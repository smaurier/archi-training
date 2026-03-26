// inventory.test.ts — Tests pour les deux stratégies de locking
// Lance: pnpm test:ex16 (depuis exercices/)

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { InventoryOptimisticService, InventoryAtomicService } from './inventory.refactored.js';
import type { IInventoryRepository, StockItem } from './inventory.js';

const makeItem = (stock = 5, version = 1): StockItem => ({
  productId: 'prod-1',
  stock,
  version,
});

describe('InventoryOptimisticService', () => {
  it('décrémente le stock si disponible', async () => {
    const item = makeItem(5, 1);
    const repo: IInventoryRepository = {
      findByProductId: vi.fn().mockResolvedValue(item),
      save: vi.fn(),
      saveWithVersionCheck: vi.fn().mockResolvedValue(true),
      reserveStock: vi.fn(),
    };

    const svc = new InventoryOptimisticService(repo);
    await svc.purchaseProduct('prod-1', 2);

    expect(repo.saveWithVersionCheck).toHaveBeenCalledWith(
      expect.objectContaining({ stock: 3, version: 2 }),
      1, // expectedVersion = version initiale
    );
  });

  it('lève une erreur si stock insuffisant', async () => {
    const repo: IInventoryRepository = {
      findByProductId: vi.fn().mockResolvedValue(makeItem(1, 1)),
      save: vi.fn(),
      saveWithVersionCheck: vi.fn(),
      reserveStock: vi.fn(),
    };

    const svc = new InventoryOptimisticService(repo);
    await expect(svc.purchaseProduct('prod-1', 5)).rejects.toThrow(/Insufficient/i);
    expect(repo.saveWithVersionCheck).not.toHaveBeenCalled();
  });

  it('retente si version conflict (saveWithVersionCheck retourne false)', async () => {
    const item = makeItem(5, 1);
    const repo: IInventoryRepository = {
      findByProductId: vi.fn().mockResolvedValue(item),
      save: vi.fn(),
      // Simule 2 conflits puis un succès
      saveWithVersionCheck: vi.fn()
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(true),
      reserveStock: vi.fn(),
    };

    const svc = new InventoryOptimisticService(repo);
    await svc.purchaseProduct('prod-1', 1, 3);

    expect(repo.saveWithVersionCheck).toHaveBeenCalledTimes(3);
  });

  it('lève une erreur après maxRetries conflits', async () => {
    const repo: IInventoryRepository = {
      findByProductId: vi.fn().mockResolvedValue(makeItem(5, 1)),
      save: vi.fn(),
      saveWithVersionCheck: vi.fn().mockResolvedValue(false),
      reserveStock: vi.fn(),
    };

    const svc = new InventoryOptimisticService(repo);
    await expect(svc.purchaseProduct('prod-1', 1, 3)).rejects.toThrow(/retries/i);
    expect(repo.saveWithVersionCheck).toHaveBeenCalledTimes(3);
  });

  it('lève une erreur si produit non trouvé', async () => {
    const repo: IInventoryRepository = {
      findByProductId: vi.fn().mockResolvedValue(null),
      save: vi.fn(),
      saveWithVersionCheck: vi.fn(),
      reserveStock: vi.fn(),
    };

    const svc = new InventoryOptimisticService(repo);
    await expect(svc.purchaseProduct('unknown', 1)).rejects.toThrow('not found');
  });
});

describe('InventoryAtomicService', () => {
  it('appelle reserveStock si stock disponible', async () => {
    const repo: IInventoryRepository = {
      findByProductId: vi.fn(),
      save: vi.fn(),
      saveWithVersionCheck: vi.fn(),
      reserveStock: vi.fn().mockResolvedValue(true),
    };

    const svc = new InventoryAtomicService(repo);
    await svc.purchaseProduct('prod-1', 3);

    expect(repo.reserveStock).toHaveBeenCalledWith('prod-1', 3);
  });

  it('lève une erreur si reserveStock retourne false (stock insuffisant)', async () => {
    const repo: IInventoryRepository = {
      findByProductId: vi.fn(),
      save: vi.fn(),
      saveWithVersionCheck: vi.fn(),
      reserveStock: vi.fn().mockResolvedValue(false),
    };

    const svc = new InventoryAtomicService(repo);
    await expect(svc.purchaseProduct('prod-1', 5)).rejects.toThrow(/Insufficient/i);
  });
});
