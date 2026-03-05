# Cours 56 — OWASP Top 10 & Threat Modeling (STRIDE)

> **Objectif** : Connaitre les 10 vulnérabilités web les plus critiques (OWASP 2021), savoir les prevenir dans une stack React + NestJS + PostgreSQL, et appliquer le modèle STRIDE pour identifier systematiquement les menaces d'une architecture.

---

## Rappel du cours précédent

<details>
<summary>1. Qu'est-ce que le distributed locking et pourquoi Redis SETNX est-il préféré a un lock applicatif ?</summary>

Le distributed locking empeche deux instances d'un service de modifier la meme ressource en parallele. `SETNX` (SET if Not eXists) est atomique et distribue — il fonctionne meme si les instances sont sur des machines différentes. Un lock applicatif (mutex, semaphore) ne protégé qu'un seul processus. Le TTL sur la cle Redis garantit qu'un lock orphelin (crash) est automatiquement libéré.
</details>

<details>
<summary>2. Pourquoi "exactly-once delivery" est un mythe dans les systèmes distribues ?</summary>

Le réseau peut perdre des paquets ou dupliquer des ACK. On ne peut garantir que **at-most-once** (fire-and-forget) ou **at-least-once** (retry + ACK). Pour simuler exactly-once, on combine at-least-once delivery avec un **idempotent consumer** (cle d'idempotence stockee, deduplication côté recepteur). C'est exactly-once *processing*, pas exactly-once *delivery*.
</details>

---

## Analogie — Le système immunitaire

Le corps humain a un système immunitaire en couches, exactement comme la sécurité applicative :

- **La peau** = la validation d'entree — elle bloque la majorite des menaces avant qu'elles n'entrent
- **Les globules blancs** = la sanitization — ils identifient et neutralisent ce qui est passe
- **Les anticorps spécifiques** = les règles de sécurité par endpoint — chaque menace connue a sa parade
- **La fievre** = le rate limiting — ralentir tout le système pour empecher une attaque de se propager
- **La mémoire immunitaire** = le threat modeling — apres chaque incident, le système "se souvient" et reagit plus vite
- **L'auto-immunite** = le faux positif — quand la sécurité attaque les utilisateurs legitimes (trop de restrictions)

Un bon architecte, comme un bon immunologue, dose la réponse : trop faible = vulnérabilité, trop forte = application inutilisable.

---

## Théorie

### 1. OWASP Top 10 (2021) — les vulnérabilités critiques

```
┌──────────────────────────────────────────────────────────┐
│                    OWASP Top 10 (2021)                    │
│                                                           │
│  A01  Broken Access Control          ████████████  #1     │
│  A02  Cryptographic Failures         ███████████   #2     │
│  A03  Injection (SQL, XSS, CMD)      ██████████    #3     │
│  A04  Insecure Design                █████████     #4     │
│  A05  Security Misconfiguration      ████████      #5     │
│  A06  Vulnerable Components          ███████       #6     │
│  A07  Auth & Identification Failures ██████        #7     │
│  A08  Software Integrity Failures    █████         #8     │
│  A09  Logging & Monitoring Failures  ████          #9     │
│  A10  SSRF                           ███           #10    │
└──────────────────────────────────────────────────────────┘
```

### 2. IDOR — Insecure Direct Object Références (A01)

L'attaquant modifie un identifiant dans l'URL pour accéder aux données d'un autre utilisateur.

```
VULNERABLE (IDs sequentiels) :
  GET /api/invoices/42        ← Ma facture
  GET /api/invoices/43        ← Facture du voisin (devination triviale)

SECURISE (UUIDs) :
  GET /api/invoices/a3f8b2c1-7d4e-4f9a-b6e1-2c8d5f0a3e7b
                              ← Impossible a deviner
                              + verification ownership cote serveur
```

| Approche | Force | Faiblesse |
|---|---|---|
| IDs sequentiels (`1, 2, 3...`) | Simple, performant | Devinable, enumerable |
| **UUIDs v4** | 122 bits d'entropie, non devinable | 36 chars, index B-tree plus lent |
| UUIDs + ownership check | Defense en profondeur | Deux lignes de code en plus |

**Regle** : les UUIDs empechent la devination, mais **ne remplacent pas** la vérification d'ownership côté serveur.

### 3. Injection SQL (A03)

```
VULNERABLE :
  const query = `SELECT * FROM users WHERE email = '${email}'`;
  // email = "'; DROP TABLE users; --"
  // → SELECT * FROM users WHERE email = ''; DROP TABLE users; --'

SECURISE (requete parametree) :
  const query = 'SELECT * FROM users WHERE email = $1';
  // Le driver traite $1 comme une VALEUR, jamais comme du SQL
  // → Meme si email contient du SQL, il est echappe
```

### 4. XSS — Cross-Site Scripting (A03)

```
Trois types de XSS :

┌────────────────────────────────────────────────────┐
│  Stored XSS                                         │
│  Attaquant → POST "<script>steal()</script>"        │
│           → Stocke en BDD                            │
│           → Affiche a TOUS les visiteurs             │
│  (Le plus dangereux)                                 │
├────────────────────────────────────────────────────┤
│  Reflected XSS                                       │
│  Attaquant → Envoie un lien piege avec payload      │
│           → Le serveur "reflete" le payload          │
│           → Affiche au visiteur qui clique            │
├────────────────────────────────────────────────────┤
│  DOM-based XSS                                       │
│  Attaquant → Manipule le DOM via JS cote client      │
│           → innerHTML, document.write, eval()        │
│           → Pas besoin du serveur                     │
└────────────────────────────────────────────────────┘
```

**Double sanitization** — sanitizer côté serveur (DOMPurify) ET echappement côté client (React echappe par defaut, sauf `dangerouslySetInnerHTML`) :

| Couche | Outil | Ce qu'il fait |
|---|---|---|
| **Serveur (écriture)** | DOMPurify / sanitize-html | Supprime les balises dangereuses AVANT stockage |
| **Client (lecture)** | React JSX (auto-escape) | Echappe `<`, `>`, `"`, `'` dans le rendu |
| **CSP (navigateur)** | `script-src 'self'` | Bloque les scripts inline meme si XSS passe |

### 5. CSRF — Cross-Site Request Forgery (A01)

```
Attaque CSRF :

1. Victime connectee sur banque.com (cookie de session)
2. Victime visite evil.com
3. evil.com contient :
   <img src="https://banque.com/transfer?to=attacker&amount=1000">
4. Le navigateur envoie le cookie automatiquement
5. La banque execute le virement

Prevention — state param + token aleatoire :
┌──────────┐       ┌──────────┐       ┌──────────┐
│  Client   │       │  Serveur  │       │  Session  │
│           │──────>│ GET /form │──────>│ Genere    │
│           │       │           │       │ csrfToken │
│           │<──────│ <input    │<──────│ = crypto  │
│           │       │  hidden>  │       │ .getRandom│
│           │       │           │       │ Values()  │
│  POST +   │──────>│ Compare   │       │           │
│  csrfToken│       │ token     │       │           │
└──────────┘       └──────────┘       └──────────┘
```

**Regles CSRF** :
- Token généré par `crypto.getRandomValues()` (pas `Math.random()`)
- Stocke en session serveur, envoye dans un champ hidden ou header custom
- `SameSite=Lax` sur les cookies (protection par defaut des navigateurs modernes)

### 6. STRIDE — Threat Modeling systematique

STRIDE est un modèle de Microsoft pour identifier les menaces categorie par categorie :

| Lettre | Menace | Question a se poser | Controle |
|---|---|---|---|
| **S** | Spoofing (usurpation) | Qui prouve l'identité ? | Auth forte, MFA, JWT |
| **T** | Tampering (falsification) | Les données peuvent-elles etre modifiees ? | Signatures, checksums, HMAC |
| **R** | Repudiation (deni) | Peut-on nier une action ? | Audit logs, timestamps |
| **I** | Information Disclosure | Des données sensibles fuient-elles ? | Chiffrement, ACL, masquage |
| **D** | Denial of Service | Le service peut-il etre sature ? | Rate limiting, WAF, CDN |
| **E** | Elevation of Privilege | Un user peut-il devenir admin ? | RBAC, least privilege |

### 7. Data Flow Diagram et Trust Boundaries

```
┌─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─┐
│  ZONE NON FIABLE (Internet)                                │
│                                                             │
│  ┌──────────┐                                              │
│  │ Navigateur│                                              │
│  │ (React)   │                                              │
│  └─────┬─────┘                                              │
└─ ─ ─ ─│─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘
=========│=========== TRUST BOUNDARY (WAF / CDN) =============
┌─ ─ ─ ─│─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐
│  ZONE DMZ                                                   │
│  ┌─────▼─────┐       ┌──────────┐                          │
│  │  Reverse   │──────>│ NestJS   │                          │
│  │  Proxy     │       │ API      │                          │
│  │  (nginx)   │       │          │                          │
│  └───────────┘       └─────┬────┘                          │
└─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┼ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘
=============│============ TRUST BOUNDARY (VPC) ==============
┌─ ─ ─ ─ ─ ─│─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐
│  ZONE INTERNE                                               │
│  ┌─────▼────┐       ┌──────────┐       ┌──────────┐       │
│  │PostgreSQL │       │  Redis    │       │ Keycloak  │       │
│  │(donnees)  │       │ (cache)   │       │ (auth)    │       │
│  └──────────┘       └──────────┘       └──────────┘       │
└─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘

Chaque traversee de TRUST BOUNDARY = point d'inspection
```

---

## Pratique

### Prevention IDOR — UUIDs + ownership check (NestJS)

```typescript
// src/invoices/invoices.controller.ts
import { Controller, Get, Param, ForbiddenException, ParseUUIDPipe } from '@nestjs/common';
import { InvoicesService } from './invoices.service';
import { CurrentUser } from '../auth/current-user.decorator';
import { User } from '../users/user.entity';

@Controller('invoices')
export class InvoicesController {
  constructor(private readonly invoices: InvoicesService) {}

  @Get(':id')
  async findOne(
    // ParseUUIDPipe rejette tout ce qui n'est pas un UUID valide
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentUser() user: User,
  ) {
    const invoice = await this.invoices.findOneOrFail(id);

    // Meme avec un UUID, on verifie l'ownership
    if (invoice.tenantId !== user.tenantId) {
      throw new ForbiddenException('Access denied');
    }

    return invoice;
  }
}
```

### Prevention injection SQL — requêtes parametrees (TypeORM)

```typescript
// src/users/users.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly repo: Repository<User>,
  ) {}

  // SECURISE — requete parametree
  async findByEmail(email: string): Promise<User | null> {
    return this.repo.findOne({ where: { email } });
    // TypeORM genere : SELECT ... WHERE "email" = $1
    // $1 est toujours traite comme une valeur, jamais comme du SQL
  }

  // SECURISE — QueryBuilder avec parametres
  async search(term: string, tenantId: string): Promise<User[]> {
    return this.repo
      .createQueryBuilder('user')
      .where('user.tenantId = :tenantId', { tenantId })
      .andWhere('user.name ILIKE :term', { term: `%${term}%` })
      .getMany();
  }

  // DANGEREUX — ne JAMAIS faire ca
  // async searchUnsafe(term: string) {
  //   return this.repo.query(`SELECT * FROM users WHERE name LIKE '%${term}%'`);
  // }
}
```

### Prevention XSS — double sanitization

```typescript
// src/articles/sanitize.pipe.ts — sanitization cote serveur (NestJS)
import { PipeTransform, Injectable } from '@nestjs/common';
import * as DOMPurify from 'isomorphic-dompurify';

@Injectable()
export class SanitizeHtmlPipe implements PipeTransform {
  transform(value: any) {
    if (typeof value === 'string') {
      return DOMPurify.sanitize(value, {
        ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'ul', 'ol', 'li', 'br', 'h2', 'h3'],
        ALLOWED_ATTR: ['href', 'target', 'rel'],
      });
    }
    if (typeof value === 'object' && value !== null) {
      for (const key of Object.keys(value)) {
        if (typeof value[key] === 'string') {
          value[key] = DOMPurify.sanitize(value[key]);
        }
      }
    }
    return value;
  }
}

// Cote React — echappement automatique par defaut
// src/components/ArticleContent.tsx
function ArticleContent({ html }: { html: string }) {
  // React echappe par defaut : <p>{html}</p> est SAFE
  // dangerouslySetInnerHTML necessite du HTML DEJA sanitize
  return <div dangerouslySetInnerHTML={{ __html: html }} />;
  // html a ete sanitize par le serveur AVANT stockage
}
```

### Prevention CSRF — token avec crypto.getRandomValues()

```typescript
// src/csrf/csrf.service.ts
import { Injectable } from '@nestjs/common';
import { randomBytes } from 'crypto';

@Injectable()
export class CsrfService {
  generateToken(): string {
    // 32 bytes = 256 bits d'entropie — crypto-secure
    return randomBytes(32).toString('hex');
  }

  validateToken(sessionToken: string, requestToken: string): boolean {
    if (!sessionToken || !requestToken) return false;
    // Comparaison en temps constant pour eviter les timing attacks
    const a = Buffer.from(sessionToken);
    const b = Buffer.from(requestToken);
    if (a.length !== b.length) return false;
    return require('crypto').timingSafeEqual(a, b);
  }
}
```

---

## Resume

1. **IDOR** : utiliser des UUIDs v4 au lieu d'IDs sequentiels ET vérifier l'ownership côté serveur — l'UUID empeche la devination, le check empeche l'accès non autorise
2. **Injection SQL** : toujours utiliser des requêtes parametrees (`$1`, `$2`) — ne jamais concatener des valeurs dans une requête SQL
3. **XSS** : double sanitization — DOMPurify côté serveur a l'écriture, echappement React côté client a la lecture, CSP comme filet de sécurité
4. **CSRF** : token généré par `crypto.getRandomValues()` + comparaison en temps constant + `SameSite=Lax` sur les cookies
5. **STRIDE** : modèle systematique pour identifier les menaces (Spoofing, Tampering, Repudiation, Information Disclosure, DoS, Elevation) — appliquer a chaque traversee de trust boundary

---

> **Prochain cours** : [Cours 57 — Architecture Zero Trust](./02-zero-trust.md) — ou comment appliquer le principe "never trust, always verify" avec microsegmentation, mTLS et identity-based access.

---

> **Lien fil rouge — ShopArch**
>
> - Réalise le threat model STRIDE du flow checkout ShopArch
> - Identifie au moins 5 menaces et leurs mitigations pour ShopArch
> - Exercice(s) associé(s) : `exercices/37-threat-model-stride/`
> - Checkpoint : Module 08, critère 3
