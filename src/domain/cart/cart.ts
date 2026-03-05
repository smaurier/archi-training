import { Money } from '../shared/money';
import { CartItem } from './cart-item';

/**
 * Entité Cart (agrégat) — panier d'achat d'un utilisateur.
 *
 * Le Cart protège ses invariants :
 * - Un même produit ne peut apparaître qu'une seule fois (on incrémente la quantité)
 * - Le panier calcule son total en temps réel
 */
export class Cart {
  readonly id: string;
  readonly userId: string;
  private _items: CartItem[];

  constructor(params: {
    id?: string;
    userId: string;
    items?: CartItem[];
  }) {
    this.id = params.id ?? crypto.randomUUID();
    this.userId = params.userId;
    this._items = params.items ? [...params.items] : [];
  }

  get items(): ReadonlyArray<CartItem> {
    return [...this._items];
  }

  get total(): Money {
    if (this._items.length === 0) return new Money(0);
    return this._items.reduce(
      (sum, item) => sum.add(item.total),
      new Money(0),
    );
  }

  get isEmpty(): boolean {
    return this._items.length === 0;
  }

  get itemCount(): number {
    return this._items.reduce((sum, item) => sum + item.quantity, 0);
  }

  addItem(item: CartItem): void {
    const existing = this._items.find((i) => i.productId === item.productId);
    if (existing) {
      existing.updateQuantity(existing.quantity + item.quantity);
    } else {
      this._items.push(item);
    }
  }

  removeItem(productId: string): void {
    this._items = this._items.filter((i) => i.productId !== productId);
  }

  updateItemQuantity(productId: string, quantity: number): void {
    const item = this._items.find((i) => i.productId === productId);
    if (!item) throw new Error(`Product ${productId} not in cart`);
    item.updateQuantity(quantity);
  }

  clear(): void {
    this._items = [];
  }
}
