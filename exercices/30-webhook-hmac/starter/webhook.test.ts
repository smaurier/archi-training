// webhook.test.ts — Tests pour WebhookService
// Lance: pnpm test:ex30 (depuis exercices/)

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WebhookService } from './webhook.js';
import type { IWebhookRepository, IHttpClient, WebhookSubscription } from './webhook.js';

const makeSub = (overrides: Partial<WebhookSubscription> = {}): WebhookSubscription => ({
  id: 'sub-1',
  url: 'https://example.com/webhook',
  secret: 'super-secret-key',
  events: ['order.created'],
  active: true,
  ...overrides,
});

const makeRepo = (subs: WebhookSubscription[] = [makeSub()]): IWebhookRepository => ({
  findByEvent: vi.fn().mockResolvedValue(subs),
  saveDelivery: vi.fn().mockResolvedValue(undefined),
  updateDelivery: vi.fn().mockResolvedValue(undefined),
});

const makeHttp = (status = 200): IHttpClient => ({
  post: vi.fn().mockResolvedValue({ status }),
});

describe('WebhookService.sign', () => {
  it('retourne un hex string non vide', () => {
    const svc = new WebhookService(makeRepo(), makeHttp());
    const sig = svc.sign('secret', 1700000000000, '{"order":"1"}');
    expect(typeof sig).toBe('string');
    expect(sig.length).toBeGreaterThan(0);
    expect(sig).toMatch(/^[a-f0-9]+$/); // hex
  });

  it('retourne la même signature pour les mêmes entrées', () => {
    const svc = new WebhookService(makeRepo(), makeHttp());
    const ts = Date.now();
    const body = '{"id":"123"}';
    expect(svc.sign('key', ts, body)).toBe(svc.sign('key', ts, body));
  });

  it('retourne des signatures différentes avec des secrets différents', () => {
    const svc = new WebhookService(makeRepo(), makeHttp());
    const ts = Date.now();
    const body = '{"id":"123"}';
    expect(svc.sign('key1', ts, body)).not.toBe(svc.sign('key2', ts, body));
  });
});

describe('WebhookService.verify', () => {
  it('retourne true pour une signature valide et récente', () => {
    const svc = new WebhookService(makeRepo(), makeHttp());
    const secret = 'super-secret';
    const ts = Date.now();
    const body = '{"event":"test"}';
    const sig = svc.sign(secret, ts, body);

    expect(svc.verify(secret, ts, body, sig)).toBe(true);
  });

  it('retourne false pour une signature incorrecte', () => {
    const svc = new WebhookService(makeRepo(), makeHttp());
    const ts = Date.now();
    expect(svc.verify('secret', ts, '{"id":"1"}', 'bad_signature')).toBe(false);
  });

  it('retourne false si timestamp > 5 minutes dans le passé (replay attack)', () => {
    const svc = new WebhookService(makeRepo(), makeHttp());
    const oldTs = Date.now() - 6 * 60 * 1000; // 6 minutes ago
    const body = '{"id":"1"}';
    const sig = svc.sign('secret', oldTs, body);
    expect(svc.verify('secret', oldTs, body, sig)).toBe(false);
  });
});

describe('WebhookService.dispatch', () => {
  it('envoie le webhook à tous les subscribers actifs', async () => {
    const sub = makeSub();
    const repo = makeRepo([sub]);
    const http = makeHttp(200);
    const svc = new WebhookService(repo, http);

    await svc.dispatch('order.created', { orderId: '42' });

    expect(http.post).toHaveBeenCalledWith(
      sub.url,
      expect.any(String),
      expect.objectContaining({
        'X-Webhook-Event': 'order.created',
        'X-Webhook-Signature': expect.stringMatching(/^[a-f0-9]+$/),
        'X-Webhook-Timestamp': expect.any(String),
      }),
    );
  });

  it('sauvegarde la delivery avant envoi', async () => {
    const repo = makeRepo();
    const svc = new WebhookService(repo, makeHttp());

    await svc.dispatch('order.created', { id: '1' });

    expect(repo.saveDelivery).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'pending', event: 'order.created' }),
    );
  });

  it('marque la delivery comme "success" si HTTP 200', async () => {
    const repo = makeRepo();
    const svc = new WebhookService(repo, makeHttp(200));

    await svc.dispatch('order.created', { id: '1' });

    expect(repo.updateDelivery).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ status: 'success', attempts: 1 }),
    );
  });

  it('marque la delivery comme "failed" si HTTP != 2xx', async () => {
    const repo = makeRepo();
    const svc = new WebhookService(repo, makeHttp(500));

    await svc.dispatch('order.created', { id: '1' });

    expect(repo.updateDelivery).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ status: 'failed' }),
    );
  });

  it("n'envoie rien si aucun subscriber pour cet event", async () => {
    const repo = makeRepo([]);
    const http = makeHttp();
    const svc = new WebhookService(repo, http);

    await svc.dispatch('order.created', { id: '1' });

    expect(http.post).not.toHaveBeenCalled();
  });
});
