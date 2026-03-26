// saga.ts — Pattern Saga avec orchestration et compensation
// Gère les transactions longues réparties entre plusieurs services.

// Types fondamentaux

export interface SagaContext {
  orderId: string;
  customerId: string;
  amount: number;
  productIds: string[];
  [key: string]: unknown;
}

export interface SagaStepResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

export interface SagaStep {
  name: string;
  execute(ctx: SagaContext): Promise<SagaStepResult>;
  compensate(ctx: SagaContext): Promise<void>;
}

export interface ISagaStateRepository {
  save(sagaId: string, state: SagaState): Promise<void>;
  findById(sagaId: string): Promise<SagaState | null>;
}

export type SagaStatus = 'running' | 'completed' | 'compensating' | 'failed';

export interface SagaState {
  sagaId: string;
  status: SagaStatus;
  completedSteps: string[];
  context: SagaContext;
  error?: string;
}

// ---- À IMPLÉMENTER ----

export class OrderSaga {
  private readonly steps: SagaStep[];

  constructor(
    steps: SagaStep[],
    private readonly stateRepo: ISagaStateRepository,
  ) {
    this.steps = steps;
  }

  /**
   * Lance tous les steps dans l'ordre.
   * Si un step échoue :
   *   1. Mettre l'état en 'compensating'
   *   2. Exécuter compensate() de chaque step déjà complété (en ordre inverse)
   *   3. Mettre l'état en 'failed'
   * Si tout réussit, mettre l'état en 'completed'.
   *
   * Persistez l'état après chaque step (completedSteps) pour la reprise.
   */
  async execute(sagaId: string, ctx: SagaContext): Promise<SagaState> {
    // TODO:
    // 1. Initialiser SagaState { status: 'running', completedSteps: [], context: ctx }
    // 2. Sauvegarder via stateRepo.save()
    // 3. Pour chaque step dans this.steps :
    //    a. step.execute(ctx)
    //    b. Si success: ajouter à completedSteps, sauvegarder
    //    c. Si failure: appeler this.compensate(state, ctx), retourner état 'failed'
    // 4. Mettre status = 'completed', sauvegarder, retourner
    throw new Error('Not implemented');
  }

  /** Exécute les compensations en ordre inverse pour les steps déjà complétés. */
  private async compensate(state: SagaState, ctx: SagaContext): Promise<void> {
    // TODO:
    // Filtrer les steps dont le name est dans state.completedSteps
    // Itérer en ordre inverse (reverse)
    // Appeler step.compensate(ctx) pour chaque un (ignorer les erreurs)
    throw new Error('Not implemented');
  }
}
