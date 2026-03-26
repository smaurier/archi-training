// product.service.refactored.ts — TA VERSION AVEC INJECTION DE DÉPENDANCES
// Implémente ce service en suivant le principe DIP :
// - Injecte IProductRepository, ICacheService, IPricingService dans le constructeur
// - Le service ne connaît QUE les interfaces, jamais les implémentations
// - Chaque dépendance est injectée depuis l'extérieur → testable avec des mocks

import type { Product, IProductRepository, ICacheService, IPricingService } from './interfaces.js';

const CACHE_TTL = 300;
const CACHE_PREFIX = 'product:';

export class ProductServiceRefactored {
  constructor(
    // TODO: injecter les 3 dépendances via le constructeur
    private readonly repository: IProductRepository,
    private readonly cache: ICacheService,
    private readonly pricing: IPricingService,
  ) {}

  async getProduct(id: string): Promise<Product> {
    // TODO:
    // 1. Chercher en cache avec CACHE_PREFIX + id
    //    → Si trouvé, retourner JSON.parse()
    // 2. Chercher en base via this.repository.findById(id)
    //    → Si non trouvé, throw new Error(`Product ${id} not found`)
    // 3. Enrichir le prix via this.pricing.getPrice(id)
    // 4. Stocker en cache (ttl: CACHE_TTL)
    // 5. Retourner le produit enrichi
    throw new Error('Not implemented');
  }

  async updateProduct(id: string, updates: Partial<Product>): Promise<Product> {
    // TODO:
    // 1. Trouver le produit existant (throw si non trouvé)
    // 2. Appliquer les mises à jour (Object.assign ou spread)
    // 3. Sauvegarder via this.repository.save()
    // 4. Invalider le cache pour cet id
    // 5. Retourner le produit mis à jour
    throw new Error('Not implemented');
  }
}
