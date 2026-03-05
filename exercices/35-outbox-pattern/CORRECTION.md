# Correction — Exercice 35 : Outbox pattern

## Table outbox

```sql
CREATE TABLE outbox_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  aggregate_type VARCHAR(100) NOT NULL,  -- 'Order', 'Product'
  aggregate_id UUID NOT NULL,
  event_type VARCHAR(100) NOT NULL,       -- 'OrderCreated', 'OrderPaid'
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  published_at TIMESTAMPTZ,
  retry_count INT NOT NULL DEFAULT 0,
  last_error TEXT,
  tenant_id UUID NOT NULL
);

-- Index pour le polling efficace
CREATE INDEX idx_outbox_unpublished
  ON outbox_events (created_at)
  WHERE published_at IS NULL AND retry_count < 5;

-- Index pour le cleanup
CREATE INDEX idx_outbox_published
  ON outbox_events (published_at)
  WHERE published_at IS NOT NULL;
```

## Écriture transactionnelle

```typescript
// order.service.ts
@Injectable()
export class OrderService {
  constructor(private readonly dataSource: DataSource) {}

  async createOrder(input: CreateOrderInput): Promise<Order> {
    return this.dataSource.transaction(async (manager) => {
      // 1. Creer la commande
      const order = manager.create(Order, {
        id: randomUUID(),
        userId: input.userId,
        items: input.items,
        total: input.total,
        status: 'created',
        tenantId: input.tenantId,
      });
      await manager.save(order);

      // 2. Creer l'event dans outbox — MEME TRANSACTION
      await manager.save(OutboxEvent, {
        aggregateType: 'Order',
        aggregateId: order.id,
        eventType: 'OrderCreated',
        payload: {
          orderId: order.id,
          userId: order.userId,
          items: order.items,
          total: order.total,
          createdAt: order.createdAt,
        },
        tenantId: input.tenantId,
      });

      // Si le commit echoue, ni la commande ni l'event ne sont crees
      return order;
    });
  }
}
```

## Outbox publisher (polling)

```typescript
// outbox-publisher.service.ts
@Injectable()
export class OutboxPublisher {
  private readonly POLL_INTERVAL = 500; // ms
  private readonly BATCH_SIZE = 50;
  private readonly MAX_RETRIES = 5;

  constructor(
    private readonly outboxRepo: Repository<OutboxEvent>,
    private readonly messageBroker: MessageBroker,
    private readonly dataSource: DataSource,
  ) {}

  @Cron('*/1 * * * * *') // toutes les secondes via cron, ou setInterval pour 500ms
  async pollAndPublish() {
    // SELECT FOR UPDATE SKIP LOCKED — permet le parallelisme
    const events = await this.dataSource.transaction(async (manager) => {
      return manager
        .createQueryBuilder(OutboxEvent, 'e')
        .setLock('pessimistic_write_or_fail') // SKIP LOCKED
        .where('e.publishedAt IS NULL')
        .andWhere('e.retryCount < :max', { max: this.MAX_RETRIES })
        .orderBy('e.createdAt', 'ASC')
        .take(this.BATCH_SIZE)
        .getMany();
    });

    if (events.length === 0) return;

    for (const event of events) {
      try {
        await this.messageBroker.publish(event.eventType, {
          id: event.id,
          aggregateType: event.aggregateType,
          aggregateId: event.aggregateId,
          payload: event.payload,
          occurredAt: event.createdAt,
        });

        // Marquer comme publie
        await this.outboxRepo.update(event.id, {
          publishedAt: new Date(),
        });
      } catch (error) {
        // Incrementer le retry count
        await this.outboxRepo.update(event.id, {
          retryCount: event.retryCount + 1,
          lastError: (error as Error).message,
        });

        if (event.retryCount + 1 >= this.MAX_RETRIES) {
          console.error(`Outbox event ${event.id} moved to dead letter after ${this.MAX_RETRIES} retries`);
          // Emettre une alerte
        }
      }
    }
  }
}
```

## Cleanup

```typescript
// outbox-cleanup.service.ts
@Injectable()
export class OutboxCleanup {
  constructor(private readonly outboxRepo: Repository<OutboxEvent>) {}

  // Tous les jours a 3h du matin
  @Cron('0 3 * * *')
  async cleanup() {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000);

    const result = await this.outboxRepo
      .createQueryBuilder()
      .delete()
      .where('publishedAt IS NOT NULL')
      .andWhere('publishedAt < :cutoff', { cutoff: sevenDaysAgo })
      .execute();

    console.log(`Cleaned up ${result.affected} published outbox events`);
  }
}
```

## Monitoring

```typescript
// outbox-monitoring.service.ts
@Injectable()
export class OutboxMonitoring {
  constructor(private readonly outboxRepo: Repository<OutboxEvent>) {}

  async getMetrics(): Promise<OutboxMetrics> {
    const pending = await this.outboxRepo.count({
      where: { publishedAt: IsNull() },
    });

    const oldestPending = await this.outboxRepo.findOne({
      where: { publishedAt: IsNull() },
      order: { createdAt: 'ASC' },
    });

    const deadLetterCount = await this.outboxRepo
      .createQueryBuilder('e')
      .where('e.publishedAt IS NULL')
      .andWhere('e.retryCount >= 5')
      .getCount();

    const ageMs = oldestPending
      ? Date.now() - oldestPending.createdAt.getTime()
      : 0;

    // Alerte si un event attend depuis plus de 5 minutes
    if (ageMs > 5 * 60 * 1000) {
      console.warn(`ALERT: Oldest unpublished outbox event is ${Math.floor(ageMs / 1000)}s old`);
    }

    return { pending, oldestAgeMs: ageMs, deadLetterCount };
  }
}
```

## Consumer idempotent

```typescript
// order-event.consumer.ts — le consumer doit gerer les doublons
@Injectable()
export class OrderEventConsumer {
  constructor(private readonly redis: Redis) {}

  async handleOrderCreated(event: { id: string; payload: OrderCreatedPayload }) {
    // Idempotence : verifier si deja traite
    const key = `event:processed:${event.id}`;
    const alreadyProcessed = await this.redis.set(key, '1', 'EX', 7 * 86400, 'NX');
    if (alreadyProcessed === null) {
      console.log(`Event ${event.id} already processed, skipping`);
      return;
    }

    // Traiter l'event
    await this.processOrderCreated(event.payload);
  }
}
```

## Ce que tu aurais pu oublier

### 1. Double write
```
FAUX — save en DB PUIS publish event (crash entre les deux = event perdu)
CORRECT — save + outbox insert dans la MEME transaction
         Le publisher lit l'outbox et publie ensuite
```

### 2. Pas de SKIP LOCKED
```
FAUX — deux instances du publisher traitent les memes events (doublons)
CORRECT — SELECT FOR UPDATE SKIP LOCKED permet le parallelisme
         Chaque instance traite un batch different
```

### 3. Consumer non idempotent
```
FAUX — le consumer traite l'event 2 fois (at-least-once = doublons possibles)
CORRECT — chaque consumer verifie l'event ID avant de traiter
         Redis SET NX pour la deduplication
```

### 4. Pas de cleanup
```
FAUX — la table outbox grossit indefiniment (millions de lignes)
CORRECT — supprimer les events publies apres 7 jours
         Garder les dead letters pour investigation
```
