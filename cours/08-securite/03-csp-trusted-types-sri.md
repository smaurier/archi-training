# Cours 58 — CSP, Trusted Types, SRI & Security Headers

> **Objectif** : Maîtriser les Content Security Policies (CSP hash-only, zero unsafe-inline), comprendre les Trusted Types, implémenter le Subresource Integrity (SRI) sur les assets tiers, et configurer l'ensemble des security headers pour une application en production.

---

## Rappel du cours précédent

<details>
<summary>1. Quelle est la différence fondamentale entre sécurité perimetrique et Zero Trust ?</summary>

La sécurité perimetrique fait confiance a tout ce qui est **a l'interieur** du réseau (firewall = mur du chateau). Le Zero Trust ne fait confiance a **rien ni personne** par defaut — chaque requête est authentifiee, autorisee et chiffree, meme entre services internes. Le principe est "assume breach" : architecturer comme si l'attaquant etait déjà dans le réseau.
</details>

<details>
<summary>2. Pourquoi utiliser du mTLS plutot que du TLS classique entre microservices ?</summary>

Le TLS classique authentifie uniquement le **serveur** (le client vérifié le certificat du serveur). Le mTLS authentifie **les deux parties** — le serveur vérifié aussi le certificat du client. En interne, cela empeche un attaquant qui serait dans le réseau de se faire passer pour un service legitime. Gere par un service mesh (Istio, Linkerd) pour éviter de gérer les certificats manuellement.
</details>

---

## Analogie — Le coffre-fort a combinaison

Les security headers fonctionnent comme un coffre-fort a combinaison :

- **CSP** = la serrure a combinaison — elle définit exactement quelles cles (scripts, styles, images) sont autorisees a tourner
- **Les hash SHA-256** = chaque cle a une empreinte unique — si quelqu'un change un seul bit du script, la cle ne rentre plus
- **Trusted Types** = un detecteur de contrefacon — il vérifié que chaque "cle" a ete fabriquee par un atelier certifie (une policy), pas par n'importe qui
- **SRI** = le sceau d'intégrité sur une livraison externe — tu verifies que le colis du fournisseur n'a pas ete ouvert en transit
- **Les autres headers** (HSTS, X-Frame-Options...) = les verrous supplementaires, l'alarme, le grillage — chaque couche ajoute un obstacle

Un seul verrou ne suffit jamais. C'est la combinaison de toutes ces protections qui rend l'attaque impraticable.

---

## Théorie

### 1. Content Security Policy (CSP) — vue d'ensemble

CSP est un header HTTP qui dit au navigateur : "n'exécuté QUE les ressources autorisees".

```
SANS CSP :
  Le navigateur execute TOUT script trouve dans la page
  → XSS : <script>steal(document.cookie)</script>  ← EXECUTE

AVEC CSP strict :
  Content-Security-Policy: script-src 'sha256-abc123...'
  → Le navigateur calcule le hash de chaque <script>
  → Si le hash ne correspond pas → BLOQUE
  → Le script XSS injecte n'a pas le bon hash → BLOQUE
```

### 2. Stratégie hash-only — zero unsafe-inline, zero unsafe-eval

| Directive CSP | Dangereux | Securise |
|---|---|---|
| `script-src` | `'unsafe-inline'` `'unsafe-eval'` | `'sha256-...'` par script |
| `style-src` | `'unsafe-inline'` | `'sha256-...'` ou `'self'` |
| `default-src` | `*` | `'none'` (puis whitelist) |
| `connect-src` | `*` | URLs API spécifiques |
| `img-src` | `*` | `'self'` + domaines CDN |

```
Strategie CSP hash-only :

Au build :
  1. Lister tous les <script> inline
  2. Calculer SHA-256 de chaque contenu
  3. Injecter les hashes dans le header CSP

A l'execution :
  Navigateur recoit :
    Content-Security-Policy:
      script-src 'sha256-K7gNU3sdo+OL0wNhqoVWhr3g6s1xYv72ol/pe/Unols='
                 'sha256-...' ;

  Pour chaque <script> :
    calcule hash → compare aux hashes declares → execute OU bloque
```

### 3. Next.js middleware — csp-hash.ts

```
Build Next.js (SSR) :
┌──────────────────┐
│  Render HTML      │
│  ┌──────────────┐ │    ┌──────────────────┐
│  │ <script>     │─┼───>│ SHA-256(contenu) │
│  │  hydration   │ │    │ = hash1          │
│  │  code        │ │    └──────────────────┘
│  └──────────────┘ │
│  ┌──────────────┐ │    ┌──────────────────┐
│  │ <script>     │─┼───>│ SHA-256(contenu) │
│  │  payload     │ │    │ = hash2          │
│  └──────────────┘ │    └──────────────────┘
│                    │
│  Header CSP :      │
│  script-src        │
│    'sha256-hash1'  │
│    'sha256-hash2'  │
└──────────────────┘
```

### 4. Trusted Types — prevenir les injections DOM

Trusted Types est une API navigateur qui **interdit** l'assignation de strings brutes aux sinks dangereux (`innerHTML`, `document.write`, `eval`).

```
SANS Trusted Types :
  element.innerHTML = userInput;  ← Autorise (XSS possible)

AVEC Trusted Types :
  element.innerHTML = userInput;  ← TypeError !
  // Il faut passer par une policy :
  const policy = trustedTypes.createPolicy('sanitize', {
    createHTML: (input) => DOMPurify.sanitize(input)
  });
  element.innerHTML = policy.createHTML(userInput);  ← OK
```

| Phase | Mode | Comportement |
|---|---|---|
| Phase 1 (actuel) | `Content-Security-Policy-Report-Only: require-trusted-types-for 'script'` | Log les violations, ne bloque pas |
| Phase 2 (futur) | `Content-Security-Policy: require-trusted-types-for 'script'` | Bloque les violations |

### 5. SRI — Subresource Integrity

SRI vérifié que les fichiers charges depuis un CDN tiers n'ont pas ete modifies :

```html
<!-- SANS SRI — si le CDN est compromis, le script malveillant s'execute -->
<script src="https://cdn.example.com/lib.js"></script>

<!-- AVEC SRI — le navigateur verifie le hash avant d'executer -->
<script
  src="https://cdn.example.com/lib.js"
  integrity="sha384-oqVuAfXRKap7fdgcCY5uykM6+R9GqQ8K/uxy9rx7HNQlGYl1kPzQho1wx4JwY8wC"
  crossorigin="anonymous"
></script>

<!-- Si le contenu change (meme 1 bit) → hash different → BLOQUE -->
```

| Attribut | Role |
|---|---|
| `integrity` | Hash SHA-256/384/512 du fichier attendu |
| `crossorigin="anonymous"` | Nécessaire pour que le navigateur puisse vérifier |

### 6. CSP violation reporting avec rate limiting

```
Navigateur                    Serveur
    │                             │
    │  CSP violation detectee     │
    │  (script bloque)            │
    │                             │
    │  POST /csp-report           │
    │  {                          │
    │    "document-uri": "...",   │
    │    "violated-directive":    │
    │      "script-src",         │
    │    "blocked-uri": "..."    │
    │  }                          │
    │────────────────────────────>│
    │                             │  Rate limit :
    │                             │  max 10 reports/min/IP
    │                             │  (eviter le flood)
    │                             │
    │                             │  Aggreger + alerter
    │                             │  si > seuil
```

**Directive CSP** : `report-uri /csp-report; report-to csp-endpoint`

### 7. Security headers complets

| Header | Valeur recommandee | Protection |
|---|---|---|
| `Content-Security-Policy` | (voir ci-dessus) | XSS, injection |
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` | Forcer HTTPS (2 ans) |
| `X-Frame-Options` | `DENY` | Clickjacking |
| `X-Content-Type-Options` | `nosniff` | MIME type sniffing |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Fuite de referrer |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=()` | APIs sensibles |
| `X-XSS-Protection` | `0` | Desactiver (le filtre XSS est dangereux) |

```
Attention : X-XSS-Protection: 0
  Contre-intuitif mais correct.
  Le filtre XSS des anciens navigateurs (Chrome < 78)
  pouvait etre EXPLOITE pour creer des XSS.
  CSP le remplace completement.
```

---

## Pratique

### Middleware Next.js — injection CSP avec hashes au build

```typescript
// middleware.ts (Next.js middleware)
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createHash } from 'crypto';

export function middleware(request: NextRequest) {
  const nonce = createHash('sha256')
    .update(crypto.randomUUID())
    .digest('base64');

  // Construire la CSP avec un nonce par requête
  const csp = [
    `default-src 'none'`,
    `script-src 'nonce-${nonce}' 'strict-dynamic'`,
    `style-src 'self'`,
    `img-src 'self' data: https://cdn.example.com`,
    `font-src 'self'`,
    `connect-src 'self' ${process.env.NEXT_PUBLIC_API_URL}`,
    `frame-ancestors 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `report-uri /api/csp-report`,
  ].join('; ');

  const response = NextResponse.next();
  response.headers.set('Content-Security-Policy', csp);

  // Passer le nonce aux Server Components via un header
  response.headers.set('x-nonce', nonce);

  return response;
}

export const config = {
  matcher: [
    // Appliquer aux pages, pas aux fichiers statiques
    { source: '/((?!_next/static|_next/image|favicon.ico).*)' },
  ],
};
```

### Endpoint de reporting CSP avec rate limiting (NestJS)

```typescript
// src/security/csp-report.controller.ts
import { Controller, Post, Body, Req, HttpCode } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';

interface CspReport {
  'csp-report': {
    'document-uri': string;
    'violated-directive': string;
    'blocked-uri': string;
    'original-policy': string;
    'source-file'?: string;
    'line-number'?: number;
  };
}

@Controller('csp-report')
export class CspReportController {
  // Rate limit : 10 reports par minute par IP
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post()
  @HttpCode(204)
  async report(@Body() body: CspReport, @Req() req: Request): Promise<void> {
    const report = body['csp-report'];

    // Logger pour monitoring (pas les donnees PII)
    console.warn('[CSP Violation]', {
      documentUri: report['document-uri'],
      violatedDirective: report['violated-directive'],
      blockedUri: report['blocked-uri'],
      sourceFile: report['source-file'],
      lineNumber: report['line-number'],
      // Ne PAS logger l'IP (GDPR)
    });

    // Alerter si le taux de violations depasse un seuil
    // (integration Prometheus/Grafana)
  }
}
```

### Middleware NestJS — tous les security headers

```typescript
// src/security/security-headers.middleware.ts
import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class SecurityHeadersMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    // HSTS — forcer HTTPS pendant 2 ans + subdomains + preload
    res.setHeader(
      'Strict-Transport-Security',
      'max-age=63072000; includeSubDomains; preload',
    );

    // Empecher le clickjacking
    res.setHeader('X-Frame-Options', 'DENY');

    // Empecher le MIME type sniffing
    res.setHeader('X-Content-Type-Options', 'nosniff');

    // Controler les informations de referrer
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

    // Desactiver le filtre XSS des anciens navigateurs (dangereux)
    res.setHeader('X-XSS-Protection', '0');

    // Restreindre les APIs sensibles du navigateur
    res.setHeader(
      'Permissions-Policy',
      'camera=(), microphone=(), geolocation=(), payment=(self)',
    );

    // CSP pour l'API (pas de scripts, juste JSON)
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'none'; frame-ancestors 'none'",
    );

    next();
  }
}
```

### Trusted Types — policy de sanitization (React)

```typescript
// src/security/trusted-types.ts
// A inclure au boot de l'application React

declare global {
  interface Window {
    trustedTypes?: {
      createPolicy: (name: string, rules: Record<string, Function>) => any;
    };
  }
}

export function initTrustedTypes(): void {
  if (!window.trustedTypes) {
    console.info('Trusted Types non supporte par ce navigateur');
    return;
  }

  // Policy par defaut — toute assignation a innerHTML/document.write
  // passe par cette policy
  window.trustedTypes.createPolicy('default', {
    createHTML: (input: string) => {
      // Utiliser DOMPurify pour sanitizer
      // En production : import DOMPurify from 'dompurify';
      // return DOMPurify.sanitize(input);
      console.warn('[TrustedTypes] HTML creation intercepted:', input.slice(0, 100));
      return input; // En report-only, on log seulement
    },
    createScriptURL: (input: string) => {
      // Bloquer les URLs de scripts non autorisees
      const allowed = [location.origin, 'https://cdn.example.com'];
      const url = new URL(input, location.origin);
      if (!allowed.some((a) => url.origin === a)) {
        throw new Error(`[TrustedTypes] Blocked script URL: ${input}`);
      }
      return input;
    },
  });
}
```

### SRI — génération des hashes au build (script npm)

```typescript
// scripts/generate-sri.ts
import { createHash } from 'crypto';
import { readFileSync } from 'fs';

function generateSriHash(filePath: string): string {
  const content = readFileSync(filePath);
  const hash = createHash('sha384').update(content).digest('base64');
  return `sha384-${hash}`;
}

// Usage dans le build pipeline
const thirdPartyAssets = [
  { file: 'node_modules/some-lib/dist/lib.min.js', url: 'https://cdn.example.com/lib.min.js' },
];

for (const asset of thirdPartyAssets) {
  const hash = generateSriHash(asset.file);
  console.log(`<script src="${asset.url}" integrity="${hash}" crossorigin="anonymous"></script>`);
}
```

---

## Resume

1. **CSP hash-only** : calculer le SHA-256 de chaque script inline au build et le déclarer dans le header CSP — zero `unsafe-inline`, zero `unsafe-eval`, chaque script est identifie par son empreinte
2. **Trusted Types** : déployer d'abord en `report-only` pour détecter les sinks dangereux (`innerHTML`, `eval`), puis enforcer — force le passage par une policy de sanitization
3. **SRI** : ajouter `integrity="sha384-..."` + `crossorigin="anonymous"` sur tous les assets tiers — le navigateur bloque le fichier si son hash ne correspond pas
4. **CSP violation reporting** : endpoint dédié avec rate limiting (10/min/IP) pour détecter les tentatives d'attaque sans se faire flooder
5. **Security headers** : HSTS (forcer HTTPS), X-Frame-Options (anti-clickjacking), X-Content-Type-Options (anti-sniffing), Referrer-Policy, Permissions-Policy — chaque header ferme un vecteur d'attaque

---

> **Prochain cours** : [Cours 59 — Rate Limiting & CORS](./04-rate-limiting-cors.md) — ou comment implémenter le sliding window rate limiting avec Redis, configurer CORS correctement, et sécuriser la supply chain.

---

> **Lien fil rouge — ShopArch**
>
> - Implémente la CSP hash-only pour ShopArch (zero `unsafe-inline`)
> - Ajoute le SRI sur les assets tiers (CDN)
> - Exercice(s) associé(s) : `exercices/39-csp-hash-only/`
> - Checkpoint : Module 08, critère 1
