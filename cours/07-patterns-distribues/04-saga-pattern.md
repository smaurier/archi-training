# Cours 52 — Saga Pattern

> **Objectif** : Maîtriser le pattern Saga pour coordonner des transactions distribuees, comprendre la différence entre choreographie et orchestration, implémenter des compensating transactions, et gérer les timeouts et les cas d'echec.

---

## Rappel du cours précédent

<details>
<summary>1. Quelle est la différence fondamentale entre state-based (CRUD) et Event Sourcing ?</summary>

**State-based** stocke l'état actuel (dernière version) — l'historique est perdu. **Event Sourcing** stocke tous les événements depuis la création (append-only) — l'état se reconstruit en rejouant les events. L'avantage principal est l'audit trail complet et la capacité de replay temporel. L'inconvenient est la complexité (projections, snapshots, versioning).
</details>

<details>
<summary>2. Qu'est-ce que l'Outbox Pattern et quel problème resout-il ?</summary>

L'Outbox Pattern resout le problème du **dual write** : quand on doit a la fois persister une modification ET publier un événement, un crash entre les deux opérations cause une inconsistance. La solution : insérer l'event dans une table `outbox` dans la **meme transaction** SQL que la modification métier. Un poller ou un CDC (Debezium) lit ensuite l'outbox et publie l'event. Garantie : at-least-once delivery.
</details>

---

## Analogie — L'agence de voyage

Reserver un voyage avec vol + hotel + voiture, c'est une transaction distribuee entre 3 fournisseurs independants :

- **Reserver le vol** (service 1) → OK
- **Reserver l'hotel** (service 2) → OK
- **Reserver la voiture** (service 3) → ECHEC (plus de voiture disponible)

Tu ne peux pas faire un `ROLLBACK` global — le vol et l'hotel sont déjà reserves chez des fournisseurs différents. Tu dois **compenser** : annuler l'hotel, puis annuler le vol. C'est exactement ce que fait un Saga : une sequence d'opérations locales avec des compensations pour chaque étape en cas d'echec.

---

## Théorie

### 1. Le problème des transactions distribuees

En monolithe, une transaction SQL garantit ACID :

```sql
BEGIN;
  UPDATE stock SET quantity = quantity - 1 WHERE product_id = 'abc';
  INSERT INTO orders (...) VALUES (...);
  INSERT INTO payments (...) VALUES (...);
COMMIT; -- Tout ou rien
```

En microservices, chaque service a sa propre base — pas de `BEGIN/COMMIT` global :

```
Service Stock      Service Orders     Service Payments
┌──────────┐      ┌──────────┐      ┌──────────┐
│ PostgreSQL│      │ PostgreSQL│      │ PostgreSQL│
│ (stock)   │      │ (orders)  │      │ (payments)│
└──────────┘      └──────────┘      └──────────┘
      │                 │                 │
      └─────── Pas de transaction commune ──┘
```

**2PC (Two-Phase Commit)** existe mais est fragile :
- Bloque si le coordinateur crash
- Latence élevée (tous les participants doivent voter)
- Ne scale pas au-dela de 3-4 participants
- La plupart des message brokers ne le supportent pas

**Saga** est l'alternative pragmatique.

### 2. Saga = sequence de transactions locales + compensations

```
Saga : Reserve Stock → Charge Payment → Ship Order

Succes :
  T1: Reserve Stock    ──> OK
  T2: Charge Payment   ──> OK
  T3: Ship Order       ──> OK
  → Saga complete

Echec au step 2 :
  T1: Reserve Stock    ──> OK
  T2: Charge Payment   ──> ECHEC
  C1: Release Stock    ──> Compenser T1
  → Saga annulee (rollback par compensation)
```

| Concept | Définition |
|---|---|
| **Transaction locale (Ti)** | Une opération dans un seul service (sa propre DB) |
| **Compensation (Ci)** | L'opération inverse de Ti — annule semantiquement l'effet |
| **Pivot transaction** | Le point de non-retour — apres cette étape, on ne compense plus |

### 3. Choreographie vs Orchestration

```
CHOREOGRAPHIE (event-driven, decentralise) :

  Stock Service          Order Service         Payment Service
       │                      │                      │
       │   StockReserved      │                      │
       │─────────────────────>│                      │
       │                      │   PaymentRequested   │
       │                      │─────────────────────>│
       │                      │                      │
       │                      │   PaymentCharged     │
       │                      │<─────────────────────│
       │                      │                      │
       │   OrderConfirmed     │                      │
       │<─────────────────────│                      │

  Chaque service ecoute les events et reagit.
  Pas de coordinateur central.


ORCHESTRATION (centralisee) :

                    ┌──────────────┐
                    │  Saga        │
                    │  Orchestrator│
                    └──────┬───────┘
                           │
            ┌──────────────┼──────────────┐
            │              │              │
            ▼              ▼              ▼
    ┌──────────┐   ┌──────────┐   ┌──────────┐
    │  Stock   │   │ Payment  │   │ Shipping │
    │  Service │   │ Service  │   │ Service  │
    └──────────┘   └──────────┘   └──────────┘

  L'orchestrateur commande chaque etape et gere les echecs.
```

| Critère | Choreographie | Orchestration |
|---|---|---|
| Coordination | Decentralisee (events) | Centralisee (orchestrateur) |
| Couplage | Faible (services independants) | Moyen (dépend de l'orchestrateur) |
| Visibilite | Difficile (flux implicite) | Claire (machine a états) |
| Debug | Dur (tracer les events) | Facile (état du saga visible) |
| Complexite | Faible pour 2-3 steps | Faible pour N steps |
| Risque | Cycles implicites, dead letters | SPOF si orchestrateur down |
| Quand l'utiliser | 2-3 services, flux simple | > 3 services, flux complexe |

**Regle pragmatique** : pour un saga avec > 3 étapes, préférer l'orchestration. La visibilité est essentielle pour le debug en production.

### 4. Compensating transactions — les règles

```
Forward :  T1 ──> T2 ──> T3 (pivot) ──> T4 ──> T5

Echec a T4 :
  C3: compenser T3 (si possible, sinon T3 est le pivot)
  C2: compenser T2
  C1: compenser T1

Regles :
  1. Chaque Ti doit avoir un Ci (sauf la pivot et les suivantes)
  2. Ci est idempotent (peut etre execute N fois)
  3. Ci doit toujours reussir (sinon → dead letter + alerte)
  4. L'ordre de compensation est inverse : Cn, Cn-1, ..., C1
```

| Transaction | Compensation | Notes |
|---|---|---|
| Reserve Stock (T1) | Release Stock (C1) | Remettre la quantité reservee |
| Charge Payment (T2) | Refund Payment (C2) | Rembourser le montant |
| Confirm Order (T3 - pivot) | — | Apres confirmation, on ne rollback plus |
| Ship Order (T4) | — | Pas de compensation (colis déjà parti) |

### 5. State machine saga

```
              ┌─────────────────────────────────────────┐
              │          Saga State Machine              │
              │                                         │
              │  STARTED                                │
              │    │                                    │
              │    ▼                                    │
              │  RESERVING_STOCK ──(fail)──> STOCK_FAILED
              │    │                         │          │
              │    │ (success)               │ (comp)   │
              │    ▼                         ▼          │
              │  CHARGING_PAYMENT          COMPENSATED  │
              │    │                         ▲          │
              │    │──────(fail)─────> PAYMENT_FAILED   │
              │    │                    │               │
              │    │ (success)          │ (compensate)  │
              │    ▼                    │               │
              │  SHIPPING ──(fail)──> SHIP_FAILED       │
              │    │                    │               │
              │    │ (success)          │ (compensate)  │
              │    ▼                    │               │
              │  COMPLETED              │               │
              └─────────────────────────────────────────┘
```

### 6. Timeout handling

Chaque étape du saga a un timeout. Sans timeout, un service lent bloque tout le saga :

| Étape | Timeout | Action si timeout |
|---|---|---|
| Reserve Stock | 5s | Annuler le saga (pas de compensation nécessaire) |
| Charge Payment | 10s | Vérifier l'état du paiement, puis decider |
| Ship Order | 30s | Le paiement est déjà fait → retry, ne pas compenser |

**Regle** : ne jamais compenser automatiquement apres un timeout sur la pivot transaction. Vérifier d'abord si l'opération a réussi (le service peut etre lent, pas en echec).

---

## Pratique

### Saga orchestrateur e-commerce (NestJS)

```typescript
// saga/order-saga.orchestrator.ts

type SagaState =
  | 'STARTED'
  | 'RESERVING_STOCK'
  | 'CHARGING_PAYMENT'
  | 'SHIPPING'
  | 'COMPLETED'
  | 'COMPENSATING_PAYMENT'
  | 'COMPENSATING_STOCK'
  | 'COMPENSATED'
  | 'FAILED';

interface SagaContext {
  orderId: string;
  items: Array<{ productId: string; quantity: number; price: number }>;
  customerId: string;
  totalAmount: number;
  state: SagaState;
  reservationId?: string;
  paymentId?: string;
  shipmentId?: string;
  failureReason?: string;
}

@Injectable()
export class OrderSagaOrchestrator {
  constructor(
    private readonly stockService: StockServiceClient,
    private readonly paymentService: PaymentServiceClient,
    private readonly shippingService: ShippingServiceClient,
    private readonly sagaRepo: SagaRepository,
  ) {}

  async execute(command: CreateOrderCommand): Promise<string> {
    const context: SagaContext = {
      orderId: crypto.randomUUID(),
      items: command.items,
      customerId: command.customerId,
      totalAmount: command.items.reduce(
        (sum, item) => sum + item.price * item.quantity, 0,
      ),
      state: 'STARTED',
    };

    await this.sagaRepo.save(context);

    try {
      // Step 1 : Reserve Stock
      await this.transitionTo(context, 'RESERVING_STOCK');
      const reservation = await this.withTimeout(
        this.stockService.reserve(context.items),
        5000, // 5s timeout
      );
      context.reservationId = reservation.id;

      // Step 2 : Charge Payment
      await this.transitionTo(context, 'CHARGING_PAYMENT');
      const payment = await this.withTimeout(
        this.paymentService.charge({
          customerId: context.customerId,
          amount: context.totalAmount,
          idempotencyKey: `order-${context.orderId}`,
        }),
        10000, // 10s timeout
      );
      context.paymentId = payment.id;

      // Step 3 : Ship (pivot — apres ici, pas de compensation)
      await this.transitionTo(context, 'SHIPPING');
      const shipment = await this.withTimeout(
        this.shippingService.createShipment({
          orderId: context.orderId,
          items: context.items,
        }),
        30000, // 30s timeout
      );
      context.shipmentId = shipment.id;

      // Succes
      await this.transitionTo(context, 'COMPLETED');
      return context.orderId;
    } catch (error) {
      context.failureReason = error instanceof Error ? error.message : 'Unknown error';
      await this.compensate(context);
      throw new SagaFailedException(context.orderId, context.failureReason);
    }
  }

  private async compensate(context: SagaContext): Promise<void> {
    // Compenser dans l'ordre inverse
    if (context.paymentId) {
      await this.transitionTo(context, 'COMPENSATING_PAYMENT');
      await this.retry(() =>
        this.paymentService.refund(context.paymentId!, context.orderId),
        3,
      );
    }

    if (context.reservationId) {
      await this.transitionTo(context, 'COMPENSATING_STOCK');
      await this.retry(() =>
        this.stockService.release(context.reservationId!),
        3,
      );
    }

    await this.transitionTo(context, 'COMPENSATED');
  }

  private async transitionTo(context: SagaContext, state: SagaState): Promise<void> {
    context.state = state;
    await this.sagaRepo.save(context);
  }

  private async withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout after ${ms}ms`)), ms),
    );
    return Promise.race([promise, timeout]);
  }

  private async retry<T>(fn: () => Promise<T>, maxAttempts: number): Promise<T> {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (error) {
        if (attempt === maxAttempts) throw error;
        // Backoff exponentiel : 1s, 2s, 4s
        await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt - 1)));
      }
    }
    throw new Error('Unreachable');
  }
}
```

### Service clients (interfaces)

```typescript
// services/stock-service.client.ts
interface StockReservation {
  id: string;
  items: Array<{ productId: string; reserved: number }>;
  expiresAt: string; // La reservation expire apres un delai
}

@Injectable()
export class StockServiceClient {
  constructor(private readonly http: HttpService) {}

  async reserve(
    items: Array<{ productId: string; quantity: number }>,
  ): Promise<StockReservation> {
    const { data } = await firstValueFrom(
      this.http.post<StockReservation>('/api/stock/reserve', { items }),
    );
    return data;
  }

  async release(reservationId: string): Promise<void> {
    // Idempotent : si deja released, retourne 200
    await firstValueFrom(
      this.http.post(`/api/stock/release/${reservationId}`),
    );
  }
}

// services/payment-service.client.ts
interface PaymentResult {
  id: string;
  status: 'charged' | 'declined';
  amount: number;
}

@Injectable()
export class PaymentServiceClient {
  constructor(private readonly http: HttpService) {}

  async charge(params: {
    customerId: string;
    amount: number;
    idempotencyKey: string;
  }): Promise<PaymentResult> {
    const { data } = await firstValueFrom(
      this.http.post<PaymentResult>('/api/payments/charge', params, {
        headers: { 'Idempotency-Key': params.idempotencyKey },
      }),
    );

    if (data.status === 'declined') {
      throw new Error('Payment declined');
    }
    return data;
  }

  async refund(paymentId: string, orderId: string): Promise<void> {
    await firstValueFrom(
      this.http.post(`/api/payments/${paymentId}/refund`, {
        reason: `Saga compensation for order ${orderId}`,
      }),
    );
  }
}
```

### Saga state persistence (pour recovery)

```typescript
// saga/saga-repository.ts
@Injectable()
export class SagaRepository {
  constructor(private readonly dataSource: DataSource) {}

  async save(context: SagaContext): Promise<void> {
    await this.dataSource.query(
      `INSERT INTO sagas (id, state, context, updated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (id) DO UPDATE SET
         state = EXCLUDED.state,
         context = EXCLUDED.context,
         updated_at = NOW()`,
      [context.orderId, context.state, JSON.stringify(context)],
    );
  }

  async findStuck(olderThanMinutes: number): Promise<SagaContext[]> {
    const rows = await this.dataSource.query(
      `SELECT context FROM sagas
       WHERE state NOT IN ('COMPLETED', 'COMPENSATED', 'FAILED')
       AND updated_at < NOW() - INTERVAL '${olderThanMinutes} minutes'`,
    );
    return rows.map((r: { context: string }) => JSON.parse(r.context));
  }
}

// Cron : detecter les sagas bloques et les compenser
@Injectable()
export class SagaRecovery {
  constructor(
    private readonly sagaRepo: SagaRepository,
    private readonly orchestrator: OrderSagaOrchestrator,
    private readonly alerting: AlertingService,
  ) {}

  @Cron('*/5 * * * *') // Toutes les 5 minutes
  async recoverStuckSagas(): Promise<void> {
    const stuck = await this.sagaRepo.findStuck(10); // Bloques > 10 min

    for (const context of stuck) {
      await this.alerting.send({
        channel: 'slack',
        message: `Saga ${context.orderId} stuck in state ${context.state}`,
      });
      // Tenter la compensation
      try {
        await this.orchestrator['compensate'](context);
      } catch {
        // Si meme la compensation echoue, marquer en FAILED
        context.state = 'FAILED';
        await this.sagaRepo.save(context);
      }
    }
  }
}
```

---

## Resume

1. **Saga** = sequence de transactions locales + compensations — l'alternative pragmatique au 2PC pour les transactions distribuees
2. **Choreographie** (events, decentralise) pour 2-3 services simples ; **Orchestration** (coordinateur central, state machine) pour > 3 services ou flux complexes
3. **Compensating transactions** annulent semantiquement chaque étape — elles doivent etre idempotentes et toujours réussir (sinon → dead letter + alerte)
4. **Pivot transaction** = point de non-retour — apres cette étape, on ne compense plus en arriere
5. **Timeout + recovery** : chaque étape a un timeout, un cron détecté les sagas bloques, ne jamais compenser sur timeout sans vérifier l'état reel du service

---

> **Prochain cours** : [Cours 53 — Résilience, Chaos Engineering & Disaster Recovery](./05-résilience-chaos-dr.md) — ou comment rendre un système resistant aux pannes, les provoquer volontairement, et se preparer au pire.

---

> **Lien fil rouge — ShopArch**
>
> - Implémente la saga de commande ShopArch : Reserve Stock → Process Payment → Confirm Order
> - Définis les compensations : si le paiement échoue, libérer le stock réservé
> - Exercice(s) associé(s) : `exercices/34-saga-commande/`
> - Checkpoint : Module 07, critère 2
