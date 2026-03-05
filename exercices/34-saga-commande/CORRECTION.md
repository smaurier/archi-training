# Correction — Exercice 34 : Saga de commande

## Définition des étapes

```typescript
// saga-step.types.ts
interface SagaStep<TInput = unknown, TOutput = unknown> {
  name: string;
  execute: (input: TInput) => Promise<TOutput>;
  compensate?: (input: TInput, output: TOutput) => Promise<void>;
  retryPolicy?: { maxAttempts: number; backoffMs: number };
}

type SagaStatus = 'running' | 'completed' | 'compensating' | 'failed' | 'compensated';

interface SagaState {
  id: string;
  type: string;
  status: SagaStatus;
  currentStep: number;
  steps: Array<{
    name: string;
    status: 'pending' | 'completed' | 'failed' | 'compensated';
    input?: unknown;
    output?: unknown;
    error?: string;
    completedAt?: Date;
  }>;
  createdAt: Date;
  updatedAt: Date;
}
```

## Saga Orchestrateur générique

```typescript
// saga-orchestrator.ts
@Injectable()
export class SagaOrchestrator {
  constructor(private readonly sagaRepo: Repository<SagaState>) {}

  async execute<T>(sagaType: string, steps: SagaStep[], initialInput: T): Promise<SagaState> {
    // 1. Creer l'etat de la saga
    const saga = await this.sagaRepo.save({
      id: randomUUID(),
      type: sagaType,
      status: 'running' as SagaStatus,
      currentStep: 0,
      steps: steps.map((s) => ({ name: s.name, status: 'pending' as const })),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    let lastOutput: unknown = initialInput;

    // 2. Executer chaque etape
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      saga.currentStep = i;
      saga.steps[i].input = lastOutput;

      try {
        lastOutput = await this.executeWithRetry(step, lastOutput);
        saga.steps[i].status = 'completed';
        saga.steps[i].output = lastOutput;
        saga.steps[i].completedAt = new Date();
        await this.sagaRepo.save(saga);
      } catch (error) {
        saga.steps[i].status = 'failed';
        saga.steps[i].error = (error as Error).message;
        saga.status = 'compensating';
        await this.sagaRepo.save(saga);

        // 3. Compenser les etapes deja executees (ordre inverse)
        await this.compensate(saga, steps, i - 1);
        return saga;
      }
    }

    saga.status = 'completed';
    saga.updatedAt = new Date();
    await this.sagaRepo.save(saga);
    return saga;
  }

  private async executeWithRetry(step: SagaStep, input: unknown): Promise<unknown> {
    const maxAttempts = step.retryPolicy?.maxAttempts ?? 1;
    const backoffMs = step.retryPolicy?.backoffMs ?? 1000;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await step.execute(input);
      } catch (error) {
        if (attempt === maxAttempts) throw error;
        await new Promise((r) => setTimeout(r, backoffMs * attempt));
      }
    }
    throw new Error('Unreachable');
  }

  private async compensate(saga: SagaState, steps: SagaStep[], fromIndex: number) {
    for (let i = fromIndex; i >= 0; i--) {
      const step = steps[i];
      if (!step.compensate || saga.steps[i].status !== 'completed') continue;

      // Les compensations doivent TOUJOURS reussir → retry infini
      let compensated = false;
      while (!compensated) {
        try {
          await step.compensate(saga.steps[i].input, saga.steps[i].output);
          saga.steps[i].status = 'compensated';
          compensated = true;
        } catch (error) {
          console.error(`Compensation ${step.name} failed, retrying...`, error);
          await new Promise((r) => setTimeout(r, 5000));
        }
      }

      await this.sagaRepo.save(saga);
    }

    saga.status = 'compensated';
    saga.updatedAt = new Date();
    await this.sagaRepo.save(saga);
  }

  // Recovery apres crash : reprendre les sagas en cours
  async recover() {
    const incompleteSagas = await this.sagaRepo.find({
      where: [{ status: 'running' }, { status: 'compensating' }],
    });

    for (const saga of incompleteSagas) {
      console.log(`Recovering saga ${saga.id} (${saga.type}) at step ${saga.currentStep}`);
      if (saga.status === 'compensating') {
        // Reprendre la compensation
        const steps = this.getStepsForType(saga.type);
        await this.compensate(saga, steps, saga.currentStep - 1);
      }
      // Pour 'running', on compense depuis la derniere etape completee
    }
  }
}
```

## Saga de commande concrete

```typescript
// order-saga.service.ts
@Injectable()
export class OrderSagaService {
  constructor(
    private readonly orchestrator: SagaOrchestrator,
    private readonly stockService: StockService,
    private readonly paymentService: PaymentService,
    private readonly orderService: OrderService,
    private readonly notificationService: NotificationService,
  ) {}

  async createOrder(input: { orderId: string; userId: string; items: OrderItem[]; total: number }) {
    const steps: SagaStep[] = [
      {
        name: 'ReserveStock',
        execute: async (data: typeof input) => {
          const reservationId = await this.stockService.reserve(data.orderId, data.items);
          return { ...data, reservationId };
        },
        compensate: async (_input, output) => {
          await this.stockService.release(output.reservationId);
        },
      },
      {
        name: 'ProcessPayment',
        execute: async (data) => {
          const paymentId = await this.paymentService.charge(data.userId, data.total, data.orderId);
          return { ...data, paymentId };
        },
        compensate: async (_input, output) => {
          await this.paymentService.refund(output.paymentId);
        },
        retryPolicy: { maxAttempts: 3, backoffMs: 2000 },
      },
      {
        name: 'ConfirmOrder',
        execute: async (data) => {
          await this.orderService.confirm(data.orderId, data.paymentId);
          return data;
        },
        compensate: async (_input, output) => {
          await this.orderService.cancel(output.orderId);
        },
      },
      {
        name: 'SendNotification',
        // Pas de compensation — best effort
        execute: async (data) => {
          await this.notificationService.sendOrderConfirmation(data.userId, data.orderId);
          return data;
        },
        // Pas de retryPolicy particuliere, et erreur ignoree
      },
    ];

    return this.orchestrator.execute('order-creation', steps, input);
  }
}
```

## Persistence de l'état

```typescript
// saga.entity.ts
@Entity('sagas')
export class SagaEntity {
  @PrimaryColumn('uuid')
  id: string;

  @Column()
  type: string;

  @Column({ type: 'enum', enum: ['running', 'completed', 'compensating', 'failed', 'compensated'] })
  status: string;

  @Column()
  currentStep: number;

  @Column('jsonb')
  steps: Array<{
    name: string;
    status: string;
    input?: unknown;
    output?: unknown;
    error?: string;
    completedAt?: string;
  }>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Index()
  @Column()
  tenantId: string;
}
```

## Alternatives et compromis

### Orchestration vs Choregraphie

| Critère | Orchestration (orchestrateur central) | Choregraphie (events distribues) |
|---|---|---|
| Couplage | Central → connait toutes les étapes | Decouple → chaque service écoute des events |
| Visibilite | Excellente (l'orchestrateur a la vue d'ensemble) | Faible (le flux est distribue, difficile a debugger) |
| Point de defaillance | L'orchestrateur est un SPOF | Pas de SPOF mais cascade d'events |
| Complexite | Moderee (1 service orchestre) | Elevee (chaque service doit gérer ses transitions) |
| Ajout d'étape | Modifier l'orchestrateur | Ajouter un listener sur l'event |
| Monitoring | Facile (état centralise) | Difficile (traces distribuees nécessaires) |

**Verdict pour ShopArch** : orchestration pour les sagas critiques (commande, paiement) car la visibilité est essentielle. Choregraphie pour les flux secondaires (notifications, analytics) ou le découplage est plus important.

### Saga vs 2PC (Two-Phase Commit)

| Critère | Saga (compensations) | 2PC (commit distribue) |
|---|---|---|
| Cohérence | Eventuelle (compensation si echec) | Forte (atomique) |
| Performance | Bonne (pas de lock distribue) | Mauvaise (lock global pendant le commit) |
| Disponibilite | Haute (chaque service independant) | Basse (si un participant est down, tout bloque) |
| Complexite | Compensations a écrire pour chaque étape | Le coordinateur géré tout |
| Cas d'usage | Microservices, processus longs | Transactions courtes, base monolithique |

**Verdict pour ShopArch** : saga obligatoire en microservices. 2PC n'est viable que dans un monolithe avec une seule base de données.

### Retry immédiat vs queue persistante

| Critère | Retry en mémoire | Queue persistante (BullMQ) |
|---|---|---|
| Résilience | Perdu si le process crash | Persiste sur Redis/disk |
| Complexite | Simple (boucle retry) | Moderee (setup queue + worker) |
| Observabilite | Logs seulement | Dashboard BullMQ, metriques |
| Backpressure | Non | Oui (concurrency, rate limiting) |

**Verdict pour ShopArch** : retry en mémoire pour les étapes rapides (< 5s), queue persistante pour les étapes longues ou critiques (paiement, stock).

## Ce que tu aurais pu oublier

### 1. Compensations qui echouent
```
FAUX — si la compensation echoue, on abandonne (stock bloque, argent debite)
CORRECT — retry infini sur les compensations, elles DOIVENT reussir
         C'est le contrat fondamental d'une saga
```

### 2. État non persiste
```
FAUX — etat de la saga en memoire (perdu si crash)
CORRECT — persister chaque transition en base AVANT d'executer l'etape
         Permet le recovery apres crash
```

### 3. Étapes non idempotentes
```
FAUX — ReserveStock cree une nouvelle reservation a chaque appel
CORRECT — chaque etape doit etre idempotente (meme orderId → meme reservation)
         Utiliser l'orderId comme cle d'idempotence
```

### 4. Notification bloquante
```
FAUX — si le service de notification est down, la saga echoue et compense tout
CORRECT — la notification est best-effort, elle ne doit pas bloquer la saga
         En cas d'echec, on log et on continue (la commande est confirmee)
```
