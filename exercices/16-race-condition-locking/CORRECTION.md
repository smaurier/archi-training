# Correction — Exercice 16 : Race condition & locking

## Résultat attendu

Deux implémentations (optimistic + pessimistic) qui garantissent que le stock ne passe jamais en negatif, même sous charge concurrente.

## Race condition expliquee

```
Timeline :
  T0: Thread A → SELECT stock FROM products WHERE id='p1' → stock = 1
  T1: Thread B → SELECT stock FROM products WHERE id='p1' → stock = 1 (meme valeur !)
  T2: Thread A → UPDATE stock = 0 WHERE id='p1' → OK
  T3: Thread B → UPDATE stock = 0 WHERE id='p1' → OK (devrait echouer !)

Resultat : stock = 0, mais DEUX ventes ont ete enregistrees pour 1 seul item.
Le check `if (stock < quantity)` a ete fait AVANT l'ecriture de l'autre thread.
```

## Solution 1 : Optimistic locking

```typescript
// Utilise un champ version dans l'entite
@Entity()
export class Product {
  @PrimaryColumn('uuid')
  id: string;

  @Column()
  stock: number;

  @VersionColumn()
  version: number;
}

@Injectable()
export class ProductService {
  async purchaseOptimistic(
    productId: string,
    quantity: number,
    maxRetries: number = 3,
  ): Promise<void> {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const product = await this.repo.findOneBy({ id: productId });

      if (!product) throw new NotFoundException();
      if (product.stock < quantity) {
        throw new ConflictException('Insufficient stock');
      }

      // UPDATE avec WHERE version = expectedVersion
      const result = await this.repo
        .createQueryBuilder()
        .update(Product)
        .set({
          stock: product.stock - quantity,
          version: product.version + 1,
        })
        .where('id = :id AND version = :version', {
          id: productId,
          version: product.version,
        })
        .execute();

      if (result.affected === 1) {
        return; // Succes
      }

      // 0 rows affected → quelqu'un a modifie entre-temps → retry
      console.log(`Optimistic lock conflict, attempt ${attempt + 1}`);
    }

    throw new ConflictException('Too many concurrent modifications, retry later');
  }
}
```

## Solution 2 : Pessimistic locking

```typescript
@Injectable()
export class ProductService {
  constructor(private readonly dataSource: DataSource) {}

  async purchasePessimistic(productId: string, quantity: number): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      // SELECT ... FOR UPDATE → verrouille la ligne
      const product = await manager
        .getRepository(Product)
        .createQueryBuilder('p')
        .setLock('pessimistic_write') // FOR UPDATE
        .where('p.id = :id', { id: productId })
        .getOne();

      if (!product) throw new NotFoundException();
      if (product.stock < quantity) {
        throw new ConflictException('Insufficient stock');
      }

      product.stock -= quantity;
      await manager.save(product);
      // Le verrou est relache a la fin de la transaction
    });
  }
}
```

## Solution 3 : Distributed lock (Redis)

```typescript
@Injectable()
export class DistributedLockService {
  constructor(private readonly redis: RedisService) {}

  async withLock<T>(
    key: string,
    ttlMs: number,
    fn: () => Promise<T>,
  ): Promise<T> {
    const lockKey = `lock:${key}`;
    const lockValue = crypto.randomUUID();

    // Essayer d'acquerir le lock
    const acquired = await this.redis.set(lockKey, lockValue, 'PX', ttlMs, 'NX');

    if (!acquired) {
      throw new ConflictException('Resource is locked, retry later');
    }

    try {
      return await fn();
    } finally {
      // Relacher le lock (seulement si c'est le notre)
      const script = `
        if redis.call('get', KEYS[1]) == ARGV[1] then
          return redis.call('del', KEYS[1])
        else
          return 0
        end
      `;
      await this.redis.eval(script, 1, lockKey, lockValue);
    }
  }
}

// Usage
await lockService.withLock(`product:${productId}`, 5000, async () => {
  const product = await productRepo.findById(productId);
  if (product.stock < quantity) throw new Error('Insufficient stock');
  product.stock -= quantity;
  await productRepo.save(product);
});
```

## Comparaison

| Critère | Optimistic | Pessimistic | Distributed (Redis) |
|---|---|---|---|
| Performance (faible contention) | Excellente | Bonne | Bonne |
| Performance (haute contention) | Retries fréquents | Attente lock | Rejet immédiat |
| Complexite | Moyenne | Simple | Elevee |
| Risque de deadlock | Aucun | Possible | Aucun (TTL) |
| Quand l'utiliser | Peu de conflits | Conflits fréquents | Multi-instance |

## Test de concurrence

```typescript
describe('Stock race condition', () => {
  it('prevents overselling with optimistic locking', async () => {
    // Creer un produit avec stock = 1
    await productRepo.save({ id: 'p1', stock: 1, version: 1 });

    // 10 achats en parallele
    const results = await Promise.allSettled(
      Array.from({ length: 10 }, () =>
        productService.purchaseOptimistic('p1', 1),
      ),
    );

    const successes = results.filter((r) => r.status === 'fulfilled');
    const failures = results.filter((r) => r.status === 'rejected');

    // Exactement 1 succes, 9 echecs
    expect(successes.length).toBe(1);
    expect(failures.length).toBe(9);

    // Le stock est a 0, pas negatif
    const product = await productRepo.findById('p1');
    expect(product.stock).toBe(0);
  });
});
```

## Ce que tu aurais pu oublier

### 1. Retry sans limite

```typescript
// FAUX — retry infini en cas de haute contention
while (true) {
  try { await purchase(); break; } catch { continue; }
}

// CORRECT — max retries avec backoff
for (let i = 0; i < 3; i++) {
  try { await purchase(); return; } catch { await sleep(100 * (i + 1)); }
}
throw new ConflictException('Max retries exceeded');
```

### 2. Oublier de relacher le lock Redis

```typescript
// FAUX — si fn() throw, le lock n'est jamais relache
const acquired = await redis.set(lockKey, value, 'NX');
await fn(); // Si ca throw, le lock reste !
await redis.del(lockKey);

// CORRECT — try/finally
try { return await fn(); } finally { await redis.del(lockKey); }
```

### 3. UPDATE atomique oublie

```typescript
// FAUX — read-modify-write en 2 requetes
product.stock -= quantity;
await repo.save(product); // UPDATE stock = 0 (valeur calculee en JS)

// AUSSI CORRECT — UPDATE atomique SQL
await repo.query(
  'UPDATE products SET stock = stock - $1 WHERE id = $2 AND stock >= $1',
  [quantity, productId],
);
// Pas de race condition car l'UPDATE est atomique
```

### 4. Deadlock avec pessimistic locking

```
FAUX — deux transactions lock deux lignes dans un ordre different
  → Transaction A lock produit 1, veut produit 2
  → Transaction B lock produit 2, veut produit 1
  → Deadlock !

CORRECT — toujours locker dans le meme ordre (par ID croissant)
  → Ou utiliser un timeout sur le lock
```
