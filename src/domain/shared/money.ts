/**
 * Value Object Money — montant + devise, immutable.
 *
 * Pourquoi un VO ? Parce que deux Money(10, 'EUR') sont identiques
 * quel que soit l'objet qui les porte. L'identité est la valeur elle-même.
 */
export class Money {
  readonly amount: number;
  readonly currency: string;

  constructor(amount: number, currency: string = 'EUR') {
    if (amount < 0) throw new Error('Amount cannot be negative');
    if (!currency || currency.length !== 3) throw new Error('Invalid currency code');
    this.amount = Math.round(amount * 100) / 100; // Arrondi à 2 décimales
    this.currency = currency.toUpperCase();
  }

  add(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(this.amount + other.amount, this.currency);
  }

  subtract(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(this.amount - other.amount, this.currency);
  }

  multiply(factor: number): Money {
    return new Money(this.amount * factor, this.currency);
  }

  isZero(): boolean {
    return this.amount === 0;
  }

  isPositive(): boolean {
    return this.amount > 0;
  }

  equals(other: Money): boolean {
    return this.amount === other.amount && this.currency === other.currency;
  }

  toString(): string {
    return `${this.amount.toFixed(2)} ${this.currency}`;
  }

  private assertSameCurrency(other: Money): void {
    if (this.currency !== other.currency) {
      throw new Error(`Cannot operate on ${this.currency} and ${other.currency}`);
    }
  }
}
