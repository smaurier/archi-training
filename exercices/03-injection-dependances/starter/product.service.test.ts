// product.service.test.ts — Ces tests vérifient ta version refactorée
// Ils echouent tant que tu n'as pas implémenté product.service.refactored.ts
// Lance: pnpm test:ex03 (depuis exercices/)

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProductServiceRefactored } from './product.service.refactored.js';
import type { IProductRepository, ICacheService, IPricingService, Product } from './interfaces.js';

const makeProduct = (overrides: Partial<Product> = {}): Product => ({
  id: 'prod-1',
  name: 'Widget Pro',
  price: 99,
  stock: 10,
  ...overrides,
});

const makeRepo = (product: Product | null = makeProduct()): IProductRepository => ({
  findById: vi.fn().mockResolvedValue(product),
  save: vi.fn().mockResolvedValue(undefined),
});

const makeCache = (cached: string | null = null): ICacheService => ({
  get: vi.fn().mockResolvedValue(cached),
  set: vi.fn().mockResolvedValue(undefined),
  invalidate: vi.fn().mockResolvedValue(undefined),
});

const makePricing = (price = 150): IPricingService => ({
  getPrice: vi.fn().mockResolvedValue(price),
});

describe('ProductServiceRefactored — DI', () => {
  describe('getProduct', () => {
    it('retourne depuis le cache si disponible (sans appeler la DB)', async () => {
      const product = makeProduct({ price: 77 });
      const repo = makeRepo();
      const cache = makeCache(JSON.stringify(product));
      const pricing = makePricing();

      const svc = new ProductServiceRefactored(repo, cache, pricing);
      const result = await svc.getProduct('prod-1');

      expect(result).toEqual(product);
      // La DB et le pricing ne devrait pas être appelés
      expect(repo.findById).not.toHaveBeenCalled();
      expect(pricing.getPrice).not.toHaveBeenCalled();
    });

    it('charge depuis la DB si le cache est vide', async () => {
      const product = makeProduct();
      const repo = makeRepo(product);
      const cache = makeCache(null);
      const pricing = makePricing(200);

      const svc = new ProductServiceRefactored(repo, cache, pricing);
      const result = await svc.getProduct('prod-1');

      expect(repo.findById).toHaveBeenCalledWith('prod-1');
      expect(result.price).toBe(200); // enrichi par pricing
    });

    it('stocke en cache après lecture DB', async () => {
      const repo = makeRepo();
      const cache = makeCache(null);
      const pricing = makePricing(150);

      const svc = new ProductServiceRefactored(repo, cache, pricing);
      await svc.getProduct('prod-1');

      expect(cache.set).toHaveBeenCalledWith(
        expect.stringContaining('prod-1'),
        expect.any(String),
        300,
      );
    });

    it('lève une erreur si le produit est introuvable', async () => {
      const repo = makeRepo(null);
      const svc = new ProductServiceRefactored(repo, makeCache(), makePricing());

      await expect(svc.getProduct('unknown')).rejects.toThrow('unknown');
    });
  });

  describe('updateProduct', () => {
    it('sauvegarde les modifications', async () => {
      const product = makeProduct({ name: 'Old Name' });
      const repo = makeRepo(product);
      const cache = makeCache();

      const svc = new ProductServiceRefactored(repo, cache, makePricing());
      const updated = await svc.updateProduct('prod-1', { name: 'New Name' });

      expect(updated.name).toBe('New Name');
      expect(repo.save).toHaveBeenCalled();
    });

    it('invalide le cache après mise à jour', async () => {
      const repo = makeRepo();
      const cache = makeCache();

      const svc = new ProductServiceRefactored(repo, cache, makePricing());
      await svc.updateProduct('prod-1', { price: 50 });

      expect(cache.invalidate).toHaveBeenCalledWith(expect.stringContaining('prod-1'));
    });

    it('lève une erreur si le produit à mettre à jour est introuvable', async () => {
      const repo = makeRepo(null);
      const svc = new ProductServiceRefactored(repo, makeCache(), makePricing());

      await expect(svc.updateProduct('unknown', { price: 50 })).rejects.toThrow('unknown');
    });
  });
});
