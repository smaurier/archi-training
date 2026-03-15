# Correction — Exercice 31 : BFF pour e-commerce

## BFF Home endpoint

```typescript
// bff-home.controller.ts
@Controller('bff')
export class BffHomeController {
  constructor(
    private readonly catalog: CatalogClient,
    private readonly cart: CartClient,
    private readonly promo: PromoClient,
    private readonly cache: CacheService,
  ) {}

  @Get('home')
  async getHome(
    @Headers('x-tenant-id') tenantId: string,
    @Headers('x-device-type') device: 'mobile' | 'tablet' | 'desktop',
    @CurrentUser() user?: { id: string },
  ) {
    const [popularProducts, categories, promotions, cartSummary] = await Promise.all([
      this.withFallback(() => this.catalog.getPopular(tenantId, device === 'mobile' ? 8 : 16), []),
      this.withFallback(() => this.getCachedCategories(tenantId), []),
      this.withFallback(() => this.getCachedPromotions(tenantId), []),
      user ? this.withFallback(() => this.cart.getSummary(user.id, tenantId), { count: 0 }) : { count: 0 },
    ]);

    return {
      popular: this.adaptProducts(popularProducts, device),
      categories,
      promotions,
      cart: cartSummary,
    };
  }

  private async withFallback<T>(fn: () => Promise<T>, fallback: T, timeoutMs = 2000): Promise<T> {
    try {
      return await Promise.race([
        fn(),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Timeout')), timeoutMs)),
      ]);
    } catch {
      return fallback;
    }
  }

  private async getCachedCategories(tenantId: string) {
    const key = `bff:categories:${tenantId}`;
    const cached = await this.cache.get(key);
    if (cached) return cached;

    const categories = await this.catalog.getCategories(tenantId);
    await this.cache.set(key, categories, 300); // 5 min
    return categories;
  }

  private async getCachedPromotions(tenantId: string) {
    const key = `bff:promos:${tenantId}`;
    const cached = await this.cache.get(key);
    if (cached) return cached;

    const promos = await this.promo.getActive(tenantId);
    await this.cache.set(key, promos, 60); // 1 min
    return promos;
  }

  private adaptProducts(products: Product[], device: string) {
    if (device === 'mobile') {
      return products.map(({ id, name, price, thumbnail }) => ({
        id, name, price, image: thumbnail,
      }));
    }
    return products.map(({ id, name, description, price, images, rating }) => ({
      id, name, description, price, images, rating,
    }));
  }
}
```

## BFF Product detail

```typescript
// bff-product.controller.ts
@Get('product/:id')
async getProduct(
  @Param('id') productId: string,
  @Headers('x-tenant-id') tenantId: string,
  @Headers('x-device-type') device: string,
  @CurrentUser() user?: { id: string },
) {
  const [product, relatedProducts, cartStatus] = await Promise.all([
    this.catalog.getProduct(productId, tenantId),
    device !== 'mobile'
      ? this.withFallback(() => this.catalog.getRelated(productId, tenantId, 4), [])
      : Promise.resolve([]),
    user
      ? this.withFallback(() => this.cart.isInCart(user.id, productId, tenantId), false)
      : false,
  ]);

  if (!product) throw new NotFoundException();

  return {
    ...this.adaptProduct(product, device),
    related: relatedProducts.map(({ id, name, price, thumbnail }) => ({
      id, name, price, image: thumbnail,
    })),
    isInCart: cartStatus,
  };
}
```

## Service client avec circuit breaker

```typescript
// service-client.base.ts
export abstract class ServiceClient {
  protected readonly baseUrl: string;
  private failures = 0;
  private circuitOpen = false;
  private circuitOpenedAt = 0;
  private readonly FAILURE_THRESHOLD = 5;
  private readonly RECOVERY_TIMEOUT = 30000; // 30s

  protected async request<T>(path: string, options?: RequestInit): Promise<T> {
    // Circuit breaker check
    if (this.circuitOpen) {
      if (Date.now() - this.circuitOpenedAt > this.RECOVERY_TIMEOUT) {
        this.circuitOpen = false; // half-open
      } else {
        throw new Error('Circuit open');
      }
    }

    try {
      const res = await fetch(`${this.baseUrl}${path}`, {
        ...options,
        headers: { 'Content-Type': 'application/json', ...options?.headers },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      this.failures = 0;
      return res.json();
    } catch (error) {
      this.failures++;
      if (this.failures >= this.FAILURE_THRESHOLD) {
        this.circuitOpen = true;
        this.circuitOpenedAt = Date.now();
      }
      throw error;
    }
  }
}

// catalog.client.ts
@Injectable()
export class CatalogClient extends ServiceClient {
  protected baseUrl = process.env.CATALOG_SERVICE_URL!;

  async getPopular(tenantId: string, limit: number): Promise<Product[]> {
    return this.request(`/products/popular?limit=${limit}`, {
      headers: { 'X-Tenant-ID': tenantId },
    });
  }

  async getCategories(tenantId: string): Promise<Category[]> {
    return this.request('/categories', {
      headers: { 'X-Tenant-ID': tenantId },
    });
  }
}
```

## Cache service

```typescript
// cache.service.ts
@Injectable()
export class CacheService {
  constructor(private readonly redis: Redis) {}

  async get<T>(key: string): Promise<T | null> {
    const value = await this.redis.get(key);
    return value ? JSON.parse(value) : null;
  }

  async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    await this.redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
  }

  async invalidate(pattern: string): Promise<void> {
    const keys = await this.redis.keys(pattern);
    if (keys.length > 0) await this.redis.del(...keys);
  }
}
```

## Alternatives et arbitrages

> En architecture, ta valeur n'est pas de connaître UNE solution,
> mais de savoir POURQUOI tu choisis celle-ci plutôt qu'une autre.

### Option A : REST BFF (solution présentée)
**Quand la choisir :** Un BFF par type de client (mobile, web, admin), agrégation de plusieurs services backend, transformation/filtrage des données pour le client, caching HTTP standard.
**Limites :** Un BFF supplémentaire à maintenir par type de client, risque de dupliquer de la logique entre BFFs, overhead réseau (client → BFF → services).

### Option B : GraphQL BFF
**Quand la choisir :** Clients avec des besoins de données très variés, le client choisit exactement les champs nécessaires, schema stitching pour fédérer plusieurs services.
**Limites :** Complexité du serveur GraphQL (resolvers, DataLoader N+1), pas de caching HTTP natif, queries arbitraires = risque de DoS (query depth limiting nécessaire).

### Option C : Pas de BFF (client → services directs)
**Quand la choisir :** Un seul backend, API déjà bien adaptée au client, pas de besoin d'agrégation, architecture simple.
**Limites :** Le client fait N appels au lieu d'un seul (latence mobile), logique d'agrégation dans le client (complexité frontend), couplage client ↔ services.

### Matrice de décision
| Critère | REST BFF | GraphQL BFF | Pas de BFF |
|---|---|---|---|
| Contrôle client | Moyen | Excellent | Faible |
| Caching HTTP | Natif | Complexe | Natif |
| Complexité infra | Moyenne | Élevée | Nulle |
| Performance mobile | Excellente (1 appel) | Excellente (1 appel) | Mauvaise (N appels) |
| Maintenance | 1 BFF/client | 1 GraphQL partagé | 0 |

### Pour ShopArch, on choisit...
REST BFF car on a deux clients distincts (front-office web et back-office admin) avec des besoins de données très différents. Le BFF web agrège catalogue + panier + promos en un seul appel. GraphQL serait pertinent si on avait >3 clients avec des besoins très variés, mais pour 2 clients le REST BFF est plus simple à cacher et monitorer.

---

## Ce que tu aurais pu oublier

### 1. Appels sequentiels
```
FAUX — await catalogService(); await cartService(); await promoService(); (sequentiel = somme des latences)
CORRECT — Promise.all([catalog, cart, promo]) (parallele = max des latences)
```

### 2. Logique métier dans le BFF
```
FAUX — le BFF calcule des prix, applique des promotions, valide le stock
CORRECT — le BFF ne fait qu'agreger et transformer les reponses des services
         La logique metier reste dans les microservices
```

### 3. Erreur si un service est down
```
FAUX — si le service Promo est down, toute la page d'accueil retourne 500
CORRECT — fallback par service : promotions = [] si down, le reste fonctionne
```

### 4. Cache des données utilisateur
```
FAUX — cacher le panier de l'utilisateur (il voit des donnees stale)
CORRECT — cacher uniquement les donnees partagees (categories, promos)
         Les donnees utilisateur (panier, profil) sont toujours fresh
```

### 5. Même réponse pour tous les devices
```
FAUX — mobile recoit 16 produits avec descriptions completes et 5 images chacun
CORRECT — adapter la reponse au device : mobile = 8 produits, thumbnail only, pas de description
```
