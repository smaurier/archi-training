// FamilyService.ts — L'EXISTANT, EN PRODUCTION. Deux domaines mélangés dans une seule
// classe : l'adhésion (membership — qui peut rejoindre une famille) et la facturation
// (billing — combien la famille paie par mois). Ticket : « ce sont deux domaines
// différents, séparés dans le code métier — extrais le domaine MEMBERSHIP dans son PROPRE
// module (MembershipDomain.ts, à créer), SANS changer l'API PUBLIQUE de FamilyService : les
// appelants existants (InviteFlow.ts, à la racine du lab, DONNÉ, ne se modifie pas) ne
// doivent RIEN changer chez eux. »
//
// Ce fichier COMPILE et MARCHE déjà. Ta mission n'est pas de corriger un bug : c'est de
// déplacer la règle "un membre de plus, sous conditions" hors de cette classe, dans
// `MembershipDomain.ts`, et de faire DÉLÉGUER `inviteMember` à ce nouveau module.
//
// Contrat de MembershipDomain.ts attendu par l'oracle (test/extraction.spec.ts) :
//
//   export const MAX_MEMBERS = 8;
//   export class MembershipDomain
//     constructor(memberEmails: string[])
//     canAcceptNewMember(): boolean
//     hasMember(email: string): boolean
//     addMember(email: string): void — lève une Error si plein ou email déjà présent.
//     get memberEmails(): string[]
//
// `MembershipDomain` doit être testable et UTILISABLE seule, sans FamilyService ni le moindre
// concept de facturation — c'est la preuve que l'extraction est réelle, pas cosmétique.
export interface FamilySeed {
  id: string;
  name: string;
  memberEmails: string[];
  billingTier: "free" | "plus" | "family";
}

const MONTHLY_PRICE_CENTS: Record<FamilySeed["billingTier"], number> = {
  free: 0,
  plus: 499,
  family: 999,
};

export class FamilyService {
  private readonly families = new Map<string, FamilySeed>();

  constructor(seed: FamilySeed[]) {
    for (const f of seed) this.families.set(f.id, f);
  }

  inviteMember(familyId: string, email: string): void {
    const family = this.families.get(familyId);
    if (!family) throw new Error(`Famille ${familyId} introuvable.`);
    if (family.memberEmails.includes(email)) throw new Error(`${email} est déjà membre.`);
    if (family.memberEmails.length >= 8) throw new Error(`${family.name} a déjà 8 membres.`);
    family.memberEmails.push(email);
  }

  monthlyPriceCents(familyId: string): number {
    const family = this.families.get(familyId);
    if (!family) throw new Error(`Famille ${familyId} introuvable.`);
    return MONTHLY_PRICE_CENTS[family.billingTier];
  }
}
