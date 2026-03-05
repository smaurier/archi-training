# Correction — Exercice 11 : FSM de commande

## Résultat attendu

Une FSM robuste avec transitions validees, guards, audit trail immutable et side effects injectes.

## Types

```typescript
type OrderStatus = 'created' | 'paid' | 'shipped' | 'delivered' | 'cancelled';

interface Transition {
  readonly from: OrderStatus;
  readonly to: OrderStatus;
  readonly at: Date;
  readonly by: string;
  readonly reason?: string;
}

type TransitionGuard = (order: Order) => boolean;
type TransitionHandler = (order: Order, transition: Transition) => Promise<void>;
```

## Matrice de transitions

```typescript
const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  created:   ['paid', 'cancelled'],
  paid:      ['shipped', 'cancelled'],
  shipped:   ['delivered', 'cancelled'],
  delivered: [],  // Etat terminal
  cancelled: [],  // Etat terminal
};
```

## Implémentation

```typescript
export class OrderStateMachine {
  private readonly guards: Map<string, TransitionGuard> = new Map();
  private readonly handlers: Map<string, TransitionHandler[]> = new Map();

  constructor() {
    this.registerDefaultGuards();
  }

  canTransitionTo(order: Order, target: OrderStatus): boolean {
    const allowed = ALLOWED_TRANSITIONS[order.status];
    if (!allowed.includes(target)) return false;

    const guard = this.guards.get(`${order.status}→${target}`);
    if (guard && !guard(order)) return false;

    return true;
  }

  async transitionTo(
    order: Order,
    target: OrderStatus,
    userId: string,
    reason?: string,
  ): Promise<void> {
    if (!this.canTransitionTo(order, target)) {
      throw new Error(
        `Invalid transition: ${order.status} → ${target}`
      );
    }

    const transition: Transition = {
      from: order.status,
      to: target,
      at: new Date(),
      by: userId,
      reason,
    };

    // Changer l'etat
    order.applyTransition(transition);

    // Executer les side effects
    const key = `${transition.from}→${transition.to}`;
    const handlers = this.handlers.get(key) ?? [];
    await Promise.all(handlers.map((h) => h(order, transition)));
  }

  registerGuard(from: OrderStatus, to: OrderStatus, guard: TransitionGuard): void {
    this.guards.set(`${from}→${to}`, guard);
  }

  registerHandler(from: OrderStatus, to: OrderStatus, handler: TransitionHandler): void {
    const key = `${from}→${to}`;
    const existing = this.handlers.get(key) ?? [];
    this.handlers.set(key, [...existing, handler]);
  }

  private registerDefaultGuards(): void {
    this.registerGuard('created', 'paid', (order) => {
      return order.paymentConfirmed === true;
    });

    this.registerGuard('paid', 'shipped', (order) => {
      return order.shippingAddress !== null;
    });

    this.registerGuard('shipped', 'delivered', (order) => {
      return order.trackingNumber !== null;
    });
  }
}
```

## Entité Order avec audit trail

```typescript
export class Order {
  readonly id: string;
  private _status: OrderStatus = 'created';
  private _transitions: Transition[] = [];

  paymentConfirmed: boolean = false;
  shippingAddress: Address | null = null;
  trackingNumber: string | null = null;

  constructor(id?: string) {
    this.id = id ?? crypto.randomUUID();
  }

  get status(): OrderStatus { return this._status; }

  // Audit trail en lecture seule
  get history(): ReadonlyArray<Transition> {
    return [...this._transitions];
  }

  applyTransition(transition: Transition): void {
    this._status = transition.to;
    this._transitions.push(transition); // Append-only
  }
}
```

## Enregistrement des side effects

```typescript
// Dans le module NestJS
const fsm = new OrderStateMachine();

// → paid : decrementer le stock
fsm.registerHandler('created', 'paid', async (order) => {
  await inventoryService.decrementStock(order.lines);
});

// → shipped : notification tracking
fsm.registerHandler('paid', 'shipped', async (order) => {
  await notificationService.sendTrackingEmail(
    order.customerEmail,
    order.trackingNumber!,
  );
});

// → delivered : email satisfaction
fsm.registerHandler('shipped', 'delivered', async (order) => {
  await notificationService.sendSatisfactionSurvey(order.customerEmail);
});

// → cancelled : remboursement + restaurer stock
fsm.registerHandler('paid', 'cancelled', async (order) => {
  await paymentService.refund(order.id);
  await inventoryService.restoreStock(order.lines);
});

fsm.registerHandler('shipped', 'cancelled', async (order) => {
  await paymentService.refund(order.id);
  await inventoryService.restoreStock(order.lines);
});
```

## FSM générique (bonus)

```typescript
class StateMachine<S extends string> {
  private readonly transitions: Map<S, S[]>;
  private readonly guards: Map<string, (ctx: unknown) => boolean> = new Map();
  private readonly handlers: Map<string, ((ctx: unknown) => Promise<void>)[]> = new Map();

  constructor(transitions: Record<S, S[]>) {
    this.transitions = new Map(Object.entries(transitions) as [S, S[]][]);
  }

  canTransition(current: S, target: S, context?: unknown): boolean {
    const allowed = this.transitions.get(current) ?? [];
    if (!allowed.includes(target)) return false;
    const guard = this.guards.get(`${current}→${target}`);
    return guard ? guard(context) : true;
  }

  async transition(current: S, target: S, context?: unknown): Promise<S> {
    if (!this.canTransition(current, target, context)) {
      throw new Error(`Invalid: ${current} → ${target}`);
    }
    const key = `${current}→${target}`;
    for (const handler of this.handlers.get(key) ?? []) {
      await handler(context);
    }
    return target;
  }
}

// Reutilisable pour un autre workflow
const articleFSM = new StateMachine<'draft' | 'review' | 'published' | 'archived'>({
  draft: ['review'],
  review: ['draft', 'published'],
  published: ['archived'],
  archived: ['draft'],
});
```

## Alternatives et arbitrages

> En architecture, ta valeur n'est pas de connaître UNE solution,
> mais de savoir POURQUOI tu choisis celle-ci plutôt qu'une autre.

### Option A : FSM in-process (solution présentée)
**Quand la choisir :** Transitions gérées par un seul service, pas de coordination inter-services, état persisté dans une base unique.
**Limites :** Ne scale pas si plusieurs services doivent participer à une transition (ex: paiement + stock + notification).

### Option B : Saga chorégraphie (event-driven)
**Quand la choisir :** Microservices indépendants qui réagissent aux événements, faible couplage, chaque service gère sa propre logique de compensation.
**Limites :** Difficile de visualiser le flow complet, pas de point central de contrôle, debugging complexe (events distribués).

### Option C : Saga orchestration
**Quand la choisir :** Workflow complexe avec beaucoup d'étapes (commande → paiement → stock → expédition → notification), besoin d'un orchestrateur central qui gère les compensations.
**Limites :** L'orchestrateur est un SPOF potentiel, couplage vers l'orchestrateur, plus de code infra.

### Option D : Event sourcing + projections
**Quand la choisir :** Besoin d'audit trail complet, reconstitution de l'état à n'importe quel point, domaine réglementaire (finance, santé).
**Limites :** Complexité opérationnelle (event store, projections, versioning des events), overkill pour la plupart des cas.

### Matrice de décision
| Critère | FSM in-process | Saga chorégraphie | Saga orchestration | Event sourcing |
|---|---|---|---|---|
| Simplicité | Excellente | Moyenne | Moyenne | Faible |
| Multi-services | Non | Oui | Oui | Oui |
| Visibilité du flow | Excellente | Faible | Bonne | Bonne |
| Compensation | Manuelle | Par service | Centralisée | Replay |
| Audit trail | Basique | Par event | Par step | Complet |

### Pour ShopArch, on choisit...
La FSM in-process pour le Module 02 car ShopArch est un monolithe modulaire — un seul service gère la commande. Si on décompose en microservices plus tard (Module 07+), on migrera vers une Saga orchestration pour coordonner Paiement, Stock et Notification.

---

## Ce que tu aurais pu oublier

### 1. Hardcoder les transitions dans des if/else

```typescript
// FAUX
if (order.status === 'created' && target === 'paid') { ... }
else if (order.status === 'paid' && target === 'shipped') { ... }
// 15 if/else imbriques

// CORRECT — matrice declarative
const ALLOWED_TRANSITIONS = {
  created: ['paid', 'cancelled'],
  paid: ['shipped', 'cancelled'],
};
```

### 2. Modifier l'audit trail

```typescript
// FAUX — l'historique peut etre modifie
order.history[0].reason = 'changed'; // Mutation !

// CORRECT — copie defensive + readonly
get history(): ReadonlyArray<Transition> {
  return [...this._transitions];
}
```

### 3. Side effects synchrones dans la transition

```typescript
// FAUX — si l'email echoue, la transition echoue
await notificationService.send(email); // Timeout → exception
order.status = 'shipped'; // Jamais atteint

// CORRECT — la transition se fait d'abord, side effects async
order.applyTransition(transition);
// Side effects en best-effort (retry + dead letter queue)
await Promise.allSettled(handlers.map(h => h(order)));
```

### 4. Oublier les états terminaux

```typescript
// FAUX — on peut annuler une commande deja livree
ALLOWED_TRANSITIONS['delivered'] = ['cancelled']; // Non !

// CORRECT — delivered et cancelled sont terminaux
ALLOWED_TRANSITIONS['delivered'] = [];
ALLOWED_TRANSITIONS['cancelled'] = [];
```
