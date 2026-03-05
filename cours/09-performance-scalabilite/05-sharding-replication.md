# Cours 66 — Sharding & Réplication

> **Objectif** : Comprendre les stratégies de sharding (horizontal partitioning), maîtriser la réplication (primary-replica, multi-primary), et savoir quand et comment partitionner les données pour le scaling.

---

## Rappel du cours précédent

<details>
<summary>1. Qu'est-ce que Little's Law et comment l'utiliser pour le capacity planning ?</summary>

`L = λ × W` — L = requêtes in-flight, λ = taux d'arrivee (req/s), W = temps de traitement moyen (s). Exemple : 200 req/s avec 50ms de latence = 10 requêtes in-flight. Si chaque pod géré 5 connexions concurrentes, il faut au minimum 2 pods. On ajoute une marge de sécurité (typiquement 1.5x-2x).
</details>

<details>
<summary>2. Pourquoi les containers doivent etre stateless pour le scaling horizontal ?</summary>

Si l'état est dans le process (sessions en mémoire, fichiers locaux), un pod qui restart perd tout, et le load balancer ne peut pas distribuer les requêtes librement. En stateless, tout l'état vit dans des services externes (Redis, S3, PG) — chaque pod est identique et jetable, le scaling horizontal est trivial.
</details>

---

## Analogie — La bibliotheque municipale

Une bibliotheque qui grandit :
- **Réplication** : photocopier le catalogue et l'envoyer dans les annexes de quartier → tout le monde peut lire, mais les ajouts se font toujours au catalogue central
- **Sharding** : repartir les livres par genre — Science-Fiction dans l'annexe Nord, Histoire dans l'annexe Sud → chaque annexe est responsable de son domaine

Si tu cherches un livre de SF, tu sais qu'il est au Nord. Pas besoin de chercher partout.

---

## Théorie

### 1. Réplication

```
Primary-Replica (Master-Slave)
┌──────────┐    WAL stream    ┌──────────┐
│ Primary  │ ──────────────> │ Replica 1│  (read-only)
│ (writes) │                  │ (reads)  │
│          │ ──────────────> ┌──────────┐
│          │                  │ Replica 2│  (read-only)
└──────────┘                  └──────────┘

Writes → Primary only
Reads  → Replicas (distribue la charge)

Replication lag : 10ms-1s typique
  → Eventual consistency pour les lectures
  → Strong consistency pour les ecritures
```

| Type | Description | Cas d'usage |
|---|---|---|
| **Synchronous** | Primary attend la confirmation du replica | Données critiques (finance) |
| **Asynchronous** | Primary n'attend pas | Performance, faible latence |
| **Semi-synchronous** | Au moins 1 replica confirme | Compromis (MySQL default) |

### 2. Sharding stratégies

```
Sharding = diviser les donnees HORIZONTALEMENT en partitions

Shard 1 : users A-F     Shard 2 : users G-N     Shard 3 : users O-Z
┌──────────────┐        ┌──────────────┐        ┌──────────────┐
│ Alice        │        │ Gabriel      │        │ Oscar        │
│ Bob          │        │ Hugo         │        │ Paul         │
│ Charlie      │        │ Isabelle     │        │ Quentin      │
│ David        │        │ Julie        │        │ Rose         │
└──────────────┘        └──────────────┘        └──────────────┘
```

| Stratégie | Logique | Avantage | Risque |
|---|---|---|---|
| **Range-based** | Par plage (A-F, G-N, O-Z) | Requetes de range efficaces | Hotspots (lettres populaires) |
| **Hash-based** | `hash(key) % N` | Distribution uniforme | Range queries impossibles |
| **Directory-based** | Lookup table (key → shard) | Flexible | Le directory est un SPOF |
| **Geography** | Par region (EU, US, APAC) | Data locality, data sovereignty | Cross-region queries couteuses |

### 3. Shard key — le choix critique

```
Bon shard key :
  - Haute cardinalite (beaucoup de valeurs distinctes)
  - Distribution uniforme (pas de hotspot)
  - Utilise dans TOUTES les requetes (evite le scatter-gather)

Exemples :
  ✓ tenant_id  → chaque tenant sur son shard (multi-tenant naturel)
  ✓ user_id    → donnees utilisateur isolees
  ✗ created_at → tous les inserts sur le shard "actuel" (hotspot)
  ✗ country    → quelques pays dominent (hotspot)
```

### 4. Scatter-gather vs targeted query

```
Targeted query (shard key dans la WHERE clause) :
  SELECT * FROM orders WHERE tenant_id = 'acme' AND id = '123'
  → Va directement sur le shard d'acme → rapide

Scatter-gather (pas de shard key) :
  SELECT * FROM orders WHERE total > 1000
  → Envoye a TOUS les shards → fusion des resultats → lent
```

### 5. PostgreSQL partitioning natif

```sql
-- Table partitionnee par tenant
CREATE TABLE orders (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    total NUMERIC(10,2),
    created_at TIMESTAMPTZ
) PARTITION BY HASH (tenant_id);

-- Creer les partitions
CREATE TABLE orders_p0 PARTITION OF orders
    FOR VALUES WITH (MODULUS 4, REMAINDER 0);
CREATE TABLE orders_p1 PARTITION OF orders
    FOR VALUES WITH (MODULUS 4, REMAINDER 1);
CREATE TABLE orders_p2 PARTITION OF orders
    FOR VALUES WITH (MODULUS 4, REMAINDER 2);
CREATE TABLE orders_p3 PARTITION OF orders
    FOR VALUES WITH (MODULUS 4, REMAINDER 3);
```

### 6. Quand sharder ?

```
NE PAS sharder si :
  - PostgreSQL single node suffit (<1TB, <10K req/s)
  - Read replicas resolvent le probleme
  - Le partitioning natif PG suffit

Sharder si :
  - Taille > capacite d'un seul noeud
  - Isolation reglementaire (data sovereignty)
  - Multi-tenant avec besoin d'isolation forte
  - Latence cross-region inacceptable
```

---

## Pratique

### Routing layer vers les shards

```typescript
@Injectable()
export class ShardRouter {
  private readonly shards: Map<string, DataSource>;

  constructor(private readonly config: ShardConfig) {
    this.shards = new Map();
    for (const shard of config.shards) {
      this.shards.set(shard.name, createDataSource(shard.connectionUrl));
    }
  }

  getShardForTenant(tenantId: string): DataSource {
    // Hash-based routing
    const hash = this.hashCode(tenantId);
    const shardIndex = Math.abs(hash) % this.shards.size;
    const shardName = `shard-${shardIndex}`;

    const shard = this.shards.get(shardName);
    if (!shard) {
      throw new Error(`Shard ${shardName} not found`);
    }
    return shard;
  }

  private hashCode(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (hash * 31 + str.charCodeAt(i)) | 0;
    }
    return hash;
  }
}

// Usage
@Injectable()
export class OrderRepository {
  constructor(private readonly router: ShardRouter) {}

  async findByTenant(tenantId: string, orderId: string): Promise<Order> {
    const db = this.router.getShardForTenant(tenantId);
    return db.getRepository(Order).findOneBy({ id: orderId });
  }
}
```

### Read/Write splitting

```typescript
@Injectable()
export class ReadWriteDataSource {
  constructor(
    private readonly primary: DataSource,   // Writes
    private readonly replicas: DataSource[], // Reads
  ) {}

  getWriter(): DataSource {
    return this.primary;
  }

  getReader(): DataSource {
    // Round-robin sur les replicas
    const index = Math.floor(Math.random() * this.replicas.length);
    return this.replicas[index];
  }
}

// Decorateur pour indiquer si la methode lit ou ecrit
function ReadOnly(): MethodDecorator {
  return (target, key, descriptor: PropertyDescriptor) => {
    const original = descriptor.value;
    descriptor.value = function (...args: unknown[]) {
      this.useReader = true;
      return original.apply(this, args);
    };
  };
}
```

---

## Resume

1. **Réplication** : primary-replica pour distribuer les lectures — async (performance) vs sync (consistance)
2. **Sharding** : diviser horizontalement les données — hash-based (uniforme) vs range-based (range queries)
3. **Shard key** : haute cardinalite, distribution uniforme, present dans toutes les requêtes — `tenant_id` est souvent le meilleur choix
4. **Scatter-gather** : éviter a tout prix — toujours inclure le shard key dans les requêtes
5. **Ne pas sharder trop tot** : PostgreSQL single node tient jusqu'a ~1TB et ~10K req/s — commencer par les read replicas

---

> **Prochain cours** : [Cours 67 — Serverless Architecture](./06-serverless.md)

---

> **Lien fil rouge — ShopArch**
>
> - Évalue si ShopArch a besoin de sharding (réponse probable : non, read replicas suffisent)
> - Configure une read replica PostgreSQL pour les requêtes du dashboard admin
> - Exercice(s) associé(s) : `exercices/44-capacity-planning/`
> - Checkpoint : Module 09, critère 3
