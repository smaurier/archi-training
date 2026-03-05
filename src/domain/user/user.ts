import { Email } from '../shared/email';

/**
 * Entité User — utilisateur du système.
 *
 * Stub pour le Module 00. Sera enrichi aux modules Auth (03) et OIDC (03).
 */

export type UserRole = 'customer' | 'admin' | 'seller';

export class User {
  readonly id: string;
  private _email: Email;
  private _name: string;
  private _role: UserRole;

  constructor(params: {
    id?: string;
    email: Email;
    name: string;
    role?: UserRole;
  }) {
    if (!params.name || params.name.trim().length === 0) {
      throw new Error('User name is required');
    }

    this.id = params.id ?? crypto.randomUUID();
    this._email = params.email;
    this._name = params.name.trim();
    this._role = params.role ?? 'customer';
  }

  get email(): Email { return this._email; }
  get name(): string { return this._name; }
  get role(): UserRole { return this._role; }

  isAdmin(): boolean {
    return this._role === 'admin';
  }

  canManageProducts(): boolean {
    return this._role === 'admin' || this._role === 'seller';
  }
}
