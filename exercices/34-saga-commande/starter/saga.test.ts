// saga.test.ts — Tests pour l'orchestrateur Saga
// Lance: pnpm test:ex34 (depuis exercices/)

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OrderSaga } from './saga.js';
import type { SagaContext, SagaStep, ISagaStateRepository } from './saga.js';

const makeCtx = (): SagaContext => ({
  orderId: 'order-1',
  customerId: 'cust-1',
  amount: 100,
  productIds: ['prod-a'],
});

const makeStep = (name: string, succeeds = true): SagaStep => ({
  name,
  execute: vi.fn().mockResolvedValue({ success: succeeds, error: succeeds ? undefined : 'Service error' }),
  compensate: vi.fn().mockResolvedValue(undefined),
});

const makeRepo = (): ISagaStateRepository => ({
  save: vi.fn().mockResolvedValue(undefined),
  findById: vi.fn().mockResolvedValue(null),
});

describe('OrderSaga', () => {
  it('exécute tous les steps dans l\'ordre et retourne "completed"', async () => {
    const steps = [makeStep('payment'), makeStep('inventory'), makeStep('shipping')];
    const repo = makeRepo();
    const saga = new OrderSaga(steps, repo);

    const state = await saga.execute('saga-1', makeCtx());

    expect(state.status).toBe('completed');
    expect(state.completedSteps).toEqual(['payment', 'inventory', 'shipping']);
    expect(steps[0].execute).toHaveBeenCalled();
    expect(steps[1].execute).toHaveBeenCalled();
    expect(steps[2].execute).toHaveBeenCalled();
  });

  it('compense en ordre inverse si le 2ème step échoue', async () => {
    const steps = [
      makeStep('payment', true),
      makeStep('inventory', false),
      makeStep('shipping', true),
    ];
    const repo = makeRepo();
    const saga = new OrderSaga(steps, repo);

    const state = await saga.execute('saga-2', makeCtx());

    expect(state.status).toBe('failed');
    expect(steps[0].compensate).toHaveBeenCalled();
    // Le step 1 a échoué → pas de compensation du step 1
    expect(steps[1].compensate).not.toHaveBeenCalled();
    // Le step 2 n'a jamais été exécuté
    expect(steps[2].execute).not.toHaveBeenCalled();
  });

  it('compense les 2 premiers steps si le 3ème échoue', async () => {
    const steps = [
      makeStep('payment', true),
      makeStep('inventory', true),
      makeStep('shipping', false),
    ];
    const repo = makeRepo();
    const saga = new OrderSaga(steps, repo);

    const state = await saga.execute('saga-3', makeCtx());

    expect(state.status).toBe('failed');
    // Compensation dans l'ordre inverse
    const compensateOrder = steps
      .filter(s => s.compensate.mock.calls.length > 0)
      .map(s => s.name);
    expect(compensateOrder).toEqual(['shipping', 'inventory', 'payment'].filter(n => n !== 'shipping') );
    expect(steps[0].compensate).toHaveBeenCalled();
    expect(steps[1].compensate).toHaveBeenCalled();
  });

  it("persiste l'état après chaque step", async () => {
    const steps = [makeStep('payment'), makeStep('inventory')];
    const repo = makeRepo();
    const saga = new OrderSaga(steps, repo);

    await saga.execute('saga-4', makeCtx());

    // Au moins : init + après step 1 + après step 2 + completed = 4 sauvegardes
    expect((repo.save as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThanOrEqual(4);
  });

  it('ne lance pas les steps suivants après un échec', async () => {
    const steps = [makeStep('payment', false), makeStep('inventory'), makeStep('shipping')];
    const repo = makeRepo();
    const saga = new OrderSaga(steps, repo);

    await saga.execute('saga-5', makeCtx());

    expect(steps[1].execute).not.toHaveBeenCalled();
    expect(steps[2].execute).not.toHaveBeenCalled();
  });
});
