// CQRS — Read Model (projections optimisées pour la lecture)
//
// Le read model écoute les domain events et maintient des vues dénormalisées.
// Il ne peut PAS modifier le write model — il est read-only.

import type { DomainEvent } from './events.js';

// Vue dénormalisée pour le catalogue (optimisée pour l'affichage)
export interface ProductView {
  id: string;
  name: string;
  price: number;
  stock: number;
  available: boolean;    // stock > 0
  totalOrdered: number;  // nombre total d'unités commandées
}

// Vue dénormalisée pour les commandes
export interface OrderView {
  orderId: string;
  items: Array<{ productId: string; productName: string; quantity: number; unitPrice: number; lineTotal: number }>;
  total: number;
}

// TODO: Implémente le ReadModel qui projette les events en vues
export class CatalogReadModel {
  private products = new Map<string, ProductView>();
  private orders = new Map<string, OrderView>();

  // Projette un event sur les vues
  apply(event: DomainEvent): void {
    // TODO: switch sur event.type et mettre à jour les vues
    // ProductCreated → ajouter le produit dans products
    // ProductPriceUpdated → mettre à jour le prix
    // ProductStockDecremented → décrémenter le stock, mettre à jour available
    // OrderPlaced → créer la vue commande avec les noms des produits et les totaux
    throw new Error('Not implemented');
  }

  // Replay tous les events (reconstruction du read model)
  replayAll(events: DomainEvent[]): void {
    this.products.clear();
    this.orders.clear();
    for (const event of events) {
      this.apply(event);
    }
  }

  // Queries
  getProduct(id: string): ProductView | undefined {
    return this.products.get(id);
  }

  getAllProducts(): ProductView[] {
    return [...this.products.values()];
  }

  getAvailableProducts(): ProductView[] {
    return this.getAllProducts().filter(p => p.available);
  }

  getOrder(orderId: string): OrderView | undefined {
    return this.orders.get(orderId);
  }
}
