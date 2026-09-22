// InviteFlow.ts — CONSOMMATEUR EXISTANT, DONNÉ. Ne se modifie pas. Un appelant réel de
// FamilyService, tel quel — la preuve que ton extraction ne casse rien est qu'il continue
// de fonctionner SANS qu'on touche une seule ligne ici.
import type { FamilyService } from "@lab/FamilyService";

export function runInviteFlow(service: FamilyService, familyId: string, email: string): number {
  service.inviteMember(familyId, email);
  return service.monthlyPriceCents(familyId);
}
