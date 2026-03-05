// Atomic Design — Niveau 2 : MOLECULES
// Composition d'atoms pour former un composant avec un sens métier.

import type { PriceProps, BadgeProps, ButtonProps } from './atoms.js';

export interface ProductCardProps {
  id: string;
  name: string;
  price: number;         // centimes
  stock: number;
  imageUrl: string;
  onAddToCart: (id: string) => void;
}

export interface ProductCardOutput {
  type: 'molecule';
  name: string;
  atoms: {
    price: PriceProps;
    badge: BadgeProps | null;   // "Rupture" si stock === 0
    button: ButtonProps;
    image: { src: string; alt: string };
  };
}

// TODO: Compose les atoms en une carte produit
export function renderProductCard(props: ProductCardProps): ProductCardOutput {
  // Logique :
  // - price: afficher le prix du produit
  // - badge: si stock === 0 → badge "Rupture" (danger), si stock <= 5 → "Stock faible" (warning), sinon null
  // - button: "Ajouter au panier" (primary), disabled si stock === 0
  // - image: l'image du produit avec alt = nom du produit
  throw new Error('Not implemented');
}
