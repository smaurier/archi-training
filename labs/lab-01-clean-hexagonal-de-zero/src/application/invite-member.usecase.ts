// invite-member.usecase.ts — PAGE BLANCHE. L'APPLICATION : orchestre le domaine via le PORT
// (jamais une implémentation concrète — importer quoi que ce soit depuis `infrastructure/`
// ici est une violation de frontière, l'oracle la vérifie aussi).
//
// export class InviteMemberUseCase
//   constructor(private readonly repository: FamilyRepository) {}
//
//   async execute({ familyId, email }: { familyId: string; email: string }): Promise<void>
//     - Charge la famille via `repository.findById(familyId)`.
//     - Si la famille n'existe pas : lève `FamilyNotFoundError` (défini ici, PAS dans domain/
//       — c'est une préoccupation applicative : "je n'ai pas trouvé ce qu'on m'a demandé",
//       pas une règle métier de Family).
//     - Sinon, appelle `family.addMember(email)` (laisse les erreurs DOMAINE remonter telles
//       quelles — FamilyFullError, DuplicateMemberError — l'application ne les traduit pas).
//     - Sauvegarde via `repository.save(family)`.
import type { FamilyRepository } from "../domain/family.repository.port";

export class FamilyNotFoundError extends Error {}

export class InviteMemberUseCase {
  constructor(private readonly repository: FamilyRepository) {}

  async execute(_input: { familyId: string; email: string }): Promise<void> {
    throw new Error("InviteMemberUseCase.execute n'est pas encore implémenté");
  }
}
