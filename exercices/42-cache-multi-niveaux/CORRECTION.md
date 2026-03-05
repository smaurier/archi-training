# Correction — Exercice 42 : Cache multi-niveaux

## Cache navigateur (L1)

```typescript
// cache-headers.interceptor.ts
@Injectable()
export class CacheHeadersInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler) {
    const req = context.switchToHttp().getRequest();
    const res = context.switchToHttp().getResponse();

    return next.handle().pipe(
      map((body) => {
        const path = req.path;

        if (path.startsWith('/products') && req.method === 'GET') {
          // Pages produit : cache court + stale-while-revalidate
          res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
          res.setHeader('Surrogate-Control', 'max-age=300'); // CDN cache plus long
          res.setHeader('Vary', 'X-Tenant-ID, Accept-Language');
        } else if (path.startsWith('/cart') || path.startsWith('/checkout')) {
          // Pages privees : jamais cache
          res.setHeader('Cache-Control', 'private, no-store');
          res.setHeader('Surrogate-Control', 'no-store');
        }

        // ETag pour validation conditionnelle
        if (body && req.method === 'GET') {
          const etag = `"${createHash('md5').update(JSON.stringify(body)).digest('hex')}"`;
          res.setHeader('ETag', etag);

          if (req.headers['if-none-match'] === etag) {
            res.status(304).end();
            return;
          }
        }

        return body;
      }),
    );
  }
}
```

## Cache Redis (L3) — Cache-Aside

```typescript
// product-cache.service.ts
@Injectable()
export class ProductCacheService {
  private readonly TTL_PRODUCT = 300; // 5 min
  private readonly TTL_SEARCH = 60;   // 1 min

  constructor(
    private readonly redis: Redis,
    private readonly productRepo: Repository<Product>,
  ) {}

  async getProduct(id: string, tenantId: string): Promise<Product | null> {
    const key = `product:${tenantId}:${id}`;

    // 1. Lire depuis le cache
    const cached = await this.redis.get(key);
    if (cached) {
      return JSON.parse(cached);
    }

    // 2. Cache miss → lire depuis la DB
    const product = await this.productRepo.findOne({ where: { id, tenantId } });
    if (!product) return null;

    // 3. Mettre en cache
    await this.redis.set(key, JSON.stringify(product), 'EX', this.TTL_PRODUCT);

    return product;
  }

  async searchProducts(query: string, tenantId: string): Promise<Product[]> {
    const key = `search:${tenantId}:${createHash('md5').update(query).digest('hex')}`;

    const cached = await this.redis.get(key);
    if (cached) return JSON.parse(cached);

    const results = await this.productRepo.find({ /* search query */ });
    await this.redis.set(key, JSON.stringify(results), 'EX', this.TTL_SEARCH);

    return results;
  }
}
```

## Invalidation cohérente

```typescript
// cache-invalidation.service.ts
@Injectable()
export class CacheInvalidationService {
  constructor(
    private readonly redis: Redis,
    private readonly cdnClient: CDNClient,
  ) {}

  @OnEvent('ProductUpdated')
  async onProductUpdated(event: { productId: string; tenantId: string; categoryId: string }) {
    // 1. Invalider Redis (L3)
    await this.invalidateRedis(event);

    // 2. Purger CDN (L2) — le navigateur (L1) re-validera via ETag
    await this.purgeCDN(event);
  }

  private async invalidateRedis(event: { productId: string; tenantId: string; categoryId: string }) {
    const pipeline = this.redis.pipeline();

    // Invalider le produit specifique
    pipeline.del(`product:${event.tenantId}:${event.productId}`);

    // Invalider les recherches (par pattern)
    const searchKeys = await this.redis.keys(`search:${event.tenantId}:*`);
    if (searchKeys.length > 0) {
      pipeline.del(...searchKeys);
    }

    // Invalider les listes par categorie
    pipeline.del(`category:${event.tenantId}:${event.categoryId}:products`);

    await pipeline.exec();
  }

  private async purgeCDN(event: { productId: string; tenantId: string }) {
    // Purge par URL
    await this.cdnClient.purge([
      `/products/${event.productId}`,
      `/api/products/${event.productId}`,
    ]);

    // Purge par tag (tous les produits de la categorie)
    await this.cdnClient.purgeByTag(`tenant:${event.tenantId}`);
  }
}

// cdn-client.ts — abstraction du CDN
@Injectable()
export class CDNClient {
  private readonly apiUrl = process.env.CDN_API_URL!;
  private readonly apiKey = process.env.CDN_API_KEY!;

  async purge(urls: string[]): Promise<void> {
    await fetch(`${this.apiUrl}/purge`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ files: urls }),
    });
  }

  async purgeByTag(tag: string): Promise<void> {
    await fetch(`${this.apiUrl}/purge/tags`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ tags: [tag] }),
    });
  }
}
```

## Cache L0 in-process (bonus)

```typescript
// local-cache.ts — cache in-process pour les hot keys
export class LocalCache<T> {
  private cache = new Map<string, { value: T; expiresAt: number }>();

  get(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return undefined;
    }
    return entry.value;
  }

  set(key: string, value: T, ttlMs: number): void {
    // Limiter la taille pour eviter les fuites memoire
    if (this.cache.size > 1000) {
      const oldest = this.cache.keys().next().value;
      if (oldest) this.cache.delete(oldest);
    }
    this.cache.set(key, { value, expiresAt: Date.now() + ttlMs });
  }

  invalidate(key: string): void {
    this.cache.delete(key);
  }
}

// Usage : L0 → L3 (Redis) → DB
async getProduct(id: string, tenantId: string): Promise<Product | null> {
  const cacheKey = `${tenantId}:${id}`;

  // L0 — in-process (< 1ms)
  const local = this.localCache.get(cacheKey);
  if (local) return local;

  // L3 — Redis (< 5ms)
  const redis = await this.redis.get(`product:${cacheKey}`);
  if (redis) {
    const product = JSON.parse(redis);
    this.localCache.set(cacheKey, product, 10000); // L0 TTL = 10s
    return product;
  }

  // DB (< 50ms)
  const product = await this.productRepo.findOne({ where: { id, tenantId } });
  if (product) {
    await this.redis.set(`product:${cacheKey}`, JSON.stringify(product), 'EX', 300);
    this.localCache.set(cacheKey, product, 10000);
  }
  return product;
}
```

## Ce que tu aurais pu oublier

### 1. Cache sans Vary header
```
FAUX — meme cache pour tous les tenants (tenant A voit les produits de tenant B)
CORRECT — Vary: X-Tenant-ID pour que le CDN cache separement par tenant
```

### 2. Invalider uniquement Redis
```
FAUX — invalider Redis mais oublier le CDN (le CDN sert la version stale pendant 5 min)
CORRECT — invalider les 3 niveaux : Redis + CDN purge + le browser re-valide via ETag
```

### 3. Cache du panier dans le CDN
```
FAUX — le CDN cache la page panier (tous les users voient le meme panier)
CORRECT — Cache-Control: private, no-store pour les donnees utilisateur
         Le CDN ne doit JAMAIS cacher des donnees specifiques a un user
```

### 4. Invalidation par keys pattern
```
FAUX — redis.keys('search:*') en production (bloque Redis)
CORRECT — utiliser SCAN au lieu de KEYS, ou invalider par tag/set
         Ou accepter le TTL court (1 min) pour les recherches
```
