// FamilyService.ts — SOLUTION DE RÉFÉRENCE (commentée). Ne l'ouvre pas avant ton GREEN.
// La règle d'adhésion est désormais dans MembershipDomain — FamilyService délègue, il ne
// connaît plus le détail (le "8", la comparaison d'email) : c'est le point de l'extraction.
import { MembershipDomain } from "./MembershipDomain";

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

interface FamilyRecord extends FamilySeed {
  membership: MembershipDomain;
}

export class FamilyService {
  private readonly families = new Map<string, FamilyRecord>();

  constructor(seed: FamilySeed[]) {
    for (const f of seed) {
      this.families.set(f.id, { ...f, membership: new MembershipDomain(f.memberEmails) });
    }
  }

  inviteMember(familyId: string, email: string): void {
    const family = this.families.get(familyId);
    if (!family) throw new Error(`Famille ${familyId} introuvable.`);
    family.membership.addMember(email);
  }

  monthlyPriceCents(familyId: string): number {
    const family = this.families.get(familyId);
    if (!family) throw new Error(`Famille ${familyId} introuvable.`);
    return MONTHLY_PRICE_CENTS[family.billingTier];
  }
}
