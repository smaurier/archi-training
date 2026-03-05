# Cours 26 — Concurrence & Asynchronisme

> **Objectif** : Comprendre les modèles d'exécution (event loop, multi-process, multi-thread), maîtriser les stratégies de locking (optimistic, pessimistic, distributed), et savoir choisir le bon isolation level PostgreSQL.

---

## Rappel du cours précédent

<details>
<summary>1. Pourquoi un background job doit-il etre idempotent ?</summary>

Un job peut etre exécuté plusieurs fois (retry apres echec, redemarrage du worker). S'il n'est pas idempotent, il produira des effets de bord (double débit, double email). L'idempotence garantit que le résultat est le meme qu'il soit exécuté 1 ou 10 fois.
</details>

<details>
<summary>2. Qu'est-ce qu'une Dead Letter Queue et pourquoi ne faut-il pas l'ignorer ?</summary>

C'est la file ou atterrissent les jobs qui ont échoué apres le nombre maximal de retries. Chaque job en DLQ represente soit un bug dans le code, soit un système externe en panne. Ignorer la DLQ = ignorer des erreurs silencieuses en production.
</details>

---

## Analogie — La cuisine du restaurant

- **1 chef, 1 cuisine** (Single-thread event loop — Node.js) : le chef ne fait qu'une chose a la fois, mais il est tres organise. Pendant que l'eau bout (I/O async), il prepare la salade. Il ne bloque jamais — il délégué les taches longues et enchaine.
- **10 chefs, 1 cuisine** (Multi-thread — Java, .NET) : plusieurs chefs travaillent en parallele, mais ils doivent se coordonner pour ne pas utiliser le meme couteau en meme temps (lock).
- **10 cuisines** (Multi-process — PHP-FPM, Gunicorn) : chaque requête a sa propre cuisine. Pas de conflit entre chefs, mais plus de ressources consommees.
- **10 restaurants** (Multi-node — Kubernetes) : scaling horizontal. Chaque noeud est independant, mais le stock (DB) est partage — la coordination devient critique.

---

## Théorie

### 1. Modèles d'exécution

```
┌─────────────────────────────────────────────────────────┐
│  Node.js — Single-thread Event Loop                      │
│                                                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐              │
│  │ Request 1│  │ Request 2│  │ Request 3│              │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘              │
│       └──────────────┼──────────────┘                    │
│                      ▼                                   │
│              ┌───────────────┐                           │
│              │  Event Loop   │  ← un seul thread         │
│              │  (non-bloquant)│                           │
│              └───────┬───────┘                           │
│                      │                                   │
│          ┌───────────┼───────────┐                      │
│          ▼           ▼           ▼                      │
│     ┌────────┐ ┌────────┐ ┌────────┐                   │
│     │ libuv  │ │ libuv  │ │ libuv  │  Thread pool      │
│     │ thread │ │ thread │ │ thread │  (I/O bloquant)    │
│     └────────┘ └────────┘ └────────┘                   │
└─────────────────────────────────────────────────────────┘
```

| Modèle | Technologie | Avantage | Inconvenient |
|---|---|---|---|
| **Event loop** | Node.js, Deno | Leger, performant pour I/O | Un calcul CPU bloque tout |
| **Thread pool** | Java, .NET | Parallelisme reel (CPU) | Gestion des locks complexe |
| **Process pool** | PHP-FPM, Gunicorn | Isolation totale | Mémoire x N, pas de partage |
| **Cluster** | Node.js cluster, PM2 | Utilise tous les cores | État non partage entre processes |

### 2. Les 3 problèmes de concurrence

**Race condition** : deux opérations lisent et ecrivent en meme temps → résultat incoherent.

```
Thread A: READ stock = 10
Thread B: READ stock = 10        ← Meme valeur !
Thread A: WRITE stock = 10 - 1 = 9
Thread B: WRITE stock = 10 - 1 = 9  ← Devrait etre 8 !
```

**Deadlock** : deux threads s'attendent mutuellement → blocage infini.

```
Thread A: LOCK resource_1, waiting for resource_2
Thread B: LOCK resource_2, waiting for resource_1
→ Deadlock ! Aucun ne peut avancer.
```

**Starvation** : un thread ne recoit jamais le lock car d'autres passent toujours devant.

### 3. Stratégies de locking

#### Optimistic locking (recommande pour le web)

Le principe : "je suppose qu'il n'y aura pas de conflit, et je vérifié au moment de sauvegarder".

```sql
-- Lecture avec version
SELECT id, name, stock, version FROM products WHERE id = 'abc';
-- version = 5, stock = 10

-- Ecriture avec check de version
UPDATE products
SET stock = 9, version = 6
WHERE id = 'abc' AND version = 5;
-- Si 0 rows affected → quelqu'un a modifie entre-temps → 409 Conflict
```

| Propriété | Optimistic | Pessimistic |
|---|---|---|
| **Quand** | La plupart des requêtes n'ont pas de conflit | Conflits fréquents |
| **Mecanisme** | Version field vérifié au UPDATE | Lock physique sur la row |
| **Performance** | Excellente (pas de lock) | Degradee (attente du lock) |
| **Scalabilite** | Excellente | Limitee (locks = goulot) |
| **Retry** | Nécessaire (relire + reessayer) | Pas nécessaire |
| **Cas d'usage** | 95% des apps web | Systèmes financiers, stock critique |

#### Pessimistic locking

```sql
-- SELECT FOR UPDATE — bloque la row jusqu'au COMMIT
BEGIN;
SELECT * FROM products WHERE id = 'abc' FOR UPDATE;
-- La row est lockee — aucun autre thread ne peut la modifier
UPDATE products SET stock = stock - 1 WHERE id = 'abc';
COMMIT;
-- Le lock est relache
```

#### Advisory locks PostgreSQL

Pour locker un concept logique (pas une row) :

```sql
-- Lock base sur un hash du concept
SELECT pg_advisory_lock(hashtext('import:tenant:abc'));
-- ... traitement exclusif ...
SELECT pg_advisory_unlock(hashtext('import:tenant:abc'));
```

#### Distributed lock avec Redis

Quand l'app tourne sur plusieurs noeuds, un lock PostgreSQL ne suffit pas :

```typescript
async function acquireDistributedLock(
  redis: Redis,
  key: string,
  ttlMs: number = 5000,
): Promise<string | null> {
  const token = crypto.randomUUID();
  const acquired = await redis.set(
    `lock:${key}`,
    token,
    'PX', ttlMs,    // Expire apres ttlMs
    'NX',           // Seulement si la cle n'existe pas
  );
  return acquired === 'OK' ? token : null;
}

async function releaseDistributedLock(
  redis: Redis,
  key: string,
  token: string,
): Promise<boolean> {
  // Script Lua atomique — ne relache que si c'est le meme token
  const script = `
    if redis.call("get", KEYS[1]) == ARGV[1] then
      return redis.call("del", KEYS[1])
    else
      return 0
    end
  `;
  const result = await redis.eval(script, 1, `lock:${key}`, token);
  return result === 1;
}
```

### 4. Isolation levels PostgreSQL

| Level | Dirty Read | Non-Repeatable Read | Phantom Read | Cas d'usage |
|---|---|---|---|---|
| **Read Uncommitted** | Possible | Possible | Possible | Jamais en PostgreSQL (= Read Committed) |
| **Read Committed** | Non | Possible | Possible | **Defaut PG** — suffisant pour 95% des cas |
| **Repeatable Read** | Non | Non | Non (en PG) | Rapports, calculs cohérents |
| **Serializable** | Non | Non | Non | Transactions financieres critiques |

```sql
-- Changer le level pour une transaction specifique
BEGIN ISOLATION LEVEL REPEATABLE READ;
SELECT sum(amount) FROM orders WHERE tenant_id = 'abc';
-- Garanti : meme resultat si on reexecute dans la meme transaction
COMMIT;
```

**Regle** : utiliser Read Committed par defaut. Passer a Repeatable Read ou Serializable uniquement pour les cas critiques (reporting, finance). Plus le level est élevé, plus les performances sont impactees.

### 5. async/await et backpressure

```typescript
// MAUVAIS — lance 10 000 requetes en parallele → memoire explose
const results = await Promise.all(
  items.map((item) => processItem(item)),
);

// BON — traitement par batch de 50 (backpressure)
async function processBatch<T, R>(
  items: T[],
  processor: (item: T) => Promise<R>,
  batchSize: number = 50,
): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map((item) => processor(item)),
    );
    results.push(...batchResults);
  }
  return results;
}
```

---

## Pratique

### Optimistic locking NestJS

```typescript
// product.entity.ts
@Entity()
export class ProductEntity {
  @PrimaryColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column('integer')
  stock: number;

  @VersionColumn()
  version: number; // TypeORM incremente automatiquement
}

// product.service.ts
@Injectable()
export class ProductService {
  async decrementStock(productId: string, quantity: number): Promise<void> {
    const maxRetries = 3;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const product = await this.repo.findOneByOrFail({ id: productId });

        if (product.stock < quantity) {
          throw new HttpException('Insufficient stock', 422);
        }

        product.stock -= quantity;
        await this.repo.save(product); // TypeORM check version automatiquement
        return; // Succes !

      } catch (error) {
        if (error instanceof OptimisticLockVersionMismatchError) {
          if (attempt === maxRetries - 1) {
            throw new HttpException('Conflict — please retry', 409);
          }
          continue; // Retry
        }
        throw error; // Autre erreur — propager
      }
    }
  }
}
```

### Race condition demo

```typescript
// Sans lock — race condition garantie
async function unsafeDecrementStock(productId: string): Promise<void> {
  const product = await repo.findOneBy({ id: productId });
  // Ici, un autre process peut lire le meme stock
  product.stock -= 1;
  await repo.save(product);
  // Le stock est ecrase par la derniere ecriture
}

// Test de race condition
it('demonstrates race condition', async () => {
  await repo.save({ id: 'p1', stock: 10, version: 1 });

  // 10 decrements en parallele — devrait donner stock = 0
  await Promise.all(
    Array.from({ length: 10 }, () => unsafeDecrementStock('p1')),
  );

  const result = await repo.findOneBy({ id: 'p1' });
  // FAIL : stock > 0 car certains decrements ont ete perdus !
  expect(result.stock).not.toBe(0); // Race condition !
});
```

### Distributed lock pour import exclusif

```typescript
@Injectable()
export class ImportService {
  constructor(
    private readonly redis: Redis,
    private readonly importProcessor: ImportProcessor,
  ) {}

  async runImport(tenantId: string, file: Buffer): Promise<ImportResult> {
    const lockKey = `import:${tenantId}`;
    const token = await acquireDistributedLock(this.redis, lockKey, 30_000);

    if (!token) {
      throw new HttpException(
        'An import is already running for this tenant',
        409,
      );
    }

    try {
      return await this.importProcessor.process(tenantId, file);
    } finally {
      await releaseDistributedLock(this.redis, lockKey, token);
    }
  }
}
```

---

## Resume

1. **Event loop Node.js** : un seul thread non-bloquant, I/O async via libuv — ne jamais bloquer avec du CPU lourd
2. **Optimistic locking** (version field) pour 95% des cas web — performant, scalable, retry-friendly
3. **Pessimistic locking** (`SELECT FOR UPDATE`) pour les cas critiques — stock financier, opérations non-idempotentes
4. **Distributed lock** (Redis SETNX + Lua) quand l'app est multi-noeud — toujours avec un TTL et un token unique
5. **Read Committed** par defaut en PostgreSQL — monter le level seulement pour les cas critiques (reporting, finance)

---

> **Prochain cours** : [Cours 27 — Modélisation relationnelle avancee](../04-architecture-bdd/01-modélisation-relationnelle.md) — ou comment concevoir un schema PostgreSQL robuste pour un système multi-tenant.

---

> **Lien fil rouge — ShopArch**
>
> - Implémente l'idempotency key sur le paiement ShopArch pour éviter les doubles charges
> - Gère la concurrence sur le stock avec optimistic locking (If-Match / ETag)
> - Exercice(s) associé(s) : `exercices/16-race-condition-locking/`
> - Checkpoint : Module 03, critère 3-4
