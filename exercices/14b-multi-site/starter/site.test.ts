// site.test.ts — Tests pour la gestion multi-site
// Lance: pnpm test:ex14b (depuis exercices/)

import { describe, it, expect, vi } from 'vitest';
import { SiteResolver, SiteConfigManager } from './site.js';
import type { ISiteRepository, SiteConfig } from './site.js';

const makeSite = (overrides: Partial<SiteConfig> = {}): SiteConfig => ({
  id: 'site-fr',
  tenantId: 'tenant-acme',
  domain: 'acme-fr.com',
  locale: 'fr-FR',
  currency: 'EUR',
  theme: 'dark',
  defaultLanguage: 'fr',
  supportedLanguages: ['fr', 'en'],
  isActive: true,
  ...overrides,
});

const makeRepo = (sites: SiteConfig[]): ISiteRepository => ({
  findByDomain: vi.fn().mockImplementation((domain: string) =>
    Promise.resolve(sites.find(s => s.domain === domain) ?? null),
  ),
  findByTenant: vi.fn().mockImplementation((tenantId: string) =>
    Promise.resolve(sites.filter(s => s.tenantId === tenantId)),
  ),
  save: vi.fn().mockResolvedValue(undefined),
});

describe('SiteResolver.resolveByDomain', () => {
  it('résout un site par son domaine', async () => {
    const site = makeSite();
    const resolver = new SiteResolver(makeRepo([site]));
    const result = await resolver.resolveByDomain('acme-fr.com');
    expect(result?.site.id).toBe('site-fr');
    expect(result?.tenantId).toBe('tenant-acme');
  });

  it("strip le sous-domaine www. et résout le domaine nu", async () => {
    const site = makeSite({ domain: 'acme-fr.com' });
    const resolver = new SiteResolver(makeRepo([site]));
    const result = await resolver.resolveByDomain('www.acme-fr.com');
    expect(result?.site.domain).toBe('acme-fr.com');
  });

  it('retourne null pour un domaine inconnu', async () => {
    const resolver = new SiteResolver(makeRepo([]));
    expect(await resolver.resolveByDomain('unknown.com')).toBeNull();
  });

  it("retourne null pour un site inactif", async () => {
    const site = makeSite({ isActive: false });
    const resolver = new SiteResolver(makeRepo([site]));
    expect(await resolver.resolveByDomain('acme-fr.com')).toBeNull();
  });
});

describe('SiteResolver.getSitesForTenant', () => {
  it('retourne uniquement les sites actifs, triés par domaine', async () => {
    const sites = [
      makeSite({ id: 's1', domain: 'z-site.com', isActive: true }),
      makeSite({ id: 's2', domain: 'a-site.com', isActive: true }),
      makeSite({ id: 's3', domain: 'm-site.com', isActive: false }),
    ];
    const resolver = new SiteResolver(makeRepo(sites));
    const result = await resolver.getSitesForTenant('tenant-acme');
    expect(result).toHaveLength(2);
    expect(result[0].domain).toBe('a-site.com');
    expect(result[1].domain).toBe('z-site.com');
  });
});

describe('SiteConfigManager', () => {
  const mgr = new SiteConfigManager();
  const site = makeSite({ defaultLanguage: 'fr', supportedLanguages: ['fr', 'en', 'de'] });

  it('retourne true si la langue est supportée', () => {
    expect(mgr.isLanguageSupported(site, 'en')).toBe(true);
  });

  it('retourne false si la langue n\'est pas supportée', () => {
    expect(mgr.isLanguageSupported(site, 'jp')).toBe(false);
  });

  it('résout la langue demandée si supportée', () => {
    expect(mgr.resolveLanguage(site, 'en')).toBe('en');
  });

  it('fallback vers defaultLanguage si langue demandée non supportée', () => {
    expect(mgr.resolveLanguage(site, 'jp')).toBe('fr');
  });

  it('fallback vers defaultLanguage si aucune langue demandée', () => {
    expect(mgr.resolveLanguage(site, undefined)).toBe('fr');
  });
});
