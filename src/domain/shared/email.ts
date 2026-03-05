/**
 * Value Object Email — adresse email validée et normalisée.
 *
 * Immutable : une fois créé, un Email ne change pas.
 * Deux Email avec la même valeur sont considérés égaux.
 */
export class Email {
  readonly value: string;

  constructor(value: string) {
    if (!value || !value.includes('@') || value.length < 5) {
      throw new Error(`Invalid email: ${value}`);
    }
    this.value = value.toLowerCase().trim();
  }

  get domain(): string {
    return this.value.split('@')[1];
  }

  equals(other: Email): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
