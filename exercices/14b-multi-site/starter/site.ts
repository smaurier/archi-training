// site.ts — Gestion multi-site au sein d'un tenant
// Un tenant peut exploiter plusieurs sites web avec des configs distinctes.

// Types

export interface SiteConfig {
  id: string;
  tenantId: string;
  domain: string;         // ex: "acme-fr.com"
  locale: string;         // ex: "fr-FR"
  currency: string;       // ex: "EUR"
  theme: string;          // ex: "dark-blue"
  defaultLanguage: string;
  supportedLanguages: string[];
  isActive: boolean;
}

export interface SiteContext {
  site: SiteConfig;
  tenantId: string;
}

export interface ISiteRepository {
  findByDomain(domain: string): Promise<SiteConfig | null>;
  findByTenant(tenantId: string): Promise<SiteConfig[]>;
  save(site: SiteConfig): Promise<void>;
}

// ---- À IMPLÉMENTER ----

/**
 * Résout la configuration du site depuis le domaine HTTP de la requête.
 * Utilisé dans un middleware pour peupler le contexte avant le handler.
 */
export class SiteResolver {
  constructor(private readonly repo: ISiteRepository) {}

  /**
   * Résout la configuration d'un site à partir de son domaine.
   * Gère aussi les www. → strip le sous-domaine "www".
   * Retourne null si aucun site ne correspond.
   */
  async resolveByDomain(domain: string): Promise<SiteContext | null> {
    // TODO:
    // 1. Normaliser le domaine : if domain.startsWith('www.') → domain.slice(4)
    // 2. repo.findByDomain(domain)
    // 3. Si null → return null
    // 4. Si !site.isActive → return null (site désactivé)
    // 5. Retourner { site, tenantId: site.tenantId }
    throw new Error('Not implemented');
  }

  /**
   * Retourne tous les sites actifs d'un tenant, triés par domaine.
   */
  async getSitesForTenant(tenantId: string): Promise<SiteConfig[]> {
    // TODO:
    // 1. repo.findByTenant(tenantId)
    // 2. Filtrer les sites actifs (isActive === true)
    // 3. Trier par domaine (alphabétique)
    throw new Error('Not implemented');
  }
}

/**
 * Gère la configuration et les overrides par site.
 * Certaines valeurs sont héritées du tenant, d'autres overridées par le site.
 */
export class SiteConfigManager {
  /**
   * Vérifie qu'une lingua est supportée par ce site.
   */
  isLanguageSupported(site: SiteConfig, lang: string): boolean {
    // TODO: site.supportedLanguages.includes(lang)
    throw new Error('Not implemented');
  }

  /**
   * Retourne la langue effective pour une requête.
   * Priorité : lang demandé (si supporté) → defaultLanguage du site
   */
  resolveLanguage(site: SiteConfig, requestedLang?: string): string {
    // TODO:
    // if requestedLang && isLanguageSupported(site, requestedLang) → return requestedLang
    // else → return site.defaultLanguage
    throw new Error('Not implemented');
  }
}
