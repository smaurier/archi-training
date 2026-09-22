// Family.ts — SOLUTION DE RÉFÉRENCE (commentée). Ne l'ouvre pas avant ton GREEN.
export const MAX_MEMBERS = 8;

export class FamilyFullError extends Error {}
export class DuplicateMemberError extends Error {}

export class Family {
  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly memberEmails: string[] = [],
  ) {}

  canAcceptNewMember(): boolean {
    return this.memberEmails.length < MAX_MEMBERS;
  }

  hasMember(email: string): boolean {
    const cible = email.toLowerCase();
    return this.memberEmails.some((e) => e.toLowerCase() === cible);
  }

  addMember(email: string): void {
    if (this.hasMember(email)) throw new DuplicateMemberError(`${email} est déjà membre.`);
    if (!this.canAcceptNewMember()) throw new FamilyFullError(`${this.name} a déjà ${MAX_MEMBERS} membres.`);
    this.memberEmails.push(email);
  }
}
