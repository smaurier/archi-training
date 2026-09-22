// Oracle STATIQUE des frontières hexagonales. Ne pas modifier. "Testé" ne veut pas dire
// seulement "le comportement marche" — une architecture en couches se prouve aussi en
// relisant qui importe quoi. Le domaine ne doit RIEN savoir de l'application ni de
// l'infrastructure ; l'application ne doit RIEN savoir de l'infrastructure.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const ROOT = process.env.LAB_ROOT!;

function importsDe(fichier: string): string[] {
  const source = readFileSync(fichier, "utf8");
  const sansCommentaires = source
    .split("\n")
    .filter((ligne) => !ligne.trim().startsWith("//"))
    .join("\n");
  const matches = [...sansCommentaires.matchAll(/from\s+["']([^"']+)["']/g)];
  return matches.map((m) => m[1]);
}

describe("Frontière DOMAINE — zéro import hors de domain/", () => {
  for (const fichier of ["domain/Family.ts", "domain/family.repository.port.ts"]) {
    it(`${fichier} n'importe rien depuis application/ ou infrastructure/, ni aucun paquet npm`, () => {
      const imports = importsDe(`${ROOT}/${fichier}`);
      for (const chemin of imports) {
        expect(chemin, `${fichier} importe "${chemin}"`).not.toMatch(/application|infrastructure/);
        expect(chemin.startsWith("."), `${fichier} importe un paquet npm ("${chemin}") — interdit dans le domaine`).toBe(true);
      }
    });
  }
});

describe("Frontière APPLICATION — zéro import depuis infrastructure/", () => {
  it("invite-member.usecase.ts n'importe rien depuis infrastructure/", () => {
    const imports = importsDe(`${ROOT}/application/invite-member.usecase.ts`);
    for (const chemin of imports) {
      expect(chemin, `le use case importe "${chemin}"`).not.toMatch(/infrastructure/);
    }
  });
});
