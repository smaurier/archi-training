// family.repository.port.ts — identique au starter : une interface n'a rien à "résoudre",
// le geste du lab porte sur les implémentations (domaine, use case, adaptateur).
import type { Family } from "./Family";

export interface FamilyRepository {
  findById(id: string): Promise<Family | null>;
  save(family: Family): Promise<void>;
}
