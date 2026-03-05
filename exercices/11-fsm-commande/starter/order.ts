import type { OrderStatus } from './order-status.js';
import type { Transition } from './transition.js';

// Les side effects sont injectés — pas de console.log ni d'appel direct
export interface OrderSideEffects {
  onPaid(orderId: string): Promise<void>;           // décrémenter stock
  onShipped(orderId: string): Promise<void>;        // envoyer notification tracking
  onDelivered(orderId: string): Promise<void>;      // envoyer email satisfaction
  onCancelled(orderId: string): Promise<void>;      // rembourser + restaurer stock
}

export class Order {
  private _status: OrderStatus = 'created';
  private _transitions: Transition[] = [];

  constructor(
    public readonly id: string,
    private readonly sideEffects: OrderSideEffects,
  ) {}

  get status(): OrderStatus {
    return this._status;
  }

  get transitions(): readonly Transition[] {
    return [...this._transitions];
  }

  canTransitionTo(target: OrderStatus): boolean {
    // TODO: vérifie si la transition est valide en utilisant VALID_TRANSITIONS
    throw new Error('Not implemented');
  }

  async transitionTo(target: OrderStatus, userId: string, reason?: string): Promise<void> {
    // TODO:
    // 1. Vérifier que la transition est valide (sinon throw)
    // 2. Si target === 'cancelled', reason est obligatoire (sinon throw)
    // 3. Enregistrer la transition dans l'audit trail
    // 4. Mettre à jour le status
    // 5. Déclencher le side effect correspondant
    throw new Error('Not implemented');
  }
}
