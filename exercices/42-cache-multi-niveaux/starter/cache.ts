// cache.ts — Cache multi-niveaux : L1 (in-memory LRU) + L2 (Redis simulé)

// Types

export interface CacheEntry<T> {
  value: T;
  expiresAt: number; // Unix timestamp ms
}

/** Abstraction du cache L2 (Redis ou similaire) */
export interface IL2Cache {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlMs: number): Promise<void>;
  delete(key: string): Promise<void>;
}

/** Source de données originale */
export interface IDataSource {
  fetch<T>(key: string): Promise<T | null>;
}

// ---- À IMPLÉMENTER ----

/**
 * Cache L1 in-memory avec éviction LRU (Least Recently Used).
 * Utilise un Map (qui préserve l'ordre d'insertion) pour implémenter LRU.
 */
export class LRUCache<T> {
  private readonly store: Map<string, CacheEntry<T>>;

  constructor(private readonly capacity: number) {
    this.store = new Map();
  }

  /**
   * Retourne la valeur si présente ET non expirée.
   * Déplace la clé en fin de Map (most recently used).
   */
  get(key: string): T | undefined {
    // TODO:
    // 1. Si clé absente → return undefined
    // 2. Si entry.expiresAt < Date.now() → supprimer et return undefined
    // 3. Déplacer en fin : delete(key), set(key, entry) → Map maintient l'ordre insertion
    // 4. Retourner entry.value
    throw new Error('Not implemented');
  }

  /** Stocke une valeur. Évicte l'élément le moins récemment utilisé si capacity dépassée. */
  set(key: string, value: T, ttlMs: number): void {
    // TODO:
    // 1. Si la clé existe déjà, la supprimer (pour la remettre en fin)
    // 2. Si store.size >= capacity → supprimer le premier élément (store.keys().next().value)
    // 3. store.set(key, { value, expiresAt: Date.now() + ttlMs })
    throw new Error('Not implemented');
  }

  delete(key: string): void {
    this.store.delete(key);
  }

  get size(): number {
    return this.store.size;
  }
}

/**
 * Cache multi-niveaux avec stratégie read-through + write-through.
 *
 * Ordre de lecture : L1 → L2 → DataSource
 * Si L2 hit → populate L1
 * Si DS hit → populate L1 + L2
 * Si introuvable partout → retourner null
 */
export class MultiLevelCache {
  private readonly l1: LRUCache<unknown>;

  constructor(
    l1Capacity: number,
    private readonly l2: IL2Cache,
    private readonly l1TtlMs: number,
    private readonly l2TtlMs: number,
    private readonly dataSource: IDataSource,
  ) {
    this.l1 = new LRUCache(l1Capacity);
  }

  async get<T>(key: string): Promise<T | null> {
    // TODO:
    // 1. L1 hit → return value (cast as T)
    // 2. L2 hit → l1.set(key, value, l1TtlMs) → return value
    // 3. DS hit → l2.set + l1.set → return value
    // 4. Return null
    throw new Error('Not implemented');
  }

  async set<T>(key: string, value: T): Promise<void> {
    // TODO:
    // Write-through : écrire dans L1 ET L2
    throw new Error('Not implemented');
  }

  async invalidate(key: string): Promise<void> {
    // TODO: supprimer de L1 ET L2
    throw new Error('Not implemented');
  }
}
