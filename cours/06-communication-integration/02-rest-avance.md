# Cours 44 — REST avance

> **Objectif** : Maîtriser HATEOAS et la découverte d'API, le versioning par URL, les headers de deprecation, la pagination cursor vs offset, les ETags conditionnels, le header Vary, la content negotiation (JSON-LD, Hydra), et la gouvernance API.

---

## Rappel du cours précédent

<details>
<summary>1. Pourquoi HTTP/3 utilise-t-il UDP au lieu de TCP ?</summary>

TCP impose un **head-of-line blocking** au niveau transport : si un seul paquet est perdu, toutes les streams HTTP/2 multiplexees sur cette connexion attendent la retransmission. QUIC (base sur UDP) géré ses propres streams independamment — une perte sur le stream 3 ne bloque pas les streams 1, 2, 4. En bonus, le handshake QUIC intégré TLS 1.3, permettant un 0-RTT pour les reconnexions.
</details>

<details>
<summary>2. Quelle est la différence entre SSE et WebSocket ?</summary>

**SSE** (Server-Sent Events) est unidirectionnel serveur vers client, utilise HTTP standard (`text/event-stream`), supporte la reconnexion automatique native, et passe les proxies/CDN sans problème. **WebSocket** est bidirectionnel, utilise un protocole propre apres un upgrade HTTP, nécessité une gestion manuelle de la reconnexion, mais permet au client d'envoyer des messages au serveur. SSE pour les notifications/flux, WebSocket pour le chat/collaboration.
</details>

---

## Analogie — Le menu avec versions saisonnieres

Un restaurant gastronomique géré son menu comme une API :

- **HATEOAS** = chaque plat du menu indique les actions possibles : "peut etre accompagne de...", "voir aussi le dessert assorti". Le client decouvre les possibilités en lisant le menu, sans avoir a connaitre la cuisine.
- **Versioning /v1/** = le menu d'ete (v1) coexiste avec le menu d'hiver (v2). Les habitues peuvent encore commander les plats du menu d'ete pendant la transition, mais un panneau indique "menu ete disponible jusqu'au 30 septembre".
- **Deprecation header** = le petit asterisque a côté d'un plat : "* Ce plat sera retire le mois prochain. Essayez plutot le nouveau plat a la page 3."
- **ETag** = le numéro de version du plat. Si tu reviens et que le plat n'a pas change (meme numéro), le serveur dit "c'est le meme, pas besoin de te le re-decrire".
- **Pagination cursor** = au lieu de dire "donnez-moi la page 12 du menu de 200 plats", tu dis "donnez-moi les 20 plats apres le dernier que j'ai vu". Meme si le chef ajoute des plats entre-temps, tu ne rates rien et tu ne vois pas de doublons.

---

## Théorie

### 1. HATEOAS — Hypermedia as the Engine of Application State

HATEOAS signifie que l'API guide le client vers les actions possibles via des liens dans la réponse. Le client n'a pas besoin de construire les URL lui-meme.

```json
{
  "@context": "/contexts/Article",
  "@id": "/api/articles/550e8400-e29b-41d4-a716-446655440000",
  "@type": "Article",
  "title": { "fr": "Mon article", "en": "My article" },
  "status": "draft",
  "_links": {
    "self":    { "href": "/api/articles/550e8400" },
    "publish": { "href": "/api/articles/550e8400/publish", "method": "POST" },
    "edit":    { "href": "/api/articles/550e8400",         "method": "PUT" },
    "delete":  { "href": "/api/articles/550e8400",         "method": "DELETE" },
    "author":  { "href": "/api/users/a1b2c3d4" },
    "collection": { "href": "/api/articles" }
  }
}
```

| Niveau Richardson | Description | Exemple |
|---|---|---|
| **Niveau 0** | Un seul endpoint, tout en POST | SOAP, XML-RPC |
| **Niveau 1** | Ressources individuelles | `/articles/42`, `/users/7` |
| **Niveau 2** | Verbes HTTP corrects | GET pour lire, POST pour créer, DELETE pour supprimer |
| **Niveau 3** | HATEOAS — hypermedia links | `_links` dans chaque réponse |

### 2. URL versioning et deprecation

```
URL Versioning Strategy

  /api/v1/articles          ← Version actuelle (stable)
  /api/v2/articles          ← Nouvelle version (breaking changes)
  /api/v1/articles (sunset) ← Depreciee, sera supprimee le 2026-09-01
```

| Stratégie | Format | Avantage | Inconvenient |
|---|---|---|---|
| **URL path** | `/v1/articles` | Visible, simple, cacheable | Duplication des routes |
| **Header** | `Accept: application/vnd.api.v2+json` | URL stable | Invisible, pas cacheable par CDN |
| **Query param** | `/articles?version=2` | Simple | Polluant, pas semantique |

**Recommandation** : URL path (`/v1/`) pour les API publiques, header pour les API internes.

Headers de deprecation (RFC 8594) :

```
HTTP/1.1 200 OK
Deprecation: Sun, 01 Sep 2026 00:00:00 GMT
Sunset: Mon, 01 Dec 2026 00:00:00 GMT
Link: </api/v2/articles>; rel="successor-version"
```

| Header | Role |
|---|---|
| **Deprecation** | Date a partir de laquelle l'endpoint est considere deprecie |
| **Sunset** | Date a partir de laquelle l'endpoint sera supprime |
| **Link rel="successor-version"** | URL de la nouvelle version |

### 3. ETag conditionnel — If-Match vs If-None-Match

Deux usages distincts du meme mecanisme :

```
If-None-Match (lecture — cache validation)

  Client                          Serveur
    │                                │
    │── GET /articles/42 ─────────>│
    │<── 200 OK, ETag: "v5" ───────│
    │                                │
    │  [... plus tard ...]           │
    │                                │
    │── GET /articles/42 ─────────>│
    │   If-None-Match: "v5"          │
    │<── 304 Not Modified ──────────│  (pas de body — economie bande passante)


If-Match (ecriture — optimistic locking)

    │── PUT /articles/42 ─────────>│
    │   If-Match: "v5"               │
    │   Body: { title: "Updated" }   │
    │                                │
    │  Si version == v5 :            │
    │<── 200 OK, ETag: "v6" ────────│
    │                                │
    │  Si version != v5 :            │
    │<── 412 Precondition Failed ───│
```

| Header | Direction | But | Code erreur |
|---|---|---|---|
| **If-None-Match** | GET (lecture) | "Renvoie-moi le contenu seulement s'il a change" | 304 Not Modified |
| **If-Match** | PUT/PATCH (écriture) | "Accepte ma modification seulement si personne n'a modifie entre-temps" | 412 Precondition Failed |

### 4. Pagination — cursor vs offset

```
Offset-based (classique mais fragile) :

  GET /articles?page=3&limit=20
  → SELECT * FROM articles ORDER BY created_at DESC LIMIT 20 OFFSET 40

  Probleme : si 5 articles sont ajoutes entre page 2 et page 3,
  on voit des doublons ou on rate des items.

  Performance : OFFSET 10000 → la DB scanne 10020 lignes pour en retourner 20.


Cursor-based (stable et performant) :

  GET /articles?after=2026-01-15T10:30:00Z&limit=20
  → SELECT * FROM articles
    WHERE created_at < '2026-01-15T10:30:00Z'
    ORDER BY created_at DESC
    LIMIT 20

  Pas d'OFFSET → performance constante O(limit).
  Pas de doublons meme si des articles sont ajoutes entre les pages.
```

| Critère | Offset | Cursor |
|---|---|---|
| **"Aller a la page 7"** | Oui (trivial) | Non (on ne peut que "page suivante") |
| **Performance sur grandes tables** | Degrade (O(offset + limit)) | Constante (O(limit)) |
| **Stabilite (insertion entre pages)** | Doublons possibles | Aucun doublon |
| **Cas d'usage** | Back-office, tables admin | Front-office, scroll infini, API publique |

**Cap serveur** : toujours limiter `limit` côté serveur (max 24 items). Ne jamais faire confiance au client.

```json
{
  "data": [ /* 20 articles */ ],
  "meta": {
    "hasNextPage": true,
    "endCursor": "2026-01-15T10:30:00Z",
    "total": 1542
  },
  "links": {
    "next": "/api/articles?after=2026-01-15T10:30:00Z&limit=20",
    "self": "/api/articles?limit=20"
  }
}
```

### 5. Vary header

Le header `Vary` indique aux caches (CDN, navigateur) quels headers de requête influencent la réponse :

```
# La reponse change selon la langue et l'encodage
Vary: Accept-Language, Accept-Encoding

# La reponse change selon le tenant
Vary: X-Tenant-ID

# ATTENTION : Vary: Cookie tue le cache CDN
# (chaque utilisateur a un cookie different → aucun cache partage)
```

| Vary | Effet sur le cache |
|---|---|
| `Vary: Accept-Encoding` | Cache une version gzip et une version br séparément |
| `Vary: Accept-Language` | Cache une version par langue |
| `Vary: X-Tenant-ID` | Cache par tenant (utile multi-tenant) |
| `Vary: Cookie` | Cache par utilisateur — a éviter sur un CDN (aucun hit) |
| `Vary: Authorization` | Pas de cache partage — chaque token est unique |

### 6. Content negotiation (JSON-LD, Hydra)

Le client negocie le format de réponse via le header `Accept` :

```
Client → Serveur :
  Accept: application/ld+json   → JSON-LD + Hydra (API Platform)
  Accept: application/json      → JSON simple
  Accept: text/html             → Page HTML (documentation)
  Accept: text/csv              → Export CSV

Serveur → Client :
  Content-Type: application/ld+json
```

```json
{
  "@context": "/contexts/Article",
  "@id": "/api/articles",
  "@type": "hydra:Collection",
  "hydra:totalItems": 42,
  "hydra:member": [
    {
      "@id": "/api/articles/550e8400",
      "@type": "Article",
      "title": { "fr": "Mon article" }
    }
  ],
  "hydra:view": {
    "@id": "/api/articles?page=1",
    "hydra:first": "/api/articles?page=1",
    "hydra:last": "/api/articles?page=3",
    "hydra:next": "/api/articles?page=2"
  }
}
```

### 7. API governance

| Pratique | Description |
|---|---|
| **Style guide** | Conventions nommage (snake_case vs camelCase), structure erreurs, pagination |
| **Changelog** | Chaque version documentee avec les breaking changes |
| **Backward compatibility** | Ajouter des champs : OK. Supprimer/renommer : breaking change |
| **Contract testing** | Tests qui verifient que le schema de réponse n'a pas change (Pact, Dredd) |
| **API linting** | Spectral / Redocly pour valider l'OpenAPI spec automatiquement en CI |
| **Deprecation policy** | Minimum 3 mois entre deprecation et suppression |

---

## Pratique

### Controller NestJS avec cursor pagination et ETag

```typescript
import {
  Controller, Get, Query, Headers, Res, Param,
  ParseUUIDPipe, HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';

interface CursorPaginationDto {
  after?: string;   // ISO date string ou UUID du dernier element
  limit?: number;
}

@Controller('v1/articles')
export class ArticleV1Controller {
  constructor(
    private readonly listArticles: ListArticlesUseCase,
    private readonly getArticle: GetArticleUseCase,
  ) {}

  // GET /v1/articles?after=2026-01-15T10:30:00Z&limit=20
  @Get()
  async list(
    @Query('after') after?: string,
    @Query('limit') limit: number = 20,
    @Headers('accept') accept?: string,
  ) {
    const safeLimit = Math.min(Math.max(limit, 1), 24); // Cap serveur

    const result = await this.listArticles.execute({
      cursor: after ? new Date(after) : undefined,
      limit: safeLimit,
    });

    // Format HATEOAS
    return {
      data: result.items.map((a) => ({
        ...ArticleReadDto.fromDomain(a),
        _links: {
          self: { href: `/v1/articles/${a.id.value}` },
          publish: a.canPublish()
            ? { href: `/v1/articles/${a.id.value}/publish`, method: 'POST' }
            : undefined,
        },
      })),
      meta: {
        hasNextPage: result.hasNextPage,
        endCursor: result.endCursor?.toISOString() ?? null,
        total: result.total,
      },
      links: {
        self: `/v1/articles?limit=${safeLimit}`,
        next: result.hasNextPage
          ? `/v1/articles?after=${result.endCursor!.toISOString()}&limit=${safeLimit}`
          : null,
      },
    };
  }

  // GET /v1/articles/:id avec If-None-Match (cache validation)
  @Get(':id')
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Headers('if-none-match') ifNoneMatch: string | undefined,
    @Res() res: Response,
  ) {
    const article = await this.getArticle.execute({ id });
    const etag = `"v${article.version}"`;

    if (ifNoneMatch === etag) {
      res.status(HttpStatus.NOT_MODIFIED).end();
      return;
    }

    res
      .set('ETag', etag)
      .set('Cache-Control', 'private, must-revalidate')
      .set('Vary', 'Accept, X-Tenant-ID')
      .json({
        ...ArticleReadDto.fromDomain(article),
        _links: {
          self: { href: `/v1/articles/${id}` },
          collection: { href: '/v1/articles' },
          publish: article.canPublish()
            ? { href: `/v1/articles/${id}/publish`, method: 'POST' }
            : undefined,
        },
      });
  }
}
```

### Deprecation middleware NestJS

```typescript
import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

// Middleware qui ajoute les headers de deprecation sur les routes /v1/
@Injectable()
export class DeprecationMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    if (req.path.startsWith('/v1/')) {
      res.set('Deprecation', 'Sun, 01 Sep 2026 00:00:00 GMT');
      res.set('Sunset', 'Mon, 01 Dec 2026 00:00:00 GMT');
      res.set('Link', '</v2' + req.path.replace('/v1', '') + '>; rel="successor-version"');
    }
    next();
  }
}
```

### Cursor pagination dans le repository

```typescript
interface CursorResult<T> {
  items: T[];
  hasNextPage: boolean;
  endCursor: Date | null;
  total: number;
}

@Injectable()
export class ArticleRepository {
  constructor(
    @InjectRepository(ArticleEntity)
    private readonly repo: Repository<ArticleEntity>,
  ) {}

  async findWithCursor(
    cursor: Date | undefined,
    limit: number,
    tenantId: string,
  ): Promise<CursorResult<Article>> {
    const qb = this.repo
      .createQueryBuilder('a')
      .where('a.tenantId = :tenantId', { tenantId })
      .andWhere('a.status != :deleted', { deleted: 'deleted' })
      .orderBy('a.createdAt', 'DESC')
      .limit(limit + 1); // +1 pour savoir s'il y a une page suivante

    if (cursor) {
      qb.andWhere('a.createdAt < :cursor', { cursor });
    }

    const [items, total] = await Promise.all([
      qb.getMany(),
      this.repo.count({
        where: { tenantId, status: Not('deleted') },
      }),
    ]);

    const hasNextPage = items.length > limit;
    if (hasNextPage) items.pop(); // Retirer l'element en trop

    return {
      items: items.map(ArticleMapper.toDomain),
      hasNextPage,
      endCursor: items.length > 0
        ? items[items.length - 1].createdAt
        : null,
      total,
    };
  }
}
```

---

## Resume

1. **HATEOAS** (niveau 3 de Richardson) : chaque réponse inclut des liens vers les actions possibles — le client decouvre l'API au lieu de hardcoder les URL
2. **URL versioning** (`/v1/`) avec headers `Deprecation` + `Sunset` pour communiquer la timeline de fin de vie aux consommateurs
3. **Cursor pagination** pour les API publiques et le scroll infini — performance O(limit) constante, aucun doublon meme avec des insertions concurrentes
4. **Vary header** pour indiquer aux caches quels headers influencent la réponse — ne jamais utiliser `Vary: Cookie` sur un CDN
5. **API governance** : style guide + changelog + contract testing + deprecation policy de 3 mois minimum — une API est un contrat, pas un detail d'implémentation

---

> **Prochain cours** : [Cours 45 — GraphQL & gRPC](./03-graphql-grpc.md) — ou comment choisir entre REST, GraphQL et gRPC selon le cas d'usage, et implémenter chacun avec sécurité.

---

> **Lien fil rouge — ShopArch**
>
> - Implémente la pagination cursor-based sur le listing produits ShopArch
> - Ajoute le conditional request (ETag / If-None-Match) sur les fiches produit
> - Exercice(s) associé(s) : `exercices/29-api-rest-avancee/`
> - Checkpoint : Module 06, critère 3
