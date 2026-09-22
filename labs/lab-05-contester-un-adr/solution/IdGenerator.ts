// IdGenerator.ts — SOLUTION DE RÉFÉRENCE (commentée). Ne l'ouvre pas avant ton GREEN.
// Conforme à ADR-002 : un UUID v4 (aléatoire cryptographique) ne permet structurellement
// pas de déduire un id à partir d'un autre — pas "difficile à deviner", MATHÉMATIQUEMENT
// non-séquentiel.
import { randomUUID } from "node:crypto";

export function nextId(): string {
  return randomUUID();
}
