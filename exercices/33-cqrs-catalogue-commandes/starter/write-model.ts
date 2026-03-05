// CQRS — Write Model (commandes d'écriture)
//
// Le write model gère les commands et émet des domain events.
// Il ne se soucie PAS de comment les données seront lues.

import type { DomainEvent } from './events.js';

export interface EventStore {
  append(event: DomainEvent): void;
  getAll(): DomainEvent[];
}

// TODO: Implémente un EventStore en mémoire
export class InMemoryEventStore implements EventStore {
  // TODO
  append(event: DomainEvent): void {
    throw new Error('Not implemented');
  }
  getAll(): DomainEvent[] {
    throw new Error('Not implemented');
  }
}

// TODO: Implémente le WriteModel pour le catalogue
export class CatalogWriteModel {
  constructor(private readonly eventStore: EventStore) {}

  // Command: créer un produit
  createProduct(id: string, name: string, price: number, stock: number): void {
    // TODO: valider les inputs puis émettre un ProductCreated event
    throw new Error('Not implemented');
  }

  // Command: mettre à jour le prix
  updatePrice(id: string, newPrice: number): void {
    // TODO: trouver le dernier prix connu depuis les events, émettre ProductPriceUpdated
    throw new Error('Not implemented');
  }

  // Command: passer une commande (décrémente le stock de chaque item)
  placeOrder(orderId: string, items: Array<{ productId: string; quantity: number }>): void {
    // TODO:
    // 1. Pour chaque item, vérifier le stock disponible (calculé depuis les events)
    // 2. Si stock insuffisant → throw
    // 3. Émettre ProductStockDecremented pour chaque item
    // 4. Émettre OrderPlaced
    throw new Error('Not implemented');
  }
}
