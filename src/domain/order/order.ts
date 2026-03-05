import { Money } from '../shared/money';
import { Email } from '../shared/email';
import { type OrderStatus, canTransition } from './order-status';

/**
 * Entité Order (agrégat root) — commande e-commerce.
 *
 * Protège ses invariants :
 * - Au moins une ligne
 * - Pas de modification après confirmation (statut != created)
 * - Transitions de statut via FSM
 *
 * La version complète avec FSM sera implémentée au Module 02.
 */

export interface OrderLine {
  readonly productId: string;
  readonly productName: string;
  readonly unitPrice: Money;
  readonly quantity: number;
}

export class Order {
  readonly id: string;
  private _lines: OrderLine[];
  private _customerEmail: Email;
  private _status: OrderStatus;
  readonly createdAt: Date;

  constructor(params: {
    id?: string;
    lines: OrderLine[];
    customerEmail: Email;
  }) {
    if (params.lines.length === 0) {
      throw new Error('Order must have at least one line');
    }

    this.id = params.id ?? crypto.randomUUID();
    this._lines = [...params.lines];
    this._customerEmail = params.customerEmail;
    this._status = 'created';
    this.createdAt = new Date();
  }

  get lines(): ReadonlyArray<OrderLine> { return [...this._lines]; }
  get status(): OrderStatus { return this._status; }
  get customerEmail(): Email { return this._customerEmail; }

  get total(): Money {
    return this._lines.reduce(
      (sum, line) => sum.add(line.unitPrice.multiply(line.quantity)),
      new Money(0),
    );
  }

  /** Transition vers un nouveau statut (validée par la FSM) */
  private transitionTo(newStatus: OrderStatus): void {
    if (!canTransition(this._status, newStatus)) {
      throw new Error(`Cannot transition from ${this._status} to ${newStatus}`);
    }
    this._status = newStatus;
  }

  markAsPaid(): void {
    this.transitionTo('paid');
  }

  ship(): void {
    this.transitionTo('shipped');
  }

  deliver(): void {
    this.transitionTo('delivered');
  }

  cancel(): void {
    this.transitionTo('cancelled');
  }
}
