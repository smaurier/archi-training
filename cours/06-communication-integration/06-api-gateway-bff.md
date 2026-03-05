# Cours 48 — API Gateway & BFF

> **Objectif** : Comprendre les patterns API Gateway et Backend-for-Frontend (BFF), savoir quand les utiliser, et maîtriser le service mesh pour la communication inter-services.

---

## Rappel du cours précédent

<details>
<summary>1. Comment sécuriser un webhook avec HMAC-SHA256 ?</summary>

Le serveur généré une signature `HMAC-SHA256(secret, body)` et l'envoie dans le header `X-Webhook-Signature`. Le recepteur recalcule la signature avec le meme secret et compare. Si les signatures correspondent, le message est authentique et n'a pas ete altere. Utiliser `crypto.timingSafeEqual()` pour la comparaison (éviter les timing attacks).
</details>

<details>
<summary>2. Pourquoi auto-désactiver un webhook apres 10 echecs consecutifs ?</summary>

Pour éviter de surcharger le système avec des retries inutiles vers un endpoint mort. Apres 10 echecs, le webhook est désactivé et l'administrateur est notifie. Il pourra le reactiver manuellement apres avoir corrige le problème côté recepteur.
</details>

---

## Analogie — Le concierge d'hotel vs l'agent de voyage personnel

- **API Gateway** = le concierge de l'hotel. Il est a l'entree, oriente chaque visiteur vers le bon service (routing), vérifié les cartes d'accès (auth), et limite le nombre de visiteurs par heure (rate limiting). Il ne fait pas le travail lui-meme — il délégué.
- **BFF** = l'agent de voyage personnel. Il connait les besoins spécifiques de SON client (le front-end). Il prepare des "packages" adaptes : pour le mobile, il agrege les données en une seule requête ; pour le web, il garde les tokens d'auth côté serveur. Chaque type de client a son propre agent.

---

## Théorie

### 1. API Gateway — le point d'entree unique

```
┌──────────┐     ┌──────────────────┐     ┌──────────────┐
│  Client   │────>│   API Gateway    │────>│  Service A   │
│  (Web)    │     │                  │────>│  Service B   │
│  (Mobile) │     │  - Routing       │────>│  Service C   │
│  (Tiers)  │     │  - Auth (JWT)    │     └──────────────┘
└──────────┘     │  - Rate limiting │
                  │  - Response cache│
                  │  - Request log   │
                  └──────────────────┘
```

| Responsabilite | Description |
|---|---|
| **Routing** | Diriger `/api/products` vers le service Catalog, `/api/orders` vers le service Order |
| **Auth** | Valider le JWT, extraire le tenant, injecter les headers |
| **Rate limiting** | Limiter les requêtes par IP/tenant/API key |
| **Response aggregation** | Combiner les réponses de plusieurs services en une seule |
| **Protocol translation** | HTTP externe → gRPC interne |
| **Caching** | Cache des réponses publiques (catalogue) |
| **Request/Response transform** | Ajouter des headers, transformer le format |

### 2. BFF — un backend par type de client

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  Web SPA     │────>│  Web BFF     │────>│              │
└──────────────┘     │  (Next.js)   │     │              │
                      └──────────────┘     │   Backend    │
┌──────────────┐     ┌──────────────┐     │   Services   │
│  Mobile App  │────>│  Mobile BFF  │────>│              │
└──────────────┘     │  (Node.js)   │     │              │
                      └──────────────┘     └──────────────┘
```

**Pourquoi un BFF ?**

| Problème | Solution BFF |
|---|---|
| Tokens JWT exposes côté client (XSS) | Le BFF garde les tokens server-side, le client utilise un cookie httpOnly |
| Le mobile a besoin d'une réponse agregee (1 requête = 3 services) | Le BFF agrege |
| Le web a besoin de SSR | Le BFF fait le SSR et sert le HTML |
| Chaque client a des besoins de données différents | Chaque BFF adapte la réponse |

### 3. BFF pour l'authentification

```
Client (SPA)              BFF (Next.js API route)           Keycloak
─────────────              ─────────────────────            ────────
POST /bff/login            POST /token
{ code, redirect_uri } ──> { grant_type: auth_code,   ──> Validate
                             code, redirect_uri,
                             client_secret }
                           <── { access_token, refresh }

                           Set-Cookie: session=encrypted(tokens)
                           httpOnly, Secure, SameSite=Strict
<── 200 OK (no tokens!)

GET /bff/api/products      GET /api/products
Cookie: session=... ────>  Authorization: Bearer {access_token}
                           (le BFF injecte le token depuis la session)
                           <── { products: [...] }
<── { products: [...] }
```

Le client ne voit **jamais** le JWT — il n'utilise qu'un cookie httpOnly.

### 4. API Gateway vs BFF

| Critère | API Gateway | BFF |
|---|---|---|
| **Responsabilite** | Cross-cutting (routing, auth, rate limit) | Client-specific (agregation, SSR, auth tokens) |
| **Nombre** | 1 pour toute l'infra | 1 par type de client |
| **Logique métier** | Aucune | Legere (agregation, transformation) |
| **Technologie** | Kong, Traefik, AWS API Gateway | Next.js API routes, Express, NestJS |
| **Déploiement** | Infrastructure | Avec le front-end |

### 5. Service Mesh

Pour la communication inter-services dans un cluster Kubernetes :

```
┌──────────────────────────────┐
│         Service A             │
│  ┌─────────┐  ┌───────────┐ │
│  │  App    │──│  Sidecar  │─┼──── mTLS ────┐
│  │  code   │  │  (Envoy)  │ │              │
│  └─────────┘  └───────────┘ │              │
└──────────────────────────────┘              │
                                              │
┌──────────────────────────────┐              │
│         Service B             │              │
│  ┌─────────┐  ┌───────────┐ │              │
│  │  App    │──│  Sidecar  │─┼──────────────┘
│  │  code   │  │  (Envoy)  │ │
│  └─────────┘  └───────────┘ │
└──────────────────────────────┘
```

Le **sidecar proxy** (Envoy) géré automatiquement :
- **mTLS** entre services (encryption transparente)
- **Retry + circuit breaker** (résilience)
- **Observabilite** (metriques, traces, logs)
- **Traffic management** (canary, blue/green)

Technologies : **Istio**, **Linkerd**, **Consul Connect**.

---

## Pratique

### BFF avec Next.js API Routes

```typescript
// app/api/bff/products/route.ts (Next.js App Router)
import { cookies } from 'next/headers';
import { decrypt } from '@/lib/session';

export async function GET(request: Request) {
  // 1. Recuperer la session depuis le cookie httpOnly
  const sessionCookie = cookies().get('session');
  if (!sessionCookie) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 2. Decrypter pour obtenir le JWT
  const session = decrypt(sessionCookie.value);
  if (!session || session.expiresAt < Date.now()) {
    // Token expire → essayer le refresh
    const refreshed = await refreshTokens(session.refreshToken);
    if (!refreshed) {
      return Response.json({ error: 'Session expired' }, { status: 401 });
    }
    // Mettre a jour le cookie avec les nouveaux tokens
    cookies().set('session', encrypt(refreshed), {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60, // 7 jours
    });
    session.accessToken = refreshed.accessToken;
  }

  // 3. Appeler l'API avec le JWT (invisible pour le client)
  const url = new URL(request.url);
  const apiUrl = `${process.env.API_URL}/products${url.search}`;

  const response = await fetch(apiUrl, {
    headers: {
      Authorization: `Bearer ${session.accessToken}`,
      'X-Tenant-Id': session.tenantId,
    },
  });

  // 4. Relayer la reponse (sans le JWT)
  const data = await response.json();
  return Response.json(data, { status: response.status });
}
```

### API Gateway config (Traefik)

```yaml
# traefik.yml — routing et middleware
http:
  routers:
    catalog-router:
      rule: "PathPrefix(`/api/products`) || PathPrefix(`/api/categories`)"
      service: catalog-service
      middlewares:
        - rate-limit
        - jwt-auth

    order-router:
      rule: "PathPrefix(`/api/orders`)"
      service: order-service
      middlewares:
        - rate-limit
        - jwt-auth

  middlewares:
    rate-limit:
      rateLimit:
        average: 100
        burst: 50
        period: 1m

    jwt-auth:
      forwardAuth:
        address: "http://auth-service:3000/verify"
        authResponseHeaders:
          - X-User-Id
          - X-Tenant-Id
          - X-User-Roles

  services:
    catalog-service:
      loadBalancer:
        servers:
          - url: "http://catalog:3001"
    order-service:
      loadBalancer:
        servers:
          - url: "http://order:3002"
```

### Response aggregation dans le BFF

```typescript
// Le mobile a besoin de la page d'accueil en UNE requete
// app/api/bff/home/route.ts
export async function GET() {
  const session = await getSession();
  const headers = { Authorization: `Bearer ${session.accessToken}` };

  // Lancer les 3 requetes en parallele
  const [featured, categories, cart] = await Promise.all([
    fetch(`${API_URL}/products?featured=true&limit=10`, { headers }).then(r => r.json()),
    fetch(`${API_URL}/categories?limit=20`, { headers }).then(r => r.json()),
    fetch(`${API_URL}/cart`, { headers }).then(r => r.json()).catch(() => null),
  ]);

  // Agreger en une seule reponse adaptee au mobile
  return Response.json({
    featured: featured['hydra:member'],
    categories: categories['hydra:member'],
    cartCount: cart?.items?.length ?? 0,
  });
}
```

---

## Resume

1. **API Gateway** : point d'entree unique pour routing, auth, rate limiting, caching — pas de logique métier
2. **BFF** : un backend par type de client — garde les tokens server-side, agrege les réponses, fait le SSR
3. **Le client ne voit jamais le JWT** — le BFF utilise un cookie `httpOnly + Secure + SameSite=Strict`
4. **Service Mesh** (Istio/Linkerd) : mTLS transparent, retry, circuit breaker, observabilité — via sidecar proxy
5. **API Gateway ≠ BFF** : le gateway est infrastructure (1 pour tous), le BFF est applicatif (1 par client)

---

> **Prochain cours** : [Cours 49 — Théorie des systèmes distribues](../07-patterns-distribues/01-théorie-systèmes-distribues.md) — ou comment comprendre le theoreme CAP, PACELC et les modèles de consistance.

---

> **Lien fil rouge — ShopArch**
>
> - Implémente le BFF ShopArch qui agrège catalogue + panier + promos en un appel
> - Le BFF gère les auth tokens côté serveur (pas de token dans le localStorage)
> - Exercice(s) associé(s) : `exercices/31-bff-ecommerce/`
> - Checkpoint : Module 06, critère 3
