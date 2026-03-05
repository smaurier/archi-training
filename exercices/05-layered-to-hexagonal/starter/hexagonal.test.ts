import { describe, it, expect, vi } from 'vitest';
import { ProductDomainService } from './domain.js';

describe('ProductDomainService (hexagonal)', () => {
  const createMocks = () => ({
    repository: {
      save: vi.fn().mockResolvedValue(undefined),
      findById: vi.fn(),
    },
    notifier: { notifyLowStock: vi.fn() },
    logger: { log: vi.fn() },
  });

  describe('createProduct', () => {
    it('valide le nom (min 2 caractères)', async () => {
      const mocks = createMocks();
      const service = new ProductDomainService(mocks.repository, mocks.notifier, mocks.logger);
      await expect(service.createProduct('', 10, 5)).rejects.toThrow();
    });

    it('valide le prix (positif)', async () => {
      const mocks = createMocks();
      const service = new ProductDomainService(mocks.repository, mocks.notifier, mocks.logger);
      await expect(service.createProduct('Widget', -1, 5)).rejects.toThrow();
    });

    it('sauvegarde via le repository injecté', async () => {
      const mocks = createMocks();
      const service = new ProductDomainService(mocks.repository, mocks.notifier, mocks.logger);
      await service.createProduct('Widget', 10, 5);
      expect(mocks.repository.save).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Widget', price: 10, stock: 5 }),
      );
    });

    it('log via le logger injecté (pas console.log)', async () => {
      const mocks = createMocks();
      const service = new ProductDomainService(mocks.repository, mocks.notifier, mocks.logger);
      await service.createProduct('Widget', 10, 5);
      expect(mocks.logger.log).toHaveBeenCalled();
    });
  });

  describe('purchase', () => {
    it('décrémente le stock', async () => {
      const mocks = createMocks();
      mocks.repository.findById.mockResolvedValue({ id: '1', name: 'W', price: 10, stock: 10 });
      const service = new ProductDomainService(mocks.repository, mocks.notifier, mocks.logger);
      await service.purchase('1', 3);
      expect(mocks.repository.save).toHaveBeenCalledWith(
        expect.objectContaining({ stock: 7 }),
      );
    });

    it('refuse si stock insuffisant', async () => {
      const mocks = createMocks();
      mocks.repository.findById.mockResolvedValue({ id: '1', name: 'W', price: 10, stock: 2 });
      const service = new ProductDomainService(mocks.repository, mocks.notifier, mocks.logger);
      await expect(service.purchase('1', 5)).rejects.toThrow('Insufficient stock');
    });

    it('notifie si stock <= 5 après achat', async () => {
      const mocks = createMocks();
      mocks.repository.findById.mockResolvedValue({ id: '1', name: 'W', price: 10, stock: 6 });
      const service = new ProductDomainService(mocks.repository, mocks.notifier, mocks.logger);
      await service.purchase('1', 2);
      expect(mocks.notifier.notifyLowStock).toHaveBeenCalled();
    });

    it('ne notifie PAS si stock > 5 après achat', async () => {
      const mocks = createMocks();
      mocks.repository.findById.mockResolvedValue({ id: '1', name: 'W', price: 10, stock: 20 });
      const service = new ProductDomainService(mocks.repository, mocks.notifier, mocks.logger);
      await service.purchase('1', 3);
      expect(mocks.notifier.notifyLowStock).not.toHaveBeenCalled();
    });
  });
});
