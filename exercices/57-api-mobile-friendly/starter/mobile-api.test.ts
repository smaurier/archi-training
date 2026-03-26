// mobile-api.test.ts — Tests pour ResponseOptimizer, DeltaSyncService, HttpCacheHeaders
// Lance: pnpm test:ex57 (depuis exercices/)

import { describe, it, expect } from 'vitest';
import { ResponseOptimizer, DeltaSyncService, HttpCacheHeaders } from './mobile-api.js';

describe('ResponseOptimizer.sparse', () => {
  const optimizer = new ResponseOptimizer();
  const fullProduct = { id: 'p1', name: 'Widget', price: 1000, stock: 5, description: 'A great widget' };

  it('retourne tous les champs si fields est vide/absent', () => {
    expect(optimizer.sparse(fullProduct)).toEqual(fullProduct);
    expect(optimizer.sparse(fullProduct, [])).toEqual(fullProduct);
  });

  it('retourne uniquement les champs demandés', () => {
    const result = optimizer.sparse(fullProduct, ['id', 'price']);
    expect(result).toEqual({ id: 'p1', price: 1000 });
    expect(result).not.toHaveProperty('name');
    expect(result).not.toHaveProperty('stock');
  });

  it('ignore les champs inexistants sans erreur', () => {
    const result = optimizer.sparse(fullProduct, ['id', 'nonexistent' as any]);
    expect(result).toHaveProperty('id');
    expect(result).not.toHaveProperty('nonexistent');
  });
});

describe('ResponseOptimizer.sparseArray', () => {
  const optimizer = new ResponseOptimizer();
  const products = [
    { id: 'p1', name: 'A', price: 100 },
    { id: 'p2', name: 'B', price: 200 },
  ];

  it('applique sparse sur chaque item', () => {
    const result = optimizer.sparseArray(products, ['id', 'price']);
    expect(result[0]).toEqual({ id: 'p1', price: 100 });
    expect(result[1]).toEqual({ id: 'p2', price: 200 });
    expect(result[0]).not.toHaveProperty('name');
  });
});

describe('ResponseOptimizer.flattenNested', () => {
  const optimizer = new ResponseOptimizer();

  it('extrait le niveau demandé', () => {
    const response = { user: { id: 'u1', name: 'Alice' }, meta: { ts: 1234 } };
    expect(optimizer.flattenNested(response, 'user')).toEqual({ id: 'u1', name: 'Alice' });
  });
});

describe('DeltaSyncService', () => {
  const syncer = new DeltaSyncService();
  const items = [
    { id: 'p1', name: 'A', updatedAt: 1000 },
    { id: 'p2', name: 'B', updatedAt: 2000 },
    { id: 'p3', name: 'C', updatedAt: 3000 },
  ];

  it('retourne tous les items au premier sync (lastSync = 0)', () => {
    const result = syncer.computeDelta(items, 0);
    expect(result.updated).toHaveLength(3);
    expect(result.deleted).toEqual([]);
  });

  it('retourne uniquement les items modifiés depuis lastSync', () => {
    const result = syncer.computeDelta(items, 1500);
    expect(result.updated.map(i => i.id)).toEqual(['p2', 'p3']);
    expect(result.updated).not.toContainEqual(expect.objectContaining({ id: 'p1' }));
  });

  it('inclut les IDs supprimés', () => {
    const result = syncer.computeDelta(items, 0, ['old-1', 'old-2']);
    expect(result.deleted).toEqual(['old-1', 'old-2']);
  });

  it('retourne un syncToken non vide', () => {
    const result = syncer.computeDelta(items, 0);
    expect(typeof result.syncToken).toBe('string');
    expect(result.syncToken.length).toBeGreaterThan(0);
  });

  it('décode correctement un sync token', () => {
    const token = Date.now().toString();
    expect(syncer.decodeSyncToken(token)).toBeGreaterThan(0);
  });
});

describe('HttpCacheHeaders', () => {
  const headers = new HttpCacheHeaders();

  it('génère Cache-Control: no-store si noStore=true', () => {
    const h = headers.generate({ maxAgeSeconds: 0, noStore: true });
    expect(h['Cache-Control']).toBe('no-store');
  });

  it('génère Cache-Control public avec max-age', () => {
    const h = headers.generate({ maxAgeSeconds: 3600 });
    expect(h['Cache-Control']).toContain('public');
    expect(h['Cache-Control']).toContain('max-age=3600');
  });

  it('génère Cache-Control private pour les données personnalisées', () => {
    const h = headers.generate({ maxAgeSeconds: 60, private: true });
    expect(h['Cache-Control']).toContain('private');
    expect(h['Cache-Control']).not.toContain('public');
  });

  it('inclut stale-while-revalidate si swr est fourni', () => {
    const h = headers.generate({ maxAgeSeconds: 3600, swr: 86400 });
    expect(h['Cache-Control']).toContain('stale-while-revalidate=86400');
  });
});
