// Atomic Design — Niveau 3 : ORGANISMS
// Composition de molecules pour former une section de page.

import type { ProductCardProps, ProductCardOutput } from './molecules.js';

export interface ProductGridProps {
  products: ProductCardProps[];
  columns?: number;  // default 3
}

export interface ProductGridOutput {
  type: 'organism';
  columns: number;
  cards: ProductCardOutput[];
  emptyMessage: string | null;  // "Aucun produit trouvé" si products.length === 0
}

// TODO: Compose les molecules en une grille produit
export function renderProductGrid(props: ProductGridProps): ProductGridOutput {
  throw new Error('Not implemented');
}
