# Exercice 03 — Injection de dépendances

> 🟢 **Difficulté** : Découverte | **Temps estimé** : 1h | **Ère** : 1 — Les Fondations
>
> **Prérequis** : Module 00 (cours 5)


## Objectif

Transformer un code tightly-coupled en code testable grace a l'injection de dépendances. Comprendre les différents scopes d'injection.

## Temps estime

45 min

## Contexte

L'application e-commerce ShopArch a un `ProductService` qui dépend directement de PostgreSQL, Redis et d'un service externe de pricing. Impossible de le tester sans infra reelle.

## Code a refactorer

```typescript
// product.service.ts — A REFACTORER
import { Pool } from 'pg';
import Redis from 'ioredis';
import axios from 'axios';

export class ProductService {
  private db = new Pool({ connectionString: process.env.DATABASE_URL });
  private cache = new Redis(process.env.REDIS_URL);

  async getProduct(id: string): Promise<Product> {
    // 1. Check cache
    const cached = await this.cache.get(`product:${id}`);
    if (cached) return JSON.parse(cached);

    // 2. Query DB
    const result = await this.db.query('SELECT * FROM products WHERE id = $1', [id]);
    if (result.rows.length === 0) throw new Error('Product not found');

    const product = result.rows[0] as Product;

    // 3. Enrichir avec le prix externe
    const priceResponse = await axios.get(
      `https://pricing-api.internal/products/${id}/price`
    );
    product.currentPrice = priceResponse.data.price;

    // 4. Mettre en cache
    await this.cache.set(`product:${id}`, JSON.stringify(product), 'EX', 300);

    return product;
  }

  async searchProducts(query: string): Promise<Product[]> {
    const result = await this.db.query(
      "SELECT * FROM products WHERE name ILIKE $1 LIMIT 20",
      [`%${query}%`]
    );
    return result.rows as Product[];
  }
}
```

## Instructions

### Étape 1 — Identifier les dépendances (5 min)

Liste les 3 dépendances concretes et leur role.

### Étape 2 — Créer les interfaces (10 min)

Definis une interface pour chaque dépendance :
- `ProductRepository` — accès aux données produit
- `CacheService` — cache key-value avec TTL
- `PricingClient` — récupération du prix externe

### Étape 3 — Refactorer le service (15 min)

Reecris `ProductService` pour qu'il recoive ses dépendances par le constructeur.

### Étape 4 — Écrire un test (15 min)

Ecris un test unitaire de `getProduct()` :
- Mock du `ProductRepository` qui retourne un produit
- Mock du `CacheService` qui retourne `null` (cache miss)
- Mock du `PricingClient` qui retourne un prix
- Verifie que le produit est enrichi et mis en cache

## Bonus

- Implemente un `InMemoryCacheService` pour les tests (pas un mock, une vraie implémentation en mémoire)
- Configure les scopes NestJS : `ProductRepository` en `REQUEST` scope, `CacheService` en `SINGLETON`

## Contraintes

- Zero `new` dans `ProductService`
- Zero import de `pg`, `ioredis`, ou `axios` dans `ProductService`
- Zero `process.env` dans `ProductService`
