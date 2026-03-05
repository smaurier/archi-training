// Atomic Design — Niveau 1 : ATOMS
// Les plus petites unités, réutilisables partout.
// Pas de logique métier, juste du rendu.

// NOTE: On utilise des objets simples (pas de JSX) pour rester testable sans React.
// En vrai projet, ce seraient des composants React.

export interface PriceProps {
  amount: number;       // en centimes
  currency?: string;    // default 'EUR'
}

export interface BadgeProps {
  label: string;
  variant: 'success' | 'warning' | 'danger' | 'info';
}

export interface ProductImageProps {
  src: string;
  alt: string;
  width?: number;
  height?: number;
}

export interface ButtonProps {
  label: string;
  onClick: () => void;
  variant?: 'primary' | 'secondary' | 'ghost';
  disabled?: boolean;
}

// TODO: Implémente les fonctions de rendu pour chaque atom
// Chaque fonction prend les props et retourne un objet décrivant le rendu

export function renderPrice(props: PriceProps): { text: string; type: 'atom' } {
  // TODO: Formate le prix (ex: 1999 centimes → "19,99 €")
  throw new Error('Not implemented');
}

export function renderBadge(props: BadgeProps): { text: string; variant: string; type: 'atom' } {
  throw new Error('Not implemented');
}

export function renderButton(props: ButtonProps): { label: string; variant: string; disabled: boolean; type: 'atom' } {
  throw new Error('Not implemented');
}
