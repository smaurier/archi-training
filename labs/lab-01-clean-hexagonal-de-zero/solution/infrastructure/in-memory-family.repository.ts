// in-memory-family.repository.ts — SOLUTION DE RÉFÉRENCE (commentée). Ne l'ouvre pas avant ton GREEN.
import type { Family } from "../domain/Family";
import type { FamilyRepository } from "../domain/family.repository.port";

export class InMemoryFamilyRepository implements FamilyRepository {
  private readonly familles = new Map<string, Family>();

  seed(family: Family): void {
    this.familles.set(family.id, family);
  }

  async findById(id: string): Promise<Family | null> {
    return this.familles.get(id) ?? null;
  }

  async save(family: Family): Promise<void> {
    this.familles.set(family.id, family);
  }
}
