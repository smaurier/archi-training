# Correction — Exercice 03 : Injection de dépendances

## Résultat attendu

Un `ProductService` découplé de toute infrastructure, testable avec de simples mocks.

## Interfaces

```typescript
// interfaces/product-repository.ts
export interface ProductRepository {
  findById(id: string): Promise<Product | null>;
  search(query: string, limit?: number): Promise<Product[]>;
}

// interfaces/cache-service.ts
export interface CacheService {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds: number): Promise<void>;
}

// interfaces/pricing-client.ts
export interface PricingClient {
  getPrice(productId: string): Promise<number>;
}
```

## ProductService refactore

```typescript
// product.service.ts
import { ProductRepository } from './interfaces/product-repository';
import { CacheService } from './interfaces/cache-service';
import { PricingClient } from './interfaces/pricing-client';

export class ProductService {
  // Les 3 dependances sont des INTERFACES — pas d'import de pg, redis, axios
  constructor(
    private readonly productRepo: ProductRepository,
    private readonly cache: CacheService,
    private readonly pricingClient: PricingClient,
  ) {}

  async getProduct(id: string): Promise<Product> {
    // 1. Check cache
    const cached = await this.cache.get(`product:${id}`);
    if (cached) return JSON.parse(cached);

    // 2. Query via le repository (abstraction)
    const product = await this.productRepo.findById(id);
    if (!product) throw new Error(`Product ${id} not found`);

    // 3. Enrichir avec le prix externe
    product.currentPrice = await this.pricingClient.getPrice(id);

    // 4. Mettre en cache (5 min)
    await this.cache.set(`product:${id}`, JSON.stringify(product), 300);

    return product;
  }

  async searchProducts(query: string): Promise<Product[]> {
    return this.productRepo.search(query, 20);
  }
}
```

## Test unitaire

```typescript
// product.service.test.ts
import { describe, it, expect, vi } from 'vitest';
import { ProductService } from './product.service';

const mockProduct: Product = {
  id: 'p-001',
  name: 'T-shirt',
  description: 'Coton bio',
  currentPrice: 0,
};

// Mocks — zero infra
const mockRepo = {
  findById: vi.fn().mockResolvedValue({ ...mockProduct }),
  search: vi.fn().mockResolvedValue([mockProduct]),
};

const mockCache = {
  get: vi.fn().mockResolvedValue(null), // Cache miss par defaut
  set: vi.fn().mockResolvedValue(undefined),
};

const mockPricing = {
  getPrice: vi.fn().mockResolvedValue(29.99),
};

describe('ProductService', () => {
  const service = new ProductService(mockRepo, mockCache, mockPricing);

  beforeEach(() => {
    vi.clearAllMocks();
    mockCache.get.mockResolvedValue(null); // Reset cache miss
  });

  it('retourne le produit enrichi en cas de cache miss', async () => {
    const product = await service.getProduct('p-001');

    // Le repo a ete appele
    expect(mockRepo.findById).toHaveBeenCalledWith('p-001');
    // Le pricing a ete appele
    expect(mockPricing.getPrice).toHaveBeenCalledWith('p-001');
    // Le prix est enrichi
    expect(product.currentPrice).toBe(29.99);
    // Le cache a ete set
    expect(mockCache.set).toHaveBeenCalledWith(
      'product:p-001',
      expect.any(String),
      300,
    );
  });

  it('retourne le cache sans appeler le repo ni le pricing', async () => {
    // Simule un cache hit
    mockCache.get.mockResolvedValue(JSON.stringify({ ...mockProduct, currentPrice: 29.99 }));

    const product = await service.getProduct('p-001');

    // Le repo n'a PAS ete appele
    expect(mockRepo.findById).not.toHaveBeenCalled();
    // Le pricing n'a PAS ete appele
    expect(mockPricing.getPrice).not.toHaveBeenCalled();
    // Le produit vient du cache
    expect(product.currentPrice).toBe(29.99);
  });

  it('throw si le produit n\'existe pas', async () => {
    mockRepo.findById.mockResolvedValue(null);

    await expect(service.getProduct('unknown')).rejects.toThrow('not found');
  });
});
```

## Bonus — InMemoryCacheService

```typescript
// in-memory-cache.service.ts
import { CacheService } from './interfaces/cache-service';

export class InMemoryCacheService implements CacheService {
  // Map avec expiration — utile pour les tests d'integration sans Redis
  private store = new Map<string, { value: string; expiresAt: number }>();

  async get(key: string): Promise<string | null> {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key); // Expire
      return null;
    }
    return entry.value;
  }

  async set(key: string, value: string, ttlSeconds: number): Promise<void> {
    this.store.set(key, {
      value,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }
}
```

## Ce que tu aurais pu oublier

### 1. Garder `process.env` dans le service

```typescript
// FAUX — le service connait la configuration
constructor() {
  this.cache = new Redis(process.env.REDIS_URL);
}

// CORRECT — l'env est resolu AILLEURS (module, factory, main.ts)
constructor(private readonly cache: CacheService) {}
```

### 2. Typer le retour du cache comme `any`

```typescript
// FAUX
const cached = await this.cache.get(key); // string | null
return cached; // Pas de parsing !

// CORRECT
const cached = await this.cache.get(key);
if (cached) return JSON.parse(cached) as Product;
```

### 3. Ne pas tester le cas cache hit

Le cache hit est le chemin le plus fréquent en production. Si tu ne le testes pas, tu ne verifies pas que le repo et le pricing sont bien court-circuites.

### 4. Confondre scope SINGLETON et REQUEST

```typescript
// SINGLETON : une seule instance pour toute l'app
// Bon pour : cache, logger, configuration
@Injectable({ scope: Scope.DEFAULT }) // = singleton
class RedisCacheService implements CacheService {}

// REQUEST : une nouvelle instance par requete HTTP
// Bon pour : contexte tenant, contexte utilisateur
@Injectable({ scope: Scope.REQUEST })
class TenantProductRepository implements ProductRepository {}
```
