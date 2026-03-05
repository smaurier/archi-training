import { describe, it, expect, vi } from 'vitest';
import { OrderProcessor } from './order-processor.refactored.js';
import type { Order } from './types.js';

// Ces tests vérifient ta version refactorée.
// Ils échouent tant que tu n'as pas implémenté order-processor.refactored.ts et interfaces.ts

const createMocks = () => ({
  validator: { validate: vi.fn() },
  pricing: { calculateDiscount: vi.fn().mockReturnValue(0) },
  tax: { calculateTax: vi.fn().mockReturnValue(40) },
  repository: { save: vi.fn().mockResolvedValue(undefined) },
  notification: { notifyOrderConfirmed: vi.fn().mockResolvedValue(undefined) },
});

const sampleOrder: Order = {
  id: '1',
  customerEmail: 'test@example.com',
  customerType: 'standard',
  items: [{ productId: 'p1', name: 'Widget', price: 100, quantity: 2 }],
  country: 'FR',
};

describe('OrderProcessor (refactoré SOLID)', () => {
  it('appelle le validator avec la commande', async () => {
    const mocks = createMocks();
    const processor = new OrderProcessor(
      mocks.validator, mocks.pricing, mocks.tax, mocks.repository, mocks.notification,
    );
    await processor.processOrder({ ...sampleOrder });
    expect(mocks.validator.validate).toHaveBeenCalledWith(expect.objectContaining({ id: '1' }));
  });

  it('appelle le pricing avec le subtotal correct', async () => {
    const mocks = createMocks();
    const processor = new OrderProcessor(
      mocks.validator, mocks.pricing, mocks.tax, mocks.repository, mocks.notification,
    );
    await processor.processOrder({ ...sampleOrder });
    expect(mocks.pricing.calculateDiscount).toHaveBeenCalledWith(
      expect.objectContaining({ id: '1' }), 200,
    );
  });

  it('calcule le total : subtotal - discount + tax', async () => {
    const mocks = createMocks();
    mocks.pricing.calculateDiscount.mockReturnValue(20);
    mocks.tax.calculateTax.mockReturnValue(36);
    const processor = new OrderProcessor(
      mocks.validator, mocks.pricing, mocks.tax, mocks.repository, mocks.notification,
    );
    const order = { ...sampleOrder };
    await processor.processOrder(order);
    expect(order.total).toBe(216); // 200 - 20 + 36
  });

  it('sauvegarde la commande avec le total calculé', async () => {
    const mocks = createMocks();
    const processor = new OrderProcessor(
      mocks.validator, mocks.pricing, mocks.tax, mocks.repository, mocks.notification,
    );
    const order = { ...sampleOrder };
    await processor.processOrder(order);
    expect(mocks.repository.save).toHaveBeenCalledWith(expect.objectContaining({ total: expect.any(Number) }));
  });

  it('envoie la notification après la sauvegarde', async () => {
    const mocks = createMocks();
    const processor = new OrderProcessor(
      mocks.validator, mocks.pricing, mocks.tax, mocks.repository, mocks.notification,
    );
    await processor.processOrder({ ...sampleOrder });
    expect(mocks.notification.notifyOrderConfirmed).toHaveBeenCalled();
  });

  it('propage l\'erreur si la validation échoue', async () => {
    const mocks = createMocks();
    mocks.validator.validate.mockImplementation(() => { throw new Error('Invalid'); });
    const processor = new OrderProcessor(
      mocks.validator, mocks.pricing, mocks.tax, mocks.repository, mocks.notification,
    );
    await expect(processor.processOrder({ ...sampleOrder })).rejects.toThrow('Invalid');
    expect(mocks.repository.save).not.toHaveBeenCalled();
  });
});
