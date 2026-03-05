# Correction — Exercice 30b : Consumer webhook avec retry

## Endpoint de reception

```typescript
// webhook-receiver.controller.ts
import { Controller, Post, Req, Res, RawBodyRequest } from '@nestjs/common';
import { Request, Response } from 'express';

@Controller('webhooks')
export class WebhookReceiverController {
  constructor(
    private readonly verifier: WebhookVerifier,
    private readonly idempotency: IdempotencyService,
    @InjectQueue('webhook-processing') private readonly queue: Queue,
  ) {}

  @Post('payment')
  async receive(
    @Req() req: RawBodyRequest<Request>,
    @Res() res: Response,
  ) {
    // 1. Lire le body brut (pas JSON parse)
    const rawBody = req.rawBody?.toString() ?? '';
    const signature = req.headers['x-webhook-signature'] as string;
    const timestamp = req.headers['x-webhook-timestamp'] as string;
    const deliveryId = req.headers['x-webhook-delivery'] as string;

    // 2. Verifier la signature
    if (!this.verifier.verify(signature, timestamp, rawBody)) {
      return res.status(401).json({ error: 'Invalid signature' });
    }

    // 3. Verifier l'idempotence
    if (await this.idempotency.alreadyProcessed(deliveryId)) {
      return res.status(200).json({ status: 'already_processed' });
    }

    // 4. Repondre 200 IMMEDIATEMENT puis traiter en async
    res.status(200).json({ status: 'accepted' });

    // 5. Queue le traitement
    const payload = JSON.parse(rawBody);
    await this.queue.add('process', { deliveryId, payload });
  }
}
```

## Vérification de signature

```typescript
// webhook-verifier.service.ts
import { createHmac, timingSafeEqual } from 'node:crypto';

@Injectable()
export class WebhookVerifier {
  constructor(@Inject('WEBHOOK_SECRET') private readonly secret: string) {}

  verify(signature: string, timestamp: string, rawBody: string): boolean {
    if (!signature || !timestamp) return false;

    // Anti-replay : rejeter si > 5 minutes
    const age = Math.floor(Date.now() / 1000) - parseInt(timestamp);
    if (Number.isNaN(age) || age > 300 || age < -60) return false;

    // Calculer le HMAC attendu
    const message = `${timestamp}.${rawBody}`;
    const expected = createHmac('sha256', this.secret).update(message).digest('hex');
    const received = signature.replace('sha256=', '');

    // Comparaison constante (pas de timing attack)
    if (expected.length !== received.length) return false;
    return timingSafeEqual(Buffer.from(expected), Buffer.from(received));
  }
}
```

## Idempotence

```typescript
// idempotency.service.ts
@Injectable()
export class IdempotencyService {
  private readonly TTL = 7 * 24 * 3600; // 7 jours

  constructor(private readonly redis: Redis) {}

  async alreadyProcessed(deliveryId: string): Promise<boolean> {
    const key = `webhook:processed:${deliveryId}`;
    const result = await this.redis.set(key, '1', 'EX', this.TTL, 'NX');
    // NX = set only if not exists
    // result = 'OK' → premiere fois (pas encore traite)
    // result = null → deja traite
    return result === null;
  }
}
```

## Event routing type-safe

```typescript
// webhook-event.types.ts
interface WebhookEvent<T extends string = string, D = unknown> {
  type: T;
  timestamp: string;
  deliveryId: string;
  data: D;
}

type PaymentSucceeded = WebhookEvent<'payment.succeeded', { orderId: string; amount: number; currency: string }>;
type PaymentFailed = WebhookEvent<'payment.failed', { orderId: string; reason: string }>;
type PaymentRefunded = WebhookEvent<'payment.refunded', { orderId: string; amount: number; refundId: string }>;

type PaymentEvent = PaymentSucceeded | PaymentFailed | PaymentRefunded;

// webhook-processor.service.ts
type EventHandler<T extends PaymentEvent['type']> = (
  event: Extract<PaymentEvent, { type: T }>,
) => Promise<void>;

@Injectable()
export class WebhookProcessor {
  private handlers: Map<string, EventHandler<any>> = new Map();

  constructor(
    private readonly orderService: OrderService,
    private readonly emailService: EmailService,
    private readonly creditService: CreditService,
  ) {
    this.handlers.set('payment.succeeded', this.handlePaymentSucceeded.bind(this));
    this.handlers.set('payment.failed', this.handlePaymentFailed.bind(this));
    this.handlers.set('payment.refunded', this.handlePaymentRefunded.bind(this));
  }

  async process(event: PaymentEvent): Promise<void> {
    const handler = this.handlers.get(event.type);
    if (!handler) {
      console.warn(`No handler for event type: ${event.type}`);
      return;
    }
    await handler(event);
  }

  private async handlePaymentSucceeded(event: PaymentSucceeded) {
    await this.orderService.markAsPaid(event.data.orderId);
    await this.emailService.sendPaymentConfirmation(event.data.orderId);
  }

  private async handlePaymentFailed(event: PaymentFailed) {
    await this.orderService.markPaymentFailed(event.data.orderId, event.data.reason);
    await this.emailService.sendPaymentFailedNotification(event.data.orderId);
  }

  private async handlePaymentRefunded(event: PaymentRefunded) {
    await this.creditService.createCredit(event.data.orderId, event.data.amount);
    await this.emailService.sendRefundConfirmation(event.data.orderId);
  }
}

// webhook-processing.worker.ts
@Processor('webhook-processing')
export class WebhookProcessingWorker {
  @Process('process')
  async handle(job: Job<{ deliveryId: string; payload: PaymentEvent }>) {
    try {
      await this.processor.process(job.data.payload);
    } catch (error) {
      // Log l'erreur mais NE PAS re-throw
      // Le webhook a deja ete acknowledge (200)
      console.error(`Webhook processing failed: ${job.data.deliveryId}`, error);
      // Stocker l'erreur pour investigation
      await this.deliveryRepo.update(job.data.deliveryId, {
        status: 'processing_failed',
        error: error.message,
      });
    }
  }
}
```

## Config NestJS pour body brut

```typescript
// main.ts — conserver le body brut pour les webhooks
app.use('/webhooks', express.json({ verify: (req: any, _res, buf) => { req.rawBody = buf; } }));
```

## Ce que tu aurais pu oublier

### 1. Parser le JSON avant de vérifier la signature
```
FAUX — JSON.parse(body) puis HMAC sur le body re-serialise (whitespace different)
CORRECT — HMAC sur le body brut (string exacte envoyee par le provider)
```

### 2. Traiter avant de répondre 200
```
FAUX — traiter le webhook puis repondre 200 (si le traitement prend 30s, le provider timeout et re-envoie)
CORRECT — repondre 200 immediatement, traiter en async dans une queue
```

### 3. Rejeter les doublons avec une erreur
```
FAUX — retourner 409 Conflict si deja traite (le provider va re-envoyer!)
CORRECT — retourner 200 pour les doublons (le provider considere que c'est OK)
```

### 4. Re-throw les erreurs de traitement
```
FAUX — une erreur de traitement bloque les futurs webhooks dans la queue
CORRECT — catch et log, le webhook a deja ete acknowledge
```
