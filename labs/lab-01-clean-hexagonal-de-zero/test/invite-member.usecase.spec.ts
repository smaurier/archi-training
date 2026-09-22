// Oracle APPLICATION. Ne pas modifier. Le use case est testé avec un FAUX port — écrit ICI,
// dans le test, jamais la vraie InMemoryFamilyRepository — c'est la preuve que l'application
// dépend de l'INTERFACE, pas d'une implémentation concrète (inversion de dépendance réelle,
// pas juste déclarée).
import { describe, expect, it, vi } from "vitest";
import { Family } from "@lab/domain/Family";
import type { FamilyRepository } from "@lab/domain/family.repository.port";
import { FamilyNotFoundError, InviteMemberUseCase } from "@lab/application/invite-member.usecase";

function fauxRepository(famille: Family | null): FamilyRepository & { saved: Family[] } {
  const saved: Family[] = [];
  return {
    saved,
    findById: vi.fn(async () => famille),
    save: vi.fn(async (f: Family) => {
      saved.push(f);
    }),
  };
}

describe("InviteMemberUseCase — orchestration via le port, jamais un adaptateur concret", () => {
  it("charge la famille, ajoute le membre, sauvegarde — via le port uniquement", async () => {
    const famille = new Family("f1", "Dupont");
    const repo = fauxRepository(famille);
    const useCase = new InviteMemberUseCase(repo);

    await useCase.execute({ familyId: "f1", email: "nouveau@t.fr" });

    expect(repo.findById).toHaveBeenCalledWith("f1");
    expect(famille.hasMember("nouveau@t.fr")).toBe(true);
    expect(repo.saved).toHaveLength(1);
  });

  it("lève FamilyNotFoundError si le port ne trouve rien (ne sauvegarde jamais)", async () => {
    const repo = fauxRepository(null);
    const useCase = new InviteMemberUseCase(repo);

    await expect(useCase.execute({ familyId: "absent", email: "x@t.fr" })).rejects.toThrow(FamilyNotFoundError);
    expect(repo.save).not.toHaveBeenCalled();
  });

  it("laisse remonter une erreur DOMAINE (famille pleine) sans la traduire", async () => {
    const membres = Array.from({ length: 8 }, (_, i) => `m${i}@t.fr`);
    const famille = new Family("f1", "Dupont", membres);
    const repo = fauxRepository(famille);
    const useCase = new InviteMemberUseCase(repo);

    await expect(useCase.execute({ familyId: "f1", email: "nouveau@t.fr" })).rejects.toThrow(
      /FamilyFullError|pleine|déjà 8/i,
    );
  });
});
