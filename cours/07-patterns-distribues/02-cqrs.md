# Cours 50 — CQRS

> **Objectif** : Maîtriser le pattern CQRS (Command Query Responsibility Segregation), implémenter la séparation commandes/queries avec des read models distincts, comprendre la cache invalidation par surrogate keys, et savoir quand CQRS est overkill.

---

## Rappel du cours précédent

<details>
<summary>1. Qu'est-ce que le theoreme CAP et quel est le vrai choix en production ?</summary>

Le theoreme CAP stipule qu'un système distribue ne peut garantir simultanement Consistency, Availability et Partition Tolerance. En production, les partitions sont inevitables — on ne "choisit" pas P, on le subit. Le vrai choix pendant une partition est : sacrifier la **consistance** (AP — accepter les écritures, merger plus tard) ou la **disponibilité** (CP — refuser les écritures tant que le quorum n'est pas atteint).
</details>

<details>
<summary>2. Quelle est la différence entre strong consistency et eventual consistency ?</summary>

**Strong consistency** (linearizable) : chaque read voit la dernière écriture, globalement. Requiert un quorum, latence élevée. Usage : soldes bancaires, stock critique.
**Eventual consistency** : tous les replicas convergent a terme (quelques ms a quelques secondes). Latence tres basse. Usage : compteurs de likes, analytics, CDN. Entre les deux, la **session consistency** garantit le read-your-own-writes dans une session.
</details>

---

## Analogie — Le restaurant avec une cuisine et un comptoir de vente a emporter

Dans un restaurant classique, le meme chef prepare les plats a la carte (commandes individuelles) ET les plateaux-repas du comptoir (formats standardises). Ca ne scale pas.

- **Le chef (write side)** prepare chaque plat a la commande — un a la fois, qualité maximale
- **Le comptoir (read side)** a des plateaux pre-prepares, mis a jour quand la cuisine change le menu
- **L'ardoise** (event/notification) previent le comptoir quand un plat est epuise
- **La salle a manger** (client) n'a aucune idee qu'il y a deux systèmes différents derriere

CQRS, c'est séparer la cuisine (écriture) du comptoir (lecture) pour optimiser chaque côté independamment.

---

## Théorie

### 1. Le problème : un seul modèle pour tout

Dans un CRUD classique, le meme modèle sert a lire et a écrire :

```
┌──────────┐     ┌──────────────┐     ┌──────────────┐
│  Client   │────>│  Controller  │────>│  Same Model  │
│           │<────│  (CRUD)      │<────│  (read+write)│
└──────────┘     └──────────────┘     └──────────────┘
```

**Problemes** :
- Le modèle d'écriture est normalise (3NF) → lectures lentes (JOINs)
- Le modèle de lecture a besoin de denormalisation → écritures complexes
- Le cache est invalide a chaque écriture → invalidation naive
- Les queries complexes (search, dashboard) polluent le modèle d'écriture

### 2. CQRS — séparer Command et Query

```
                    ┌─────────────┐
                    │   Client    │
                    └──────┬──────┘
                           │
                    ┌──────┴──────┐
                    │   API       │
                    │  Router     │
                    └──┬──────┬──┘
                       │      │
              Command  │      │  Query
              (POST,   │      │  (GET)
              PUT,     │      │
              DELETE)  │      │
                       ▼      ▼
              ┌────────┐  ┌────────┐
              │Command │  │ Query  │
              │Handler │  │Handler │
              └───┬────┘  └───┬────┘
                  │           │
                  ▼           ▼
           ┌──────────┐ ┌──────────────┐
           │  Write   │ │  Read Model  │
           │  Model   │ │ (denormalise)│
           │ (3NF DB) │ │              │
           └────┬─────┘ └──────────────┘
                │               ▲
                │   Projection  │
                └───────────────┘
```

| Aspect | Command (Write) | Query (Read) |
|---|---|---|
| Verbe HTTP | POST, PUT, PATCH, DELETE | GET |
| Retour | void ou ID cree | DTO complet (denormalise) |
| Modèle | Normalise, valide, invariants | Denormalise, optimise lecture |
| Scaling | Vertical (1 master) | Horizontal (N replicas) |
| Cache | Pas de cache (écriture) | Cache agressif (CDN, Redis) |

### 3. Les 3 niveaux de read store

Le read model peut prendre plusieurs formes, du plus simple au plus complexe :

```
Niveau 1 : Meme DB, vues denormalisees
┌──────────────────────────────────────────┐
│            PostgreSQL                     │
│  ┌──────────┐  ┌─────────────────────┐  │
│  │ Tables    │  │ Materialized Views  │  │
│  │ (write)   │  │ (read, denormalise) │  │
│  └──────────┘  └─────────────────────┘  │
└──────────────────────────────────────────┘

Niveau 2 : Read replica separee
┌──────────┐         ┌──────────────┐
│  Master   │ ──────> │  Replica     │
│  (write)  │  async  │  (read only) │
└──────────┘         └──────────────┘

Niveau 3 : Store specialise (Elasticsearch, Redis)
┌──────────┐  event   ┌──────────────┐
│  Master   │ ──────> │ Elasticsearch│
│  (write)  │         │  (search)    │
└──────────┘         └──────────────┘
                      ┌──────────────┐
              ──────> │ Redis        │
                      │ (hot data)   │
                      └──────────────┘
```

| Niveau | Complexite | Latence lecture | Consistance | Quand l'utiliser |
|---|---|---|---|---|
| 1 — Meme DB | Basse | Moyenne (~10ms) | Forte (meme DB) | MVP, équipe petite, trafic modere |
| 2 — Read replica | Moyenne | Basse (~5ms) | Eventual (~100ms lag) | Trafic lecture élevé |
| 3 — Store specialise | Elevee | Tres basse (~1ms) | Eventual (~seconds) | Search, dashboard, analytics |

### 4. Surrogate-key cache invalidation (tag-based CDN purge)

Le problème classique du cache : comment invalider les bonnes entrees sans tout purger ?

```
Requete GET /api/products?category=shoes

CDN repond avec headers :
  Cache-Control: public, max-age=3600
  Surrogate-Key: product-list category-shoes tenant-abc

Quand un produit de la categorie "shoes" est modifie :

API → CDN Purge :  "Surrogate-Key: category-shoes"
                   → Toutes les reponses taguees "category-shoes" sont purgees
                   → Les reponses taguees "category-hats" ne sont pas touchees
```

| Tag (Surrogate Key) | Purge quand... | Exemple de réponses purgees |
|---|---|---|
| `product:{id}` | Le produit est modifie | GET /products/{id}, pages contenant ce produit |
| `category:{slug}` | Un produit de cette categorie change | GET /products?category=shoes, listing page |
| `tenant:{id}` | Configuration tenant change | Toutes les pages du tenant |
| `product-list` | N'importe quel produit change | Tous les listings produits |

```
Hierarchie de tags (du plus specifique au plus large) :

  product:abc-123          → 1 reponse invalidee
  category:shoes           → ~50 reponses invalidees
  tenant:acme              → ~5000 reponses invalidees
  all                      → tout le cache (nuclear option)
```

**Regle** : toujours invalider au niveau le plus spécifique possible. Ne jamais purger `all` sauf en cas de changement de schema global.

### 5. Quand CQRS est overkill

CQRS ajoute de la complexité. Ne l'utilise que quand le benefice est reel :

| Situation | CQRS ? | Pourquoi |
|---|---|---|
| CRUD simple (blog, admin) | Non | Un seul modèle suffit, complexité injustifiee |
| Lectures >> écritures (catalogue) | Oui (Niveau 1) | Vues materialisees sans changer l'archi |
| Search full-text + filtres complexes | Oui (Niveau 3) | Elasticsearch projection nécessaire |
| Dashboard avec agregations | Oui (Niveau 1-2) | Precalculer les stats plutot que scanner |
| Équipe < 3 devs | Non | Le cout cognitif ne se justifie pas |
| Multi-tenant avec cache CDN | Oui (tags) | Surrogate keys essentielles pour invalidation fine |
| Event sourcing | Oui (obligatoire) | Les projections SONT le read model |

**Regle** : commencer sans CQRS. Ajouter le Niveau 1 (vues materialisees) quand les queries deviennent un bottleneck. Monter au Niveau 3 uniquement quand c'est mesure.

---

## Pratique

### Command et Query handlers separes (NestJS)

```typescript
// --- Commands (ecriture) ---

// commands/create-product.command.ts
export class CreateProductCommand {
  constructor(
    public readonly name: string,
    public readonly price: number,
    public readonly categoryId: string,
    public readonly tenantId: string,
  ) {}
}

// commands/create-product.handler.ts
@CommandHandler(CreateProductCommand)
export class CreateProductHandler implements ICommandHandler<CreateProductCommand> {
  constructor(
    private readonly repo: ProductRepository,
    private readonly cacheInvalidator: CacheInvalidator,
  ) {}

  async execute(command: CreateProductCommand): Promise<string> {
    // 1. Valider les invariants metier
    const product = Product.create({
      name: command.name,
      price: command.price,
      categoryId: command.categoryId,
      tenantId: command.tenantId,
    });

    // 2. Persister (modele normalise)
    await this.repo.save(product);

    // 3. Invalider le cache par surrogate keys
    await this.cacheInvalidator.purgeByTags([
      `product-list`,
      `category:${command.categoryId}`,
      `tenant:${command.tenantId}`,
    ]);

    return product.id;
  }
}
```

```typescript
// --- Queries (lecture) ---

// queries/get-product-listing.query.ts
export class GetProductListingQuery {
  constructor(
    public readonly categoryId?: string,
    public readonly page: number = 1,
    public readonly limit: number = 20,
    public readonly tenantId: string = '',
  ) {}
}

// queries/get-product-listing.handler.ts
@QueryHandler(GetProductListingQuery)
export class GetProductListingHandler
  implements IQueryHandler<GetProductListingQuery>
{
  constructor(
    private readonly readModel: ProductReadModel,
  ) {}

  async execute(query: GetProductListingQuery): Promise<ProductListingDto> {
    // Lire depuis le modele denormalise (vue materialisee ou replica)
    const result = await this.readModel.findListing({
      categoryId: query.categoryId,
      page: query.page,
      limit: query.limit,
      tenantId: query.tenantId,
    });

    return {
      items: result.items,
      total: result.total,
      page: query.page,
      surrogateKeys: this.buildSurrogateKeys(query, result),
    };
  }

  private buildSurrogateKeys(
    query: GetProductListingQuery,
    result: { items: ProductListItemDto[] },
  ): string[] {
    const tags = ['product-list', `tenant:${query.tenantId}`];
    if (query.categoryId) {
      tags.push(`category:${query.categoryId}`);
    }
    // Ajouter chaque produit individuel pour invalidation fine
    result.items.forEach((item) => tags.push(`product:${item.id}`));
    return tags;
  }
}
```

### Read model avec vue materialisee (PostgreSQL)

```typescript
// read-models/product-read-model.ts
@Injectable()
export class ProductReadModel {
  constructor(
    @InjectDataSource('read') private readonly readDs: DataSource,
  ) {}

  async findListing(params: {
    categoryId?: string;
    page: number;
    limit: number;
    tenantId: string;
  }): Promise<{ items: ProductListItemDto[]; total: number }> {
    // Lire depuis la vue materialisee (pre-JOINee, denormalisee)
    const qb = this.readDs
      .createQueryBuilder()
      .select('*')
      .from('mv_product_listing', 'p')
      .where('p.tenant_id = :tenantId', { tenantId: params.tenantId });

    if (params.categoryId) {
      qb.andWhere('p.category_id = :categoryId', {
        categoryId: params.categoryId,
      });
    }

    const total = await qb.getCount();
    const items = await qb
      .orderBy('p.created_at', 'DESC')
      .offset((params.page - 1) * params.limit)
      .limit(params.limit)
      .getRawMany<ProductListItemDto>();

    return { items, total };
  }
}
```

```sql
-- Vue materialisee pour le listing produits (denormalisee, pre-JOINee)
CREATE MATERIALIZED VIEW mv_product_listing AS
SELECT
  p.id,
  p.name,
  p.slug,
  p.price,
  p.status,
  p.tenant_id,
  p.created_at,
  c.id AS category_id,
  c.name AS category_name,
  c.slug AS category_slug,
  (SELECT url FROM media m WHERE m.id = p.thumbnail_id) AS thumbnail_url,
  (SELECT COUNT(*) FROM reviews r WHERE r.product_id = p.id) AS review_count,
  (SELECT AVG(r.rating) FROM reviews r WHERE r.product_id = p.id) AS avg_rating
FROM products p
JOIN categories c ON c.id = p.category_id
WHERE p.status = 'published';

CREATE UNIQUE INDEX idx_mv_product_listing_id ON mv_product_listing (id);
CREATE INDEX idx_mv_product_listing_category ON mv_product_listing (tenant_id, category_id);

-- Rafraichir apres chaque ecriture (via trigger ou cron)
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_product_listing;
```

### Surrogate-key cache invalidation (CDN)

```typescript
// cache/cache-invalidator.ts
@Injectable()
export class CacheInvalidator {
  constructor(
    private readonly httpService: HttpService,
    private readonly config: ConfigService,
  ) {}

  async purgeByTags(tags: string[]): Promise<void> {
    const cdnProvider = this.config.get('CDN_PROVIDER'); // 'fastly' | 'cloudflare'

    switch (cdnProvider) {
      case 'fastly':
        // Fastly : purge par Surrogate-Key header
        await this.httpService.axiosRef.post(
          `https://api.fastly.com/service/${this.config.get('FASTLY_SERVICE_ID')}/purge`,
          { surrogate_keys: tags },
          { headers: { 'Fastly-Key': this.config.get('FASTLY_API_KEY') } },
        );
        break;

      case 'cloudflare':
        // Cloudflare : purge par Cache-Tag
        await this.httpService.axiosRef.post(
          `https://api.cloudflare.com/client/v4/zones/${this.config.get('CF_ZONE_ID')}/purge_cache`,
          { tags },
          { headers: { Authorization: `Bearer ${this.config.get('CF_API_TOKEN')}` } },
        );
        break;
    }
  }
}

// Dans le controller, injecter les Surrogate-Key headers dans la reponse
@Get('products')
async listProducts(
  @Query() query: ProductListingQueryDto,
  @Res({ passthrough: true }) res: Response,
): Promise<ProductListingDto> {
  const result = await this.queryBus.execute(
    new GetProductListingQuery(query.categoryId, query.page, query.limit, query.tenantId),
  );

  // Headers pour le CDN
  res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=86400');
  res.setHeader('Surrogate-Key', result.surrogateKeys.join(' '));

  return result;
}
```

---

## Resume

1. **CQRS** séparé les chemins d'écriture (Command) et de lecture (Query) — chaque côté a son propre modèle optimise
2. **3 niveaux de read store** : meme DB avec vues materialisees (simple), read replica (scalable), store specialise comme Elasticsearch (puissant)
3. **Surrogate-key invalidation** : taguer chaque réponse CDN avec des cles (`product:123`, `category:shoes`) et purger par tag — plus fin que purger tout le cache
4. **Projection** : les données du write model sont transformees (denormalisees) vers le read model, de manière synchrone (meme DB) ou asynchrone (event-driven)
5. **CQRS est overkill** pour les CRUDs simples et les petites équipes — commencer sans, ajouter quand les lectures deviennent un bottleneck mesure

---

> **Prochain cours** : [Cours 51 — Event Sourcing & Outbox Pattern](./03-event-sourcing-outbox.md) — ou comment stocker les événements plutot que l'état, et garantir la publication fiable des événements.

---

> **Lien fil rouge — ShopArch**
>
> - Implémente CQRS léger pour le catalogue ShopArch (read model = materialized view)
> - Sépare les commandes (CreateProduct) des queries (GetProductList)
> - Exercice(s) associé(s) : `exercices/33-cqrs-catalogue-commandes/`
> - Checkpoint : Module 07, critère 1
