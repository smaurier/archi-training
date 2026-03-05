# Correction — Exercice 15 : Job queue BullMQ

## Résultat attendu

Un système de queues robuste avec producers dans l'API, consumers dans un worker séparé, retry, et dead letter queue.

## Queue setup

```typescript
// queues/queue.module.ts
import { BullModule } from '@nestjs/bullmq';

@Module({
  imports: [
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST ?? 'localhost',
        port: parseInt(process.env.REDIS_PORT ?? '6379'),
      },
    }),
    BullModule.registerQueue(
      { name: 'email' },
      { name: 'media' },
      { name: 'import' },
    ),
  ],
})
export class QueueModule {}
```

## Job types

```typescript
// queues/job-types.ts
export interface OrderConfirmationJob {
  to: string;
  orderId: string;
  total: number;
  locale: string;
}

export interface GenerateThumbnailsJob {
  mediaId: string;
  tenantId: string;
  originalKey: string; // S3 key
  sizes: number[];     // [150, 800, 1920]
}

export interface ImportCsvJob {
  tenantId: string;
  siteId: string;
  fileKey: string;    // S3 key du CSV
  entityType: 'products' | 'categories';
}
```

## Producer

```typescript
// order/order.service.ts
@Injectable()
export class OrderService {
  constructor(
    @InjectQueue('email') private readonly emailQueue: Queue,
  ) {}

  async createOrder(dto: CreateOrderDto): Promise<Order> {
    const order = await this.orderRepo.save(dto);

    // Ajouter le job email (non-bloquant)
    await this.emailQueue.add(
      'order-confirmation',
      {
        to: order.customerEmail,
        orderId: order.id,
        total: order.total,
        locale: order.locale,
      } satisfies OrderConfirmationJob,
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 },
        priority: 1, // Haute priorite
        removeOnComplete: { age: 86400 }, // Garder 24h
        removeOnFail: false, // Garder les echecs pour debug
      },
    );

    return order;
  }
}
```

## Workers

```typescript
// workers/email.worker.ts
@Processor('email')
export class EmailWorker extends WorkerHost {
  constructor(private readonly mailer: MailService) {
    super();
  }

  async process(job: Job<OrderConfirmationJob>): Promise<void> {
    const { to, orderId, total, locale } = job.data;

    console.log(JSON.stringify({
      level: 'info',
      event: 'job.started',
      queue: 'email',
      jobId: job.id,
      jobName: job.name,
    }));

    await this.mailer.send({
      to,
      template: 'order-confirmation',
      context: { orderId, total, locale },
    });

    console.log(JSON.stringify({
      level: 'info',
      event: 'job.completed',
      queue: 'email',
      jobId: job.id,
    }));
  }
}

// workers/media.worker.ts
@Processor('media')
export class MediaWorker extends WorkerHost {
  constructor(
    private readonly s3: S3Service,
    private readonly imageProcessor: ImageProcessorService,
  ) {
    super();
  }

  async process(job: Job<GenerateThumbnailsJob>): Promise<void> {
    const { mediaId, tenantId, originalKey, sizes } = job.data;

    // Telecharger l'original
    const original = await this.s3.download(originalKey);

    for (let i = 0; i < sizes.length; i++) {
      const size = sizes[i];

      // Generer le thumbnail
      const thumbnail = await this.imageProcessor.resize(original, size);

      // Uploader sur S3
      const key = originalKey.replace(/(\.[^.]+)$/, `_${size}$1`);
      await this.s3.upload(key, thumbnail);

      // Mettre a jour la progression
      await job.updateProgress(((i + 1) / sizes.length) * 100);
    }
  }
}

// workers/import.worker.ts
@Processor('import')
export class ImportWorker extends WorkerHost {
  async process(job: Job<ImportCsvJob>): Promise<void> {
    const { tenantId, siteId, fileKey, entityType } = job.data;

    const csvContent = await this.s3.download(fileKey);
    const lines = csvContent.toString().split('\n');
    const total = lines.length - 1; // Moins le header

    let processed = 0;
    let errors: string[] = [];

    for (let i = 1; i < lines.length; i++) {
      try {
        const row = this.parseLine(lines[i], entityType);
        await this.importRow(tenantId, siteId, entityType, row);
        processed++;
      } catch (err) {
        errors.push(`Line ${i}: ${err.message}`);
      }

      // Progression
      await job.updateProgress(Math.round((i / total) * 100));
    }

    // Resultat du job
    return { processed, errors, total };
  }
}
```

## Dead letter queue handler

```typescript
// workers/dead-letter.listener.ts
@Injectable()
export class DeadLetterListener {
  constructor(
    @InjectQueue('email') private readonly emailQueue: Queue,
  ) {
    this.emailQueue.on('failed', (job: Job, err: Error) => {
      if (job.attemptsMade >= job.opts.attempts) {
        console.log(JSON.stringify({
          level: 'error',
          event: 'job.dead_letter',
          queue: 'email',
          jobId: job.id,
          jobName: job.name,
          error: err.message,
          data: job.data,
          attempts: job.attemptsMade,
        }));
        // Alerter l'equipe (Slack, PagerDuty)
      }
    });
  }
}
```

## Alternatives et arbitrages

> En architecture, ta valeur n'est pas de connaître UNE solution,
> mais de savoir POURQUOI tu choisis celle-ci plutôt qu'une autre.

### Option A : BullMQ + Redis (solution présentée)
**Quand la choisir :** Stack Node.js, besoin de jobs avec retry/delay/scheduling, Redis déjà en place (cache/sessions), volume modéré (<10K jobs/sec).
**Limites :** Dépendance à Redis (SPOF si pas de cluster), pas de garantie d'ordre strict, perte de messages si Redis crash sans persistance AOF.

### Option B : RabbitMQ (AMQP)
**Quand la choisir :** Routing complexe (exchanges, bindings), garantie de livraison (acknowledgements), protocole standard AMQP (interopérable Java/.NET/Python), dead letter queues natives.
**Limites :** Infrastructure dédiée (Erlang runtime), plus complexe à opérer que Redis, overhead protocole vs BullMQ.

### Option C : Apache Kafka
**Quand la choisir :** Event streaming haute performance (>100K events/sec), besoin de replay (consumer groups, offsets), event sourcing, data pipeline (Kafka Connect).
**Limites :** Complexité opérationnelle (ZooKeeper/KRaft, partitions, replication), overkill pour des job queues simples, latence plus élevée pour des jobs unitaires.

### Matrice de décision
| Critère | BullMQ/Redis | RabbitMQ | Kafka |
|---|---|---|---|
| Simplicité setup | Excellente | Moyenne | Faible |
| Throughput | Bon (<10K/s) | Bon (<50K/s) | Excellent (>100K/s) |
| Garantie livraison | At-least-once | At-least-once | At-least-once |
| Replay messages | Non | Non | Oui |
| Routing avancé | Basique | Excellent | Par partition |
| Scheduling/Delay | Natif | Plugin | Non natif |

### Pour ShopArch, on choisit...
BullMQ + Redis car Redis est déjà utilisé pour le cache et les sessions. Les jobs (envoi d'emails, génération de factures PDF, import catalogue) sont à volume modéré et bénéficient du retry/delay natif de BullMQ. Si on avait besoin d'event streaming (analytics, data pipeline), on ajouterait Kafka en complément — pas en remplacement.

---

## Ce que tu aurais pu oublier

### 1. Worker dans le meme process que l'API

```
FAUX — le worker partage le CPU avec les requetes HTTP
  → Un import CSV lourd ralentit les reponses API

CORRECT — worker dans un process separe
  → main.ts = API HTTP (port 3000)
  → worker.ts = consumers de queues (pas de port)
```

### 2. Jobs non-idempotents

```typescript
// FAUX — le retry envoie un 2e email de confirmation
await mailer.send({ to, subject: 'Confirmation' });
// Si le job est retry, le client recoit 2 emails

// CORRECT — idempotency key
const idempotencyKey = `email:order-confirmation:${orderId}`;
const alreadySent = await redis.get(idempotencyKey);
if (alreadySent) return; // Deja envoye
await mailer.send({ to, subject: 'Confirmation' });
await redis.set(idempotencyKey, '1', 'EX', 86400);
```

### 3. Pas de backoff exponentiel

```typescript
// FAUX — retry immediate (3 fois en 1 seconde)
{ attempts: 3 } // Pas de delai entre les retries

// CORRECT — backoff exponentiel
{ attempts: 3, backoff: { type: 'exponential', delay: 1000 } }
// 1s → 2s → 4s entre les retries
```

### 4. Oublier la progression pour les jobs longs

```typescript
// FAUX — l'import CSV tourne 5 minutes sans feedback
// L'utilisateur ne sait pas ou en est l'import

// CORRECT — mise a jour de la progression
await job.updateProgress(Math.round((i / total) * 100));
// Le front peut poller GET /api/imports/:jobId/progress
```
