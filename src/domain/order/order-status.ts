/**
 * Union type des statuts de commande.
 *
 * La FSM (Finite State Machine) sera implémentée au Module 02.
 * Pour l'instant, on définit juste les états possibles.
 *
 * Transitions valides :
 *   created → paid → shipped → delivered
 *   created → cancelled
 *   paid → cancelled
 *   shipped → (pas d'annulation possible)
 */
export type OrderStatus =
  | 'created'
  | 'paid'
  | 'shipped'
  | 'delivered'
  | 'cancelled';

/** Transitions valides depuis chaque état */
export const VALID_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  created: ['paid', 'cancelled'],
  paid: ['shipped', 'cancelled'],
  shipped: ['delivered'],
  delivered: [],
  cancelled: [],
};

/** Vérifie si une transition est valide */
export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return VALID_TRANSITIONS[from].includes(to);
}
