// Ce service "fonctionne" mais mélange tout : logique métier, accès DB, validation.
// Ton job : le découper en architecture hexagonale (ports & adapters).

interface Product {
  id: string;
  name: string;
  price: number;
  stock: number;
}

// Service typique "layered" — tout est mélangé
export class ProductService {
  private products: Map<string, Product> = new Map();

  async createProduct(name: string, price: number, stock: number): Promise<Product> {
    // Validation mélangée avec la logique
    if (!name || name.length < 2) throw new Error('Name too short');
    if (price <= 0) throw new Error('Price must be positive');
    if (stock < 0) throw new Error('Stock cannot be negative');

    const id = Math.random().toString(36).slice(2);
    const product: Product = { id, name, price, stock };

    // Persistence directe (couplage fort)
    this.products.set(id, product);

    // Logging direct (couplage fort)
    console.log(`Product created: ${name} at ${price}€`);

    return product;
  }

  async purchase(productId: string, quantity: number): Promise<void> {
    const product = this.products.get(productId);
    if (!product) throw new Error('Product not found');
    if (product.stock < quantity) throw new Error('Insufficient stock');

    product.stock -= quantity;
    this.products.set(productId, product);

    // Notification directe (couplage fort)
    if (product.stock <= 5) {
      console.log(`LOW STOCK ALERT: ${product.name} has only ${product.stock} left`);
    }
  }
}
