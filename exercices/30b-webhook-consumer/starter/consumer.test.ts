// consumer.test.ts — Tests pour WebhookConsumer
// Lance: pnpm test:ex30b (depuis exercices/)

import { describe, it, expect, vi } from 'vitest';
import { WebhookConsumer } from './consumer.js';
import type { IIdempotencyStore, IEventHandler, WebhookEvent } from './consumer.js';
import { createHmac } from 'node:crypto';

const SECRET = 'test-secret';

const makeEvent = (overrides: Partial<WebhookEvent> = {}): { event: WebhookEvent; rawBody: string } => {
  const payload = { orderId: '42', amount: 1000 };
  const rawBody = JSON.stringify(payload);
  const timestamp = Date.now();
  const sig = createHmac('sha256', SECRET).update(`${timestamp}.${rawBody}`).digest('hex');

  return {
    event: {
      id: 'evt-1',
      type: 'payment.succeeded',
      payload,
      timestamp,
      signature: sig,
      ...overrides,
    },
    rawBody,
  };
};

const makeIdempotency = (alreadyProcessed = false): IIdempotencyStore => ({
  has: vi.fn().mockResolvedValue(alreadyProcessed),
  mark: vi.fn().mockResolvedValue(undefined),
});

const makeHandler = (supports = true): IEventHandler => ({
  supports: vi.fn().mockReturnValue(supports),
  handle: vi.fn().mockResolvedValue(undefined),
});

describe('WebhookConsumer.handle', () => {
  it('traite un event valide et retourne "processed"', async () => {
    const { event, rawBody } = makeEvent();
    const handler = makeHandler();
    const consumer = new WebhookConsumer(SECRET, makeIdempotency(false), [handler]);

    const result = await consumer.handle(event, rawBody);

    expect(result).toBe('processed');
    expect(handler.handle).toHaveBeenCalledWith(event);
  });

  it('retourne "invalid_signature" si la signature est incorrecte', async () => {
    const { event, rawBody } = makeEvent({ signature: 'bad-signature' });
    const consumer = new WebhookConsumer(SECRET, makeIdempotency(false), []);

    const result = await consumer.handle(event, rawBody);
    expect(result).toBe('invalid_signature');
  });

  it('retourne "expired" si le timestamp est trop ancien', async () => {
    const payload = { orderId: '1' };
    const rawBody = JSON.stringify(payload);
    const oldTimestamp = Date.now() - 10 * 60 * 1000; // 10 min ago
    const sig = createHmac('sha256', SECRET).update(`${oldTimestamp}.${rawBody}`).digest('hex');
    const event: WebhookEvent = {
      id: 'evt-old',
      type: 'payment.succeeded',
      payload,
      timestamp: oldTimestamp,
      signature: sig,
    };
    const consumer = new WebhookConsumer(SECRET, makeIdempotency(false), []);
    expect(await consumer.handle(event, rawBody)).toBe('expired');
  });

  it('retourne "duplicate" si l\'event a déjà été traité (idempotence)', async () => {
    const { event, rawBody } = makeEvent();
    const consumer = new WebhookConsumer(SECRET, makeIdempotency(true), [makeHandler()]);
    expect(await consumer.handle(event, rawBody)).toBe('duplicate');
  });

  it("retourne 'processed' même sans handler enregistré (event non géré → ignoré)", async () => {
    const { event, rawBody } = makeEvent();
    const handler = makeHandler(false); // supports = false
    const consumer = new WebhookConsumer(SECRET, makeIdempotency(false), [handler]);
    expect(await consumer.handle(event, rawBody)).toBe('processed');
    expect(handler.handle).not.toHaveBeenCalled();
  });

  it("marque l'event dans le store d'idempotence après traitement", async () => {
    const { event, rawBody } = makeEvent();
    const idempotency = makeIdempotency(false);
    const consumer = new WebhookConsumer(SECRET, idempotency, [makeHandler()]);
    await consumer.handle(event, rawBody);
    expect(idempotency.mark).toHaveBeenCalledWith('evt-1');
  });
});
