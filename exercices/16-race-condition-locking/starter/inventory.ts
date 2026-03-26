// inventory.ts — LE CODE AVEC LA RACE CONDITION
// Ce code a un bug classique de concurrence :
// deux requêtes simultanées peuvent vendre le dernier stock deux fois.
// Analyse la race condition, puis implémente les corrections dans
// inventory.refactored.ts

// Types
export interface StockItem {
  productId: string;
  stock: number;
  version: number; // Pour l'optimistic locking
}

// Repo simulé (ne pas modifier)
export interface IInventoryRepository {
  findByProductId(productId: string): Promise<StockItem | null>;
  save(item: StockItem): Promise<void>;
  saveWithVersionCheck(item: StockItem, expectedVersion: number): Promise<boolean>;
  reserveStock(productId: string, quantity: number): Promise<boolean>; // DB-level atomic
}

// ---- CODE AVEC RACE CONDITION ----
// Scénario : deux requêtes arrivent en même temps pour stock = 1
// T0 : Req A lit stock = 1
// T0 : Req B lit stock = 1
// T1 : Req A : stock(1) >= qty(1) → OK → stock = 0 → save
// T1 : Req B : stock(1) >= qty(1) → OK → stock = 0 → save
// Résultat : stock = 0 mais 2 commandes créées → OVERSELL

export class InventoryServiceBuggy {
  constructor(private readonly repo: IInventoryRepository) {}

  async purchaseProduct(productId: string, quantity: number): Promise<void> {
    const item = await this.repo.findByProductId(productId);
    if (!item) throw new Error('Product not found');

    // BUG: lecture et vérification non atomiques
    if (item.stock < quantity) {
      throw new Error('Insufficient stock');
    }

    item.stock -= quantity;
    await this.repo.save(item); // Pas de vérification de version !
  }
}
