// in-memory-family.repository.ts — PAGE BLANCHE. L'INFRASTRUCTURE : un ADAPTATEUR qui
// implémente le PORT `FamilyRepository`. En prod, ce serait un adaptateur PostgreSQL (cours
// 10) — ici, une Map en mémoire, mais le point est que `InviteMemberUseCase` ne verrait
// AUCUNE différence : il ne connaît que l'interface.
import type { Family } from "../domain/Family";
import type { FamilyRepository } from "../domain/family.repository.port";

export class InMemoryFamilyRepository implements FamilyRepository {
  private readonly familles = new Map<string, Family>();

  seed(family: Family): void {
    this.familles.set(family.id, family);
  }

  async findById(_id: string): Promise<Family | null> {
    throw new Error("findById n'est pas encore implémenté");
  }

  async save(_family: Family): Promise<void> {
    throw new Error("save n'est pas encore implémenté");
  }
}
