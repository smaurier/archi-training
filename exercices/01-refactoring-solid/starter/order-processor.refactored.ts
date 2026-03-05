// TODO: Réécris le OrderProcessor en respectant SOLID
//
// Contraintes :
// - Zero `new` dans cette classe (tout est injecté via le constructeur)
// - Zero `any`
// - Zero import de librairie concrète
// - La classe ne fait QUE de l'orchestration
//
// Indices :
// 1. Le constructeur reçoit 5 interfaces (validator, pricing, tax, repository, notification)
// 2. processOrder() appelle les 5 dans l'ordre
// 3. Le calcul : subtotal = sum(price * quantity), discount, tax, total = subtotal - discount + tax

import type { Order } from './types.js';
// import tes interfaces ici

export class OrderProcessor {
  // TODO: constructeur avec injection de dépendances

  async processOrder(order: Order): Promise<void> {
    // TODO: orchestrer les 5 étapes
    throw new Error('Not implemented');
  }
}
