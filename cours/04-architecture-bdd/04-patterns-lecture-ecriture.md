# Cours 30 — Patterns lecture/écriture

> **Objectif** : Maîtriser la séparation lecture/écriture (read replicas, materialized views, denormalisation), implémenter un cache Redis avec namespace convention, et comprendre le CQRS côté base de données.

---

## Rappel du cours précédent

<details>
<summary>1. Quels sont les 3 principaux types d'index PostgreSQL et leurs cas d'usage ?</summary>

- **B-tree** : egalite, plage, tri (=, <, >, BETWEEN) — defaut, convient a 90% des cas
- **GIN** : index inverse pour full-text search (`tsvector @@`), JSONB (`@>`), arrays
- **BRIN** : block range index pour grandes tables dont les données sont physiquement ordonnees (dates)
</details>

<details>
<summary>2. Qu'est-ce qu'un partial index et quand l'utiliser ?</summary>

Un index qui ne couvre qu'un sous-ensemble des rows, filtre par une clause `WHERE`. Exemple : `CREATE INDEX ... WHERE status = 'published'` n'indexe que les produits publies. Il est plus petit (moins de stockage), plus rapide a maintenir, et plus performant pour les requêtes qui correspondent au filtre.
</details>

---

## Analogie — La bibliotheque avec sa salle de consultation

- **Base de données principale** (master) = la reserve ou sont ranges tous les livres originaux. Un seul exemplaire, accès restreint pour écrire (cataloguer, ajouter, modifier)
- **Read replicas** = les copies deposees en salle de consultation. Plusieurs lecteurs peuvent les consulter simultanement sans deranger la reserve
- **Materialized view** = un résumé prepare a l'avance (les "best of" par categorie). Plus rapide a consulter, mais il faut le regenerer quand le catalogue change
- **Cache Redis** = le post-it du bibliothecaire : "les 20 livres les plus empruntes ce mois". Ultra-rapide a lire, mais peut etre obsolete

---

## Théorie

### 1. Le problème : lectures >> écritures

Dans la plupart des applications web :

```
Ratio typique :
  Lectures : 90-95%   (lister, afficher, rechercher)
  Ecritures : 5-10%   (creer, modifier, supprimer)

Probleme :
  Les lectures partagent les memes ressources que les ecritures
  → Un export CSV lourd peut ralentir les ecritures
  → Un pic de trafic en lecture bloque les commandes
```

**Solution** : séparer les chemins de lecture et d'écriture.

### 2. Read replicas

```
┌──────────┐       Ecritures         ┌──────────────┐
│  API     │──────────────────────>  │  Master (RW) │
│  Write   │                         │  PostgreSQL  │
└──────────┘                         └──────┬───────┘
                                            │ Replication
┌──────────┐       Lectures                 │ asynchrone
│  API     │──────────────────────>  ┌──────┴───────┐
│  Read    │                         │  Replica (RO)│
│          │──────────────────────>  │  PostgreSQL  │
└──────────┘                         └──────────────┘
                                     ┌──────────────┐
                                     │  Replica (RO)│
                                     │  PostgreSQL  │
                                     └──────────────┘
```

| Propriété | Master | Read Replica |
|---|---|---|
| Opérations | Read + Write | Read only |
| Nombre | 1 | N (scalable) |
| Latence réplication | — | ~100ms (async) |
| Données | Source de vérité | Eventuellement cohérente |

**Attention** : réplication asynchrone = les replicas peuvent etre "en retard" de quelques millisecondes. Ne JAMAIS lire d'un replica juste apres avoir écrit sur le master (le read-your-own-writes problem).

### 3. Materialized views

Une vue materialisee est une requête dont le résultat est **stocke physiquement** :

```sql
-- Vue materialisee pour le dashboard admin
CREATE MATERIALIZED VIEW mv_category_stats AS
SELECT
  c.id AS category_id,
  c.name AS category_name,
  COUNT(p.id) AS product_count,
  AVG(p.price) AS avg_price,
  MIN(p.price) AS min_price,
  MAX(p.price) AS max_price
FROM categories c
LEFT JOIN products p ON p.category_id = c.id
WHERE p.status = 'published'
GROUP BY c.id, c.name;

-- Index sur la vue materialisee (oui, c'est possible !)
CREATE UNIQUE INDEX idx_mv_category_stats ON mv_category_stats (category_id);

-- Rafraichir la vue (manuellement ou via cron/trigger)
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_category_stats;
```

| Aspect | Vue classique | Vue materialisee |
|---|---|---|
| Stockage | Aucun (requête a la volee) | Physique (résultat stocke) |
| Performance lecture | Depend de la complexité | Tres rapide (données precalculees) |
| Fraicheur | Temps reel | Aussi frais que le dernier REFRESH |
| Index | Non | Oui |
| REFRESH | — | CONCURRENTLY (sans bloquer les lectures) |

### 4. Quand denormaliser

La normalisation (3NF) est la règle par defaut. On denormalise quand :

| Critère | Normalise | Denormalise |
|---|---|---|
| Lectures simples/fréquentes | JOIN a chaque lecture | Données déjà assemblees |
| Ecritures | Mise a jour 1 endroit | Mise a jour N endroits |
| Cohérence | Garantie | A maintenir manuellement |
| Stockage | Optimal | Redondant |

**Regle** : normaliser par defaut. Denormaliser seulement quand un JOIN est un bottleneck mesure (pas suppose).

### 5. Redis cache — namespace convention

```
Convention : {app}:{feature}:{key}

Exemples :
  shop:products:abc-123              → Produit individuel
  shop:products:category:electronics → Liste par categorie
  shop:cart:user:user-456            → Panier utilisateur
  shop:search:query:chaussures       → Resultat de recherche (TTL 5min)
  shop:stats:daily:2024-03-15        → Stats du jour
```

| Stratégie | TTL | Cas d'usage |
|---|---|---|
| **Cache-aside** | 5-15 min | Données stables (catalogue) |
| **Write-through** | Infini (invalide sur write) | Cohérence forte requise |
| **Write-behind** | Buffer + flush periodique | Compteurs, analytics |
| **Tag-based invalidation** | Varie | Invalider par "famille" |

### 6. CQRS côté base de données (preview)

CQRS (Command Query Responsibility Segregation) pousse la séparation au maximum :

```
                    ┌─────────────────┐
                    │    API          │
                    └────┬──────┬────┘
                         │      │
                 Write   │      │  Read
                         ▼      ▼
              ┌──────────┐  ┌──────────┐
              │ Command  │  │  Query   │
              │ Handler  │  │ Handler  │
              └────┬─────┘  └────┬─────┘
                   │             │
                   ▼             ▼
            ┌──────────┐  ┌──────────────┐
            │ Master   │  │ Read Model   │
            │ (normalise)│  │ (denormalise)│
            └──────────┘  └──────────────┘
```

Le read model peut etre :
- La meme DB avec des vues materialisees
- Un read replica avec des index spécifiques
- Elasticsearch pour la recherche
- Redis pour les données chaudes

On approfondira dans le Module 07 (Patterns distribues).

---

## Pratique

### Service avec read/write séparation

```typescript
// datasource.config.ts
const writeDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_MASTER_HOST,
  replication: {
    master: {
      host: process.env.DB_MASTER_HOST,
      port: 5432,
      username: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
    },
    slaves: [
      {
        host: process.env.DB_REPLICA_1_HOST,
        port: 5432,
        username: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
      },
      {
        host: process.env.DB_REPLICA_2_HOST,
        port: 5432,
        username: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
      },
    ],
  },
});
// TypeORM route automatiquement : SELECT → replica, INSERT/UPDATE/DELETE → master
```

### Redis cache layer avec namespace

```typescript
@Injectable()
export class ProductCacheService {
  private readonly PREFIX = 'shop:products';
  private readonly DEFAULT_TTL = 300; // 5 min

  constructor(private readonly redis: Redis) {}

  async get(productId: string): Promise<Product | null> {
    const cached = await this.redis.get(`${this.PREFIX}:${productId}`);
    return cached ? JSON.parse(cached) : null;
  }

  async set(product: Product): Promise<void> {
    await this.redis.set(
      `${this.PREFIX}:${product.id}`,
      JSON.stringify(product),
      'EX', this.DEFAULT_TTL,
    );
    // Ajouter aux tags pour invalidation groupee
    await this.redis.sadd(
      `${this.PREFIX}:tag:category:${product.categoryId}`,
      product.id,
    );
  }

  async invalidateByCategory(categoryId: string): Promise<void> {
    const tagKey = `${this.PREFIX}:tag:category:${categoryId}`;
    const productIds = await this.redis.smembers(tagKey);

    if (productIds.length > 0) {
      const keys = productIds.map((id) => `${this.PREFIX}:${id}`);
      await this.redis.del(...keys, tagKey);
    }
  }

  async invalidateProduct(productId: string): Promise<void> {
    await this.redis.del(`${this.PREFIX}:${productId}`);
  }
}
```

### Product service avec cache-aside pattern

```typescript
@Injectable()
export class ProductQueryService {
  constructor(
    private readonly repo: ProductRepository,
    private readonly cache: ProductCacheService,
  ) {}

  async findById(id: string): Promise<Product> {
    // 1. Check cache
    const cached = await this.cache.get(id);
    if (cached) return cached;

    // 2. Query DB (routed to replica via TypeORM)
    const product = await this.repo.findById(id);
    if (!product) throw new NotFoundException(`Product ${id} not found`);

    // 3. Populate cache
    await this.cache.set(product);

    return product;
  }
}

@Injectable()
export class ProductCommandService {
  constructor(
    private readonly repo: ProductRepository,
    private readonly cache: ProductCacheService,
  ) {}

  async updateProduct(id: string, dto: UpdateProductDto): Promise<void> {
    // Write to master
    const product = await this.repo.findById(id);
    product.update(dto);
    await this.repo.save(product);

    // Invalidate cache (le prochain read rechargera depuis la DB)
    await this.cache.invalidateProduct(id);
  }
}
```

---

## Resume

1. **Read replicas** scalent les lectures horizontalement — attention au réplication lag (~100ms)
2. **Materialized views** precalculent des agregats — `REFRESH CONCURRENTLY` pour ne pas bloquer les lectures
3. **Denormaliser seulement quand mesure** — un JOIN lent est un signal, pas une supposition
4. **Redis cache namespace** : `{app}:{feature}:{key}` + tag-based invalidation pour la cohérence
5. **CQRS côté DB** : séparer les modèles de lecture (denormalise, rapide) et d'écriture (normalise, cohérent)

---

> **Prochain cours** : [Cours 31 — NoSQL & Polyglot Persistence](./05-nosql-polyglot-persistence.md) — ou comment choisir la bonne base de données pour chaque problème.

---

> **Lien fil rouge — ShopArch**
>
> - Implémente un read model dénormalisé pour le listing produits (materialized view)
> - Sépare les modèles de lecture (catalogue) et d'écriture (commandes)
> - Exercice(s) associé(s) : `exercices/33-cqrs-catalogue-commandes/`
> - Checkpoint : Module 07, critère 1
