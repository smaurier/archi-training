// search.test.ts — Tests pour SearchService
// Lance: pnpm test:ex20 (depuis exercices/)

import { describe, it, expect, vi } from 'vitest';
import { SearchService } from './search.js';
import type { ISearchProvider, SearchQuery, SearchResult } from './search.js';

interface Product { id: string; name: string; }

const makeProvider = (overrides: Partial<ISearchProvider<Product>> = {}): ISearchProvider<Product> => ({
  search: vi.fn().mockResolvedValue({ hits: [], total: 0, nextCursor: null, took: 1 }),
  index: vi.fn().mockResolvedValue(undefined),
  delete: vi.fn().mockResolvedValue(undefined),
  reindex: vi.fn().mockResolvedValue(undefined),
  ...overrides,
});

describe('SearchService.search', () => {
  it('normalise la query en lowercase et trim', async () => {
    const provider = makeProvider();
    const svc = new SearchService<Product>(provider);
    await svc.search({ q: '  Widget PRO  ' });
    expect(provider.search).toHaveBeenCalledWith(
      expect.objectContaining({ q: 'widget pro' }),
    );
  });

  it("remplace une query vide par '*'", async () => {
    const provider = makeProvider();
    const svc = new SearchService<Product>(provider);
    await svc.search({ q: '' });
    expect(provider.search).toHaveBeenCalledWith(
      expect.objectContaining({ q: '*' }),
    );
  });

  it('applique la limite par défaut de 20', async () => {
    const provider = makeProvider();
    const svc = new SearchService<Product>(provider);
    await svc.search({ q: 'test' });
    expect(provider.search).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 20 }),
    );
  });

  it('respecte la limite fournie par le client', async () => {
    const provider = makeProvider();
    const svc = new SearchService<Product>(provider);
    await svc.search({ q: 'test', limit: 5 });
    expect(provider.search).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 5 }),
    );
  });
});

describe('SearchService.index', () => {
  it('indexe un document avec un ID valide', async () => {
    const provider = makeProvider();
    const svc = new SearchService<Product>(provider);
    await svc.index('prod-1', { id: 'prod-1', name: 'Widget' });
    expect(provider.index).toHaveBeenCalledWith('prod-1', { id: 'prod-1', name: 'Widget' });
  });

  it('lève une erreur si l\'ID est vide', async () => {
    const svc = new SearchService<Product>(makeProvider());
    await expect(svc.index('', { id: '', name: 'X' })).rejects.toThrow();
  });

  it('lève une erreur si l\'ID est un espace', async () => {
    const svc = new SearchService<Product>(makeProvider());
    await expect(svc.index('   ', { id: '  ', name: 'X' })).rejects.toThrow();
  });
});

describe('SearchService.delete', () => {
  it('délègue la suppression au provider', async () => {
    const provider = makeProvider();
    const svc = new SearchService<Product>(provider);
    await svc.delete('prod-1');
    expect(provider.delete).toHaveBeenCalledWith('prod-1');
  });
});

describe('SearchService.reindex', () => {
  it('délègue le reindex au provider', async () => {
    const provider = makeProvider();
    const svc = new SearchService<Product>(provider);
    const docs = [{ id: '1', document: { id: '1', name: 'A' } }];
    await svc.reindex(docs);
    expect(provider.reindex).toHaveBeenCalledWith(docs);
  });
});
