// search.ts — Couche d'abstraction de recherche (Strategy pattern)
// Découple le code métier du moteur de recherche (PostgreSQL FTS ↔ Elasticsearch).

// Types

export interface SearchQuery {
  q: string;
  filters?: Record<string, string | number | boolean>;
  fields?: string[];  // sparse fieldsets
  limit?: number;
  cursor?: string;
  sort?: { field: string; direction: 'asc' | 'desc' };
}

export interface SearchHit<T> {
  item: T;
  score: number; // relevance score [0..1]
  highlights?: Record<string, string>; // ex: { name: "Super <em>Widget</em>" }
}

export interface SearchResult<T> {
  hits: SearchHit<T>[];
  total: number;
  nextCursor: string | null;
  took: number; // ms
}

/** Interface commune pour tout moteur de recherche. */
export interface ISearchProvider<T> {
  search(query: SearchQuery): Promise<SearchResult<T>>;
  index(id: string, document: T): Promise<void>;
  delete(id: string): Promise<void>;
  reindex(documents: Array<{ id: string; document: T }>): Promise<void>;
}

// ---- À IMPLÉMENTER ----

/**
 * Service de recherche qui délègue à un ISearchProvider.
 * Applique la validation, la normalisation des queries, et le caching.
 */
export class SearchService<T> {
  constructor(private readonly provider: ISearchProvider<T>) {}

  /**
   * Recherche des documents.
   * - Normalise la query : trim + lowercase
   * - Remplace une query vide par "*" (match-all)
   * - Applique limit par défaut à 20 si non précisé
   * - Délègue au provider
   */
  async search(query: SearchQuery): Promise<SearchResult<T>> {
    // TODO:
    // 1. Normaliser query.q : q.trim().toLowerCase() || '*'
    // 2. query.limit = query.limit ?? 20
    // 3. return this.provider.search(normalizedQuery)
    throw new Error('Not implemented');
  }

  /**
   * Indexe ou met à jour un document.
   * Lance une erreur si id est vide.
   */
  async index(id: string, document: T): Promise<void> {
    // TODO:
    // 1. if (!id.trim()) throw new Error('Document ID cannot be empty')
    // 2. this.provider.index(id, document)
    throw new Error('Not implemented');
  }

  /**
   * Supprime un document de l'index.
   */
  async delete(id: string): Promise<void> {
    // TODO: déléguer à provider.delete(id)
    throw new Error('Not implemented');
  }

  /**
   * Remplace entièrement l'index avec une nouvelle liste de documents.
   * Utile pour la synchronisation depuis PostgreSQL.
   */
  async reindex(documents: Array<{ id: string; document: T }>): Promise<void> {
    // TODO: déléguer à provider.reindex(documents)
    throw new Error('Not implemented');
  }

  /** Retourne le nom du provider actif (pour les logs). */
  getProviderName(): string {
    return this.provider.constructor.name;
  }
}
