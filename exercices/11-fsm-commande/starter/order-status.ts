// Les états possibles d'une commande
export type OrderStatus = 'created' | 'paid' | 'shipped' | 'delivered' | 'cancelled';

// TODO: Définis la map des transitions valides
// Chaque état a une liste d'états vers lesquels il peut transitionner
//
// Diagramme :
//   created -> paid -> shipped -> delivered
//     |                  |
//     v                  v
//   cancelled         cancelled
//
// Exemple : VALID_TRANSITIONS.get('created') -> ['paid', 'cancelled']
export const VALID_TRANSITIONS = new Map<OrderStatus, OrderStatus[]>([
  // TODO: remplis les transitions valides
]);
