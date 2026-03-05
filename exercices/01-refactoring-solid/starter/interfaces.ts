// TODO: Définis les interfaces pour chaque responsabilité
// Chaque interface = un contrat que le OrderProcessor utilisera
//
// Tu dois créer :
// 1. OrderValidator     — validate(order: Order): void
// 2. PricingStrategy    — calculateDiscount(order: Order, subtotal: number): number
// 3. TaxCalculator      — calculateTax(country: string, amount: number): number
// 4. OrderRepository    — save(order: Order): Promise<void>
// 5. NotificationService — notifyOrderConfirmed(order: Order): Promise<void>

import type { Order } from './types.js';

// Exemple pour te lancer :
// export interface OrderValidator {
//   validate(order: Order): void;
// }

// À toi de jouer !
