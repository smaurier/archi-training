# Cours 59 — Rate Limiting & CORS

> **Objectif** : Implémenter un rate limiting en sliding window avec Redis (INCR + EXPIRE), gérer les compteurs par tenant avec des cles GDPR-safe, configurer CORS correctement (preflight, headers), et comprendre la sécurité de la supply chain (SBOM, lockfile, Sigstore).

---

## Rappel du cours précédent

<details>
<summary>1. Pourquoi utiliser des hash SHA-256 plutot que 'unsafe-inline' dans une CSP ?</summary>

`unsafe-inline` autorise TOUS les scripts inline, y compris ceux injectes par un attaquant (XSS). Avec des hashes SHA-256, le navigateur calcule l'empreinte de chaque `<script>` et la compare aux hashes declares dans la CSP. Un script XSS injecte n'aura pas son hash dans la liste → il est bloque. La CSP passe de "tout autoriser" a "autoriser exactement ces scripts".
</details>

<details>
<summary>2. Quelle est la différence entre Trusted Types en report-only et en enforcement ?</summary>

En **report-only** (`Content-Security-Policy-Report-Only`), les violations sont detectees et loguees mais pas bloquees — le code continue de fonctionner. En **enforcement** (`Content-Security-Policy`), les assignations directes aux sinks dangereux (`innerHTML`, `eval`) sont bloquees avec une `TypeError`. On deploie d'abord en report-only pour identifier tous les sinks, puis on migre vers l'enforcement quand tout passe par des Trusted Types policies.
</details>

---

## Analogie — Le peage autoroutier

Le rate limiting fonctionne comme un peage autoroutier et CORS comme la douane :

- **Le peage** = le rate limiter — il laisse passer un nombre limite de vehicules par minute, peu importe leur vitesse
- **La fenetre glissante** = la barriere qui compte les vehicules des 60 dernières secondes, pas "par tranche fixe de 60s"
- **Le ticket de peage** = le header `X-Rate-Limit-Remaining` — il te dit combien de passages il te reste
- **Les voies de peage par categorie** = les compteurs per-tenant — chaque client a son propre quota
- **Le hash de la plaque** = la cle GDPR-safe — on identifie le vehicule sans stocker la plaque en clair
- **La douane** = CORS — elle vérifié que tu viens d'un pays autorise (`Access-Control-Allow-Origin`) avant de te laisser passer
- **Le pre-controle** = la preflight request (`OPTIONS`) — la douane vérifié tes papiers AVANT que tu traverses

---

## Théorie

### 1. Rate Limiting — pourquoi et comment

```
SANS rate limiting :
  Attaquant → 10 000 req/sec → API surchargee → 503 pour tous

AVEC rate limiting (sliding window) :
  Attaquant → 10 000 req/sec → 100 passent, 9 900 recoivent 429
  Utilisateurs normaux → continuent a utiliser l'API normalement
```

### 2. Fixed window vs Sliding window

```
FIXED WINDOW (probleme du burst au bord) :

  Fenetre 1 (00:00-01:00)     Fenetre 2 (01:00-02:00)
  ─────────────────────────    ─────────────────────────
  .....              [100req]  [100req]...............
                     ↑ 00:59   ↑ 01:00
                     200 requetes en 2 secondes !

  Limite = 100/min, mais un burst de 200 en 2s est possible
  au changement de fenetre.

SLIDING WINDOW :

  Fenetre glissante = "les 60 dernieres secondes"
  ──────────────────────────────────────────
  A chaque requete : compter les req des 60 dernieres sec
  → Jamais plus de 100 dans n'importe quelle fenetre de 60s
  → Pas de burst au bord
```

| Algorithme | Precision | Mémoire | Complexite |
|---|---|---|---|
| Fixed window | Faible (burst) | O(1) par cle | Simple |
| **Sliding window log** | Exacte | O(n) par cle | Couteux |
| **Sliding window counter** | Bonne approximation | O(1) par cle | **Optimal** |
| Token bucket | Bonne | O(1) par cle | Moyen |
| Leaky bucket | Lissage | O(1) par cle | Moyen |

### 3. Redis INCR + EXPIRE — implémentation sliding window counter

```
Cle Redis : rate:{tenant}:{sha256(ip+pepper)}:{window}

Algorithme :
  1. window_current = floor(timestamp / 60)
  2. window_previous = window_current - 1
  3. count_previous = GET rate:...:window_previous (ou 0)
  4. count_current = INCR rate:...:window_current
  5. EXPIRE rate:...:window_current 120  (2 fenetres)
  6. weight = 1 - (timestamp % 60) / 60
  7. total = count_previous * weight + count_current
  8. Si total > limit → 429 Too Many Requests

Exemple :
  timestamp = 90s (1min30)
  window_current = 1, window_previous = 0
  count_previous = 80, count_current = 30
  weight = 1 - (90 % 60) / 60 = 1 - 0.5 = 0.5
  total = 80 * 0.5 + 30 = 70  → OK (< 100)
```

### 4. Cles GDPR-safe — SHA-256(IP + pepper)

Stocker des IPs en clair dans Redis viole le RGPD (donnée personnelle). Solution :

```
IP brute :         192.168.1.42
Pepper (secret) :  s3cr3t_p3pp3r_r0tat3d_m0nthly

Hash :  SHA-256("192.168.1.42" + "s3cr3t_p3pp3r_r0tat3d_m0nthly")
      = "a7f3b2c1d4e5f6..."

→ Impossible de retrouver l'IP depuis le hash
→ Le meme IP + pepper donne toujours le meme hash (comptage OK)
→ Rotation mensuelle du pepper = les anciens compteurs expirent
```

| Approche | GDPR-safe | Comptage fiable | Reversible |
|---|---|---|---|
| IP en clair | Non | Oui | Oui (problème) |
| **SHA-256(IP + pepper)** | **Oui** | Oui | Non (bien) |
| Pas d'IP du tout | Oui | Non (pas de compteur) | N/A |

### 5. Headers X-Rate-Limit-*

```
HTTP/1.1 200 OK
X-Rate-Limit-Limit: 100        ← Quota total par fenetre
X-Rate-Limit-Remaining: 67     ← Requetes restantes
X-Rate-Limit-Reset: 1709420400 ← Timestamp reset (epoch)
Retry-After: 23                 ← Secondes avant retry (si 429)

HTTP/1.1 429 Too Many Requests
X-Rate-Limit-Limit: 100
X-Rate-Limit-Remaining: 0
X-Rate-Limit-Reset: 1709420400
Retry-After: 23
Content-Type: application/json
{
  "error": "rate_limit_exceeded",
  "message": "Too many requests. Retry after 23 seconds."
}
```

### 6. CORS — Cross-Origin Resource Sharing

```
MEME ORIGINE (Same-Origin Policy) :
  https://app.example.com → https://app.example.com/api  ← OK

CROSS-ORIGIN (bloque par defaut) :
  https://app.example.com → https://api.example.com     ← BLOQUE
  (protocole, domaine OU port different = cross-origin)

CORS autorise les requetes cross-origin de maniere controlee :

  Navigateur                        Serveur
      │                                │
      │  Requete simple (GET)          │
      │  Origin: https://app.example   │
      │───────────────────────────────>│
      │                                │
      │  Access-Control-Allow-Origin:  │
      │  https://app.example.com       │
      │<───────────────────────────────│
      │  ← OK, le navigateur autorise  │

  Requete complexe (POST + JSON) :
      │                                │
      │  OPTIONS (preflight)           │
      │  Origin: https://app.example   │
      │  Access-Control-Request-Method:│
      │    POST                        │
      │  Access-Control-Request-Headers│
      │    Content-Type, Authorization │
      │───────────────────────────────>│
      │                                │
      │  Access-Control-Allow-Origin:  │
      │    https://app.example.com     │
      │  Access-Control-Allow-Methods: │
      │    GET, POST, PUT, DELETE      │
      │  Access-Control-Allow-Headers: │
      │    Content-Type, Authorization │
      │  Access-Control-Max-Age: 3600  │
      │<───────────────────────────────│
      │                                │
      │  POST /api/articles (requete)  │
      │───────────────────────────────>│
```

| Header CORS | Role | Exemple |
|---|---|---|
| `Access-Control-Allow-Origin` | Origines autorisees | `https://app.example.com` (JAMAIS `*` avec credentials) |
| `Access-Control-Allow-Methods` | Méthodes HTTP autorisees | `GET, POST, PUT, DELETE` |
| `Access-Control-Allow-Headers` | Headers custom autorises | `Content-Type, Authorization, X-Tenant-ID` |
| `Access-Control-Allow-Credentials` | Autoriser les cookies | `true` (nécessité une origine spécifique) |
| `Access-Control-Max-Age` | Cache du preflight (secondes) | `3600` (1h) |
| `Access-Control-Expose-Headers` | Headers lisibles par le JS | `X-Rate-Limit-Remaining` |

### 7. Supply chain security

```
Chaine d'approvisionnement logicielle :

  Open Source           Build             Production
  ┌──────────┐       ┌──────────┐       ┌──────────┐
  │ npm       │──────>│ npm ci   │──────>│ Deploy   │
  │ registry  │       │ (lock)   │       │          │
  └──────────┘       └──────────┘       └──────────┘
       ↑                    ↑                  ↑
   Attaque :           Attaque :          Attaque :
   typosquatting       lockfile tamper    image tamper
   malicious pkg       dep confusion
```

| Menace | Protection | Outil |
|---|---|---|
| Package malveillant | `npm audit`, `Socket.dev` | SBOM (Software Bill of Materials) |
| Lockfile modifie | `npm ci` (pas `npm install`) | Lockfile integrity check |
| Image Docker modifiee | Signature des images | **Sigstore** (cosign) |
| Typosquatting | Scope packages (`@org/pkg`) | Review manuelle |
| Dep confusion | Registry scope interne | `.npmrc` configuration |

---

## Pratique

### Rate limiter NestJS avec Redis (sliding window)

```typescript
// src/security/rate-limiter.service.ts
import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import Redis from 'ioredis';

interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;    // epoch seconds
  retryAfter: number; // seconds
}

@Injectable()
export class RateLimiterService {
  private readonly redis = new Redis(process.env.REDIS_URL);
  private readonly pepper = process.env.RATE_LIMIT_PEPPER!;

  /**
   * Sliding window counter rate limiting
   * GDPR-safe : IP hashee avec pepper, jamais stockee en clair
   */
  async check(
    ip: string,
    tenantId: string,
    limit = 100,
    windowSec = 60,
  ): Promise<RateLimitResult> {
    const now = Math.floor(Date.now() / 1000);
    const currentWindow = Math.floor(now / windowSec);
    const previousWindow = currentWindow - 1;

    // Cle GDPR-safe : hash de l'IP, pas l'IP en clair
    const ipHash = createHash('sha256')
      .update(ip + this.pepper)
      .digest('hex')
      .slice(0, 16); // Tronquer pour economiser la memoire Redis

    const keyPrefix = `rate:${tenantId}:${ipHash}`;
    const keyCurrent = `${keyPrefix}:${currentWindow}`;
    const keyPrevious = `${keyPrefix}:${previousWindow}`;

    // Pipeline Redis pour atomicite
    const pipeline = this.redis.pipeline();
    pipeline.get(keyPrevious);
    pipeline.incr(keyCurrent);
    pipeline.expire(keyCurrent, windowSec * 2); // TTL = 2 fenetres

    const results = await pipeline.exec();
    const countPrevious = parseInt((results![0][1] as string) || '0', 10);
    const countCurrent = results![1][1] as number;

    // Poids de la fenetre precedente (interpolation lineaire)
    const elapsed = now % windowSec;
    const weight = 1 - elapsed / windowSec;
    const total = Math.floor(countPrevious * weight) + countCurrent;

    const resetAt = (currentWindow + 1) * windowSec;
    const remaining = Math.max(0, limit - total);
    const retryAfter = total > limit ? resetAt - now : 0;

    return {
      allowed: total <= limit,
      limit,
      remaining,
      resetAt,
      retryAfter,
    };
  }
}
```

### Guard NestJS — injecter les headers X-Rate-Limit-*

```typescript
// src/security/rate-limit.guard.ts
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { RateLimiterService } from './rate-limiter.service';

@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(private readonly limiter: RateLimiterService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    const res = context.switchToHttp().getResponse<Response>();

    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const tenantId = (req.headers['x-tenant-id'] as string) || 'default';

    const result = await this.limiter.check(ip, tenantId);

    // Toujours envoyer les headers, meme si autorise
    res.setHeader('X-Rate-Limit-Limit', result.limit);
    res.setHeader('X-Rate-Limit-Remaining', result.remaining);
    res.setHeader('X-Rate-Limit-Reset', result.resetAt);

    if (!result.allowed) {
      res.setHeader('Retry-After', result.retryAfter);
      throw new HttpException(
        {
          error: 'rate_limit_exceeded',
          message: `Too many requests. Retry after ${result.retryAfter} seconds.`,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }
}
```

### Configuration CORS — NestJS (pattern nelmio/cors)

```typescript
// src/main.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // CORS — whitelist explicite, jamais '*' avec credentials
  const allowedOrigins = (process.env.CORS_ORIGINS || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  app.enableCors({
    origin: (origin, callback) => {
      // Autoriser les requetes sans origin (curl, postman, server-to-server)
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      callback(new Error(`Origin ${origin} not allowed by CORS`));
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Tenant-ID',
      'X-Request-ID',
    ],
    exposedHeaders: [
      'X-Rate-Limit-Limit',
      'X-Rate-Limit-Remaining',
      'X-Rate-Limit-Reset',
    ],
    credentials: true,
    maxAge: 3600,    // Cache preflight 1h
  });

  await app.listen(3000);
}
bootstrap();
```

### Lockfile integrity check (CI)

```typescript
// scripts/verify-lockfile.ts
import { readFileSync } from 'fs';
import { createHash } from 'crypto';

/**
 * Verifier que package-lock.json n'a pas ete modifie
 * sans que package.json change aussi.
 * Empeche les attaques par lockfile tampering.
 */
function verifyLockfileIntegrity(): void {
  const lockfile = JSON.parse(readFileSync('package-lock.json', 'utf-8'));

  // Verifier que chaque package a une integrity hash
  const packages = lockfile.packages || {};
  const missing: string[] = [];

  for (const [name, meta] of Object.entries(packages) as [string, any][]) {
    if (name === '') continue; // Root package
    if (!meta.integrity) {
      missing.push(name);
    }
  }

  if (missing.length > 0) {
    console.error('Packages without integrity hash:');
    missing.forEach((p) => console.error(`  - ${p}`));
    process.exit(1);
  }

  console.log(`All ${Object.keys(packages).length} packages have integrity hashes.`);
}

verifyLockfileIntegrity();
```

---

## Resume

1. **Sliding window counter** : interpolation entre fenetre courante et précédente via Redis INCR + EXPIRE — pas de burst au bord de fenetre, O(1) mémoire par cle
2. **Cles GDPR-safe** : `SHA-256(IP + pepper)` au lieu d'IP en clair — le pepper est un secret serveur rotate mensuellement, le hash est irreversible
3. **Headers X-Rate-Limit-*** : toujours envoyer `Limit`, `Remaining`, `Reset` — le client peut adapter son comportement sans deviner (et `Retry-After` sur les 429)
4. **CORS** : whitelist explicite des origines, jamais `*` avec credentials, `Access-Control-Max-Age` pour éviter les preflight repetitifs, `exposedHeaders` pour rendre les rate-limit headers lisibles par le JS
5. **Supply chain** : `npm ci` (pas `install`) pour respecter le lockfile, vérifier les integrity hashes, signer les images Docker avec Sigstore, générer un SBOM pour auditer les dépendances

---

> **Prochain cours** : [Cours 60 — Sandboxing & Extension Security](./05-sandboxing-extensions.md) — ou comment isoler les extensions tierces avec des iframes sandboxed, Shadow DOM, postMessage et des guardrails CSS.

---

> **Lien fil rouge — ShopArch**
>
> - Implémente le rate limiting sur l'API ShopArch (100 req/min par IP, 20 req/min sur /auth)
> - Configure CORS pour autoriser uniquement les domaines ShopArch
> - Exercice(s) associé(s) : `exercices/38-securiser-api/`
> - Checkpoint : Module 08, critère 2
