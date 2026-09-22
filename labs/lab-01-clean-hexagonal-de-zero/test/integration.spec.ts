// Oracle INTÉGRATION. Ne pas modifier. Le VRAI câblage : use case + VRAI adaptateur
// (InMemoryFamilyRepository), pas de faux port cette fois — la preuve que les pièces
// s'assemblent réellement, pas seulement en isolation.
import { describe, expect, it } from "vitest";
import { Family } from "@lab/domain/Family";
import { InMemoryFamilyRepository } from "@lab/infrastructure/in-memory-family.repository";
import { InviteMemberUseCase } from "@lab/application/invite-member.usecase";

describe("Câblage réel : use case + adaptateur InMemoryFamilyRepository", () => {
  it("invite un membre de bout en bout, persisté dans le vrai repository", async () => {
    const repository = new InMemoryFamilyRepository();
    repository.seed(new Family("f1", "Dupont"));
    const useCase = new InviteMemberUseCase(repository);

    await useCase.execute({ familyId: "f1", email: "nouveau@t.fr" });

    const relue = await repository.findById("f1");
    expect(relue?.hasMember("nouveau@t.fr")).toBe(true);
  });
});
