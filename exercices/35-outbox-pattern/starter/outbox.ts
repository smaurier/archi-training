// outbox.ts — Pattern Transactional Outbox pour la garantie de livraison d'événements

// Types

export interface DomainEvent {
  type: string;
  payload: unknown;
  aggregateId: string;
}

export interface OutboxEntry {
  id: string;
  event: DomainEvent;
  status: 'pending' | 'published' | 'failed';
  createdAt: number;
  attempts: number;
  lastAttemptAt?: number;
  error?: string;
}

/** Transaction abstraite : la méthode recordEvent doit être atomique avec les données métier. */
export interface ITransaction {
  id: string;
}

export interface IOutboxRepository {
  /** Enregistre l'event dans l'outbox DANS la même transaction. */
  saveInTransaction(trx: ITransaction, entry: OutboxEntry): Promise<void>;
  /** Récupère les entrées à republier (pending ou failed < maxAttempts). */
  findPending(maxAttempts: number): Promise<OutboxEntry[]>;
  /** Met à jour le statut après tentative de publication. */
  updateStatus(id: string, status: 'published' | 'failed', error?: string): Promise<void>;
}

export interface IMessageBroker {
  publish(eventType: string, payload: unknown): Promise<void>;
}

// ---- À IMPLÉMENTER ----

export class OutboxService {
  static readonly MAX_ATTEMPTS = 5;

  constructor(
    private readonly repo: IOutboxRepository,
    private readonly broker: IMessageBroker,
  ) {}

  /**
   * Enregistre un event dans l'outbox atomiquement avec la transaction métier.
   * L'event ne doit PAS être envoyé ici — il sera publié par publishPending().
   */
  async recordEvent(trx: ITransaction, event: DomainEvent): Promise<void> {
    // TODO:
    // Créer un OutboxEntry { id: crypto.randomUUID(), event, status: 'pending', createdAt: Date.now(), attempts: 0 }
    // Appeler repo.saveInTransaction(trx, entry) — garantit atomicité avec la transaction métier
    throw new Error('Not implemented');
  }

  /**
   * Doit être appelé périodiquement (worker/cron).
   * Pour chaque entrée pending :
   *   1. Tenter broker.publish(event.type, event.payload)
   *   2. Si succès: repo.updateStatus(id, 'published')
   *   3. Si erreur et attempts < MAX_ATTEMPTS: repo.updateStatus(id, 'failed', message)
   *   4. Si attempts >= MAX_ATTEMPTS: laisser en 'failed' (dead letter — logguer l'erreur)
   */
  async publishPending(): Promise<void> {
    // TODO:
    // 1. repo.findPending(OutboxService.MAX_ATTEMPTS)
    // 2. Pour chaque entry :
    //    try { broker.publish → updateStatus 'published' }
    //    catch { entry.attempts++ → updateStatus 'failed' }
    throw new Error('Not implemented');
  }
}
