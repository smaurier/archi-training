// security.ts — Protections OWASP : rate limiting, sanitisation, IDOR guard
// Implémente les défenses contre les 3 risques les plus courants sur l'API ShopArch.

// Types

export interface RateLimitConfig {
  windowMs: number;     // Taille de la fenêtre en ms
  maxRequests: number;  // Requêtes max par windowMs par clientId
}

export interface RateLimitEntry {
  count: number;
  windowStart: number; // Timestamp début de la fenêtre courante
}

// ---- À IMPLÉMENTER ----

/**
 * RateLimiter — sliding window (ou fixed window).
 * Limite le nombre de requêtes par clientId (IP, userId…) dans une fenêtre de temps.
 * Utiliser une fixed window pour simplifier : on reset le compteur quand
 * Date.now() - windowStart > windowMs.
 */
export class RateLimiter {
  private readonly store: Map<string, RateLimitEntry> = new Map();

  constructor(private readonly config: RateLimitConfig) {}

  /**
   * Vérifie et consomme un jeton pour ce client.
   * Retourne true si la requête est autorisée, false si la limite est atteinte.
   */
  isAllowed(clientId: string, now = Date.now()): boolean {
    // TODO:
    // 1. Récupérer l'entrée pour clientId (ou créer { count: 0, windowStart: now })
    // 2. Si now - entry.windowStart > windowMs → reset : { count: 0, windowStart: now }
    // 3. Si entry.count >= maxRequests → return false
    // 4. entry.count++, sauvegarder, return true
    throw new Error('Not implemented');
  }

  /** Retourne le nombre de requêtes restantes pour ce client dans la fenêtre courante. */
  remaining(clientId: string, now = Date.now()): number {
    // TODO:
    // 1. Récupérer l'entrée (ou créer avec count 0)
    // 2. Si fenêtre expirée → return maxRequests
    // 3. return Math.max(0, maxRequests - entry.count)
    throw new Error('Not implemented');
  }
}

/**
 * InputSanitizer — Neutralise les injections SQL et XSS.
 * Note: en production, utiliser des prepared statements et DOMPurify.
 * Cette implémentation est pédagogique.
 */
export class InputSanitizer {
  /** Détecte les patterns d'injection SQL basiques.
   *  Retourne true si l'input contient des mots-clés suspects.
   */
  containsSqlInjection(input: string): boolean {
    // TODO:
    // Regex: /(';|--|\/\*|\*\/|xp_|union\s+select|select\s+.*\s+from|drop\s+table|insert\s+into)/i
    throw new Error('Not implemented');
  }

  /** Échappe les caractères HTML spéciaux pour prévenir le XSS.
   *  < → &lt;   > → &gt;   & → &amp;   " → &quot;   ' → &#x27;
   */
  escapeHtml(input: string): string {
    // TODO: enchaîner les replaceAll pour chaque caractère
    throw new Error('Not implemented');
  }
}

/**
 * IDORGuard — Prévient les Insecure Direct Object Reference.
 * Vérifie que l'utilisateur connecté est bien propriétaire de la ressource demandée.
 */
export class IDORGuard {
  /**
   * Lève une ForbiddenError si userId !== resource.ownerId.
   * Exception: un admin peut tout accéder.
   */
  assertOwnership<T extends { ownerId: string }>(
    resource: T,
    userId: string,
    userRoles: string[] = [],
  ): void {
    // TODO:
    // if (userRoles.includes('admin')) return (admin bypass)
    // if (resource.ownerId !== userId) throw new ForbiddenError(...)
    throw new Error('Not implemented');
  }
}

export class ForbiddenError extends Error {
  constructor(message = 'Access denied') {
    super(message);
    this.name = 'ForbiddenError';
  }
}
