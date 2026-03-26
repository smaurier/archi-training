// acl.test.ts — Tests pour l'Anti-Corruption Layer
// Lance: pnpm test:ex59 (depuis exercices/)

import { describe, it, expect } from 'vitest';
import { legacyProductToDomain, legacyOrderToDomain, domainProductToLegacy } from './acl.js';
import type { LegacyProduct, LegacyOrder, Product } from './acl.js';

const legacyProduct: LegacyProduct = {
  prod_id: 'P-001',
  prod_name: 'Widget Pro',
  prod_price_eur_cents: 1999,
  prod_stock_qty: 42,
  prod_status_code: 'A',
  prod_created_ts: '2024-01-15T10:30:00.000Z',
  prod_category_id: 7,
  prod_tags: 'hardware,electronics,sale',
};

describe('legacyProductToDomain', () => {
  it('traduit correctement les champs de base', () => {
    const product = legacyProductToDomain(legacyProduct);
    expect(product.id).toBe('P-001');
    expect(product.name).toBe('Widget Pro');
    expect(product.stockQuantity).toBe(42);
    expect(product.categoryId).toBe('7');
  });

  it('convertit les centimes en euros', () => {
    const product = legacyProductToDomain(legacyProduct);
    expect(product.priceEuros).toBeCloseTo(19.99, 2);
  });

  it("traduit le status 'A' → 'active'", () => {
    expect(legacyProductToDomain({ ...legacyProduct, prod_status_code: 'A' }).status).toBe('active');
  });

  it("traduit le status 'I' → 'inactive'", () => {
    expect(legacyProductToDomain({ ...legacyProduct, prod_status_code: 'I' }).status).toBe('inactive');
  });

  it("traduit le status 'D' → 'discontinued'", () => {
    expect(legacyProductToDomain({ ...legacyProduct, prod_status_code: 'D' }).status).toBe('discontinued');
  });

  it('convertit la date en objet Date', () => {
    const product = legacyProductToDomain(legacyProduct);
    expect(product.createdAt).toBeInstanceOf(Date);
    expect(product.createdAt.getFullYear()).toBe(2024);
  });

  it('splite les tags CSV en tableau', () => {
    const product = legacyProductToDomain(legacyProduct);
    expect(product.tags).toEqual(['hardware', 'electronics', 'sale']);
  });

  it('gère les tags vides', () => {
    const product = legacyProductToDomain({ ...legacyProduct, prod_tags: '' });
    expect(product.tags).toEqual([]);
  });
});

describe('legacyOrderToDomain', () => {
  const legacyOrder: LegacyOrder = {
    ord_ref: 'ORD-2024-001',
    ord_customer_code: 'CUST-42',
    ord_lines: [
      { line_prod_id: 'P-001', line_qty: 2, line_unit_price_cents: 1999 },
      { line_prod_id: 'P-002', line_qty: 1, line_unit_price_cents: 4999 },
    ],
    ord_total_cents: 8997,
    ord_status: 'OPEN',
    ord_date: '2024-06-01T12:00:00.000Z',
  };

  it('traduit les champs de base de la commande', () => {
    const order = legacyOrderToDomain(legacyOrder);
    expect(order.id).toBe('ORD-2024-001');
    expect(order.customerId).toBe('CUST-42');
    expect(order.totalEuros).toBeCloseTo(89.97, 2);
  });

  it("traduit les statuts : OPEN → 'open', CANCEL → 'cancelled'", () => {
    expect(legacyOrderToDomain({ ...legacyOrder, ord_status: 'OPEN' }).status).toBe('open');
    expect(legacyOrderToDomain({ ...legacyOrder, ord_status: 'CLOSED' }).status).toBe('closed');
    expect(legacyOrderToDomain({ ...legacyOrder, ord_status: 'CANCEL' }).status).toBe('cancelled');
  });

  it('traduit les lignes de commande', () => {
    const order = legacyOrderToDomain(legacyOrder);
    expect(order.lines).toHaveLength(2);
    expect(order.lines[0]).toEqual({
      productId: 'P-001',
      quantity: 2,
      unitPriceEuros: 19.99,
    });
  });
});

describe('domainProductToLegacy (round-trip)', () => {
  it('la traduction aller-retour est cohérente', () => {
    const domain = legacyProductToDomain(legacyProduct);
    const backToLegacy = domainProductToLegacy(domain);

    expect(backToLegacy.prod_id).toBe(legacyProduct.prod_id);
    expect(backToLegacy.prod_price_eur_cents).toBe(legacyProduct.prod_price_eur_cents);
    expect(backToLegacy.prod_status_code).toBe(legacyProduct.prod_status_code);
    expect(backToLegacy.prod_category_id).toBe(legacyProduct.prod_category_id);
    expect(backToLegacy.prod_tags).toBe(legacyProduct.prod_tags);
  });
});
