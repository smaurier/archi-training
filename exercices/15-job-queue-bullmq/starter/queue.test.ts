// queue.test.ts — Tests pour JobQueue
// Lance: pnpm test:ex15 (depuis exercices/)

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { JobQueue } from './queue.js';
import type { IJobStorage, Job } from './queue.js';

const makeStorage = (waiting: Job[] = []): IJobStorage => ({
  save: vi.fn().mockResolvedValue(undefined),
  findWaiting: vi.fn().mockResolvedValue(waiting),
  update: vi.fn().mockResolvedValue(undefined),
  findDead: vi.fn().mockResolvedValue([]),
});

describe('JobQueue.enqueue', () => {
  it('crée un job avec les valeurs par défaut', async () => {
    const storage = makeStorage();
    const q = new JobQueue(storage);

    const job = await q.enqueue('email:send', { to: 'test@test.com' });

    expect(job.type).toBe('email:send');
    expect(job.payload).toEqual({ to: 'test@test.com' });
    expect(job.status).toBe('waiting');
    expect(job.attempts).toBe(0);
    expect(job.maxAttempts).toBe(JobQueue.DEFAULT_MAX_ATTEMPTS);
    expect(typeof job.id).toBe('string');
  });

  it('applique le délai initial si delayMs est fourni', async () => {
    const storage = makeStorage();
    const q = new JobQueue(storage);
    const before = Date.now();

    const job = await q.enqueue('report:gen', {}, { delayMs: 5000 });

    expect(job.scheduledAt).toBeGreaterThanOrEqual(before + 5000);
  });

  it('sauvegarde le job dans le storage', async () => {
    const storage = makeStorage();
    const q = new JobQueue(storage);

    await q.enqueue('test', {});

    expect(storage.save).toHaveBeenCalledWith(expect.objectContaining({ type: 'test' }));
  });
});

describe('JobQueue.processNext', () => {
  it('appelle le handler enregistré pour chaque job', async () => {
    const pendingJob: Job = {
      id: 'j1', type: 'email:send', payload: { to: 'x' },
      attempts: 0, maxAttempts: 3, status: 'waiting',
      createdAt: Date.now(), scheduledAt: Date.now() - 1,
    };
    const storage = makeStorage([pendingJob]);
    const handler = vi.fn().mockResolvedValue(undefined);
    const q = new JobQueue(storage);
    q.registerHandler('email:send', handler);

    await q.processNext();

    expect(handler).toHaveBeenCalledWith(expect.objectContaining({ id: 'j1' }));
    expect(storage.update).toHaveBeenCalledWith('j1', expect.objectContaining({ status: 'completed' }));
  });

  it('met le job en "waiting" avec délai exponentiel après une erreur (si attempts < maxAttempts)', async () => {
    const job: Job = {
      id: 'j2', type: 'process', payload: {},
      attempts: 0, maxAttempts: 3, status: 'waiting',
      createdAt: Date.now(), scheduledAt: Date.now() - 1,
    };
    const storage = makeStorage([job]);
    const q = new JobQueue(storage);
    q.registerHandler('process', vi.fn().mockRejectedValue(new Error('fail')));

    await q.processNext();

    expect(storage.update).toHaveBeenCalledWith(
      'j2',
      expect.objectContaining({ status: 'waiting', attempts: 1 }),
    );
  });

  it('met le job en "dead" après maxAttempts erreurs', async () => {
    const job: Job = {
      id: 'j3', type: 'process', payload: {},
      attempts: 2, maxAttempts: 3, status: 'waiting', // attempts + 1 after this = 3 = maxAttempts
      createdAt: Date.now(), scheduledAt: Date.now() - 1,
    };
    const storage = makeStorage([job]);
    const q = new JobQueue(storage);
    q.registerHandler('process', vi.fn().mockRejectedValue(new Error('final fail')));

    await q.processNext();

    expect(storage.update).toHaveBeenCalledWith('j3', expect.objectContaining({ status: 'dead' }));
  });

  it('met le job en "dead" immédiatement si aucun handler', async () => {
    const job: Job = {
      id: 'j4', type: 'unknown', payload: {},
      attempts: 0, maxAttempts: 3, status: 'waiting',
      createdAt: Date.now(), scheduledAt: Date.now() - 1,
    };
    const storage = makeStorage([job]);
    const q = new JobQueue(storage);

    await q.processNext();

    expect(storage.update).toHaveBeenCalledWith(
      'j4',
      expect.objectContaining({ status: 'dead' }),
    );
  });
});

describe('JobQueue.getDeadJobs', () => {
  it('délègue au storage.findDead()', async () => {
    const deadJob: Job = {
      id: 'dead-1', type: 't', payload: {},
      attempts: 3, maxAttempts: 3, status: 'dead',
      createdAt: 0, scheduledAt: 0,
    };
    const storage: IJobStorage = {
      save: vi.fn(),
      findWaiting: vi.fn(),
      update: vi.fn(),
      findDead: vi.fn().mockResolvedValue([deadJob]),
    };
    const q = new JobQueue(storage);

    const dead = await q.getDeadJobs();

    expect(dead).toHaveLength(1);
    expect(dead[0].id).toBe('dead-1');
  });
});
