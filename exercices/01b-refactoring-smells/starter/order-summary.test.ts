import { describe, it, expect } from 'vitest';
import { buildOrderSummary, type Item } from './order-summary.js';

// ─────────────────────────────────────────────────────────────
// FILET DE SÉCURITÉ (golden master + invariants).
// Ces tests décrivent le comportement ACTUEL. Ils doivent rester
// verts à CHAQUE étape de ton refactoring.
//
// ⚠️ SEULE zone que tu adaptes si tu changes la signature
// (ex. Introduce Parameter Object) : l'adaptateur `summary` ci-dessous.
// Tu ne touches JAMAIS aux assertions.
// ─────────────────────────────────────────────────────────────

type Order = {
  customerType: string;
  country: string;
  street: string;
  city: string;
  zip: string;
  items: Item[];
};

const summary = (o: Order): string =>
  buildOrderSummary(o.customerType, o.country, o.street, o.city, o.zip, o.items);

// extrait un montant en euros depuis une ligne "Label: ...€"
const amount = (out: string, label: string): number => {
  const line = out.split('\n').find((l) => l.startsWith(label));
  if (!line) throw new Error(`ligne introuvable: ${label}`);
  const m = line.match(/-?\d+(\.\d+)?(?=€)/);
  if (!m) throw new Error(`montant introuvable dans: ${line}`);
  return Number(m[0]);
};

const base = (over: Partial<Order> = {}): Order => ({
  customerType: 'standard',
  country: 'FR',
  street: '1 rue de la Paix',
  city: 'Lyon',
  zip: '69001',
  items: [{ sku: 'A', label: 'Widget', price: 1000, qty: 1, weight: 500 }],
  ...over,
});

describe('golden master — cas exacts (ne doivent jamais bouger)', () => {
  it('standard / FR / petit colis léger', () => {
    const out = summary(base());
    expect(amount(out, 'Sous-total')).toBeCloseTo(10, 2);
    expect(amount(out, 'Remise')).toBeCloseTo(0, 2);
    expect(amount(out, 'Frais de port')).toBeCloseTo(4.9, 2);
    expect(amount(out, 'TVA')).toBeCloseTo(2.98, 2);
    expect(amount(out, 'Total')).toBeCloseTo(17.88, 2);
  });

  it('vip / FR / franco de port au-dessus de 150€', () => {
    const out = summary(
      base({ customerType: 'vip', items: [{ sku: 'B', label: 'Console', price: 20000, qty: 1, weight: 100 }] }),
    );
    expect(amount(out, 'Sous-total')).toBeCloseTo(200, 2);
    expect(amount(out, 'Remise')).toBeCloseTo(-30, 2);
    expect(amount(out, 'Frais de port')).toBeCloseTo(0, 2);
    expect(amount(out, 'TVA')).toBeCloseTo(34, 2);
    expect(amount(out, 'Total')).toBeCloseTo(204, 2);
  });

  it('standard / hors-UE (US) / colis moyen : TVA 0', () => {
    const out = summary(
      base({ country: 'US', items: [{ sku: 'C', label: 'Livre', price: 1000, qty: 1, weight: 3000 }] }),
    );
    expect(amount(out, 'Sous-total')).toBeCloseTo(10, 2);
    expect(amount(out, 'Frais de port')).toBeCloseTo(39, 2);
    expect(amount(out, 'TVA')).toBeCloseTo(0, 2);
    expect(amount(out, 'Total')).toBeCloseTo(49, 2);
  });
});

describe('invariants métier (vrais avant ET après refactoring)', () => {
  it('total = après-remise + port + TVA', () => {
    const out = summary(base({ customerType: 'gold', country: 'DE' }));
    const sub = amount(out, 'Sous-total');
    const rem = amount(out, 'Remise'); // négatif
    const ship = amount(out, 'Frais de port');
    const vat = amount(out, 'TVA');
    const total = amount(out, 'Total');
    expect(total).toBeCloseTo(sub + rem + ship + vat, 5);
  });

  it('les paliers de remise respectent vip > gold > silver > standard', () => {
    const disc = (t: string) =>
      -amount(summary(base({ customerType: t, items: [{ sku: 'X', label: 'X', price: 10000, qty: 1, weight: 100 }] })), 'Remise');
    expect(disc('vip')).toBeGreaterThan(disc('gold'));
    expect(disc('gold')).toBeGreaterThan(disc('silver'));
    expect(disc('silver')).toBeGreaterThan(disc('standard'));
  });

  it('livraison offerte dès que le montant après remise dépasse 150€', () => {
    const out = summary(base({ items: [{ sku: 'Y', label: 'Y', price: 16000, qty: 1, weight: 5000 }] }));
    expect(amount(out, 'Frais de port')).toBe(0);
  });

  it('un type de client inconnu lève une erreur', () => {
    expect(() => summary(base({ customerType: 'diamond' }))).toThrow();
  });

  it('la première ligne contient toujours l’adresse de livraison', () => {
    const out = summary(base());
    expect(out.split('\n')[0]).toBe('Livraison: 1 rue de la Paix, 69001 Lyon (FR)');
  });
});
