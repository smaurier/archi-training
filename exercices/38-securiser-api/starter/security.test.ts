// security.test.ts — Tests pour RateLimiter, InputSanitizer, IDORGuard
// Lance: pnpm test:ex38 (depuis exercices/)

import { describe, it, expect, vi } from 'vitest';
import { RateLimiter, InputSanitizer, IDORGuard, ForbiddenError } from './security.js';

describe('RateLimiter', () => {
  it('autorise les requêtes sous la limite', () => {
    const limiter = new RateLimiter({ windowMs: 60_000, maxRequests: 5 });
    expect(limiter.isAllowed('user-1')).toBe(true);
    expect(limiter.isAllowed('user-1')).toBe(true);
  });

  it('bloque après avoir atteint la limite', () => {
    const limiter = new RateLimiter({ windowMs: 60_000, maxRequests: 3 });
    limiter.isAllowed('user-1');
    limiter.isAllowed('user-1');
    limiter.isAllowed('user-1');
    expect(limiter.isAllowed('user-1')).toBe(false);
  });

  it('isole les compteurs par clientId', () => {
    const limiter = new RateLimiter({ windowMs: 60_000, maxRequests: 2 });
    limiter.isAllowed('user-1');
    limiter.isAllowed('user-1');
    // user-1 est bloqué
    expect(limiter.isAllowed('user-1')).toBe(false);
    // user-2 n'est pas affecté
    expect(limiter.isAllowed('user-2')).toBe(true);
  });

  it('reset le compteur après la fenêtre de temps', () => {
    const limiter = new RateLimiter({ windowMs: 1000, maxRequests: 2 });
    const now = Date.now();
    limiter.isAllowed('user-1', now);
    limiter.isAllowed('user-1', now);
    expect(limiter.isAllowed('user-1', now)).toBe(false);
    // Avancer de 2 secondes
    expect(limiter.isAllowed('user-1', now + 2000)).toBe(true);
  });

  it('retourne le nombre de requêtes restantes', () => {
    const limiter = new RateLimiter({ windowMs: 60_000, maxRequests: 5 });
    limiter.isAllowed('user-1');
    limiter.isAllowed('user-1');
    expect(limiter.remaining('user-1')).toBe(3);
  });
});

describe('InputSanitizer', () => {
  const sanitizer = new InputSanitizer();

  it("détecte une injection SQL avec ' et --", () => {
    expect(sanitizer.containsSqlInjection("'; DROP TABLE users --")).toBe(true);
  });

  it('détecte UNION SELECT', () => {
    expect(sanitizer.containsSqlInjection("' UNION SELECT * FROM users")).toBe(true);
  });

  it("n'alerte pas sur un input normal", () => {
    expect(sanitizer.containsSqlInjection("Widget Pro 2024")).toBe(false);
  });

  it('échappe les caractères HTML dangereux', () => {
    const html = sanitizer.escapeHtml('<script>alert("XSS")</script>');
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;');
    expect(html).toContain('&gt;');
  });

  it('échappe les guillemets', () => {
    const html = sanitizer.escapeHtml('"quoted" & \'single\'');
    expect(html).not.toContain('"');
    expect(html).toContain('&amp;');
  });
});

describe('IDORGuard', () => {
  const guard = new IDORGuard();

  it("ne lève pas d'erreur si l'utilisateur est propriétaire", () => {
    const resource = { ownerId: 'user-1', id: 'order-1' };
    expect(() => guard.assertOwnership(resource, 'user-1')).not.toThrow();
  });

  it('lève ForbiddenError si l\'utilisateur n\'est pas propriétaire', () => {
    const resource = { ownerId: 'user-1', id: 'order-1' };
    expect(() => guard.assertOwnership(resource, 'user-2')).toThrow(ForbiddenError);
  });

  it("un admin peut accéder à la ressource de n'importe quel utilisateur", () => {
    const resource = { ownerId: 'user-1', id: 'order-1' };
    expect(() => guard.assertOwnership(resource, 'admin-user', ['admin'])).not.toThrow();
  });
});
