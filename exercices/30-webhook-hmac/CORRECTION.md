# Correction — Exercice 30 : Webhook system avec HMAC

## Modèle de données

```typescript
// webhook-subscription.entity.ts
@Entity()
export class WebhookSubscription {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  url: string; // HTTPS uniquement

  @Column({ select: false }) // jamais expose en lecture
  secret: string;

  @Column('simple-array')
  events: string[]; // ['order.created', 'payment.received', 'stock.updated']

  @Column({ default: true })
  active: boolean;

  @Column({ default: 0 })
  consecutiveFailures: number;

  @Column()
  tenantId: string;
}

// webhook-delivery.entity.ts
@Entity()
export class WebhookDelivery {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => WebhookSubscription)
  subscription: WebhookSubscription;

  @Column()
  event: string;

  @Column('jsonb')
  payload: Record<string, unknown>;

  @Column({ type: 'enum', enum: ['pending', 'success', 'failed', 'dead_letter'] })
  status: string;

  @Column({ nullable: true })
  responseStatus: number;

  @Column({ type: 'text', nullable: true })
  responseBody: string; // tronque a 1 KB

  @Column({ default: 0 })
  attempts: number;

  @Column({ type: 'float', nullable: true })
  durationMs: number;

  @CreateDateColumn()
  createdAt: Date;
}
```

## Signature HMAC-SHA256

```typescript
// webhook-signer.ts
import { createHmac } from 'node:crypto';

export function signPayload(secret: string, timestamp: number, body: string): string {
  const message = `${timestamp}.${body}`;
  return createHmac('sha256', secret).update(message).digest('hex');
}

export function buildHeaders(secret: string, body: string, deliveryId: string) {
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = signPayload(secret, timestamp, body);

  return {
    'Content-Type': 'application/json',
    'X-Webhook-Signature': `sha256=${signature}`,
    'X-Webhook-Timestamp': timestamp.toString(),
    'X-Webhook-Delivery': deliveryId,
  };
}

// --- Documentation pour les consumers ---
// Pour verifier la signature cote consumer :
//
// 1. Lire X-Webhook-Timestamp et X-Webhook-Signature
// 2. Verifier que le timestamp < 5 minutes (anti-replay)
// 3. Calculer HMAC-SHA256(secret, `${timestamp}.${body}`)
// 4. Comparer avec timingSafeEqual (pas ===)
```

## Vérification côté consumer

```typescript
// webhook-verifier.ts (fourni aux partenaires)
import { createHmac, timingSafeEqual } from 'node:crypto';

export function verifyWebhook(
  secret: string,
  signature: string,
  timestamp: string,
  body: string,
): boolean {
  // Anti-replay : rejeter si timestamp > 5 minutes
  const age = Math.floor(Date.now() / 1000) - parseInt(timestamp);
  if (age > 300) return false;

  const expected = createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');
  const received = signature.replace('sha256=', '');

  return timingSafeEqual(Buffer.from(expected), Buffer.from(received));
}
```

## Envoi asynchrone avec retry

```typescript
// webhook-dispatcher.service.ts
@Injectable()
export class WebhookDispatcher {
  constructor(
    @InjectQueue('webhooks') private queue: Queue,
    private subscriptionRepo: Repository<WebhookSubscription>,
  ) {}

  async dispatch(event: string, data: Record<string, unknown>, tenantId: string) {
    const subscriptions = await this.subscriptionRepo.find({
      where: { tenantId, active: true },
    });

    const matching = subscriptions.filter((s) => s.events.includes(event));

    for (const sub of matching) {
      const deliveryId = randomUUID();
      const payload = {
        event,
        timestamp: new Date().toISOString(),
        deliveryId,
        data,
      };

      await this.queue.add('send', {
        subscriptionId: sub.id,
        deliveryId,
        payload,
      }, {
        attempts: 5,
        backoff: { type: 'custom' },
        removeOnComplete: true,
      });
    }
  }
}

// webhook-worker.ts
@Processor('webhooks')
export class WebhookWorker {
  // Backoff custom : 1s, 5s, 30s, 5min, 30min
  private readonly DELAYS = [1000, 5000, 30000, 300000, 1800000];

  @Process('send')
  async send(job: Job) {
    const { subscriptionId, deliveryId, payload } = job.data;
    const sub = await this.subRepo.findOne({
      where: { id: subscriptionId },
      select: ['id', 'url', 'secret', 'active', 'consecutiveFailures'],
    });

    if (!sub || !sub.active) return;

    const body = JSON.stringify(payload);
    const headers = buildHeaders(sub.secret, body, deliveryId);
    const start = performance.now();

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(sub.url, {
        method: 'POST',
        headers,
        body,
        signal: controller.signal,
      });
      clearTimeout(timeout);

      const durationMs = performance.now() - start;

      await this.deliveryRepo.save({
        id: deliveryId,
        subscription: sub,
        event: payload.event,
        payload,
        status: response.ok ? 'success' : 'failed',
        responseStatus: response.status,
        responseBody: (await response.text()).slice(0, 1024),
        attempts: job.attemptsMade + 1,
        durationMs,
      });

      if (response.ok) {
        await this.subRepo.update(sub.id, { consecutiveFailures: 0 });
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (error) {
      const durationMs = performance.now() - start;
      const failures = sub.consecutiveFailures + 1;

      // Circuit breaker : desactiver apres 10 echecs consecutifs
      if (failures >= 10) {
        await this.subRepo.update(sub.id, { active: false, consecutiveFailures: failures });
      } else {
        await this.subRepo.update(sub.id, { consecutiveFailures: failures });
      }

      const isFinal = job.attemptsMade >= 4;
      await this.deliveryRepo.save({
        id: deliveryId,
        subscription: sub,
        event: payload.event,
        payload,
        status: isFinal ? 'dead_letter' : 'failed',
        attempts: job.attemptsMade + 1,
        durationMs,
      });

      if (!isFinal) throw error; // declenche le retry BullMQ
    }
  }
}
```

## Alternatives et arbitrages

> En architecture, ta valeur n'est pas de connaître UNE solution,
> mais de savoir POURQUOI tu choisis celle-ci plutôt qu'une autre.

### Option A : Webhooks + HMAC (solution présentée)
**Quand la choisir :** Notification push en temps réel, le producteur connaît le consommateur, payload riche (JSON complet), authentification par secret partagé.
**Limites :** Le consommateur doit être accessible publiquement (URL), gestion des retries côté producteur, idempotency nécessaire, le consommateur peut être down.

### Option B : Polling
**Quand la choisir :** Le consommateur ne peut pas exposer d'URL publique, réseau restrictif (firewall), volume faible de changements, tolérance à la latence.
**Limites :** Gaspillage de bande passante (requêtes vides), latence (dépend de l'intervalle de polling), charge sur le producteur.

### Option C : Server-Sent Events (SSE)
**Quand la choisir :** Flux unidirectionnel serveur → client, connexion longue durée, navigateur comme consommateur, besoin de reconnexion automatique.
**Limites :** Unidirectionnel seulement, limité à 6 connexions par domaine (HTTP/1.1), pas adapté au serveur-à-serveur.

### Option D : WebSocket
**Quand la choisir :** Communication bidirectionnelle en temps réel, chat, collaboration live, trading, besoin de faible latence.
**Limites :** Connexion persistante (coût mémoire serveur), plus complexe à scaler (sticky sessions), pas de caching HTTP.

### Alternatives d'authentification webhook

| Méthode | Usage | Sécurité |
|---|---|---|
| **HMAC-SHA256** (présenté) | Standard (Stripe, GitHub) | Secret partagé |
| **mTLS** | Haute sécurité (banking) | Certificats mutuels |
| **OAuth2 bearer** | API-first (Salesforce) | Token révocable |
| **IP whitelisting** | Complément uniquement | Facilement contournable |

### Pour ShopArch, on choisit...
Webhooks + HMAC pour les notifications de paiement (Stripe envoie un webhook quand le paiement est confirmé) et les notifications de livraison. HMAC-SHA256 est le standard de l'industrie et suffisant pour notre use case. On n'a pas besoin de mTLS (pas de contexte bancaire) ni de WebSocket (pas de communication bidirectionnelle pour les events serveur).

---

## Ce que tu aurais pu oublier

### 1. Comparaison de signature avec ===
```
FAUX — if (signature === expected) (vulnerable aux timing attacks)
CORRECT — timingSafeEqual pour comparer les signatures HMAC
```

### 2. Pas de protection anti-replay
```
FAUX — signature sans timestamp (un attaquant peut rejouer un ancien webhook)
CORRECT — inclure le timestamp dans le message signe + rejeter si > 5 min
```

### 3. Secret expose dans les GET
```
FAUX — GET /webhooks/:id retourne le secret en clair
CORRECT — { select: false } sur la colonne, le secret est write-only
```

### 4. Retry synchrone
```
FAUX — retry dans la meme requete HTTP (bloque le thread)
CORRECT — job queue asynchrone avec backoff exponentiel
```

### 5. Pas de delivery ID
```
FAUX — le consumer ne peut pas deduplicer les webhooks
CORRECT — X-Webhook-Delivery unique (UUID) pour l'idempotence cote consumer
```
