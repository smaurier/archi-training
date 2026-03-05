# Cours 47 — Event-driven, Webhooks & Message Queues

> **Objectif** : Concevoir une architecture webhook complete (signature HMAC-SHA256, retry avec backoff, auto-disable), implémenter le dispatch asynchrone avec BullMQ, comprendre un event bus Kafka, intégrer n8n comme middleware d'orchestration, et documenter les events avec AsyncAPI.

---

## Rappel du cours précédent

<details>
<summary>1. Pourquoi utiliser un Redis pub/sub adapter pour scaler les WebSockets ?</summary>

Quand on deploie plusieurs instances du serveur WebSocket derriere un load balancer, un client connecte au serveur 1 ne recoit pas les messages publies par le serveur 2 — les rooms sont locales a chaque process. Le **Redis pub/sub adapter** fait que chaque serveur publie ses messages sur Redis et s'abonne aux channels. Redis redistribue les messages a toutes les instances, qui les diffusent a leurs clients locaux. Résultat : les rooms fonctionnent de manière transparente, quelle que soit l'instance.
</details>

<details>
<summary>2. Quelle est la différence entre WebSocket et SSE pour les notifications temps reel ?</summary>

**SSE** (Server-Sent Events) est unidirectionnel (serveur vers client), utilise HTTP standard, supporte la reconnexion automatique avec `Last-Event-ID`, et passe les proxies/CDN sans problème. **WebSocket** est bidirectionnel, nécessité un upgrade protocol, et la reconnexion est manuelle. Pour des notifications ou des flux d'events ou le client ne fait qu'écouter, SSE est plus simple et suffisant. WebSocket est nécessaire uniquement si le client doit aussi envoyer des messages (chat, collaboration).
</details>

---

## Analogie — Le système postal professionnel

Imagine une entreprise qui doit informer ses partenaires de chaque événement important :

- **Webhook = le recommande avec accuse de reception** : l'entreprise envoie un courrier signe (HMAC) a l'adresse du partenaire. Si le partenaire n'est pas la (erreur 500), le facteur revient le lendemain (retry 1), puis 2 jours apres (retry 2), puis 4 jours (retry 3). Apres 10 courriers non-recus, l'entreprise arrete d'envoyer et note "adresse invalide" (auto-disable).
- **Message queue = le tri postal** : les courriers arrivent dans un centre de tri (Redis/Kafka). Meme si le facteur est occupe, les lettres attendent dans la file. Plusieurs facteurs (workers) peuvent traiter en parallele. Une lettre urgente (priority) passe avant les publicites.
- **Event bus Kafka = le journal officiel** : chaque événement est publie dans un journal permanent que tous les abonnes peuvent lire a leur rythme. Le journal ne disparait pas apres lecture — il est conserve (retention) et chaque lecteur a son propre marque-page (consumer offset).

---

## Théorie

### 1. Architecture webhook complete

```
Webhook Lifecycle

  CMS (Publisher)                    Partenaire (Consumer)
    │                                    │
    │  Event: "content.published"        │
    │                                    │
    │  1. Generer le payload JSON        │
    │  2. Signer avec HMAC-SHA256        │
    │  3. Envoyer via queue (async)      │
    │                                    │
    │── POST https://partner.com/hook ──>│
    │   X-Webhook-Signature: sha256=abc  │
    │   X-Webhook-Event: content.published
    │   X-Webhook-Delivery: uuid-123     │
    │   Content-Type: application/json   │
    │   Body: { event, data, timestamp } │
    │                                    │
    │                                    │  4. Verifier la signature HMAC
    │                                    │  5. Traiter l'event
    │<── 200 OK ─────────────────────────│
    │                                    │
    │  Si timeout ou 5xx :               │
    │  6. Retry #1 apres 60s             │
    │  7. Retry #2 apres 300s            │
    │  8. Retry #3 apres 3600s           │
    │                                    │
    │  Si 10 echecs consecutifs :        │
    │  9. Desactiver le webhook          │
    │  10. Notifier l'admin              │
```

### 2. Signature HMAC-SHA256

```
Processus de signature et verification

  Publisher :
  ──────────
  payload = JSON.stringify(body)
  signature = HMAC-SHA256(secret, payload)
  Header: X-Webhook-Signature: sha256=<signature>

  Consumer :
  ──────────
  rawBody = request.body (raw string, PAS parse)
  expectedSig = HMAC-SHA256(sharedSecret, rawBody)
  actualSig = request.headers['x-webhook-signature'].replace('sha256=', '')

  if (timingSafeEqual(expectedSig, actualSig)) {
    → Signature valide — traiter l'event
  } else {
    → Signature invalide — rejeter (403)
  }
```

**Regles critiques :**
- Utiliser `timingSafeEqual` pour comparer — empeche les timing attacks
- Signer le body RAW (avant JSON.parse) — sinon un reformatage invalide la signature
- Chaque webhook a son propre secret — ne jamais partager entre partenaires

### 3. Retry avec backoff exponentiel

| Tentative | Delai | Delai cumule | Description |
|---|---|---|---|
| 1 | Immediat | 0 | Premier essai |
| 2 | 60s | 1 min | Service peut-etre temporairement down |
| 3 | 300s | 6 min | Laisser le temps de récupérer |
| 4 (final) | 3600s | ~1h | Derniere chance |

```
Apres 3 retries echoues → marquer comme "failed"
Compteur failures++ pour le webhook

Si failures >= 10 consecutifs :
  → webhook.status = "disabled"
  → Envoyer un email a l'admin du tenant
  → Logger dans le monitoring
```

### 4. Vocabulaire standard des events

| Event | Description | Payload cle |
|---|---|---|
| `content.published` | Un article/page a ete publie | `contentId`, `contentType`, `locale` |
| `content.unpublished` | Un contenu a ete depublie | `contentId`, `previousStatus` |
| `content.updated` | Un contenu a ete modifie | `contentId`, `changedFields[]` |
| `content.deleted` | Un contenu a ete supprime | `contentId`, `deletedBy` |
| `media.uploaded` | Un media a ete uploade | `mediaId`, `mimeType`, `size` |
| `media.deleted` | Un media a ete supprime | `mediaId` |
| `form.submitted` | Un formulaire a ete soumis | `formId`, `submissionId` |
| `user.created` | Un utilisateur a ete cree | `userId`, `role` |
| `site.settings.updated` | Les parametres du site ont change | `siteId`, `changedKeys[]` |

### 5. Dispatch asynchrone avec BullMQ

```
Architecture dispatch webhook

  API Controller               BullMQ Queue              Webhook Worker
       │                           │                          │
       │  article.publish()        │                          │
       │  → domain event           │                          │
       │                           │                          │
       │  webhookQueue.add(        │                          │
       │    'dispatch',            │                          │
       │    { event, payload }     │                          │
       │  )                        │                          │
       │─────────────────────────>│                          │
       │                           │                          │
       │  200 OK (client)          │  Job dequeued            │
       │                           │────────────────────────>│
       │                           │                          │
       │                           │  Pour chaque webhook     │
       │                           │  actif du tenant :       │
       │                           │  → Signer + envoyer      │
       │                           │  → Retry si echec        │
       │                           │  → Log le resultat       │
```

### 6. Event bus Kafka

```
Kafka Architecture

  ┌──────────┐     ┌─────────────────────────────────┐
  │ Producer │     │          Topic: cms.events       │
  │  (API)   │────>│                                   │
  └──────────┘     │  Partition 0  │  Partition 1      │
                   │  [evt1][evt3] │  [evt2][evt4]     │
                   │       ▲       │       ▲           │
                   └───────┼───────┴───────┼───────────┘
                           │               │
                    ┌──────┴──┐     ┌──────┴──┐
                    │Consumer │     │Consumer │
                    │ Group A │     │ Group A │
                    │(webhook │     │(webhook │
                    │ worker) │     │ worker) │
                    └─────────┘     └─────────┘

  Consumer Group B (search indexer) — lit les memes events independamment
  Consumer Group C (analytics)      — chacun a son propre offset
```

| Concept Kafka | Description |
|---|---|
| **Topic** | Un flux d'events nomme (`cms.events`, `cms.content.published`) |
| **Partition** | Un topic est divise en partitions pour le parallelisme |
| **Consumer Group** | Chaque groupe lit les messages independamment — les messages sont distribues entre les membres du groupe |
| **Offset** | Position de lecture d'un consumer dans une partition — permet de reprendre apres un crash |
| **Retention** | Les messages sont conserves pendant une durée configurable (7 jours par defaut) |

### 7. n8n — middleware d'intégration

```
n8n comme middleware d'orchestration

  CMS Webhook ──> n8n Workflow ──> Actions multiples
                       │
                       ├─> Envoyer un email (SMTP)
                       ├─> Poster dans Slack (#content-updates)
                       ├─> Mettre a jour un Google Sheet
                       ├─> Declencher un build Netlify
                       └─> Synchroniser vers un CRM externe

  Avantage : le CMS emet UN seul event, n8n orchestre les N integrations.
  → Evite le "connector sprawl" (un connecteur code par integration).
```

### 8. AsyncAPI spécification

```yaml
# asyncapi.yaml — documenter les events asynchrones
asyncapi: '2.6.0'
info:
  title: CMS Event API
  version: '1.0.0'
  description: Events publies par le CMS via webhooks et Kafka

channels:
  content/published:
    subscribe:
      summary: Un contenu a ete publie
      message:
        payload:
          type: object
          properties:
            event:
              type: string
              enum: ['content.published']
            timestamp:
              type: string
              format: date-time
            data:
              type: object
              properties:
                contentId:
                  type: string
                  format: uuid
                contentType:
                  type: string
                  enum: ['article', 'page']
                locale:
                  type: string
                title:
                  type: string
```

AsyncAPI est l'équivalent d'OpenAPI pour les API asynchrones — il documente les channels, les events, et les payloads.

---

## Pratique

### Webhook dispatcher avec HMAC et retry (NestJS + BullMQ)

```typescript
// webhook-dispatch.processor.ts
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { createHmac, timingSafeEqual } from 'crypto';
import { randomUUID } from 'crypto';

interface WebhookJob {
  webhookId: string;
  url: string;
  secret: string;
  event: string;
  payload: Record<string, any>;
  tenantId: string;
}

@Processor('webhook-dispatch')
export class WebhookDispatchWorker extends WorkerHost {
  constructor(
    private readonly webhookRepo: WebhookRepository,
    private readonly deliveryLogRepo: DeliveryLogRepository,
    private readonly alerting: AlertingService,
  ) {
    super();
  }

  async process(job: Job<WebhookJob>): Promise<void> {
    const { webhookId, url, secret, event, payload, tenantId } = job.data;
    const deliveryId = randomUUID();

    // Construire le body avec metadata
    const body = JSON.stringify({
      event,
      deliveryId,
      timestamp: new Date().toISOString(),
      data: payload,
    });

    // Signer avec HMAC-SHA256
    const signature = createHmac('sha256', secret)
      .update(body)
      .digest('hex');

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': `sha256=${signature}`,
          'X-Webhook-Event': event,
          'X-Webhook-Delivery': deliveryId,
          'User-Agent': 'CMS-Webhook/1.0',
        },
        body,
        signal: AbortSignal.timeout(10_000), // 10s timeout
      });

      // Logger la livraison
      await this.deliveryLogRepo.save({
        deliveryId,
        webhookId,
        event,
        statusCode: response.status,
        success: response.ok,
        tenantId,
      });

      if (!response.ok) {
        throw new Error(`Webhook returned ${response.status}`);
      }

      // Succes → reinitialiser le compteur d'echecs
      await this.webhookRepo.resetFailureCount(webhookId);

    } catch (error) {
      // Logger l'echec
      await this.deliveryLogRepo.save({
        deliveryId,
        webhookId,
        event,
        statusCode: 0,
        success: false,
        error: (error as Error).message,
        tenantId,
      });

      // Incrementer le compteur d'echecs consecutifs
      const failures = await this.webhookRepo.incrementFailureCount(webhookId);

      // Auto-disable apres 10 echecs consecutifs
      if (failures >= 10) {
        await this.webhookRepo.disable(webhookId);
        await this.alerting.send({
          channel: 'email',
          to: await this.webhookRepo.getOwnerEmail(webhookId),
          subject: `Webhook auto-disabled: ${url}`,
          body: `Your webhook to ${url} has been disabled after 10 consecutive failures.`,
        });
      }

      // Re-throw pour que BullMQ retrie le job
      throw error;
    }
  }
}
```

### Webhook event publisher (service métier)

```typescript
// webhook-event.service.ts
import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

@Injectable()
export class WebhookEventService {
  constructor(
    @InjectQueue('webhook-dispatch') private readonly queue: Queue,
    private readonly webhookRepo: WebhookRepository,
  ) {}

  // Appele apres un domain event (ex: article publie)
  async dispatch(tenantId: string, event: string, payload: Record<string, any>): Promise<void> {
    // Trouver tous les webhooks actifs du tenant qui ecoutent cet event
    const webhooks = await this.webhookRepo.findActiveByTenantAndEvent(tenantId, event);

    // Creer un job par webhook dans la queue
    const jobs = webhooks.map((wh) => ({
      name: 'dispatch',
      data: {
        webhookId: wh.id,
        url: wh.url,
        secret: wh.secret,
        event,
        payload,
        tenantId,
      },
      opts: {
        attempts: 4,  // 1 initial + 3 retries
        backoff: {
          type: 'custom' as const,
          delay: 60_000, // Les delais reels sont geres par la strategie custom
        },
        removeOnComplete: 200,
        removeOnFail: 1000,
      },
    }));

    if (jobs.length > 0) {
      await this.queue.addBulk(jobs);
    }
  }
}

// Utilisation dans un service metier
@Injectable()
export class ArticleService {
  constructor(
    private readonly articleRepo: ArticleRepository,
    private readonly webhookEvents: WebhookEventService,
  ) {}

  async publish(id: string, tenantId: string): Promise<Article> {
    const article = await this.articleRepo.findById(id);
    article.publish();
    await this.articleRepo.save(article);

    // Dispatch le webhook de maniere asynchrone (via BullMQ)
    await this.webhookEvents.dispatch(tenantId, 'content.published', {
      contentId: article.id,
      contentType: 'article',
      locale: article.locale,
      title: article.title,
      slug: article.slug,
      publishedAt: article.publishedAt!.toISOString(),
    });

    return article;
  }
}
```

### Webhook consumer (vérification HMAC côté recepteur)

```typescript
// webhook-receiver.controller.ts — cote partenaire
import { Controller, Post, Req, Res, HttpStatus } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';
import { Request, Response } from 'express';

@Controller('hooks')
export class WebhookReceiverController {
  private readonly secret = process.env.WEBHOOK_SECRET!;

  @Post('cms')
  async receive(@Req() req: Request, @Res() res: Response): Promise<void> {
    // 1. Recuperer le body RAW (pas parse)
    const rawBody = (req as any).rawBody as Buffer;
    if (!rawBody) {
      res.status(HttpStatus.BAD_REQUEST).json({ error: 'Raw body required' });
      return;
    }

    // 2. Verifier la signature HMAC
    const signatureHeader = req.headers['x-webhook-signature'] as string;
    if (!signatureHeader?.startsWith('sha256=')) {
      res.status(HttpStatus.FORBIDDEN).json({ error: 'Missing signature' });
      return;
    }

    const receivedSig = Buffer.from(signatureHeader.replace('sha256=', ''), 'hex');
    const expectedSig = Buffer.from(
      createHmac('sha256', this.secret).update(rawBody).digest('hex'),
      'hex',
    );

    if (!timingSafeEqual(receivedSig, expectedSig)) {
      res.status(HttpStatus.FORBIDDEN).json({ error: 'Invalid signature' });
      return;
    }

    // 3. Traiter l'event
    const body = JSON.parse(rawBody.toString());
    console.log(`Received event: ${body.event}`, body.data);

    // 4. Repondre 200 rapidement — traiter en background si necessaire
    res.status(HttpStatus.OK).json({ received: true });
  }
}
```

---

## Resume

1. **Webhooks** avec signature HMAC-SHA256 (`X-Webhook-Signature`) garantissent l'authenticite — toujours utiliser `timingSafeEqual` pour comparer et signer le body RAW
2. **Retry exponentiel** (60s, 300s, 3600s) avec auto-disable apres 10 echecs consecutifs — ne jamais perdre un event en silence, toujours logger et alerter
3. **BullMQ** pour le dispatch asynchrone des webhooks — le service métier enqueue et repond 200 immédiatement, le worker envoie les webhooks en parallele
4. **Kafka** pour l'event bus inter-services — topics partitionnes, consumer groups independants, retention pour replay, chaque service lit a son propre rythme
5. **AsyncAPI** pour documenter les events asynchrones — l'équivalent d'OpenAPI pour les webhooks, Kafka topics, et les events WebSocket

---

> **Prochain cours** : [Cours 48 — API Gateway & BFF](./06-api-gateway-bff.md) — ou comment utiliser un BFF pour sécuriser les tokens, un API Gateway pour centraliser le routing et le rate limiting, et un service mesh pour le mTLS transparent.

---

> **Lien fil rouge — ShopArch**
>
> - Implémente les webhooks HMAC-SHA256 pour les notifications de paiement ShopArch
> - Définis les events domaine qui déclenchent des webhooks (OrderPaid, OrderShipped)
> - Exercice(s) associé(s) : `exercices/30-webhook-hmac/`, `exercices/30b-webhook-consumer/`
> - Checkpoint : Module 06, critère 2
