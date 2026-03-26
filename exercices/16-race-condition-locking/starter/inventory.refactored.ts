// inventory.refactored.ts — TA VERSION AVEC LOCKING
// Tu dois implémenter deux stratégies :

import type { IInventoryRepository, StockItem } from './inventory.js';

// ---- STRATÉGIE 1 : Optimistic Locking ----
// Principe : on lit, on modifie, on réécrit AVEC vérification de version.
// Si la version a changé entre la lecture et l'écriture → conflit → retry.
// Avantages : pas de lock DB, haute perf en lecture.
// Inconvénients : retry nécessaire si contention élevée.

export class InventoryOptimisticService {
  constructor(private readonly repo: IInventoryRepository) {}

  async purchaseProduct(
    productId: string,
    quantity: number,
    maxRetries = 3,
  ): Promise<void> {
    // TODO:
    // Boucle jusqu'à maxRetries :
    //   1. Lire l'item (throw si non trouvé)
    //   2. Vérifier le stock (throw si insuffisant)
    //   3. Préparer la version mise à jour (item.version + 1)
    //   4. Appeler repo.saveWithVersionCheck(updatedItem, item.version)
    //      → si retourne false → version conflict → continuer la boucle
    //      → si retourne true → succès, return
    // Après maxRetries echecs → throw new Error('Optimistic lock failed after X retries')
    throw new Error('Not implemented');
  }
}

// ---- STRATÉGIE 2 : DB-level Atomic (Pessimistic) ----
// Principe : un UPDATE atomique en base qui vérifie ET décrémente en une seule opération.
// SQL : UPDATE inventory SET stock = stock - $qty WHERE product_id = $id AND stock >= $qty
// Retourne true si l'UPDATE a modifié 1 ligne (succès) ou false (stock insuffisant).
// Avantages : aucun conflit possible, pas de retry.
// Inconvénients : lock de ligne au niveau DB.

export class InventoryAtomicService {
  constructor(private readonly repo: IInventoryRepository) {}

  async purchaseProduct(productId: string, quantity: number): Promise<void> {
    // TODO:
    // 1. Appeler repo.reserveStock(productId, quantity)
    //    → Si retourne false → throw new Error('Insufficient stock')
    throw new Error('Not implemented');
  }
}
