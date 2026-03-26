// cache.test.ts — Tests pour LRUCache et MultiLevelCache
// Lance: pnpm test:ex42 (depuis exercices/)

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LRUCache, MultiLevelCache } from './cache.js';
import type { IL2Cache, IDataSource } from './cache.js';

// ── LRUCache ──────────────────────────────────────────────────────────────────

describe('LRUCache', () => {
  it('stocke et retourne une valeur', () => {
    const cache = new LRUCache<string>(3);
    cache.set('key', 'hello', 60_000);
    expect(cache.get('key')).toBe('hello');
  });

  it('retourne undefined pour une clé inconnue', () => {
    const cache = new LRUCache<number>(3);
    expect(cache.get('missing')).toBeUndefined();
  });

  it('retourne undefined et supprime une entrée expirée', () => {
    const cache = new LRUCache<string>(3);
    cache.set('key', 'value', -1); // TTL déjà expiré
    expect(cache.get('key')).toBeUndefined();
    expect(cache.size).toBe(0);
  });

  it("évicte l'entrée LRU quand la capacité est dépassée", () => {
    const cache = new LRUCache<number>(2);
    cache.set('a', 1, 60_000);
    cache.set('b', 2, 60_000);
    cache.get('a'); // 'a' est maintenant MRU
    cache.set('c', 3, 60_000); // 'b' doit être évicté (LRU)

    expect(cache.get('a')).toBe(1);
    expect(cache.get('b')).toBeUndefined(); // évicté
    expect(cache.get('c')).toBe(3);
  });

  it('respecte la capacité maximale', () => {
    const cache = new LRUCache<number>(3);
    cache.set('a', 1, 60_000);
    cache.set('b', 2, 60_000);
    cache.set('c', 3, 60_000);
    cache.set('d', 4, 60_000);

    expect(cache.size).toBeLessThanOrEqual(3);
  });
});

// ── MultiLevelCache ───────────────────────────────────────────────────────────

const makeL2 = (storedValue: unknown = null): IL2Cache => ({
  get: vi.fn().mockResolvedValue(storedValue),
  set: vi.fn().mockResolvedValue(undefined),
  delete: vi.fn().mockResolvedValue(undefined),
});

const makeDataSource = (value: unknown = null): IDataSource => ({
  fetch: vi.fn().mockResolvedValue(value),
});

describe('MultiLevelCache', () => {
  it('retourne la valeur depuis L1 sans consulter L2 ni la source', async () => {
    const l2 = makeL2(null);
    const ds = makeDataSource(null);
    const mc = new MultiLevelCache(5, l2, 60_000, 300_000, ds);

    // Pré-remplir L1 via set
    await mc.set('user:1', { name: 'Alice' });

    const result = await mc.get<{ name: string }>('user:1');

    expect(result).toEqual({ name: 'Alice' });
    // L2.get ne doit PAS être appelé si L1 a la valeur
    expect(l2.get).not.toHaveBeenCalled();
    expect(ds.fetch).not.toHaveBeenCalled();
  });

  it('retourne la valeur depuis L2 et populate L1 si L1 miss', async () => {
    const l2 = makeL2({ name: 'Bob' });
    const ds = makeDataSource(null);
    const mc = new MultiLevelCache(5, l2, 60_000, 300_000, ds);

    const result = await mc.get<{ name: string }>('user:2');

    expect(result).toEqual({ name: 'Bob' });
    expect(l2.get).toHaveBeenCalledWith('user:2');
    expect(ds.fetch).not.toHaveBeenCalled();

    // Deuxième appel : doit venir de L1 maintenant
    const l2GetMock = l2.get as ReturnType<typeof vi.fn>;
    l2GetMock.mockClear();
    await mc.get('user:2');
    expect(l2.get).not.toHaveBeenCalled();
  });

  it('récupère depuis la source et populate L1 + L2 si les deux missent', async () => {
    const l2 = makeL2(null);
    const ds = makeDataSource({ name: 'Charlie' });
    const mc = new MultiLevelCache(5, l2, 60_000, 300_000, ds);

    const result = await mc.get<{ name: string }>('user:3');

    expect(result).toEqual({ name: 'Charlie' });
    expect(ds.fetch).toHaveBeenCalledWith('user:3');
    expect(l2.set).toHaveBeenCalledWith('user:3', { name: 'Charlie' }, 300_000);
  });

  it('retourne null si introuvable partout', async () => {
    const mc = new MultiLevelCache(5, makeL2(null), 60_000, 300_000, makeDataSource(null));

    const result = await mc.get('nonexistent');

    expect(result).toBeNull();
  });

  it('invalidate supprime de L1 et L2', async () => {
    const l2 = makeL2(null);
    const mc = new MultiLevelCache(5, l2, 60_000, 300_000, makeDataSource(null));
    await mc.set('k', 'v');

    await mc.invalidate('k');

    expect(l2.delete).toHaveBeenCalledWith('k');
    // L1 doit aussi être vide
    const l2NoValue = makeL2(null);
    const mc2 = new MultiLevelCache(5, l2NoValue, 60_000, 300_000, makeDataSource('fresh'));
    await mc2.set('k', 'v');
    await mc2.invalidate('k');
    const afterInvalidate = await mc2.get<string>('k');
    expect(afterInvalidate).toBe('fresh'); // vient de la source, pas du cache
  });
});
