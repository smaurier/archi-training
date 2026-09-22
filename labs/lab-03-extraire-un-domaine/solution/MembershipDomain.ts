// MembershipDomain.ts — SOLUTION DE RÉFÉRENCE (commentée). Ne l'ouvre pas avant ton GREEN.
export const MAX_MEMBERS = 8;

export class MembershipDomain {
  constructor(private readonly _memberEmails: string[]) {}

  get memberEmails(): string[] {
    return this._memberEmails;
  }

  canAcceptNewMember(): boolean {
    return this._memberEmails.length < MAX_MEMBERS;
  }

  hasMember(email: string): boolean {
    return this._memberEmails.includes(email);
  }

  addMember(email: string): void {
    if (this.hasMember(email)) throw new Error(`${email} est déjà membre.`);
    if (!this.canAcceptNewMember()) throw new Error(`La famille a déjà ${MAX_MEMBERS} membres.`);
    this._memberEmails.push(email);
  }
}
