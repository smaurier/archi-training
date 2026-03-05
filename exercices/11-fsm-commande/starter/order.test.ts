import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Order } from './order.js';
import type { OrderSideEffects } from './order.js';

const createMockEffects = (): OrderSideEffects => ({
  onPaid: vi.fn().mockResolvedValue(undefined),
  onShipped: vi.fn().mockResolvedValue(undefined),
  onDelivered: vi.fn().mockResolvedValue(undefined),
  onCancelled: vi.fn().mockResolvedValue(undefined),
});

describe('Order FSM', () => {
  let effects: OrderSideEffects;
  let order: Order;

  beforeEach(() => {
    effects = createMockEffects();
    order = new Order('order-1', effects);
  });

  describe('état initial', () => {
    it('commence à "created"', () => {
      expect(order.status).toBe('created');
    });

    it('a un audit trail vide', () => {
      expect(order.transitions).toHaveLength(0);
    });
  });

  describe('transitions valides', () => {
    it('created -> paid', async () => {
      await order.transitionTo('paid', 'user-1');
      expect(order.status).toBe('paid');
    });

    it('paid -> shipped', async () => {
      await order.transitionTo('paid', 'user-1');
      await order.transitionTo('shipped', 'user-1');
      expect(order.status).toBe('shipped');
    });

    it('shipped -> delivered', async () => {
      await order.transitionTo('paid', 'user-1');
      await order.transitionTo('shipped', 'user-1');
      await order.transitionTo('delivered', 'user-1');
      expect(order.status).toBe('delivered');
    });

    it('created -> cancelled (avec reason)', async () => {
      await order.transitionTo('cancelled', 'user-1', 'Client a changé d\'avis');
      expect(order.status).toBe('cancelled');
    });

    it('paid -> cancelled (avec reason)', async () => {
      await order.transitionTo('paid', 'user-1');
      await order.transitionTo('cancelled', 'user-1', 'Rupture de stock');
      expect(order.status).toBe('cancelled');
    });
  });

  describe('transitions invalides', () => {
    it('created -> delivered (impossible)', async () => {
      await expect(order.transitionTo('delivered', 'user-1')).rejects.toThrow();
    });

    it('created -> shipped (impossible)', async () => {
      await expect(order.transitionTo('shipped', 'user-1')).rejects.toThrow();
    });

    it('delivered -> cancelled (impossible)', async () => {
      await order.transitionTo('paid', 'user-1');
      await order.transitionTo('shipped', 'user-1');
      await order.transitionTo('delivered', 'user-1');
      await expect(order.transitionTo('cancelled', 'user-1', 'trop tard')).rejects.toThrow();
    });

    it('cancelled -> paid (impossible)', async () => {
      await order.transitionTo('cancelled', 'user-1', 'annulé');
      await expect(order.transitionTo('paid', 'user-1')).rejects.toThrow();
    });
  });

  describe('cancelled nécessite une reason', () => {
    it('throw si pas de reason pour cancelled', async () => {
      await expect(order.transitionTo('cancelled', 'user-1')).rejects.toThrow();
    });
  });

  describe('audit trail', () => {
    it('enregistre chaque transition', async () => {
      await order.transitionTo('paid', 'user-1');
      await order.transitionTo('shipped', 'user-2');
      expect(order.transitions).toHaveLength(2);
      expect(order.transitions[0]).toMatchObject({ from: 'created', to: 'paid', by: 'user-1' });
      expect(order.transitions[1]).toMatchObject({ from: 'paid', to: 'shipped', by: 'user-2' });
    });

    it('chaque transition a un timestamp', async () => {
      await order.transitionTo('paid', 'user-1');
      expect(order.transitions[0].at).toBeInstanceOf(Date);
    });

    it('l\'audit trail est immutable (copie défensive)', () => {
      const trail = order.transitions;
      expect(() => (trail as any).push({} as any)).not.toThrow(); // push on copy
      expect(order.transitions).toHaveLength(0); // original unchanged
    });
  });

  describe('side effects', () => {
    it('déclenche onPaid quand -> paid', async () => {
      await order.transitionTo('paid', 'user-1');
      expect(effects.onPaid).toHaveBeenCalledWith('order-1');
    });

    it('déclenche onShipped quand -> shipped', async () => {
      await order.transitionTo('paid', 'user-1');
      await order.transitionTo('shipped', 'user-1');
      expect(effects.onShipped).toHaveBeenCalledWith('order-1');
    });

    it('déclenche onCancelled quand -> cancelled', async () => {
      await order.transitionTo('cancelled', 'user-1', 'annulé');
      expect(effects.onCancelled).toHaveBeenCalledWith('order-1');
    });
  });
});
