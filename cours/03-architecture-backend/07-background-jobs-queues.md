# Cours 25 — Background Jobs & Queues

> **Objectif** : Comprendre les patterns de traitement asynchrone (job queues, delayed jobs, recurring tasks), implémenter un système de jobs avec BullMQ, et maîtriser la gestion des echecs (dead letter queue, idempotence).

---

## Rappel du cours précédent

<details>
<summary>1. Quelles sont les 3 couches de validation dans une API NestJS ?</summary>

1. **DTO Validation** — class-validator/Zod sur le DTO d'entree (format, presence, contraintes)
2. **Domain Validation** — règles métier dans l'entité/service (cohérence, invariants)
3. **Persistence Validation** — contraintes DB (unique, FK, check constraints)

On valide du plus générique (format) au plus spécifique (métier), en rejetant le plus tot possible.
</details>

<details>
<summary>2. Qu'est-ce que RFC 7807 Problem Details ?</summary>

Un format standard pour les réponses d'erreur API avec les champs `type` (URI du type d'erreur), `title` (description humaine), `status` (code HTTP), `detail` (description spécifique), `instance` (URI de la ressource). On peut l'etendre avec `violations` pour la validation.
</details>

---

## Analogie — La file d'attente au restaurant

Quand un restaurant recoit trop de commandes en meme temps :

- **Sans queue** : le chef essaie de tout faire en parallele → chaos, plats brules, service degrade
- **Avec queue** : les commandes arrivent dans une file, le chef les traite une par une (ou par lot), les VIP passent en priorité, et si un plat rate, on le refait (retry)
- **Dead letter** : apres 3 tentatives ratees, la commande est mise de côté pour investigation manuelle — on ne bloque pas la file

C'est exactement ce que fait BullMQ avec Redis.

---

## Théorie

### 1. Pourquoi des background jobs ?

Certaines opérations ne doivent **pas** bloquer la réponse HTTP :

| Opération | Temps | Bloquant ? |
|---|---|---|
| Envoyer un email de confirmation | 500ms-2s | Non — le client n'a pas besoin d'attendre |
| Générer un PDF de facture | 2-5s | Non — notifier quand c'est pret |
| Redimensionner une image | 1-3s | Non — afficher un placeholder |
| Indexer dans Elasticsearch | 200ms-1s | Non — la recherche peut etre "eventually consistent" |
| Publier un article programme | Cron | Non — c'est une tache planifiee |

**Regle** : si l'utilisateur n'a pas besoin du résultat immédiatement, c'est un background job.

### 2. Anatomie d'un système de queues

```
┌──────────┐     ┌──────────────┐     ┌──────────────┐
│  Producer │────>│    Queue     │────>│   Worker     │
│  (API)   │     │   (Redis)    │     │  (Consumer)  │
└──────────┘     └──────┬───────┘     └──────┬───────┘
                        │                     │
                        │              ┌──────┴───────┐
                        │              │  Succes ?    │
                        │              │  Oui → Done  │
                        │              │  Non → Retry │
                        │              └──────┬───────┘
                        │                     │
                        │              ┌──────┴──────────┐
                        │              │ Max retries     │
                        │              │ atteint ?       │
                        │              │ → Dead Letter Q │
                        │              └─────────────────┘
                        │
                 ┌──────┴───────┐
                 │  Scheduler   │  (Cron jobs)
                 │  every 5min  │
                 └──────────────┘
```

### 3. Types de jobs

| Type | Description | Exemple |
|---|---|---|
| **Immediate** | Execute des qu'un worker est disponible | Envoyer un email |
| **Delayed** | Execute apres un delai | Rappel "panier abandonne" (30 min) |
| **Scheduled** | Execute a une date precise | Publier un article le 15 mars a 9h |
| **Recurring** | Execute periodiquement (cron) | Nettoyer les sessions expirees chaque nuit |
| **Priority** | Passe devant les autres | Notification de paiement (priorité haute) |

### 4. Idempotence des jobs

Un job DOIT etre idempotent — s'il est exécuté 2 fois, le résultat est le meme :

```typescript
// NON IDEMPOTENT — danger si retry
async processPayment(orderId: string) {
  await paymentGateway.charge(orderId, amount); // Double debit !
}

// IDEMPOTENT — safe pour retry
async processPayment(orderId: string, idempotencyKey: string) {
  const existing = await db.findPayment(idempotencyKey);
  if (existing) return existing; // Deja traite → skip

  const result = await paymentGateway.charge(orderId, amount);
  await db.savePayment({ idempotencyKey, orderId, result });
  return result;
}
```

### 5. Dead Letter Queue (DLQ)

Apres N retries echoues, le job est deplace dans une DLQ pour investigation :

```
Job echoue → Retry 1 (delai 1s) → Retry 2 (delai 5s) → Retry 3 (delai 30s)
                                                               │
                                                               ▼
                                                        Dead Letter Queue
                                                        → Alerte monitoring
                                                        → Investigation manuelle
```

**Ne jamais ignorer la DLQ** — chaque job en DLQ est un bug potentiel ou un système externe en panne.

### 6. Backoff stratégies

| Stratégie | Delai | Cas d'usage |
|---|---|---|
| **Fixed** | 5s, 5s, 5s | Service qui redemarrage rapidement |
| **Exponential** | 1s, 2s, 4s, 8s | Service externe temporairement down |
| **Exponential + jitter** | 1s±0.5, 2s±1, 4s±2 | Éviter le "thundering herd" (tous retryent en meme temps) |

---

## Pratique

### Setup BullMQ avec NestJS

```typescript
// queue.module.ts
import { BullModule } from '@nestjs/bullmq';

@Module({
  imports: [
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
      },
    }),
    BullModule.registerQueue(
      { name: 'email' },
      { name: 'media' },
      { name: 'publication' },
    ),
  ],
})
export class QueueModule {}
```

### Producer — Envoyer un job depuis l'API

```typescript
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

@Injectable()
export class OrderService {
  constructor(
    @InjectQueue('email') private readonly emailQueue: Queue,
  ) {}

  async createOrder(dto: CreateOrderDto): Promise<Order> {
    const order = await this.orderRepo.save(/* ... */);

    // Job immediat — envoyer l'email de confirmation
    await this.emailQueue.add('order-confirmation', {
      orderId: order.id,
      email: order.customer.email,
      idempotencyKey: `order-confirm-${order.id}`,
    }, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 1000 },
      removeOnComplete: 100,  // Garder les 100 derniers pour debug
      removeOnFail: 500,      // Garder les 500 derniers echecs
    });

    // Job delayed — rappel panier abandonne dans 30 min
    await this.emailQueue.add('cart-abandoned', {
      userId: order.customer.id,
    }, {
      delay: 30 * 60 * 1000, // 30 minutes
      attempts: 2,
    });

    return order;
  }
}
```

### Worker — Traiter les jobs

```typescript
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';

@Processor('email')
export class EmailWorker extends WorkerHost {
  constructor(
    private readonly mailer: MailerService,
    private readonly templateService: TemplateService,
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    switch (job.name) {
      case 'order-confirmation':
        await this.sendOrderConfirmation(job.data);
        break;
      case 'cart-abandoned':
        await this.sendCartReminder(job.data);
        break;
      default:
        throw new Error(`Unknown job: ${job.name}`);
    }
  }

  private async sendOrderConfirmation(data: {
    orderId: string;
    email: string;
    idempotencyKey: string;
  }): Promise<void> {
    // Idempotence check
    const alreadySent = await this.mailer.wasSent(data.idempotencyKey);
    if (alreadySent) return; // Deja envoye → skip

    const order = await this.orderRepo.findById(data.orderId);
    if (!order) throw new Error(`Order ${data.orderId} not found`);

    const html = this.templateService.render('order-confirmation', { order });
    await this.mailer.send({
      to: data.email,
      subject: `Order #${order.reference} confirmed`,
      html,
      idempotencyKey: data.idempotencyKey,
    });
  }

  private async sendCartReminder(data: { userId: string }): Promise<void> {
    const cart = await this.cartRepo.findByUserId(data.userId);
    // Si le panier est vide ou si la commande a ete passee, on skip
    if (!cart || cart.items.length === 0) return;

    await this.mailer.send({
      to: cart.userEmail,
      subject: 'You left items in your cart!',
      html: this.templateService.render('cart-abandoned', { cart }),
    });
  }
}
```

### Recurring job — Auto-publication cron

```typescript
@Injectable()
export class PublicationScheduler implements OnModuleInit {
  constructor(
    @InjectQueue('publication') private readonly pubQueue: Queue,
  ) {}

  async onModuleInit() {
    // Supprimer les anciens repeatables avant d'en ajouter de nouveaux
    const existing = await this.pubQueue.getRepeatableJobs();
    for (const job of existing) {
      await this.pubQueue.removeRepeatableByKey(job.key);
    }

    // Verifier les articles programmes toutes les minutes
    await this.pubQueue.add('check-scheduled', {}, {
      repeat: { pattern: '* * * * *' }, // Chaque minute
      removeOnComplete: 10,
    });
  }
}

@Processor('publication')
export class PublicationWorker extends WorkerHost {
  async process(job: Job): Promise<void> {
    if (job.name !== 'check-scheduled') return;

    // Trouver les articles dont la date de publication est passee
    const articles = await this.articleRepo.findScheduledBefore(new Date());

    for (const article of articles) {
      article.publish(); // Transition FSM : Scheduled → Published
      await this.articleRepo.save(article);
      // Invalider le cache
      await this.cacheService.invalidateTag(`article:${article.id}`);
    }
  }
}
```

### Dead Letter Queue handler

```typescript
import { OnQueueEvent, QueueEventsHost, QueueEventsListener } from '@nestjs/bullmq';

@QueueEventsListener('email')
export class EmailQueueEvents extends QueueEventsHost {
  constructor(private readonly alerting: AlertingService) {
    super();
  }

  @OnQueueEvent('failed')
  async onFailed(args: { jobId: string; failedReason: string; prev: string }) {
    // Le job a echoue definitivement (max retries atteint)
    if (args.prev === 'failed') {
      await this.alerting.send({
        channel: 'slack',
        severity: 'warning',
        message: `Email job ${args.jobId} failed permanently: ${args.failedReason}`,
      });
    }
  }
}
```

---

## Resume

1. **Background jobs** pour tout ce qui n'a pas besoin d'une réponse synchrone — emails, PDF, images, indexation
2. **BullMQ + Redis** : queues nommees, workers dédiés, retry avec backoff exponentiel
3. **Idempotence obligatoire** — chaque job doit pouvoir etre rejoue sans effet de bord
4. **Dead Letter Queue** — ne jamais ignorer les echecs definitifs, alerter le monitoring
5. **Cron jobs** pour les taches recurrentes (auto-publication, nettoyage, synchronisation)

---

> **Prochain cours** : [Cours 26 — Concurrence & Asynchronisme](./08-concurrence-asynchronisme.md) — ou comment gérer les accès concurrents, les race conditions et les locks.

---

> **Lien fil rouge — ShopArch**
>
> - Implémente un job BullMQ pour l'envoi d'email de confirmation de commande
> - Ajoute un job de génération de facture PDF en arrière-plan
> - Exercice(s) associé(s) : `exercices/15-job-queue-bullmq/`
> - Checkpoint : Module 03, critère 3
