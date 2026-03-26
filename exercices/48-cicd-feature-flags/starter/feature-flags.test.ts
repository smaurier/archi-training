// feature-flags.test.ts — Tests pour FeatureFlagService et stableHash
// Lance: pnpm test:ex48 (depuis exercices/)

import { describe, it, expect, vi } from 'vitest';
import { FeatureFlagService, stableHash } from './feature-flags.js';
import type { IFlagRepository, FlagConfig } from './feature-flags.js';

const makeRepo = (flags: FlagConfig[]): IFlagRepository => ({
  findAll: vi.fn().mockResolvedValue(flags),
  findByName: vi.fn().mockImplementation((name: string) =>
    Promise.resolve(flags.find(f => f.name === name) ?? null),
  ),
  save: vi.fn().mockResolvedValue(undefined),
});

describe('stableHash', () => {
  it('retourne un nombre positif', () => {
    expect(stableHash('user-1:new-checkout')).toBeGreaterThanOrEqual(0);
  });

  it('retourne le même résultat pour le même input', () => {
    expect(stableHash('abc')).toBe(stableHash('abc'));
  });

  it('retourne des résultats différents pour des inputs différents', () => {
    expect(stableHash('user-1:flag-a')).not.toBe(stableHash('user-2:flag-a'));
  });
});

describe('FeatureFlagService.isEnabled', () => {
  it('retourne false si le flag est introuvable', async () => {
    const svc = new FeatureFlagService(makeRepo([]));
    expect(await svc.isEnabled('unknown')).toBe(false);
  });

  it('retourne false si le flag est désactivé', async () => {
    const svc = new FeatureFlagService(makeRepo([{ name: 'feat', enabled: false }]));
    expect(await svc.isEnabled('feat')).toBe(false);
  });

  it('retourne true si le flag est activé à 100%', async () => {
    const svc = new FeatureFlagService(makeRepo([{ name: 'feat', enabled: true }]));
    expect(await svc.isEnabled('feat')).toBe(true);
  });

  it('retourne false si rolloutPercentage = 0', async () => {
    const svc = new FeatureFlagService(makeRepo([{ name: 'feat', enabled: true, rolloutPercentage: 0 }]));
    expect(await svc.isEnabled('feat', 'user-1')).toBe(false);
  });

  it('retourne true si userId est dans la allowList (bypass rollout)', async () => {
    const svc = new FeatureFlagService(makeRepo([{
      name: 'feat', enabled: true, rolloutPercentage: 0, allowList: ['qa-user'],
    }]));
    expect(await svc.isEnabled('feat', 'qa-user')).toBe(true);
  });

  it('retourne false si userId est dans la denyList', async () => {
    const svc = new FeatureFlagService(makeRepo([{
      name: 'feat', enabled: true, denyList: ['banned-user'],
    }]));
    expect(await svc.isEnabled('feat', 'banned-user')).toBe(false);
  });

  it('retourne false si le flag est expiré', async () => {
    const pastDate = new Date(Date.now() - 1000).toISOString();
    const svc = new FeatureFlagService(makeRepo([{ name: 'feat', enabled: true, expiresAt: pastDate }]));
    expect(await svc.isEnabled('feat')).toBe(false);
  });

  it('retourne true si le flag n\'est pas encore expiré', async () => {
    const futureDate = new Date(Date.now() + 100_000).toISOString();
    const svc = new FeatureFlagService(makeRepo([{ name: 'feat', enabled: true, expiresAt: futureDate }]));
    expect(await svc.isEnabled('feat')).toBe(true);
  });

  it('le rollout est stable : même userId → même résultat', async () => {
    const flag: FlagConfig = { name: 'feat', enabled: true, rolloutPercentage: 50 };
    const svc = new FeatureFlagService(makeRepo([flag]));
    const first = await svc.isEnabled('feat', 'user-stable-42');
    const second = await svc.isEnabled('feat', 'user-stable-42');
    expect(first).toBe(second);
  });
});

describe('FeatureFlagService.getEnabledFlags', () => {
  it('retourne les noms des flags actifs pour un utilisateur', async () => {
    const flags: FlagConfig[] = [
      { name: 'flag-a', enabled: true },
      { name: 'flag-b', enabled: false },
      { name: 'flag-c', enabled: true },
    ];
    const svc = new FeatureFlagService(makeRepo(flags));
    const enabled = await svc.getEnabledFlags('user-1');
    expect(enabled).toContain('flag-a');
    expect(enabled).toContain('flag-c');
    expect(enabled).not.toContain('flag-b');
  });
});
