import { Money } from '../shared/money';

/**
 * Entité Product — identifiée par un UUID unique.
 *
 * Pourquoi une Entité et pas un VO ? Parce que deux produits
 * avec le même nom et le même prix sont quand même différents (id distinct).
 * Un Product a un cycle de vie : créé, mis à jour, supprimé.
 */
export class Product {
  readonly id: string;
  private _name: string;
  private _description: string;
  private _price: Money;
  private _stock: number;
  private _categoryId: string;

  constructor(params: {
    id?: string;
    name: string;
    description: string;
    price: Money;
    stock: number;
    categoryId: string;
  }) {
    if (params.stock < 0) throw new Error('Stock cannot be negative');
    if (!params.name || params.name.trim().length === 0) throw new Error('Product name is required');

    this.id = params.id ?? crypto.randomUUID();
    this._name = params.name.trim();
    this._description = params.description;
    this._price = params.price;
    this._stock = params.stock;
    this._categoryId = params.categoryId;
  }

  get name(): string { return this._name; }
  get description(): string { return this._description; }
  get price(): Money { return this._price; }
  get stock(): number { return this._stock; }
  get categoryId(): string { return this._categoryId; }

  /** Vérifie si le stock permet de satisfaire la quantité demandée */
  canFulfill(quantity: number): boolean {
    return this._stock >= quantity;
  }

  /** Décrémente le stock — lève une erreur si insuffisant */
  decrementStock(quantity: number): void {
    if (!this.canFulfill(quantity)) {
      throw new Error(`Insufficient stock: ${this._stock} < ${quantity}`);
    }
    this._stock -= quantity;
  }

  /** Met à jour le prix — seul moyen de modifier le prix */
  updatePrice(newPrice: Money): void {
    this._price = newPrice;
  }
}
