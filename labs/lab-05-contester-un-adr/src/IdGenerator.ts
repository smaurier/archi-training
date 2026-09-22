// IdGenerator.ts — L'EXISTANT, EN PRODUCTION, conforme à ADR-001 (identifiants entiers
// séquentiels). Lis FINDINGS.md et ADR-001-identifiants-familles.md AVANT de toucher à ce
// fichier.
//
// Contrat attendu APRÈS ta correction : `nextId(): string` renvoie un identifiant qui NE
// PERMET PAS de deviner le prochain à partir d'un identifiant connu (voir
// test/adr-contestation.spec.ts pour la preuve exacte attendue).
let counter = 0;

export function nextId(): string {
  counter += 1;
  return String(counter);
}
