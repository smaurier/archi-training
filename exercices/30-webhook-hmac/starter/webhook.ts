// webhook.ts — Système de webhooks avec signature HMAC-SHA256
// Implémente la signature, la vérification, et l'enregistrement des livraisons.

import { createHmac, timingSafeEqual } from 'node:crypto';

// Types
export interface WebhookSubscription {
  id: string;
  url: string;
  secret: string;
  events: string[];
  active: boolean;
}

export interface WebhookDelivery {
  id: string;
  subscriptionId: string;
  event: string;
  payload: unknown;
  timestamp: number; // Unix timestamp (ms)
  signature: string;
  status: 'pending' | 'success' | 'failed';
  attempts: number;
}

export interface IWebhookRepository {
  findByEvent(event: string): Promise<WebhookSubscription[]>;
  saveDelivery(delivery: WebhookDelivery): Promise<void>;
  updateDelivery(id: string, updates: Partial<WebhookDelivery>): Promise<void>;
}

export interface IHttpClient {
  post(url: string, body: string, headers: Record<string, string>): Promise<{ status: number }>;
}

// ---- À IMPLÉMENTER ----

export class WebhookService {
  constructor(
    private readonly repo: IWebhookRepository,
    private readonly http: IHttpClient,
  ) {}

  /** Génère la signature HMAC-SHA256 d'un payload avec un secret.
   *  Format: HMAC-SHA256(secret, `${timestamp}.${body}`)
   *  Retour: hex string
   */
  sign(secret: string, timestamp: number, body: string): string {
    // TODO: utiliser createHmac('sha256', secret)
    //       mettre à jour avec `${timestamp}.${body}`
    //       retourner le digest en 'hex'
    throw new Error('Not implemented');
  }

  /** Vérifie qu'une signature reçue est valide.
   *  Utiliser timingSafeEqual pour éviter les timing attacks.
   *  Rejeter si timestamp > 5 minutes dans le passé (replay attack).
   */
  verify(secret: string, timestamp: number, body: string, signature: string): boolean {
    // TODO:
    // 1. Vérifier que Date.now() - timestamp <= 5 * 60 * 1000 (sinon false)
    // 2. Recalculer la signature attendue via this.sign()
    // 3. Comparer avec timingSafeEqual (Buffer.from les deux strings)
    //    → retourner true si égaux, false sinon
    //    → entourer de try/catch (timingSafeEqual throw si longueurs différentes)
    throw new Error('Not implemented');
  }

  /** Envoie un event à tous les subscribers et enregistre les livraisons. */
  async dispatch(event: string, payload: unknown): Promise<void> {
    // TODO:
    // 1. Récupérer les subscriptions actives pour cet event
    // 2. Pour chaque subscription :
    //    a. Créer un WebhookDelivery { id: crypto.randomUUID(), status: 'pending', attempts: 0 }
    //    b. Sauvegarder via repo.saveDelivery()
    //    c. Signer le payload (JSON.stringify(payload))
    //    d. POST vers subscription.url avec les headers :
    //       - Content-Type: application/json
    //       - X-Webhook-Event: event name
    //       - X-Webhook-Timestamp: timestamp string
    //       - X-Webhook-Signature: hex signature
    //    e. Mettre à jour la delivery : status 'success' ou 'failed', attempts + 1
    throw new Error('Not implemented');
  }
}
