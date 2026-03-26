// contracts.test.ts — Tests pour les validateurs de contrat
// Lance: pnpm test:ex51 (depuis exercices/)

import { describe, it, expect } from 'vitest';
import {
  validateProduct,
  validatePaginatedProducts,
  validateCart,
  assertContract,
  ContractViolationError,
} from './contracts.js';

describe('validateProduct', () => {
  const validProduct = { id: 'p1', name: 'Widget', price: 1999, stock: 5, status: 'active' };

  it('retourne [] pour un produit valide', () => {
    expect(validateProduct(validProduct)).toEqual([]);
  });

  it('détecte un id manquant', () => {
    const violations = validateProduct({ name: 'W', price: 100, stock: 1, status: 'active' });
    expect(violations.some(v => v.includes('id'))).toBe(true);
  });

  it('détecte un price non-number', () => {
    const violations = validateProduct({ ...validProduct, price: 'cheap' });
    expect(violations.some(v => v.includes('price'))).toBe(true);
  });

  it('détecte un status invalide', () => {
    const violations = validateProduct({ ...validProduct, status: 'unknown' });
    expect(violations.some(v => v.includes('status'))).toBe(true);
  });

  it('détecte un objet null', () => {
    expect(validateProduct(null).length).toBeGreaterThan(0);
  });
});

describe('validatePaginatedProducts', () => {
  const valid = {
    data: [{ id: 'p1', name: 'Widget', price: 100, stock: 1, status: 'active' }],
    nextCursor: null,
    total: 1,
  };

  it('retourne [] pour une réponse paginée valide', () => {
    expect(validatePaginatedProducts(valid)).toEqual([]);
  });

  it('détecte data non-array', () => {
    const violations = validatePaginatedProducts({ ...valid, data: 'not-array' });
    expect(violations.some(v => v.includes('data'))).toBe(true);
  });

  it('détecte total manquant', () => {
    const { total, ...noTotal } = valid;
    const violations = validatePaginatedProducts(noTotal);
    expect(violations.some(v => v.includes('total'))).toBe(true);
  });

  it('propage les violations des produits individuels', () => {
    const withBadProduct = { ...valid, data: [{ id: 'p1' }] }; // name, price, stock, status manquants
    const violations = validatePaginatedProducts(withBadProduct);
    expect(violations.length).toBeGreaterThan(0);
  });
});

describe('validateCart', () => {
  const validCart = {
    id: 'cart-1',
    userId: 'user-1',
    items: [{ productId: 'p1', quantity: 2, unitPrice: 1000, lineTotal: 2000 }],
    total: 2000,
    updatedAt: '2024-01-15T10:00:00.000Z',
  };

  it('retourne [] pour un cart valide', () => {
    expect(validateCart(validCart)).toEqual([]);
  });

  it('détecte userId manquant', () => {
    const { userId, ...noUserId } = validCart;
    expect(validateCart(noUserId).some(v => v.includes('userId'))).toBe(true);
  });

  it('détecte items non-array', () => {
    expect(validateCart({ ...validCart, items: 'not-array' }).length).toBeGreaterThan(0);
  });
});

describe('assertContract', () => {
  it('ne lève pas d\'erreur si le contrat est respecté', () => {
    const data = { id: 'p1', name: 'W', price: 100, stock: 1, status: 'active' };
    expect(() => assertContract('Product', data, validateProduct)).not.toThrow();
  });

  it('lève ContractViolationError si le contrat est violé', () => {
    expect(() => assertContract('Product', {}, validateProduct)).toThrow(ContractViolationError);
  });

  it('la ContractViolationError contient le nom du contrat et les violations', () => {
    try {
      assertContract('Product', {}, validateProduct);
    } catch (e) {
      expect(e).toBeInstanceOf(ContractViolationError);
      expect((e as ContractViolationError).contract).toBe('Product');
      expect((e as ContractViolationError).violations.length).toBeGreaterThan(0);
    }
  });
});
