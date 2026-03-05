# Exercice 07 — Decomposer un monolithe

> 🟡 **Difficulté** : Conception | **Temps estimé** : 1h30 | **Ère** : 2 — Le Domaine
>
> **Prérequis** : Module 01 (cours 4-5)


## Objectif

Identifier les service boundaries dans un monolithe e-commerce et proposer un plan de decomposition en microservices.

## Contexte

Tu travailles sur ShopArch, un monolithe NestJS qui contient tout : catalogue, panier, commandes, paiements, utilisateurs. Le monolithe grandit et l'équipe veut migrer vers des microservices. Mais attention : toute decomposition n'est pas bonne a prendre.

## Temps estime

1h15

## Instructions

### Étape 1 — Analyser les dépendances

Voici la structure actuelle du monolithe :

```
src/
  modules/
    catalog/        → Product, Category, Search
    cart/           → CartItem, CartService
    order/          → Order, OrderLine, OrderWorkflow
    payment/        → Payment, PaymentGateway, Refund
    user/           → User, Address, Preferences
    notification/   → Email, SMS, Push
    analytics/      → PageView, EventTracker
  shared/
    database.module.ts
    auth.guard.ts
    tenant.filter.ts
```

Identifie les dépendances entre modules en analysant ce code :

```typescript
// order.service.ts
@Injectable()
export class OrderService {
  constructor(
    private readonly cartService: CartService,
    private readonly paymentService: PaymentService,
    private readonly userService: UserService,
    private readonly notificationService: NotificationService,
    private readonly catalogService: CatalogService, // verifier stock
    private readonly analyticsService: AnalyticsService,
  ) {}

  async createOrder(userId: string, cartId: string): Promise<Order> {
    const user = await this.userService.findById(userId);
    const cart = await this.cartService.findById(cartId);

    // Verifier le stock pour chaque item
    for (const item of cart.items) {
      const product = await this.catalogService.findById(item.productId);
      if (product.stock < item.quantity) {
        throw new Error(`Insufficient stock for ${product.name}`);
      }
    }

    const order = await this.orderRepo.save({ userId, items: cart.items, total: cart.total });
    const payment = await this.paymentService.charge(order.id, order.total);
    await this.catalogService.decrementStock(cart.items);
    await this.cartService.clear(cartId);
    await this.notificationService.sendOrderConfirmation(user.email, order);
    await this.analyticsService.track('order.created', { orderId: order.id });

    return order;
  }
}
```

### Étape 2 — Dessiner la carte de dépendances

Dessine un diagramme (ASCII ou papier) montrant :
- Chaque module = un noeud
- Chaque appel direct = une fleche
- Les dépendances partagees (database, auth, tenant)

### Étape 3 — Proposer des service boundaries

Pour chaque groupe, justifie :
1. Quels modules deviennent des services independants ?
2. Quels modules restent ensemble et pourquoi ?
3. Comment les services communiquent (sync HTTP, async events, ou les deux) ?

### Étape 4 — Dessiner l'architecture cible

Dessine l'architecture microservices cible avec :
- Les services
- Les communications (sync vs async)
- La base de données de chaque service (data per service)
- Le proxy/API Gateway devant

### Bonus

- Proposer l'ordre de migration (quel service extraire en premier ?)
- Identifier les risques du distributed monolith

## Contraintes

- Chaque service a sa propre base de données (data per service)
- Pas de base de données partagee entre services
- Les communications sync sont via HTTP/gRPC, les async via message queue
- Justifier chaque decision
