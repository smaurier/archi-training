import { Money } from '../shared/money';

/**
 * CartItem — ligne du panier avec prix unitaire et quantité.
 *
 * Pas un VO pur (on peut modifier la quantité), mais appartient à l'agrégat Cart.
 */
export class CartItem {
  readonly productId: string;
  readonly productName: string;
  readonly unitPrice: Money;
  private _quantity: number;

  constructor(params: {
    productId: string;
    productName: string;
    unitPrice: Money;
    quantity: number;
  }) {
    if (params.quantity <= 0) throw new Error('Quantity must be positive');

    this.productId = params.productId;
    this.productName = params.productName;
    this.unitPrice = params.unitPrice;
    this._quantity = params.quantity;
  }

  get quantity(): number { return this._quantity; }

  get total(): Money {
    return this.unitPrice.multiply(this._quantity);
  }

  updateQuantity(newQuantity: number): void {
    if (newQuantity <= 0) throw new Error('Quantity must be positive');
    this._quantity = newQuantity;
  }
}
