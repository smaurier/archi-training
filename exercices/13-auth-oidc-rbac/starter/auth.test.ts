// auth.test.ts — Tests pour AuthService (JWT + RBAC)
// Lance: pnpm test:ex13 (depuis exercices/)

import { describe, it, expect, vi } from 'vitest';
import { AuthService, UnauthorizedError, ForbiddenError } from './auth.js';
import type { ITokenVerifier, IPermissionRegistry, JwtPayload } from './auth.js';

const makePayload = (overrides: Partial<JwtPayload> = {}): JwtPayload => ({
  sub: 'user-1',
  email: 'alice@test.com',
  roles: ['customer'],
  tenantId: 'tenant-a',
  exp: Math.floor(Date.now() / 1000) + 3600,
  iat: Math.floor(Date.now() / 1000),
  ...overrides,
});

const makeVerifier = (payload: JwtPayload | null): ITokenVerifier => ({
  verify: vi.fn().mockReturnValue(payload),
});

const makePermissions = (required: string[] = ['customer']): IPermissionRegistry => ({
  getRequiredRoles: vi.fn().mockReturnValue(required),
});

describe('AuthService.authenticate', () => {
  it('retourne le payload pour un token Bearer valide', () => {
    const payload = makePayload();
    const svc = new AuthService(makeVerifier(payload), makePermissions());
    const result = svc.authenticate('Bearer valid.token.here');
    expect(result).toEqual(payload);
  });

  it('lève UnauthorizedError si le header est absent', () => {
    const svc = new AuthService(makeVerifier(null), makePermissions());
    expect(() => svc.authenticate(undefined)).toThrow(UnauthorizedError);
  });

  it("lève UnauthorizedError si le header ne commence pas par 'Bearer '", () => {
    const svc = new AuthService(makeVerifier(makePayload()), makePermissions());
    expect(() => svc.authenticate('Basic abc123')).toThrow(UnauthorizedError);
  });

  it('lève UnauthorizedError si le token est invalide (verifier retourne null)', () => {
    const svc = new AuthService(makeVerifier(null), makePermissions());
    expect(() => svc.authenticate('Bearer bad.token')).toThrow(UnauthorizedError);
  });

  it('lève UnauthorizedError si le token est expiré (exp dans le passé)', () => {
    const expiredPayload = makePayload({ exp: Math.floor(Date.now() / 1000) - 600 });
    const svc = new AuthService(makeVerifier(expiredPayload), makePermissions());
    expect(() => svc.authenticate('Bearer expired.token')).toThrow(UnauthorizedError);
  });
});

describe('AuthService.authorize', () => {
  it("ne lève pas d'erreur si l'utilisateur a un rôle requis", () => {
    const permissions = makePermissions(['customer', 'manager'] as any);
    const svc = new AuthService(makeVerifier(makePayload()), permissions);
    expect(() => svc.authorize(makePayload({ roles: ['customer'] }), 'catalog', 'read')).not.toThrow();
  });

  it('lève ForbiddenError si le rôle est insuffisant', () => {
    const permissions: IPermissionRegistry = { getRequiredRoles: vi.fn().mockReturnValue(['admin']) };
    const svc = new AuthService(makeVerifier(makePayload()), permissions);
    expect(() => svc.authorize(makePayload({ roles: ['customer'] }), 'admin', 'delete')).toThrow(ForbiddenError);
  });

  it("un admin a accès à tout", () => {
    const permissions: IPermissionRegistry = { getRequiredRoles: vi.fn().mockReturnValue(['admin']) };
    const svc = new AuthService(makeVerifier(makePayload()), permissions);
    expect(() => svc.authorize(makePayload({ roles: ['admin'] }), 'orders', 'delete')).not.toThrow();
  });
});

describe('AuthService.assertTenant', () => {
  it('ne lève pas d\'erreur si le tenant correspond', () => {
    const svc = new AuthService(makeVerifier(makePayload()), makePermissions());
    expect(() => svc.assertTenant(makePayload({ tenantId: 'tenant-a' }), 'tenant-a')).not.toThrow();
  });

  it('lève une erreur si le tenant ne correspond pas', () => {
    const svc = new AuthService(makeVerifier(makePayload()), makePermissions());
    expect(() => svc.assertTenant(makePayload({ tenantId: 'tenant-a' }), 'tenant-b')).toThrow();
  });

  it("un admin peut accéder à n'importe quel tenant (cross-tenant)", () => {
    const svc = new AuthService(makeVerifier(makePayload()), makePermissions());
    expect(() => svc.assertTenant(makePayload({ tenantId: 'tenant-a', roles: ['admin'] }), 'tenant-b')).not.toThrow();
  });
});
