// tenant.test.ts — Tests pour l'isolation multi-tenant
// Lance: pnpm test:ex14 (depuis exercices/)

import { describe, it, expect, vi } from 'vitest';
import { TenantResolver, TenantQueryFilter, TenantStoragePrefix } from './tenant.js';
import type { ITenantRepository, TenantConfig, TenantContext } from './tenant.js';

const makeTenantConfig = (overrides: Partial<TenantConfig> = {}): TenantConfig => ({
  id: 'tenant-acme',
  name: 'Acme Corp',
  schema: 'tenant_acme',
  storagePrefix: 'acme/',
  features: ['pro'],
  plan: 'pro',
  ...overrides,
});

const makeRepo = (config: TenantConfig | null = makeTenantConfig()): ITenantRepository => ({
  findById: vi.fn().mockResolvedValue(config),
  findBySchema: vi.fn().mockResolvedValue(config),
});

describe('TenantResolver', () => {
  it('résout correctement un tenantId connu', async () => {
    const resolver = new TenantResolver(makeRepo());
    const ctx = await resolver.resolve('tenant-acme');
    expect(ctx.tenantId).toBe('tenant-acme');
    expect(ctx.schema).toBe('tenant_acme');
  });

  it('lève une erreur si le tenant est inconnu', async () => {
    const resolver = new TenantResolver(makeRepo(null));
    await expect(resolver.resolve('unknown')).rejects.toThrow('unknown');
  });
});

describe('TenantQueryFilter', () => {
  const ctx: TenantContext = { tenantId: 'acme', schema: 'tenant_acme' };
  const filter = new TenantQueryFilter();

  it('retourne le bon SET search_path', () => {
    expect(filter.getSetSearchPath(ctx)).toBe('SET search_path TO tenant_acme, public');
  });

  it('accepte une query qui utilise le bon schéma', () => {
    expect(filter.isSafeQuery(ctx, 'SELECT * FROM tenant_acme.products WHERE id = $1')).toBe(true);
  });

  it('rejette une query qui référence un autre schéma', () => {
    expect(filter.isSafeQuery(ctx, 'SELECT * FROM tenant_beta.products')).toBe(false);
  });

  it("accepte une query sans référence de schéma (utilise search_path)", () => {
    expect(filter.isSafeQuery(ctx, 'SELECT * FROM products WHERE id = $1')).toBe(true);
  });
});

describe('TenantStoragePrefix', () => {
  const config = makeTenantConfig({ storagePrefix: 'acme/' });
  const storage = new TenantStoragePrefix(config);

  it('génère le chemin S3 complet', () => {
    expect(storage.getPath('uploads/product-1.jpg')).toBe('acme/uploads/product-1.jpg');
  });

  it("reconnaît un chemin comme appartenant à ce tenant", () => {
    expect(storage.isOwnedPath('acme/uploads/logo.png')).toBe(true);
  });

  it("rejette un chemin appartenant à un autre tenant", () => {
    expect(storage.isOwnedPath('beta/uploads/logo.png')).toBe(false);
  });
});
