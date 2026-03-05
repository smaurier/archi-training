import { describe, it, expect, vi } from 'vitest';
import { renderPrice, renderBadge, renderButton } from './atoms.js';
import { renderProductCard } from './molecules.js';
import { renderProductGrid } from './organisms.js';

describe('Atoms', () => {
  it('renderPrice formate en euros', () => {
    const result = renderPrice({ amount: 1999 });
    expect(result.text).toBe('19,99 €');
    expect(result.type).toBe('atom');
  });

  it('renderPrice avec devise custom', () => {
    const result = renderPrice({ amount: 1999, currency: 'USD' });
    expect(result.text).toBe('19,99 $');
  });

  it('renderBadge retourne le bon variant', () => {
    const result = renderBadge({ label: 'Promo', variant: 'success' });
    expect(result).toEqual({ text: 'Promo', variant: 'success', type: 'atom' });
  });

  it('renderButton a le bon état par défaut', () => {
    const result = renderButton({ label: 'Click', onClick: () => {} });
    expect(result.variant).toBe('primary');
    expect(result.disabled).toBe(false);
  });
});

describe('Molecules — ProductCard', () => {
  const baseProps = {
    id: 'p1',
    name: 'Widget',
    price: 2500,
    stock: 10,
    imageUrl: '/img/widget.jpg',
    onAddToCart: vi.fn(),
  };

  it('compose les atoms correctement', () => {
    const card = renderProductCard(baseProps);
    expect(card.type).toBe('molecule');
    expect(card.atoms.price).toEqual({ amount: 2500, currency: 'EUR' });
    expect(card.atoms.image).toEqual({ src: '/img/widget.jpg', alt: 'Widget' });
  });

  it('pas de badge si stock > 5', () => {
    const card = renderProductCard({ ...baseProps, stock: 10 });
    expect(card.atoms.badge).toBeNull();
  });

  it('badge warning si stock <= 5', () => {
    const card = renderProductCard({ ...baseProps, stock: 3 });
    expect(card.atoms.badge).toEqual({ label: 'Stock faible', variant: 'warning' });
  });

  it('badge danger + bouton disabled si stock === 0', () => {
    const card = renderProductCard({ ...baseProps, stock: 0 });
    expect(card.atoms.badge).toEqual({ label: 'Rupture', variant: 'danger' });
    expect(card.atoms.button.disabled).toBe(true);
  });

  it('bouton "Ajouter au panier" enabled si stock > 0', () => {
    const card = renderProductCard(baseProps);
    expect(card.atoms.button.label).toBe('Ajouter au panier');
    expect(card.atoms.button.disabled).toBe(false);
  });
});

describe('Organisms — ProductGrid', () => {
  it('grille vide → message', () => {
    const grid = renderProductGrid({ products: [] });
    expect(grid.emptyMessage).toBe('Aucun produit trouvé');
    expect(grid.cards).toHaveLength(0);
  });

  it('grille avec produits → pas de message', () => {
    const products = [
      { id: '1', name: 'A', price: 100, stock: 5, imageUrl: '/a.jpg', onAddToCart: vi.fn() },
    ];
    const grid = renderProductGrid({ products });
    expect(grid.emptyMessage).toBeNull();
    expect(grid.cards).toHaveLength(1);
    expect(grid.type).toBe('organism');
  });

  it('3 colonnes par défaut', () => {
    const grid = renderProductGrid({ products: [] });
    expect(grid.columns).toBe(3);
  });

  it('colonnes configurables', () => {
    const grid = renderProductGrid({ products: [], columns: 4 });
    expect(grid.columns).toBe(4);
  });
});
