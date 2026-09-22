// invite-member.usecase.ts — SOLUTION DE RÉFÉRENCE (commentée). Ne l'ouvre pas avant ton GREEN.
import type { FamilyRepository } from "../domain/family.repository.port";

export class FamilyNotFoundError extends Error {}

export class InviteMemberUseCase {
  constructor(private readonly repository: FamilyRepository) {}

  async execute({ familyId, email }: { familyId: string; email: string }): Promise<void> {
    const family = await this.repository.findById(familyId);
    if (!family) throw new FamilyNotFoundError(`Famille ${familyId} introuvable.`);
    family.addMember(email);
    await this.repository.save(family);
  }
}
