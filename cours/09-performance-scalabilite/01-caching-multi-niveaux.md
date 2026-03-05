# Cours 62 — Caching multi-niveaux

> **Objectif** : Maîtriser l'architecture de cache à 3 niveaux (serveur Nitro/Redis, in-memory, client localStorage), comprendre la surrogate-key invalidation, implémenter ETag à chaque couche, et définir une stratégie de cache par type de route.

---

## Rappel du cours précédent

<details>
<summary>1. Quels sont les 7 principes de Privacy by Design ?</summary>

1. Proactif (pas réactif), 2. Privacy par défaut, 3. Privacy intégrée au design, 4. Fonctionnalité complète (privacy + feature), 5. Sécurité bout en bout, 6. Visibilité et transparence, 7. Respect de l'utilisateur. L'idée est d'intégrer la protection de la vie privée **dès la conception**, pas en bolt-on après coup.
</details>

<details>
<summary>2. Pourquoi aucun script non-nécessaire ne doit se charger avant le consentement CMP ?</summary>

Le GDPR et la directive ePrivacy exigent le **consentement explicite** avant tout traitement de données personnelles (analytics, marketing). Charger un script Matomo ou Facebook Pixel avant le consentement = collecte illégale de données. Le CMP doit bloquer ces scripts et ne les activer qu'après consentement positif.
</details>

---

## Analogie — Les 3 mémoires humaines

Le cerveau a 3 niveaux de mémoire :
- **Registres CPU** = mémoire de travail (3-7 éléments, ~100ms) → **in-memory cache** (Map/LRU, <1ms)
- **RAM** = mémoire court terme (retient pendant la session) → **Redis cache** (partagé entre serveurs, ~1-5ms)
- **Disque** = mémoire long terme (persiste après arrêt) → **CDN / localStorage** (persiste côté client, 0ms local)

Plus la mémoire est proche, plus elle est rapide — mais plus elle est limitée en taille. Le cache multi-niveaux exploite cette hiérarchie.

---

## Théorie

### 1. Les 3 niveaux de cache

```
Client Request
     │
     ▼
┌─────────────────────┐
│  Niveau 1 : CDN     │  Cache public, edge, TTL long
│  (Cloudflare, Akamai)│  → Pages statiques, images
│  ~0ms (edge)         │  Hit ratio : 90%+
└──────────┬──────────┘
           │ MISS
           ▼
┌─────────────────────┐
│  Niveau 2 : Redis   │  Cache partage, server-side
│  (Redis, Memcached)  │  → Reponses API, sessions
│  ~1-5ms              │  Hit ratio : 85%+
└──────────┬──────────┘
           │ MISS
           ▼
┌─────────────────────┐
│  Niveau 3 : DB      │  Source de verite
│  (PostgreSQL)        │  → Toujours a jour
│  ~10-50ms            │
└─────────────────────┘
```

### 2. Redis namespace convention

```
{app}:{feature}:{identifier}

Exemples :
  cms:catalog:product:uuid-123        → Produit cache
  cms:catalog:list:cat-shoes:page-1   → Liste paginee
  cms:auth:jwks:keys                  → Cles JWKS
  cms:search:query:sha256(query)      → Resultat de recherche
  cms:tenant:config:tenant-slug       → Config tenant
```

### 3. Tag-aware cache pools

| Type de contenu | TTL | Tags | Invalidation |
|---|---|---|---|
| Catalogue produits | 1h | `product:{id}`, `category:{id}` | Publish / update |
| Pages CMS | 24h | `page:{id}`, `site:{siteId}` | Content save |
| Config tenant | 5min | `tenant:{tenantId}` | Settings update |
| JWKS keys | 24h | `auth:jwks` | Forced refresh on JWT failure |
| Search results | 5min | `search:{query_hash}` | Re-index |

### 4. Surrogate-key invalidation

```
Reponse API avec surrogate keys :
  HTTP/1.1 200 OK
  Surrogate-Key: product:abc category:shoes tenant:acme
  Cache-Control: public, max-age=3600

Quand le produit est modifie :
  PURGE via API CDN avec le tag "product:abc"
  → Toutes les pages contenant ce produit sont invalidees
  → Pas besoin de connaitre les URLs exactes
```

### 5. Stratégie de cache par route

| Type de route | Cache-Control | Niveau | Exemple |
|---|---|---|---|
| Ultra-statique | `public, max-age=31536000, immutable` | CDN | `/assets/logo.abc123.svg` |
| Éditorial | `public, max-age=3600, s-maxage=86400` | CDN + Redis | `/blog/article-slug` |
| Dynamique authentifié | `private, max-age=0, must-revalidate` | Redis only | `/api/cart` |
| Temps réel | `no-store` | Aucun | `/api/notifications` |

### 6. ETag à chaque couche

```
Requete 1 :
  GET /api/products/123 → 200 OK
  ETag: "abc123"

Requete 2 :
  GET /api/products/123
  If-None-Match: "abc123"
  → 304 Not Modified (0 bytes transferes)

ETag generation :
  hash(version + updatedAt) ou hash(content)
```

---

## Pratique

### Cache service multi-niveaux

```typescript
@Injectable()
export class CacheService {
  private readonly memory = new Map<string, { value: string; expiresAt: number }>();
  private readonly MEMORY_MAX = 1000;

  constructor(private readonly redis: Redis) {}

  async get<T>(key: string): Promise<T | null> {
    // Niveau 1 : in-memory
    const memEntry = this.memory.get(key);
    if (memEntry && memEntry.expiresAt > Date.now()) {
      return JSON.parse(memEntry.value);
    }

    // Niveau 2 : Redis
    const redisValue = await this.redis.get(key);
    if (redisValue) {
      // Promouvoir en memoire locale (1 min)
      this.setMemory(key, redisValue, 60_000);
      return JSON.parse(redisValue);
    }

    return null; // MISS total → aller en DB
  }

  async set<T>(key: string, value: T, ttlMs: number, tags: string[] = []): Promise<void> {
    const serialized = JSON.stringify(value);

    // Ecrire dans Redis
    await this.redis.set(key, serialized, 'PX', ttlMs);

    // Enregistrer les tags pour invalidation
    for (const tag of tags) {
      await this.redis.sadd(`tag:${tag}`, key);
      await this.redis.pexpire(`tag:${tag}`, ttlMs);
    }

    // Promouvoir en memoire locale
    this.setMemory(key, serialized, Math.min(ttlMs, 60_000));
  }

  async invalidateByTag(tag: string): Promise<number> {
    const keys = await this.redis.smembers(`tag:${tag}`);

    if (keys.length > 0) {
      await this.redis.del(...keys);
      // Nettoyer aussi la memoire locale
      for (const key of keys) {
        this.memory.delete(key);
      }
    }

    await this.redis.del(`tag:${tag}`);
    return keys.length;
  }

  private setMemory(key: string, value: string, ttlMs: number): void {
    // Eviction LRU simple (supprimer le plus ancien si plein)
    if (this.memory.size >= this.MEMORY_MAX) {
      const oldest = this.memory.keys().next().value;
      if (oldest) this.memory.delete(oldest);
    }
    this.memory.set(key, { value, expiresAt: Date.now() + ttlMs });
  }
}
```

### Utilisation avec tag invalidation

```typescript
@Injectable()
export class ProductService {
  constructor(
    private readonly cache: CacheService,
    private readonly repo: ProductRepository,
  ) {}

  async findById(id: string): Promise<Product> {
    const cacheKey = `cms:catalog:product:${id}`;

    const cached = await this.cache.get<Product>(cacheKey);
    if (cached) return cached;

    const product = await this.repo.findById(id);

    await this.cache.set(cacheKey, product, 3600_000, [
      `product:${id}`,
      `category:${product.categoryId}`,
    ]);

    return product;
  }

  async update(id: string, data: UpdateProductDto): Promise<Product> {
    const product = await this.repo.update(id, data);

    // Invalider TOUT ce qui depend de ce produit
    await this.cache.invalidateByTag(`product:${id}`);

    return product;
  }
}
```

### ETag middleware

```typescript
function etagMiddleware(req: Request, res: Response, next: NextFunction): void {
  const originalJson = res.json.bind(res);

  res.json = (body: unknown) => {
    const etag = `"${createHash('md5').update(JSON.stringify(body)).digest('hex')}"`;

    res.setHeader('ETag', etag);

    // Client a deja cette version ?
    if (req.headers['if-none-match'] === etag) {
      res.status(304).end();
      return res;
    }

    return originalJson(body);
  };

  next();
}
```

---

## Résumé

1. **3 niveaux** : CDN (edge, ~0ms) → Redis (partagé, ~1-5ms) → DB (source de vérité, ~10-50ms)
2. **Namespace convention** : `{app}:{feature}:{key}` — structure prédictible et invalidable
3. **Tag-aware invalidation** : associer des tags aux clés, purger par tag (pas par URL) — surrogate keys côté CDN
4. **ETag / If-None-Match** : économiser la bande passante avec 304 Not Modified
5. **Stratégie par route** : immutable pour les assets, public+TTL pour l'éditorial, private pour l'authentifié, no-store pour le temps réel

---

> **Prochain cours** : [Cours 63 — CDN, Edge Computing & Image Pipeline](./02-cdn-edge-images.md)

---

> **Lien fil rouge — ShopArch**
>
> - Implémente le cache Redis 3 niveaux pour ShopArch (HTTP, application, query)
> - Définis les stratégies d'invalidation par entité (product update → invalider le cache catalogue)
> - Exercice(s) associé(s) : `exercices/42-cache-multi-niveaux/`
> - Checkpoint : Module 09, critère 1
