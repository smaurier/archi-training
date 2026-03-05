# Correction — Exercice 50 : Stratégie de test e-commerce

## Tests unitaires — Calcul de prix

```typescript
// price-calculator.test.ts
describe('PriceCalculator', () => {
  const calculator = new PriceCalculator();

  describe('calculateLineTotal', () => {
    it('should calculate base price × quantity', () => {
      expect(calculator.calculateLineTotal({ price: 10, quantity: 3 })).toBe(30);
    });

    it('should apply percentage discount', () => {
      expect(calculator.calculateLineTotal({
        price: 100, quantity: 1, discount: { type: 'percentage', value: 20 },
      })).toBe(80);
    });

    it('should apply fixed discount', () => {
      expect(calculator.calculateLineTotal({
        price: 100, quantity: 2, discount: { type: 'fixed', value: 15 },
      })).toBe(185); // (100 × 2) - 15
    });

    it('should never return negative price', () => {
      expect(calculator.calculateLineTotal({
        price: 10, quantity: 1, discount: { type: 'fixed', value: 50 },
      })).toBe(0); // pas -40
    });

    it('should apply quantity discount (buy 3, 10% off)', () => {
      expect(calculator.calculateLineTotal({
        price: 100, quantity: 3, quantityDiscount: { minQuantity: 3, percentage: 10 },
      })).toBe(270); // 300 - 10%
    });
  });

  describe('calculateOrderTotal', () => {
    it('should sum all lines + tax', () => {
      const order = {
        items: [
          { price: 100, quantity: 2 },
          { price: 50, quantity: 1 },
        ],
        taxRate: 0.20,
      };
      expect(calculator.calculateOrderTotal(order)).toBe(300); // (200 + 50) × 1.20
    });

    it('should apply order-level coupon', () => {
      const order = {
        items: [{ price: 100, quantity: 1 }],
        taxRate: 0.20,
        coupon: { type: 'percentage', value: 10 },
      };
      expect(calculator.calculateOrderTotal(order)).toBe(108); // 100 - 10% = 90 × 1.20
    });
  });
});
```

## Tests unitaires — FSM commande

```typescript
// order-fsm.test.ts
describe('OrderStateMachine', () => {
  it('should transition created → paid', () => {
    const order = new OrderStateMachine('created');
    order.transition('pay');
    expect(order.state).toBe('paid');
  });

  it('should transition paid → shipped', () => {
    const order = new OrderStateMachine('paid');
    order.transition('ship');
    expect(order.state).toBe('shipped');
  });

  it('should reject invalid transitions', () => {
    const order = new OrderStateMachine('created');
    expect(() => order.transition('ship')).toThrow('Invalid transition: created → ship');
  });

  it('should allow cancellation from created or paid', () => {
    const fromCreated = new OrderStateMachine('created');
    fromCreated.transition('cancel');
    expect(fromCreated.state).toBe('cancelled');

    const fromPaid = new OrderStateMachine('paid');
    fromPaid.transition('cancel');
    expect(fromPaid.state).toBe('cancelled');
  });

  it('should not allow cancellation after shipped', () => {
    const order = new OrderStateMachine('shipped');
    expect(() => order.transition('cancel')).toThrow();
  });
});
```

## Tests d'intégration — API

```typescript
// products-api.integration.test.ts
describe('Products API (integration)', () => {
  let app: INestApplication;
  let tenantA: string;
  let tenantB: string;

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication();
    await app.init();
    tenantA = 'tenant-a-uuid';
    tenantB = 'tenant-b-uuid';
  });

  afterAll(() => app.close());

  describe('CRUD', () => {
    it('should create a product', async () => {
      const res = await request(app.getHttpServer())
        .post('/products')
        .set('X-Tenant-ID', tenantA)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Test Product', description: 'Desc', price: 29.99, categoryId });

      expect(res.status).toBe(201);
      expect(res.body.id).toBeDefined();
      expect(res.body.name).toBe('Test Product');
    });

    it('should soft delete a product', async () => {
      await request(app.getHttpServer())
        .delete(`/products/${productId}`)
        .set('X-Tenant-ID', tenantA)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(204);

      // Le produit n'apparait plus dans les listings
      const res = await request(app.getHttpServer())
        .get('/products')
        .set('X-Tenant-ID', tenantA);
      expect(res.body.data.find((p: any) => p.id === productId)).toBeUndefined();
    });
  });

  describe('Multi-tenant isolation', () => {
    it('should not return products from another tenant', async () => {
      // Creer un produit pour tenant A
      const product = await createProduct(tenantA, { name: 'Tenant A Product' });

      // Lister les produits pour tenant B
      const res = await request(app.getHttpServer())
        .get('/products')
        .set('X-Tenant-ID', tenantB);

      expect(res.body.data.find((p: any) => p.id === product.id)).toBeUndefined();
    });

    it('should return 404 when accessing another tenant product', async () => {
      const product = await createProduct(tenantA, { name: 'Secret' });

      await request(app.getHttpServer())
        .get(`/products/${product.id}`)
        .set('X-Tenant-ID', tenantB)
        .expect(404);
    });
  });

  describe('Cursor pagination', () => {
    it('should not miss or duplicate items', async () => {
      // Creer 25 produits
      for (let i = 0; i < 25; i++) {
        await createProduct(tenantA, { name: `Product ${i}`, price: i });
      }

      // Paginer par pages de 10
      const allIds = new Set<string>();
      let cursor: string | undefined;

      do {
        const res = await request(app.getHttpServer())
          .get('/products')
          .query({ limit: 10, ...(cursor ? { cursor } : {}) })
          .set('X-Tenant-ID', tenantA);

        for (const product of res.body.data) {
          expect(allIds.has(product.id)).toBe(false); // pas de doublon
          allIds.add(product.id);
        }

        cursor = res.body.meta.nextCursor;
      } while (cursor);

      expect(allIds.size).toBe(25); // pas d'element manque
    });
  });
});
```

## Test E2E — Checkout

```typescript
// checkout.e2e.test.ts (Playwright)
import { test, expect } from '@playwright/test';

test('complete checkout flow', async ({ page }) => {
  // 1. Rechercher un produit
  await page.goto('/');
  await page.fill('[data-testid="search-input"]', 'TypeScript Book');
  await page.press('[data-testid="search-input"]', 'Enter');
  await expect(page.locator('[data-testid="product-card"]').first()).toBeVisible();

  // 2. Ouvrir la page produit
  await page.click('[data-testid="product-card"]:first-child');
  await expect(page.locator('[data-testid="product-name"]')).toContainText('TypeScript');

  // 3. Ajouter au panier
  await page.click('[data-testid="add-to-cart"]');
  await expect(page.locator('[data-testid="cart-count"]')).toContainText('1');

  // 4. Aller au checkout
  await page.click('[data-testid="cart-icon"]');
  await page.click('[data-testid="checkout-button"]');

  // 5. Remplir l'adresse
  await page.fill('[data-testid="address-line1"]', '123 Test Street');
  await page.fill('[data-testid="city"]', 'Paris');
  await page.fill('[data-testid="zip"]', '75001');

  // 6. Paiement (mock Stripe)
  await page.fill('[data-testid="card-number"]', '4242424242424242');
  await page.fill('[data-testid="card-expiry"]', '12/28');
  await page.fill('[data-testid="card-cvc"]', '123');

  // 7. Confirmer
  await page.click('[data-testid="pay-button"]');
  await expect(page.locator('[data-testid="order-confirmation"]')).toBeVisible({ timeout: 10000 });
  await expect(page.locator('[data-testid="order-id"]')).toBeDefined();
});
```

## Property-based tests (bonus)

```typescript
// price-calculator.property.test.ts
import fc from 'fast-check';

describe('PriceCalculator (property-based)', () => {
  it('total should always be >= 0', () => {
    fc.assert(
      fc.property(
        fc.float({ min: 0.01, max: 10000, noNaN: true }),
        fc.integer({ min: 1, max: 100 }),
        fc.float({ min: 0, max: 100, noNaN: true }),
        (price, quantity, discountPercent) => {
          const total = calculator.calculateLineTotal({
            price, quantity,
            discount: { type: 'percentage', value: discountPercent },
          });
          return total >= 0;
        },
      ),
    );
  });

  it('adding items should never decrease total', () => {
    fc.assert(
      fc.property(
        fc.float({ min: 0.01, max: 10000, noNaN: true }),
        fc.integer({ min: 1, max: 100 }),
        (price, quantity) => {
          const total1 = calculator.calculateLineTotal({ price, quantity });
          const total2 = calculator.calculateLineTotal({ price, quantity: quantity + 1 });
          return total2 >= total1;
        },
      ),
    );
  });
});
```

## Ce que tu aurais pu oublier

### 1. Tests unitaires avec DB
```
FAUX — les tests unitaires se connectent a PostgreSQL
CORRECT — tests unitaires = logique pure, pas de DB ni reseau
         Utiliser des mocks/stubs pour les dependances externes
```

### 2. Tests d'intégration sans isolation
```
FAUX — les tests partagent la meme DB et interferent entre eux
CORRECT — chaque test a son propre tenant (isolation par tenant ID)
         Ou : transaction rollback apres chaque test
```

### 3. Pas de test multi-tenant
```
FAUX — tester uniquement avec un seul tenant
CORRECT — tester explicitement que tenant A ne voit pas les donnees de tenant B
         C'est le test le plus important en SaaS multi-tenant
```

### 4. E2E qui teste tout
```
FAUX — 200 tests E2E (lents, fragiles, couteux a maintenir)
CORRECT — 5% de tests E2E sur les parcours CRITIQUES uniquement
         Le gros du testing est en unit + integration (rapide, stable)
```
