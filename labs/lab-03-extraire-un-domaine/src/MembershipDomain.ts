// MembershipDomain.ts — PAGE BLANCHE (le fichier à CRÉER, voir le contrat exact en tête de
// FamilyService.ts). N'existe pas encore dans l'existant — c'est le domaine que tu extrais.
export const MAX_MEMBERS = 8;

export class MembershipDomain {
  constructor(private readonly _memberEmails: string[]) {}

  get memberEmails(): string[] {
    throw new Error("MembershipDomain.memberEmails n'est pas encore implémenté");
  }

  canAcceptNewMember(): boolean {
    throw new Error("MembershipDomain.canAcceptNewMember n'est pas encore implémenté");
  }

  hasMember(_email: string): boolean {
    throw new Error("MembershipDomain.hasMember n'est pas encore implémenté");
  }

  addMember(_email: string): void {
    throw new Error("MembershipDomain.addMember n'est pas encore implémenté");
  }
}
