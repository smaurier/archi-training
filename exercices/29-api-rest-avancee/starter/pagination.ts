// pagination.ts — Pagination cursor + ETag/If-None-Match
// Optimise l'API catalogue pour les clients mobiles (500ms → < 100ms).

import { createHash } from 'node:crypto';

// Types

export interface PaginatedResult<T> {
  data: T[];
  nextCursor: string | null; // null = dernière page
  hasMore: boolean;
  total?: number;
}

// ---- À IMPLÉMENTER ----

/**
 * ETagService : génère et valide les ETags pour le cache conditionnel HTTP.
 * Un ETag est un hash du contenu — si le contenu n'a pas changé,
 * le client peut réutiliser sa réponse en cache (304 Not Modified).
 */
export class ETagService {
  /**
   * Génère un ETag SHA-256 (premiers 16 chars) du contenu sérialisé.
   * Format retourné: `"abc123..."` (avec guillemets, conforme RFC 7232)
   */
  generate(data: unknown): string {
    // TODO:
    // 1. JSON.stringify(data)
    // 2. createHash('sha256').update(json).digest('hex').slice(0, 16)
    // 3. Entourer de guillemets doubles : `"${hash}"`
    throw new Error('Not implemented');
  }

  /**
   * Vérifie si le ETag d'une réponse correspond au If-None-Match du client.
   * Retourne true → le client a la version à jour (répondre 304).
   * Gère la valeur spéciale "*" (If-None-Match: * signifie "toujours revalider").
   */
  matches(currentEtag: string, ifNoneMatch: string | undefined): boolean {
    // TODO:
    // if (!ifNoneMatch) → false
    // if (ifNoneMatch === '*') → true (le client veut toujours revalider)
    // return ifNoneMatch === currentEtag
    throw new Error('Not implemented');
  }
}

/**
 * CursorPagination : remplace la pagination par offset (lente) par un curseur
 * basé sur l'ID du dernier élément retourné (O(log n) au lieu de O(n)).
 */
export class CursorPagination {
  /**
   * Encode un ID en curseur opaque Base64.
   * Ex: "prod-123" → "cHJvZC0xMjM="
   */
  encode(lastId: string): string {
    // TODO: Buffer.from(lastId).toString('base64')
    throw new Error('Not implemented');
  }

  /**
   * Décode un curseur Base64 en ID.
   * Ex: "cHJvZC0xMjM=" → "prod-123"
   * Lance une erreur si le curseur est invalide (base64 mal formé).
   */
  decode(cursor: string): string {
    // TODO:
    // try { return Buffer.from(cursor, 'base64').toString('utf-8') }
    // catch { throw new Error('Invalid cursor') }
    throw new Error('Not implemented');
  }

  /**
   * Applique la pagination à un tableau d'items.
   * La liste doit déjà être filtrée (cursor appliqué en SQL).
   * Retourne limit items + détecte s'il y a une page suivante (via limit+1).
   * getKey : fonction qui retourne la clé de pagination (id) d'un item.
   */
  paginate<T>(
    items: T[],
    limit: number,
    getKey: (item: T) => string,
  ): PaginatedResult<T> {
    // TODO:
    // 1. Si items.length > limit : il y a une page suivante
    //    → data = items.slice(0, limit)
    //    → nextCursor = encode(getKey(data[data.length - 1]))
    // 2. Sinon :
    //    → data = items
    //    → nextCursor = null
    // 3. hasMore = nextCursor !== null
    throw new Error('Not implemented');
  }
}
