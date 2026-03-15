# Correction — Exercice 05 : Layered to Hexagonal

## Interfaces (ports sortants)

```typescript
// domain/ports/order-repository.ts
export interface OrderRepository {
  save(order: Order): Promise<Order>;
  findById(id: string): Promise<Order | null>;
}

// domain/ports/inventory-client.ts
export interface InventoryClient {
  checkStock(productId: string): Promise<{ available: number }>;
  reserve(productId: string, quantity: number, orderId: string): Promise<void>;
}

// domain/ports/pricing-client.ts
export interface PricingClient {
  getPrice(productId: string): Promise<number>;
}

// domain/ports/notification-service.ts
export interface NotificationService {
  sendOrderConfirmation(order: Order): Promise<void>;
}
```

## Entité de domaine

```typescript
// domain/order.ts
export interface OrderItem {
  productId: string;
  quantity: number;
  unitPrice: number;
}

export interface Order {
  id?: string;
  userId: string;
  items: OrderItem[];
  subtotal: number;
  tax: number;
  total: number;
  status: string;
  createdAt: Date;
}
```

## OrderService refactore

```typescript
// domain/order.service.ts
// AUCUN import d'infra — uniquement des interfaces et des entites de domaine

import { OrderRepository } from './ports/order-repository';
import { InventoryClient } from './ports/inventory-client';
import { PricingClient } from './ports/pricing-client';
import { NotificationService } from './ports/notification-service';
import { Order, OrderItem } from './order';

const TAX_RATE = 0.2;

export class OrderService {
  constructor(
    private readonly orderRepo: OrderRepository,
    private readonly inventory: InventoryClient,
    private readonly pricing: PricingClient,
    private readonly notifications: NotificationService,
  ) {}

  async createOrder(
    userId: string,
    items: Array<{ productId: string; quantity: number }>,
  ): Promise<Order> {
    // 1. Verifier le stock
    await this.verifyStock(items);

    // 2. Calculer les prix
    const pricedItems = await this.priceItems(items);

    // 3. Calculer les totaux
    const subtotal = pricedItems.reduce(
      (sum, item) => sum + item.unitPrice * item.quantity,
      0,
    );
    const tax = subtotal * TAX_RATE;
    const total = subtotal + tax;

    // 4. Creer et sauvegarder la commande
    const order = await this.orderRepo.save({
      userId,
      items: pricedItems,
      subtotal,
      tax,
      total,
      status: 'created',
      createdAt: new Date(),
    });

    // 5. Envoyer la confirmation
    await this.notifications.sendOrderConfirmation(order);

    // 6. Reserver le stock
    for (const item of pricedItems) {
      await this.inventory.reserve(item.productId, item.quantity, order.id!);
    }

    return order;
  }

  private async verifyStock(
    items: Array<{ productId: string; quantity: number }>,
  ): Promise<void> {
    for (const item of items) {
      const stock = await this.inventory.checkStock(item.productId);
      if (stock.available < item.quantity) {
        throw new Error(`Insufficient stock for product ${item.productId}`);
      }
    }
  }

  private async priceItems(
    items: Array<{ productId: string; quantity: number }>,
  ): Promise<OrderItem[]> {
    return Promise.all(
      items.map(async (item) => ({
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: await this.pricing.getPrice(item.productId),
      })),
    );
  }
}
```

## Test unitaire

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OrderService } from './order.service';

const mockOrderRepo = {
  save: vi.fn(async (order) => ({ ...order, id: 'order-001' })),
  findById: vi.fn(),
};

const mockInventory = {
  checkStock: vi.fn(async () => ({ available: 100 })),
  reserve: vi.fn(async () => {}),
};

const mockPricing = {
  getPrice: vi.fn(async (productId: string) => {
    const prices: Record<string, number> = {
      'prod-1': 25.00,
      'prod-2': 10.00,
    };
    return prices[productId] ?? 0;
  }),
};

const mockNotifications = {
  sendOrderConfirmation: vi.fn(async () => {}),
};

describe('OrderService (Hexagonal)', () => {
  let service: OrderService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new OrderService(
      mockOrderRepo,
      mockInventory,
      mockPricing,
      mockNotifications,
    );
  });

  it('cree une commande avec le bon total et la taxe', async () => {
    const order = await service.createOrder('user-1', [
      { productId: 'prod-1', quantity: 2 },
      { productId: 'prod-2', quantity: 3 },
    ]);

    // subtotal = (25*2) + (10*3) = 80
    expect(order.subtotal).toBe(80);
    // tax = 80 * 0.2 = 16
    expect(order.tax).toBe(16);
    // total = 80 + 16 = 96
    expect(order.total).toBe(96);
    expect(order.status).toBe('created');
  });

  it('verifie le stock de chaque produit', async () => {
    await service.createOrder('user-1', [
      { productId: 'prod-1', quantity: 2 },
      { productId: 'prod-2', quantity: 3 },
    ]);

    expect(mockInventory.checkStock).toHaveBeenCalledWith('prod-1');
    expect(mockInventory.checkStock).toHaveBeenCalledWith('prod-2');
  });

  it('reserve le stock apres la creation', async () => {
    await service.createOrder('user-1', [
      { productId: 'prod-1', quantity: 2 },
    ]);

    expect(mockInventory.reserve).toHaveBeenCalledWith('prod-1', 2, 'order-001');
  });

  it('envoie un email de confirmation', async () => {
    const order = await service.createOrder('user-1', [
      { productId: 'prod-1', quantity: 1 },
    ]);

    expect(mockNotifications.sendOrderConfirmation).toHaveBeenCalledOnce();
    expect(mockNotifications.sendOrderConfirmation).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'order-001' }),
    );
  });

  it('throw si le stock est insuffisant', async () => {
    mockInventory.checkStock.mockResolvedValue({ available: 0 });

    await expect(
      service.createOrder('user-1', [{ productId: 'prod-1', quantity: 5 }]),
    ).rejects.toThrow('Insufficient stock');

    // La commande n'a PAS ete creee
    expect(mockOrderRepo.save).not.toHaveBeenCalled();
  });
});
```

## Alternatives et arbitrages

> En architecture, ta valeur n'est pas de connaître UNE solution,
> mais de savoir POURQUOI tu choisis celle-ci plutôt qu'une autre.

### Option A : Architecture hexagonale (solution présentée)
**Quand la choisir :** Domaine métier riche avec des règles complexes, besoin de tester le cœur sans infrastructure, équipe expérimentée DDD.
**Limites :** Overhead de structure (ports/adapters) pour des CRUD simples, courbe d'apprentissage pour les juniors, multiplication des fichiers.

### Option B : Rester en architecture en couches
**Quand la choisir :** Application majoritairement CRUD, petite équipe, time-to-market prioritaire, domaine métier simple.
**Limites :** Le domaine dépend de l'infrastructure (ORM leak), difficile à tester unitairement, tendance au "fat controller".

### Option C : Clean Architecture (Onion)
**Quand la choisir :** Projet enterprise long terme, multiple interfaces (API, CLI, events), besoin de découplage maximal.
**Limites :** Encore plus de couches (Entities → Use Cases → Interface Adapters → Frameworks), risque d'over-engineering sur un projet moyen.

### Matrice de décision
| Critère | Hexagonale | Couches | Clean (Onion) |
|---|---|---|---|
| Complexité setup | Moyenne | Faible | Élevée |
| Testabilité domaine | Excellente | Faible | Excellente |
| Adapté au CRUD | Non | Oui | Non |
| Courbe d'apprentissage | Moyenne | Faible | Élevée |
| Évolutivité long terme | Très bonne | Limitée | Excellente |

### Pour ShopArch, on choisit...
L'architecture hexagonale car le domaine e-commerce (pricing, stock, promotions, commandes) est riche en règles métier. On veut tester le cœur sans démarrer PostgreSQL. On ne va pas jusqu'à la Clean Architecture car on à un seul port d'entrée (REST API) et pas besoin de 4 couches distinctes.

---

## Ce que tu aurais pu oublier

### 1. Laisser `new Date()` dans le service

```typescript
// ACCEPTABLE — new Date() est un detail de logique, pas d'infra
createdAt: new Date()

// PURISTE — injecter un Clock service (utile pour les tests)
createdAt: this.clock.now()
// Mais c'est de l'over-engineering pour la plupart des cas
```

### 2. Appeler reserve AVANT save

Si `reserve` est appele avant `save`, en cas d'echec de `save`, le stock est reserve pour une commande qui n'existe pas. Toujours persister d'abord, puis faire les effets de bord.

### 3. Ne pas extraire les sous-méthodes

Un `createOrder` de 50 lignes est difficile a lire. Extraire `verifyStock` et `priceItems` comme méthodes privees rend le flux principal lisible en un coup d'oeil.

### 4. Oublier que les ports sont dans le DOMAINE

```
FAUX :
  src/infra/interfaces/order-repository.ts  ← L'infra definit le contrat !

CORRECT :
  src/domain/ports/order-repository.ts      ← Le domaine definit le contrat
  src/infra/adapters/typeorm-order-repo.ts  ← L'infra implemente le contrat
```
