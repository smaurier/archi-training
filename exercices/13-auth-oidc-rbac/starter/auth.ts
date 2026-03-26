// auth.ts — Authentification OIDC (JWT) + RBAC
// Valide les JWT Keycloak et applique le contrôle d'accès par rôle.

// Types

export type Role = 'admin' | 'manager' | 'customer' | 'guest';

export interface JwtPayload {
  sub: string;          // user ID
  email: string;
  roles: Role[];
  tenantId: string;
  exp: number;          // Unix timestamp (s)
  iat: number;
}

export interface ITokenVerifier {
  /** Vérifie la signature et retourne le payload décodé, ou null si invalide/expiré. */
  verify(token: string): JwtPayload | null;
}

export interface IPermissionRegistry {
  /** Retourne les rôles autorisés pour une ressource+action. */
  getRequiredRoles(resource: string, action: string): Role[];
}

// Erreurs métier

export class UnauthorizedError extends Error {
  constructor(message = 'Unauthorized') {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends Error {
  constructor(requiredRoles: Role[]) {
    super(`Forbidden: requires one of [${requiredRoles.join(', ')}]`);
    this.name = 'ForbiddenError';
  }
}

// ---- À IMPLÉMENTER ----

export class AuthService {
  constructor(
    private readonly verifier: ITokenVerifier,
    private readonly permissions: IPermissionRegistry,
  ) {}

  /**
   * Valide le token Bearer et retourne le payload.
   * Le token doit être au format "Bearer <jwt>".
   * Lève UnauthorizedError si absent, malformé, ou expiré.
   */
  authenticate(authorizationHeader: string | undefined): JwtPayload {
    // TODO:
    // 1. Vérifier que authorizationHeader existe et commence par 'Bearer '
    //    → sinon UnauthorizedError('Missing token')
    // 2. Extraire le token (split ' ')[1]
    // 3. verifier.verify(token) → si null : UnauthorizedError('Invalid or expired token')
    // 4. Vérifier que payload.exp * 1000 > Date.now() (double check)
    //    → sinon UnauthorizedError('Token expired')
    // 5. Retourner le payload
    throw new Error('Not implemented');
  }

  /**
   * Vérifie que le payload a l'un des rôles requis pour resource+action.
   * Lève ForbiddenError si aucun rôle ne correspond.
   */
  authorize(payload: JwtPayload, resource: string, action: string): void {
    // TODO:
    // 1. requiredRoles = permissions.getRequiredRoles(resource, action)
    // 2. Si payload.roles a au moins un rôle dans requiredRoles → OK
    // 3. Sinon → ForbiddenError(requiredRoles)
    throw new Error('Not implemented');
  }

  /**
   * Vérifie que le payload appartient bien au tenant demandé.
   * Empêche un user d'un tenant A d'accéder aux données du tenant B.
   */
  assertTenant(payload: JwtPayload, requestedTenantId: string): void {
    // TODO:
    // Si payload.tenantId !== requestedTenantId
    //   → ForbiddenError(['admin']) ou UnauthorizedError('Tenant mismatch')
    //   (selon la politique : seul admin peut cross-tenant)
    // Sauf si payload.roles contient 'admin' (super-admin cross-tenant)
    throw new Error('Not implemented');
  }
}
