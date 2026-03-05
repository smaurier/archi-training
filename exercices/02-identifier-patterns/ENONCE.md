# Exercice 02 — Identifier les design patterns

> 🔵 **Difficulté** : Application | **Temps estimé** : 1h30 | **Ère** : 1 — Les Fondations
>
> **Prérequis** : Module 00 (cours 3)


## Objectif

Reconnaitre les design patterns dans du code existant et savoir quand les appliquer.

## Temps estime

45 min

## Partie A — Identification (20 min)

Lis chaque extrait de code et identifie le design pattern utilise. Explique en une phrase pourquoi ce pattern a ete choisi ici.

### Extrait 1

```typescript
class Logger {
  private static instance: Logger | null = null;

  private constructor(private readonly level: string) {}

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger('info');
    }
    return Logger.instance;
  }

  log(message: string): void {
    console.log(`[${this.level}] ${message}`);
  }
}
```

**Pattern :** ...
**Pourquoi :** ...
**Risque :** ...

### Extrait 2

```typescript
interface PaymentGateway {
  charge(amount: number, currency: string): Promise<PaymentResult>;
}

class StripeAdapter implements PaymentGateway {
  constructor(private readonly stripe: StripeSDK) {}

  async charge(amount: number, currency: string): Promise<PaymentResult> {
    const result = await this.stripe.paymentIntents.create({
      amount: amount * 100, // Stripe utilise les centimes
      currency: currency.toLowerCase(),
    });
    return { id: result.id, status: result.status === 'succeeded' ? 'ok' : 'failed' };
  }
}
```

**Pattern :** ...
**Pourquoi :** ...

### Extrait 3

```typescript
class OrderBuilder {
  private order: Partial<Order> = {};

  withCustomer(email: string): this {
    this.order.customerEmail = email;
    return this;
  }

  withItem(name: string, price: number, qty: number): this {
    this.order.items = this.order.items || [];
    this.order.items.push({ name, price, quantity: qty });
    return this;
  }

  withShipping(address: string): this {
    this.order.shippingAddress = address;
    return this;
  }

  build(): Order {
    if (!this.order.customerEmail) throw new Error('Customer required');
    if (!this.order.items?.length) throw new Error('Items required');
    return this.order as Order;
  }
}

// Usage
const order = new OrderBuilder()
  .withCustomer('alice@mail.com')
  .withItem('T-shirt', 29.99, 2)
  .withShipping('123 Rue de Paris')
  .build();
```

**Pattern :** ...
**Pourquoi :** ...

### Extrait 4

```typescript
type EventHandler = (data: unknown) => void;

class EventBus {
  private handlers = new Map<string, EventHandler[]>();

  on(event: string, handler: EventHandler): void {
    const list = this.handlers.get(event) || [];
    list.push(handler);
    this.handlers.set(event, list);
  }

  emit(event: string, data: unknown): void {
    const list = this.handlers.get(event) || [];
    list.forEach(handler => handler(data));
  }
}
```

**Pattern :** ...
**Pourquoi :** ...

### Extrait 5

```typescript
interface ShippingStrategy {
  calculate(weight: number, distance: number): number;
}

class StandardShipping implements ShippingStrategy {
  calculate(weight: number, distance: number): number {
    return weight * 0.5 + distance * 0.1;
  }
}

class ExpressShipping implements ShippingStrategy {
  calculate(weight: number, distance: number): number {
    return (weight * 0.5 + distance * 0.1) * 2.5;
  }
}

class ShippingCalculator {
  constructor(private strategy: ShippingStrategy) {}

  setStrategy(strategy: ShippingStrategy): void {
    this.strategy = strategy;
  }

  getPrice(weight: number, distance: number): number {
    return this.strategy.calculate(weight, distance);
  }
}
```

**Pattern :** ...
**Pourquoi :** ...

## Partie B — Application (25 min)

### Scénario

Tu dois implémenter un système de notifications pour une app e-commerce. Les notifications peuvent etre envoyees par :
- Email (SendGrid)
- SMS (Twilio)
- Push notification (Firebase)

Les règles :
- Quand une commande est confirmee → Email + Push
- Quand une livraison est en retard → Email + SMS
- Les canaux de notification pourraient changer (ajouter WhatsApp, Slack...)
- L'envoi ne doit pas bloquer le traitement de la commande

**Quels patterns utiliserais-tu ?** Ecris le code TypeScript avec les interfaces et au moins 2 implémentations concretes.

## Contraintes

- TypeScript strict
- Justifie chaque pattern choisi en commentaire
- Identifie au moins 1 pattern que tu ne devrais PAS utiliser ici et explique pourquoi
