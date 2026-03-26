// outbox.test.ts — Tests pour OutboxService
// Lance: pnpm test:ex35 (depuis exercices/)

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OutboxService } from './outbox.js';
import type { IOutboxRepository, IMessageBroker, OutboxEntry, ITransaction, DomainEvent } from './outbox.js';

const makeEvent = (): DomainEvent => ({
  type: 'order.created',
  payload: { orderId: '42' },
  aggregateId: 'order-42',
});

const makeTrx = (): ITransaction => ({ id: 'trx-1' });

const makeRepo = (pendingEntries: OutboxEntry[] = []): IOutboxRepository => ({
  saveInTransaction: vi.fn().mockResolvedValue(undefined),
  findPending: vi.fn().mockResolvedValue(pendingEntries),
  updateStatus: vi.fn().mockResolvedValue(undefined),
});

const makeBroker = (shouldFail = false): IMessageBroker => ({
  publish: shouldFail
    ? vi.fn().mockRejectedValue(new Error('Broker down'))
    : vi.fn().mockResolvedValue(undefined),
});

describe('OutboxService.recordEvent', () => {
  it('sauvegarde l\'event dans la transaction avec status "pending"', async () => {
    const repo = makeRepo();
    const svc = new OutboxService(repo, makeBroker());

    await svc.recordEvent(makeTrx(), makeEvent());

    expect(repo.saveInTransaction).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'trx-1' }),
      expect.objectContaining({
        event: makeEvent(),
        status: 'pending',
        attempts: 0,
      }),
    );
  });

  it("n'appelle PAS broker.publish au moment de recordEvent", async () => {
    const broker = makeBroker();
    const svc = new OutboxService(makeRepo(), broker);

    await svc.recordEvent(makeTrx(), makeEvent());

    expect(broker.publish).not.toHaveBeenCalled();
  });
});

describe('OutboxService.publishPending', () => {
  const makePending = (attempts = 0): OutboxEntry => ({
    id: 'entry-1',
    event: makeEvent(),
    status: 'pending',
    createdAt: Date.now(),
    attempts,
  });

  it('publie les events pending via le broker', async () => {
    const broker = makeBroker();
    const repo = makeRepo([makePending()]);
    const svc = new OutboxService(repo, broker);

    await svc.publishPending();

    expect(broker.publish).toHaveBeenCalledWith('order.created', { orderId: '42' });
  });

  it('marque les events comme "published" après succès', async () => {
    const repo = makeRepo([makePending()]);
    const svc = new OutboxService(repo, makeBroker());

    await svc.publishPending();

    expect(repo.updateStatus).toHaveBeenCalledWith('entry-1', 'published', undefined);
  });

  it('marque les events comme "failed" après erreur du broker', async () => {
    const repo = makeRepo([makePending()]);
    const svc = new OutboxService(repo, makeBroker(true));

    await svc.publishPending();

    expect(repo.updateStatus).toHaveBeenCalledWith(
      'entry-1',
      'failed',
      expect.stringContaining('Broker down'),
    );
  });

  it("ne publie pas les events dépassant MAX_ATTEMPTS", async () => {
    const broker = makeBroker();
    // findPending doit retourner [] si maxAttempts est respecté (le repo filtre)
    const repo = makeRepo([]); // Déjà filtré dans le repo
    const svc = new OutboxService(repo, broker);

    await svc.publishPending();

    expect(broker.publish).not.toHaveBeenCalled();
  });

  it('continue les autres events si l\'un échoue', async () => {
    const entry1: OutboxEntry = { id: 'e1', event: { type: 'a', payload: {}, aggregateId: '1' }, status: 'pending', createdAt: Date.now(), attempts: 0 };
    const entry2: OutboxEntry = { id: 'e2', event: { type: 'b', payload: {}, aggregateId: '2' }, status: 'pending', createdAt: Date.now(), attempts: 0 };
    const broker: IMessageBroker = {
      publish: vi.fn().mockRejectedValueOnce(new Error('fail')).mockResolvedValueOnce(undefined),
    };
    const repo = makeRepo([entry1, entry2]);
    const svc = new OutboxService(repo, broker);

    await svc.publishPending();

    expect(broker.publish).toHaveBeenCalledTimes(2);
    expect(repo.updateStatus).toHaveBeenCalledWith('e2', 'published', undefined);
  });
});
