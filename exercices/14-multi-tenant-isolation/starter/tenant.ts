// tenant.ts — Isolation multi-tenant avec schema-per-tenant PostgreSQL
// Garantit qu'un tenant ne peut jamais accéder aux données d'un autre.

// Types

export interface TenantContext {
  tenantId: string;
  schema: string;   // ex: "tenant_acme", "tenant_beta"
}

export interface TenantConfig {
  id: string;
  name: string;
  schema: string;
  storagePrefix: string; // ex: "acme/" pour S3
  features: string[];
  plan: 'free' | 'pro' | 'enterprise';
}

export interface ITenantRepository {
  findById(tenantId: string): Promise<TenantConfig | null>;
  findBySchema(schema: string): Promise<TenantConfig | null>;
}

// ---- À IMPLÉMENTER ----

/**
 * Résout le contexte tenant depuis un JWT payload ou un header HTTP.
 * Lance une erreur si le tenant n'existe pas ou est désactivé.
 */
export class TenantResolver {
  constructor(private readonly repo: ITenantRepository) {}

  async resolve(tenantId: string): Promise<TenantContext> {
    // TODO:
    // 1. repo.findById(tenantId)
    // 2. Si null → throw new Error(`Tenant ${tenantId} not found`)
    // 3. Retourner { tenantId: config.id, schema: config.schema }
    throw new Error('Not implemented');
  }
}

/**
 * Applique l'isolation SQL au niveau du search_path PostgreSQL.
 * Toutes les requêtes d'un tenant tournent dans son propre schéma.
 */
export class TenantQueryFilter {
  /**
   * Retourne la commande SQL SET search_path pour le schéma du tenant.
   * Format: "SET search_path TO <schema>, public"
   */
  getSetSearchPath(ctx: TenantContext): string {
    // TODO: retourner `SET search_path TO ${ctx.schema}, public`
    throw new Error('Not implemented');
  }

  /**
   * Vérifie qu'une requête SQL ne référence pas explicitement un autre schéma.
   * Détecte les références cross-tenant du type "tenant_other.products".
   * Retourne true si la requête est sûre, false si elle tente un accès cross-tenant.
   */
  isSafeQuery(ctx: TenantContext, sql: string): boolean {
    // TODO:
    // Chercher dans sql tous les patterns "tenant_<nom>." (regex: /tenant_\w+\./g)
    // Si un pattern référence un schéma DIFFÉRENT de ctx.schema → false
    // Sinon → true
    throw new Error('Not implemented');
  }
}

/**
 * Gère les préfixes de stockage S3 pour l'isolation des assets par tenant.
 */
export class TenantStoragePrefix {
  constructor(private readonly config: TenantConfig) {}

  /**
   * Retourne le chemin S3 complet pour un fichier.
   * Format: "<storagePrefix><relativePath>"
   * ex: "acme/uploads/product-1.jpg"
   */
  getPath(relativePath: string): string {
    // TODO: `${this.config.storagePrefix}${relativePath}`
    throw new Error('Not implemented');
  }

  /**
   * Vérifie qu'un chemin S3 appartient bien à ce tenant.
   * Retourne false si le chemin commence par un préfixe d'un autre tenant.
   */
  isOwnedPath(path: string): boolean {
    // TODO: path.startsWith(this.config.storagePrefix)
    throw new Error('Not implemented');
  }
}
