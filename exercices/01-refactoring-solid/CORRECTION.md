# Correction — Exercice 01 : Refactoring SOLID

## Résultat attendu

Un `OrderProcessor` qui orchestre 4 collaborateurs injectes, sans aucune logique métier directe. Chaque collaborateur a une responsabilité unique et est derriere une interface.

## Violations identifiees

| Principe | Violation | Consequence |
|---|---|---|
| **S** | OrderProcessor fait 5 choses (validation, pricing, persistance, notification, logging) | Impossible a tester, impossible a modifier sans risque |
| **O** | Réduction VIP et TVA hardcodees dans `if` | Ajouter un pays ou un type de client = modifier le code |
| **L** | Pas d'interface pour la DB — impossible de substituer une implémentation | Pas de mock possible pour les tests |
| **I** | `any` partout — pas de contrat clair entre les couches | Bugs silencieux, pas d'autocompletion |
| **D** | `new PostgresDatabase(...)` et `require('nodemailer')` dans le code | Couplage fort, impossible de tester sans infra reelle |

## Solution

### Types du domaine

```typescript
// types.ts
export interface OrderItem {
  productId: string;
  name: string;
  price: number;   // Prix unitaire HT en centimes
  quantity: number;
}

export interface Order {
  id: string;
  customerEmail: string;
  customerType: 'standard' | 'vip' | 'employee';
  items: OrderItem[];
  country: string;  // Code ISO pour la TVA
  total?: number;
}
```

### Interfaces (contrats)

```typescript
// interfaces.ts
import { Order } from './types';

// Chaque interface = une responsabilite unique (SRP)
// Chaque interface = un contrat substituable (LSP)

export interface OrderValidator {
  validate(order: Order): void; // Throw si invalide
}

export interface PricingStrategy {
  // L'interface ne connait pas les details de la reduction
  calculateDiscount(order: Order, subtotal: number): number;
}

export interface TaxCalculator {
  // L'interface ne connait pas les taux par pays
  calculateTax(country: string, amount: number): number;
}

export interface OrderRepository {
  save(order: Order): Promise<void>;
}

export interface NotificationService {
  notifyOrderConfirmed(order: Order): Promise<void>;
}
```

### Implementations

```typescript
// validators/order-validator.ts
import { Order, OrderValidator } from '../interfaces';

export class DefaultOrderValidator implements OrderValidator {
  validate(order: Order): void {
    if (!order.items || order.items.length === 0) {
      throw new Error('Order must have at least one item');
    }
    if (!order.customerEmail || !order.customerEmail.includes('@')) {
      throw new Error('Invalid customer email');
    }
    for (const item of order.items) {
      if (item.quantity <= 0) throw new Error('Quantity must be positive');
      if (item.price < 0) throw new Error('Price cannot be negative');
    }
  }
}
```

```typescript
// pricing/vip-pricing.ts
import { Order, PricingStrategy } from '../interfaces';

// Strategie VIP — OCP : on ajoute une nouvelle strategie sans modifier les existantes
export class VipPricingStrategy implements PricingStrategy {
  calculateDiscount(order: Order, subtotal: number): number {
    return order.customerType === 'vip' ? subtotal * 0.1 : 0;
  }
}

// pricing/employee-pricing.ts
export class EmployeePricingStrategy implements PricingStrategy {
  calculateDiscount(order: Order, subtotal: number): number {
    return order.customerType === 'employee' ? subtotal * 0.3 : 0;
  }
}

// On peut COMBINER les strategies (Composite pattern)
export class CompositePricingStrategy implements PricingStrategy {
  constructor(private readonly strategies: PricingStrategy[]) {}

  calculateDiscount(order: Order, subtotal: number): number {
    // Applique la plus grosse reduction (pas cumulable)
    return Math.max(...this.strategies.map(s => s.calculateDiscount(order, subtotal)));
  }
}
```

```typescript
// tax/eu-tax-calculator.ts
import { TaxCalculator } from '../interfaces';

// OCP : ajouter un pays = ajouter une entree dans le map, pas modifier de if/else
export class EuTaxCalculator implements TaxCalculator {
  private readonly rates: Record<string, number> = {
    FR: 0.20,  // France 20%
    BE: 0.21,  // Belgique 21%
    DE: 0.19,  // Allemagne 19%
    NL: 0.21,  // Pays-Bas 21%
    LU: 0.17,  // Luxembourg 17%
  };

  calculateTax(country: string, amount: number): number {
    const rate = this.rates[country];
    if (rate === undefined) {
      throw new Error(`Tax rate not configured for country: ${country}`);
    }
    return amount * rate;
  }
}
```

### OrderProcessor refactore

```typescript
// order-processor.ts — Version SOLID
import { Order } from './types';
import {
  OrderValidator,
  PricingStrategy,
  TaxCalculator,
  OrderRepository,
  NotificationService,
} from './interfaces';

export class OrderProcessor {
  // DIP : toutes les dependances sont des INTERFACES injectees
  // SRP : OrderProcessor ne fait QUE de l'orchestration
  constructor(
    private readonly validator: OrderValidator,
    private readonly pricing: PricingStrategy,
    private readonly tax: TaxCalculator,
    private readonly repository: OrderRepository,
    private readonly notification: NotificationService,
  ) {}

  async processOrder(order: Order): Promise<void> {
    // 1. Valider (delegue au validator)
    this.validator.validate(order);

    // 2. Calculer le prix (delegue aux strategies)
    const subtotal = order.items.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0,
    );
    const discount = this.pricing.calculateDiscount(order, subtotal);
    const taxAmount = this.tax.calculateTax(order.country, subtotal - discount);
    order.total = subtotal - discount + taxAmount;

    // 3. Persister (delegue au repository)
    await this.repository.save(order);

    // 4. Notifier (delegue au service de notification)
    await this.notification.notifyOrderConfirmed(order);
  }
}
```

### Test avec mocks

```typescript
// order-processor.test.ts
import { OrderProcessor } from './order-processor';
import { Order } from './types';

// Mocks — aucune infra reelle !
const mockValidator = { validate: vi.fn() };
const mockPricing = { calculateDiscount: vi.fn().mockReturnValue(0) };
const mockTax = { calculateTax: vi.fn().mockReturnValue(20) };
const mockRepo = { save: vi.fn().mockResolvedValue(undefined) };
const mockNotif = { notifyOrderConfirmed: vi.fn().mockResolvedValue(undefined) };

const processor = new OrderProcessor(
  mockValidator,
  mockPricing,
  mockTax,
  mockRepo,
  mockNotif,
);

const order: Order = {
  id: '1',
  customerEmail: 'test@example.com',
  customerType: 'standard',
  items: [{ productId: 'p1', name: 'Widget', price: 100, quantity: 2 }],
  country: 'FR',
};

test('processOrder appelle les 4 collaborateurs dans l\'ordre', async () => {
  await processor.processOrder(order);

  expect(mockValidator.validate).toHaveBeenCalledWith(order);
  expect(mockPricing.calculateDiscount).toHaveBeenCalled();
  expect(mockTax.calculateTax).toHaveBeenCalledWith('FR', 200);
  expect(mockRepo.save).toHaveBeenCalledWith(order);
  expect(mockNotif.notifyOrderConfirmed).toHaveBeenCalledWith(order);
});

test('processOrder calcule le total correctement', async () => {
  mockPricing.calculateDiscount.mockReturnValue(10); // 10€ de remise
  mockTax.calculateTax.mockReturnValue(38); // TVA sur 190€

  await processor.processOrder(order);

  expect(order.total).toBe(228); // 200 - 10 + 38
});
```

## Ce que tu aurais pu oublier

### 1. Injecter `new` dans le constructeur au lieu d'une interface

```typescript
// FAUX — toujours couple a l'implementation
constructor() {
  this.repo = new PostgresOrderRepository();
}

// CORRECT — injecte l'interface
constructor(private readonly repo: OrderRepository) {}
```

### 2. Garder `any` sur le parametre Order

```typescript
// FAUX — aucune securite de typage
async processOrder(order: any): Promise<void>

// CORRECT — type explicite
async processOrder(order: Order): Promise<void>
```

### 3. Oublier de rendre les stratégies composables

```typescript
// FAUX — hardcoder les strategies dans un if/else
if (order.customerType === 'vip') discount = 0.1;
else if (order.customerType === 'employee') discount = 0.3;

// CORRECT — la strategie est injectee, le processor ne connait pas les types
const discount = this.pricing.calculateDiscount(order, subtotal);
```

### 4. Injection SQL dans la requête (sécurité !)

```typescript
// FAUX — injection SQL possible
const sql = `INSERT INTO orders VALUES ('${order.customerEmail}', ${total})`;

// CORRECT — parameterized query (dans l'implementation du repository)
const sql = `INSERT INTO orders VALUES ($1, $2)`;
await this.db.query(sql, [order.customerEmail, total]);
```

### 5. Tester avec une vraie base de données

```typescript
// FAUX — le test depend de PostgreSQL
const repo = new PostgresOrderRepository();

// CORRECT — mock injecte
const mockRepo = { save: vi.fn().mockResolvedValue(undefined) };
```
