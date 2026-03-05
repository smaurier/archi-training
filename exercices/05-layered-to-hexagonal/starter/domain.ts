// TODO: Implémente la logique MÉTIER pure (pas d'infrastructure !)
//
// Le domaine ne connaît AUCUNE implémentation concrète.
// Il utilise uniquement les ports (interfaces) définis dans ports.ts.
//
// La classe ProductDomainService implémente le port primaire ProductUseCase
// et utilise les ports secondaires (repository, notifier, logger) injectés.

// import tes ports ici

export class ProductDomainService /* implements ProductUseCase */ {
  // TODO: constructeur avec injection des ports secondaires

  async createProduct(name: string, price: number, stock: number): Promise<any> {
    throw new Error('Not implemented');
  }

  async purchase(productId: string, quantity: number): Promise<void> {
    throw new Error('Not implemented');
  }
}
