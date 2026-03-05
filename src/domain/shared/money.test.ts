import { describe, it, expect } from 'vitest';
import { Money } from './money';

describe('Money', () => {
  it('crée un Money valide', () => {
    const m = new Money(10.5, 'EUR');
    expect(m.amount).toBe(10.5);
    expect(m.currency).toBe('EUR');
  });

  it('arrondit à 2 décimales', () => {
    const m = new Money(10.999, 'EUR');
    expect(m.amount).toBe(11);
  });

  it('rejette un montant négatif', () => {
    expect(() => new Money(-1, 'EUR')).toThrow('Amount cannot be negative');
  });

  it('rejette une devise invalide', () => {
    expect(() => new Money(10, '')).toThrow('Invalid currency code');
    expect(() => new Money(10, 'EU')).toThrow('Invalid currency code');
  });

  it('additionne deux Money de même devise', () => {
    const a = new Money(10, 'EUR');
    const b = new Money(5.5, 'EUR');
    const result = a.add(b);
    expect(result.amount).toBe(15.5);
    expect(result.currency).toBe('EUR');
  });

  it('refuse d\'additionner deux devises différentes', () => {
    const eur = new Money(10, 'EUR');
    const usd = new Money(10, 'USD');
    expect(() => eur.add(usd)).toThrow('Cannot operate on EUR and USD');
  });

  it('soustrait deux Money', () => {
    const a = new Money(10, 'EUR');
    const b = new Money(3, 'EUR');
    expect(a.subtract(b).amount).toBe(7);
  });

  it('multiplie un Money par un facteur', () => {
    const m = new Money(10, 'EUR');
    expect(m.multiply(3).amount).toBe(30);
  });

  it('vérifie l\'égalité par valeur', () => {
    const a = new Money(10, 'EUR');
    const b = new Money(10, 'EUR');
    const c = new Money(10, 'USD');
    expect(a.equals(b)).toBe(true);
    expect(a.equals(c)).toBe(false);
  });

  it('toString formate correctement', () => {
    expect(new Money(42.5, 'EUR').toString()).toBe('42.50 EUR');
  });
});
