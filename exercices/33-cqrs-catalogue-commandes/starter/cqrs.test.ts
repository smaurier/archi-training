import { describe, it, expect } from 'vitest';
import { InMemoryEventStore, CatalogWriteModel } from './write-model.js';
import { CatalogReadModel } from './read-model.js';

describe('CQRS — Catalogue & Commandes', () => {
  const setup = () => {
    const store = new InMemoryEventStore();
    const write = new CatalogWriteModel(store);
    const read = new CatalogReadModel();
    return { store, write, read };
  };

  const syncReadModel = (store: InMemoryEventStore, read: CatalogReadModel) => {
    read.replayAll(store.getAll());
  };

  describe('Write Model', () => {
    it('createProduct émet un ProductCreated event', () => {
      const { store, write } = setup();
      write.createProduct('p1', 'Widget', 1999, 50);
      const events = store.getAll();
      expect(events).toHaveLength(1);
      expect(events[0]).toEqual({
        type: 'ProductCreated',
        payload: { id: 'p1', name: 'Widget', price: 1999, stock: 50 },
      });
    });

    it('updatePrice émet un ProductPriceUpdated event', () => {
      const { store, write } = setup();
      write.createProduct('p1', 'Widget', 1999, 50);
      write.updatePrice('p1', 2499);
      const events = store.getAll();
      expect(events[1]).toEqual({
        type: 'ProductPriceUpdated',
        payload: { id: 'p1', oldPrice: 1999, newPrice: 2499 },
      });
    });

    it('placeOrder décrémente le stock et émet les events', () => {
      const { store, write } = setup();
      write.createProduct('p1', 'Widget', 1999, 50);
      write.createProduct('p2', 'Gadget', 999, 10);
      write.placeOrder('o1', [
        { productId: 'p1', quantity: 2 },
        { productId: 'p2', quantity: 1 },
      ]);
      const events = store.getAll();
      // ProductCreated x2 + ProductStockDecremented x2 + OrderPlaced x1
      expect(events).toHaveLength(5);
      expect(events[2].type).toBe('ProductStockDecremented');
      expect(events[4].type).toBe('OrderPlaced');
    });

    it('placeOrder refuse si stock insuffisant', () => {
      const { write } = setup();
      write.createProduct('p1', 'Widget', 1999, 2);
      expect(() => write.placeOrder('o1', [{ productId: 'p1', quantity: 5 }])).toThrow();
    });
  });

  describe('Read Model', () => {
    it('projette ProductCreated en vue produit', () => {
      const { store, write, read } = setup();
      write.createProduct('p1', 'Widget', 1999, 50);
      syncReadModel(store, read);
      expect(read.getProduct('p1')).toEqual({
        id: 'p1', name: 'Widget', price: 1999, stock: 50, available: true, totalOrdered: 0,
      });
    });

    it('projette ProductPriceUpdated', () => {
      const { store, write, read } = setup();
      write.createProduct('p1', 'Widget', 1999, 50);
      write.updatePrice('p1', 2499);
      syncReadModel(store, read);
      expect(read.getProduct('p1')?.price).toBe(2499);
    });

    it('projette une commande avec stock mis à jour', () => {
      const { store, write, read } = setup();
      write.createProduct('p1', 'Widget', 1999, 50);
      write.createProduct('p2', 'Gadget', 999, 10);
      write.placeOrder('o1', [
        { productId: 'p1', quantity: 2 },
        { productId: 'p2', quantity: 1 },
      ]);
      syncReadModel(store, read);

      // Stock mis à jour
      expect(read.getProduct('p1')?.stock).toBe(48);
      expect(read.getProduct('p2')?.stock).toBe(9);

      // totalOrdered mis à jour
      expect(read.getProduct('p1')?.totalOrdered).toBe(2);

      // Commande projetée
      const order = read.getOrder('o1');
      expect(order).toBeDefined();
      expect(order!.items).toHaveLength(2);
      expect(order!.total).toBe(1999 * 2 + 999 * 1);
    });

    it('getAvailableProducts filtre les ruptures', () => {
      const { store, write, read } = setup();
      write.createProduct('p1', 'Widget', 1999, 2);
      write.createProduct('p2', 'Gadget', 999, 10);
      write.placeOrder('o1', [{ productId: 'p1', quantity: 2 }]); // stock → 0
      syncReadModel(store, read);

      const available = read.getAvailableProducts();
      expect(available).toHaveLength(1);
      expect(available[0].id).toBe('p2');
    });

    it('replayAll reconstruit le read model from scratch', () => {
      const { store, write, read } = setup();
      write.createProduct('p1', 'Widget', 1999, 50);
      write.placeOrder('o1', [{ productId: 'p1', quantity: 5 }]);

      // Premier replay
      syncReadModel(store, read);
      expect(read.getProduct('p1')?.stock).toBe(45);

      // Deuxième replay (doit donner le même résultat, pas cumuler)
      syncReadModel(store, read);
      expect(read.getProduct('p1')?.stock).toBe(45);
    });
  });
});
