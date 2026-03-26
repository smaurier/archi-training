// consumer.ts — Consumer webhook avec vérification de signature et idempotence
// Reçoit les webhooks Stripe-like et les traite exactement une fois.

// Types

export interface WebhookEvent {
  id: string;    // Identifiant unique de l'event (idempotency key)
  type: string;  // ex: "payment.succeeded", "payment.failed"
  payload: unknown;
  timestamp: number; // Unix ms
  signature: string; // HMAC-SHA256 sur `${timestamp}.${JSON.stringify(payload)}`
}

export type ProcessResult = 'processed' | 'duplicate' | 'invalid_signature' | 'expired';

export interface IIdempotencyStore {
  /** Retourne true si cet eventId a déjà été traité. */
  has(eventId: string): Promise<boolean>;
  /** Marque l'eventId comme traité. */
  mark(eventId: string): Promise<void>;
}

export interface IEventHandler {
  /** Retourne les types d'events gérés par ce handler. */
  supports(eventType: string): boolean;
  /** Traite l'event métier. */
  handle(event: WebhookEvent): Promise<void>;
}

// ---- À IMPLÉMENTER ----

export class WebhookConsumer {
  static readonly MAX_AGE_MS = 5 * 60 * 1000; // 5 minutes

  constructor(
    private readonly secret: string,
    private readonly idempotency: IIdempotencyStore,
    private readonly handlers: IEventHandler[],
  ) {}

  /**
   * Pipeline de traitement d'un webhook entrant :
   * 1. Vérifier la signature (timestamp + body)
   * 2. Vérifier que l'event n'est pas trop vieux (replay attack)
   * 3. Vérifier l'idempotence (event.id déjà traité ?)
   * 4. Dispatcher au handler approprié
   * 5. Marquer comme traité
   *
   * @param rawBody - Le body HTTP brut (string) tel que reçu (pour la vérification HMAC)
   */
  async handle(event: WebhookEvent, rawBody: string): Promise<ProcessResult> {
    // TODO:
    // 1. Calculer la signature attendue avec HMAC-SHA256(secret, `${event.timestamp}.${rawBody}`)
    //    → import { createHmac } from 'node:crypto'
    //    → Si signature ne correspond pas → return 'invalid_signature'
    // 2. Si Date.now() - event.timestamp > MAX_AGE_MS → return 'expired'
    // 3. Si await idempotency.has(event.id) → return 'duplicate'
    // 4. Trouver un handler qui supports(event.type)
    //    → Si trouvé : await handler.handle(event)
    //    → Sinon : ignorer (event non géré, mais pas d'erreur)
    // 5. await idempotency.mark(event.id)
    // 6. return 'processed'
    throw new Error('Not implemented');
  }
}
