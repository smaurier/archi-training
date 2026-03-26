// interfaces.ts — Les ports (abstractions) pour le ProductService
// Tu dois définir les interfaces ici. Le service ne doit dépendre
// QUE de ces interfaces, jamais des implémentations concrètes.

// ---- À implémenter ----

export interface Product {
  id: string;
  name: string;
  price: number;
  stock: number;
}

export interface IProductRepository {
  // TODO: findById(id: string): Promise<Product | null>
  // TODO: save(product: Product): Promise<void>
  findById(id: string): Promise<Product | null>;
  save(product: Product): Promise<void>;
}

export interface ICacheService {
  // TODO: get(key: string): Promise<string | null>
  // TODO: set(key: string, value: string, ttlSeconds: number): Promise<void>
  // TODO: invalidate(key: string): Promise<void>
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds: number): Promise<void>;
  invalidate(key: string): Promise<void>;
}

export interface IPricingService {
  // TODO: getPrice(productId: string): Promise<number>
  getPrice(productId: string): Promise<number>;
}
