# Cours 74 — Test doubles & patterns

> **Objectif** : Maîtriser les 5 types de test doubles (mock, stub, spy, fake, dummy), utiliser MSW pour les tests API, implémenter le pattern auth mock, et savoir quand mocker vs quand NE PAS mocker.

---

## Rappel du cours précédent

<details>
<summary>1. Quels sont les 3 niveaux de la pyramide de tests et leur proportion ?</summary>

1. **Unit tests** (~60%) : logique métier pure, rapides (<1ms), très stables
2. **Intégration tests** (~30%) : API endpoints, DB queries, cache — testent les frontières
3. **E2E tests** (~10%) : parcours utilisateur critiques, lents (5-30s), fragiles — 5-10 scénarios max
</details>

<details>
<summary>2. Pourquoi tester l'accessibilite avec axe-core + Playwright ?</summary>

axe-core détecte automatiquement les violations WCAG (images sans alt, contraste insuffisant, ARIA invalide). Playwright permet de tester la navigation clavier (skip links, focus trap dans les modales, tab order). Les deux combinés couvrent les aspects automatisables de l'accessibilité WCAG 2.1 AA.
</details>

---

## Analogie — Les acteurs dans un film

Quand tu filmes une scène de cascades :
- **Dummy** : un mannequin dans la voiture — il est là mais ne fait rien
- **Stub** : un acteur qui dit toujours "oui" quand on lui parle — réponse prédéterminée
- **Spy** : un acteur qui joue normalement mais enregistre combien de fois il a été appelé
- **Mock** : un acteur avec un script précis — si on lui dit "bonjour" il doit répondre "salut", sinon le tournage échoue
- **Fake** : une doublure qui fait la cascade RÉELLEMENT mais dans un environnement contrôlé (matelas, filet)

---

## Théorie

### 1. Les 5 types de test doubles

| Type | Comportement | Vérification | Exemple |
|---|---|---|---|
| **Dummy** | Remplit un paramètre, jamais utilisé | Aucune | `new DummyLogger()` |
| **Stub** | Retourne une valeur prédéterminée | Aucune | `getUser() → { id: '1', name: 'Alice' }` |
| **Spy** | Enregistre les appels (wraps real) | Appels effectués | `expect(spy).toHaveBeenCalledWith(...)` |
| **Mock** | Comportement programmé + vérification | Strict | `mock.expects('save').once()` |
| **Fake** | Implémentation simplifiée mais fonctionnelle | Via assertions | `InMemoryUserRepository` |

### 2. Quand mocker, quand NE PAS mocker

```
MOCKER :
  ✓ Appels reseau (APIs externes, Stripe, Keycloak)
  ✓ Services lents (email, SMS, file upload)
  ✓ Non-determinisme (Date.now, Math.random, UUID)
  ✓ Side effects (envoi d'email, webhook)

NE PAS MOCKER :
  ✗ La DB en tests d'integration (utiliser test containers)
  ✗ La logique metier qu'on teste
  ✗ Les dependances internes simples (utils, helpers)
  ✗ Le framework (NestJS, Express) — tester via supertest
```

### 3. MSW (Mock Service Worker)

```
Sans MSW :
  Tests ──> Mock axios ──> Reponse fake
  Probleme : ne teste pas la serialisation, les headers, les erreurs HTTP

Avec MSW :
  Tests ──> Vraie requete HTTP ──> MSW intercepte ──> Reponse fake
  Avantage : teste le vrai chemin HTTP (fetch, headers, body parsing)
```

### 4. Auth mock pattern

```
Production :
  Request → OIDC Middleware → Keycloak validation → Controller

Tests / Dev :
  Request → Mock Auth Middleware → Hardcoded user → Controller

Le switch se fait via env variable :
  AUTH_MODE=oidc  → production
  AUTH_MODE=mock  → dev/tests
```

### 5. Test containers

```
Au lieu de mocker la DB :
  → Demarrer un PostgreSQL dans Docker
  → Executer les migrations
  → Tester les vraies queries SQL
  → Detruire le container apres les tests

Avantage : teste les vrais comportements DB (constraints, triggers, indexes)
Inconvenient : plus lent (~5s de setup)
```

---

## Pratique

### MSW handlers

```typescript
// mocks/handlers.ts
import { http, HttpResponse } from 'msw';

export const handlers = [
  // Stub : GET /api/products retourne une liste fixe
  http.get('/api/products', () => {
    return HttpResponse.json({
      'hydra:member': [
        { id: 'p1', name: 'T-shirt', price: 29.90 },
        { id: 'p2', name: 'Hoodie', price: 59.90 },
      ],
      'hydra:totalItems': 2,
    });
  }),

  // Stub conditionnel
  http.get('/api/products/:id', ({ params }) => {
    if (params.id === 'not-found') {
      return HttpResponse.json(
        { type: 'not_found', title: 'Product not found' },
        { status: 404 },
      );
    }
    return HttpResponse.json({
      id: params.id,
      name: 'T-shirt bio',
      price: 29.90,
    });
  }),

  // Mock pour verifier les appels POST
  http.post('/api/orders', async ({ request }) => {
    const body = await request.json();
    return HttpResponse.json(
      { id: 'order-1', status: 'created', items: body.items },
      { status: 201 },
    );
  }),
];
```

### Setup MSW dans les tests

```typescript
// mocks/server.ts
import { setupServer } from 'msw/node';
import { handlers } from './handlers';

export const server = setupServer(...handlers);

// vitest.setup.ts
import { beforeAll, afterAll, afterEach } from 'vitest';
import { server } from './mocks/server';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

### Auth mock pattern (NestJS)

```typescript
// auth/auth-mock.guard.ts
@Injectable()
export class MockAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    req.user = {
      id: 'dev-user-1',
      email: 'dev@example.com',
      roles: ['admin'],
      tenantId: 'dev-tenant',
    };
    return true;
  }
}

// auth/auth.module.ts
@Module({
  providers: [
    {
      provide: APP_GUARD,
      useClass:
        process.env.AUTH_MODE === 'mock'
          ? MockAuthGuard
          : OidcAuthGuard, // Production OIDC
    },
  ],
})
export class AuthModule {}
```

### Fake repository pour tests unitaires

```typescript
// infra/in-memory-order.repository.ts
export class InMemoryOrderRepository implements OrderRepository {
  private orders: Order[] = [];

  async findById(id: string): Promise<Order | null> {
    return this.orders.find((o) => o.id === id) ?? null;
  }

  async save(order: Order): Promise<Order> {
    const index = this.orders.findIndex((o) => o.id === order.id);
    if (index >= 0) {
      this.orders[index] = order;
    } else {
      this.orders.push(order);
    }
    return order;
  }

  async findByTenant(tenantId: string): Promise<Order[]> {
    return this.orders.filter((o) => o.tenantId === tenantId);
  }

  // Helper pour les tests
  clear(): void { this.orders = []; }
  seed(orders: Order[]): void { this.orders = [...orders]; }
}

// Usage dans un test
describe('OrderService', () => {
  let service: OrderService;
  let repo: InMemoryOrderRepository;

  beforeEach(() => {
    repo = new InMemoryOrderRepository();
    service = new OrderService(repo); // Injection du fake
  });

  it('calcule le total avec tax', async () => {
    repo.seed([
      { id: '1', tenantId: 't1', items: [{ price: 100, qty: 2 }], status: 'created' },
    ]);
    const order = await service.calculateTotal('1');
    expect(order.total).toBe(200);
  });
});
```

---

## Résumé

1. **5 test doubles** : dummy (remplit), stub (réponse fixe), spy (enregistre), mock (vérifié), fake (implémentation simplifiée)
2. **MSW** : intercepte les vraies requêtes HTTP — teste le chemin complet (fetch, headers, body parsing), pas juste le mock
3. **Auth mock pattern** : `AUTH_MODE=mock` en dev/tests, `AUTH_MODE=oidc` en production — même interface, implémentation différente
4. **Fake repositories** : `InMemoryRepository` pour les tests unitaires — rapide, pas de DB, seedable
5. **Ne pas mocker** : la DB en intégration (test containers), la logique qu'on teste, les dépendances internes simples

---

> **Prochain cours** : [Cours 75 — Contract Testing](./03-contract-testing.md)

---

> **Lien fil rouge — ShopArch**
>
> - Implémente les mocks MSW pour les appels API du front ShopArch
> - Crée un mock du PaymentGateway pour les tests du module Order
> - Exercice(s) associé(s) : `exercices/51b-msw-mock-layer/`
> - Checkpoint : Module 11, critère 1
