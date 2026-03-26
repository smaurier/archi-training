// queue.ts — File de jobs avec retry et dead-letter queue
// Implémentation pure TypeScript (pas de BullMQ) — logique algorithmique.

// Types

export interface Job<T = unknown> {
  id: string;
  type: string;
  payload: T;
  attempts: number;
  maxAttempts: number;
  status: 'waiting' | 'active' | 'completed' | 'failed' | 'dead';
  createdAt: number;
  scheduledAt: number; // Timestamp à partir duquel le job peut être traité
  error?: string;
}

export type JobHandler<T = unknown> = (job: Job<T>) => Promise<void>;

export interface IJobStorage {
  save(job: Job): Promise<void>;
  findWaiting(now: number, limit: number): Promise<Job[]>;
  update(id: string, updates: Partial<Job>): Promise<void>;
  findDead(): Promise<Job[]>;
}

// ---- À IMPLÉMENTER ----

export class JobQueue {
  static readonly DEFAULT_MAX_ATTEMPTS = 3;
  /** Délai exponentiel en ms avant retry : attempt * BASE_DELAY */
  static readonly BASE_RETRY_DELAY_MS = 1000;

  private handlers: Map<string, JobHandler> = new Map();

  constructor(private readonly storage: IJobStorage) {}

  /** Enregistre un handler pour un type de job. */
  registerHandler<T>(type: string, handler: JobHandler<T>): void {
    this.handlers.set(type, handler as JobHandler);
  }

  /** Ajoute un job à la queue. */
  async enqueue<T>(
    type: string,
    payload: T,
    options: { maxAttempts?: number; delayMs?: number } = {},
  ): Promise<Job<T>> {
    // TODO:
    // Créer un Job { id: crypto.randomUUID(), type, payload, attempts: 0,
    //   maxAttempts: options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS,
    //   status: 'waiting', createdAt: Date.now(),
    //   scheduledAt: Date.now() + (options.delayMs ?? 0) }
    // Sauvegarder via storage.save()
    // Retourner le job
    throw new Error('Not implemented');
  }

  /**
   * Traite les prochains jobs disponibles (scheduledAt <= now).
   * Pour chaque job :
   *   1. Mettre status = 'active', attempts++
   *   2. Appeler le handler
   *   3. Si succès: status = 'completed'
   *   4. Si erreur et attempts < maxAttempts:
   *      status = 'waiting', scheduledAt = now + attempts * BASE_RETRY_DELAY_MS
   *   5. Si erreur et attempts >= maxAttempts: status = 'dead'
   */
  async processNext(limit = 10): Promise<void> {
    // TODO:
    // 1. storage.findWaiting(Date.now(), limit)
    // 2. Pour chaque job :
    //    a. Récupérer le handler via this.handlers.get(job.type)
    //    b. Si pas de handler → marquer 'dead' avec error 'No handler registered'
    //    c. Sinon → exécuter avec la logique retry ci-dessus
    throw new Error('Not implemented');
  }

  /** Retourne tous les jobs en dead-letter queue. */
  async getDeadJobs(): Promise<Job[]> {
    // TODO: déléguer à storage.findDead()
    throw new Error('Not implemented');
  }
}
