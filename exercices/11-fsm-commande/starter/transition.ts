import type { OrderStatus } from './order-status.js';

// Chaque transition est enregistrée dans un audit trail immutable
export interface Transition {
  from: OrderStatus;
  to: OrderStatus;
  at: Date;
  by: string;      // userId
  reason?: string;  // obligatoire pour cancelled
}
