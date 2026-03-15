# Correction — Exercice 10b : Context Map

## Résultat attendu

Un Context Map formel avec des patterns DDD nommes et des domain events définis.

## Context Map

```
                    ┌─────────────────┐
                    │    Identity     │
                    │    Context      │
                    │  (Open Host)    │
                    └────────┬────────┘
                             │ OHS / Published Language
               ┌─────────────┼─────────────┐
               ▼             ▼             ▼
        ┌────────────┐ ┌──────────┐ ┌───────────┐
        │  Catalog   │ │  Order   │ │  Payment  │
        │  Context   │ │  Context │ │  Context  │
        │            │ │ (ACL←Cat)│ │(Conformist│
        │(OHS: API)  │ │          │ │ ←Stripe)  │
        └─────┬──────┘ └────┬─────┘ └─────┬─────┘
              │              │             │
              │    ACL       │  Cust/Supp  │
              └──────────────┘─────────────┘

Shared Kernel : @shoparch/shared-types (Money, UUID, DateRange)
```

## Relations detaillees

| Upstream | Downstream | Pattern | Justification |
|---|---|---|---|
| Identity | Catalog, Order, Payment | **Open Host Service** | Identity expose OIDC/JWKS — protocole standard |
| Catalog | Order | **ACL** | Order traduit CatalogProduct → OrderLine (modèles très différents) |
| Order | Payment | **Customer/Supplier** | Payment s'adapte aux besoins d'Order (même équipe) |
| Stripe (externe) | Payment | **Conformist** | On accepte le modèle Stripe tel quel (pas le choix) |
| — | — | **Shared Kernel** | `@shoparch/shared-types` : Money, UUID |

## Anti-Corruption Layer : Catalog → Order

```typescript
// order/acl/catalog-product-translator.ts
// L'ACL traduit le modele du Catalog vers le modele de l'Order

interface CatalogProduct {
  id: string;
  name: MultiLangField;
  price: { amount: number; currency: string };
  images: { url: string; alt: string }[];
  // ... plein de champs catalogue
}

interface OrderLine {
  productId: string;
  productName: string;  // String simple, fige
  unitPrice: Money;     // Copie, pas reference
  quantity: number;
}

export class CatalogACL {
  toOrderLine(product: CatalogProduct, quantity: number, locale: string): OrderLine {
    return {
      productId: product.id,
      productName: product.name.get(locale),  // Figer dans la locale
      unitPrice: new Money(product.price.amount, product.price.currency),
      quantity,
    };
  }
}
```

## Domain Events

| Event | Emetteur | Consommateur(s) | Payload |
|---|---|---|---|
| `product.published` | Catalog | Search, Marketing | `{ productId, name, category, price }` |
| `product.priceChanged` | Catalog | Cart (recalcul) | `{ productId, oldPrice, newPrice }` |
| `order.created` | Order | Inventory, Notification | `{ orderId, lines[], userId }` |
| `order.paid` | Order | Inventory (stock--), Notification | `{ orderId, paymentId, total }` |
| `order.shipped` | Order | Notification | `{ orderId, trackingNumber }` |
| `payment.succeeded` | Payment | Order (confirm) | `{ paymentId, orderId, amount }` |
| `payment.failed` | Payment | Order (cancel), Notification | `{ paymentId, orderId, reason }` |
| `user.registered` | Identity | Notification, Marketing | `{ userId, email }` |

```typescript
// Exemple d'event immutable
interface DomainEvent<T> {
  readonly eventId: string;        // UUID unique
  readonly eventType: string;      // 'order.created'
  readonly occurredAt: string;     // ISO 8601
  readonly aggregateId: string;    // ID de l'entite source
  readonly payload: T;             // Donnees specifiques
}

const event: DomainEvent<OrderCreatedPayload> = {
  eventId: crypto.randomUUID(),
  eventType: 'order.created',
  occurredAt: new Date().toISOString(),
  aggregateId: order.id,
  payload: {
    orderId: order.id,
    userId: order.userId,
    lines: order.lines,
    total: order.total,
  },
};
```

## Fallback si un context est indisponible

```typescript
// Si le Catalog est down, Order utilise un cache
class ResilientCatalogACL {
  constructor(
    private readonly catalogClient: CatalogClient,
    private readonly cache: CacheService,
  ) {}

  async getProduct(productId: string): Promise<CatalogProduct> {
    try {
      const product = await this.catalogClient.findById(productId);
      await this.cache.set(`catalog:product:${productId}`, product, 3600);
      return product;
    } catch {
      const cached = await this.cache.get(`catalog:product:${productId}`);
      if (cached) return cached;
      throw new ServiceUnavailableException('Catalog service unavailable');
    }
  }
}
```

## Ce que tu aurais pu oublier

### 1. Nommer les events au present au lieu du passe

```
FAUX — 'order.create', 'payment.process'
  → Un event represente quelque chose qui S'EST PASSE

CORRECT — 'order.created', 'payment.succeeded'
  → Passe compose : c'est un fait, immutable
```

### 2. Mettre trop de données dans les events

```
FAUX — l'event order.created contient tout le User, tout le Product, etc.
  → Couplage fort, payload enorme

CORRECT — l'event contient les IDs + les donnees minimales necessaires
  → Le consommateur peut appeler l'API si il a besoin de plus
```

### 3. Oublier le Conformist pour les services externes

```
FAUX — Essayer de traduire le modele Stripe dans un ACL complexe
  → Stripe change son API → maintenance lourde

CORRECT — Conformist : accepter le modele Stripe tel quel dans le Payment Context
  → L'ACL est entre Payment et Order, pas entre Payment et Stripe
```
