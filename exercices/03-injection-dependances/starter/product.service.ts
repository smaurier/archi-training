// product.service.ts — LE CODE À REFACTORER
// Ce service viole le principe de Dependency Inversion :
// il instancie directement ses dépendances (pg, ioredis, axios).
// Résultat : impossible à tester sans infrastructure réelle.
// Ton job : le remplacer par product.service.refactored.ts

import type { Product } from './interfaces.js';

// Simulations des modules externes (ne pas modifier)
const fakeDb = {
  query: async (_sql: string, _params: unknown[]) =>
    ({ rows: [] as Product[] }),
};
const fakeRedis = {
  get: async (_key: string): Promise<string | null> => null,
  set: async (_key: string, _value: string, _mode: string, _ttl: number) => {},
};
const fakeAxios = {
  get: async (_url: string) => ({ data: { price: 100 } }),
};

export class ProductService {
  // Problème 1 : dépendances instanciées dans le constructeur
  private db = fakeDb;
  private cache = fakeRedis;

  async getProduct(id: string): Promise<Product> {
    // Problème 2 : logique mixée (cache + DB + pricing)
    const cached = await this.cache.get(`product:${id}`);
    if (cached) return JSON.parse(cached) as Product;

    const result = await this.db.query('SELECT * FROM products WHERE id = $1', [id]);
    if (result.rows.length === 0) throw new Error(`Product ${id} not found`);

    const product = result.rows[0];

    // Problème 3 : appel HTTP direct dans le service métier
    const pricing = await fakeAxios.get(`http://pricing-service/price/${id}`);
    product.price = pricing.data.price as number;

    await this.cache.set(`product:${id}`, JSON.stringify(product), 'EX', 300);
    return product;
  }
}
