// family.repository.port.ts — PAGE BLANCHE. Le PORT (une interface, rien d'autre) : le
// domaine et l'application ne connaissent QUE ce contrat, jamais une implémentation
// concrète. C'est ce qui permet de tester `InviteMemberUseCase` avec un FAUX port (test
// application) sans jamais toucher à une vraie infrastructure.
import type { Family } from "./Family";

export interface FamilyRepository {
  findById(id: string): Promise<Family | null>;
  save(family: Family): Promise<void>;
}
