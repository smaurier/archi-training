// Oracle STATIQUE des frontières d'agrégats. Ne pas modifier.
// Le comportement peut être juste avec une architecture fausse : deux agrégats qui s'appellent
// directement passeraient tous les tests de comportement de ce lab. On relit donc qui importe
// qui. C'est ce test qui interdit la solution de facilité (famille.accueillir() appelé depuis
// Invitation) et force le vrai choix : fusionner, ou passer par un fait.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const ROOT = process.env.LAB_ROOT!;

function importsDe(fichier: string): string[] {
  const source = readFileSync(`${ROOT}/${fichier}`, "utf8");
  const sansCommentaires = source
    .split("\n")
    .filter((ligne) => !ligne.trim().startsWith("//"))
    .join("\n");
  return [...sansCommentaires.matchAll(/from\s+["']([^"']+)["']/g)].map((m) => m[1]);
}

describe("Frontière entre les deux agrégats : aucun ne connaît l'autre", () => {
  it("famille/Famille.ts ignore l'invitation et le processus", () => {
    for (const chemin of importsDe("famille/Famille.ts")) {
      expect(chemin, `Famille.ts importe "${chemin}"`).not.toMatch(/invitation|adhesion/);
      expect(
        chemin.startsWith("."),
        `Famille.ts importe un paquet externe ("${chemin}"), interdit dans un agrégat`,
      ).toBe(true);
    }
  });

  it("invitation/Invitation.ts ignore la famille et le processus", () => {
    for (const chemin of importsDe("invitation/Invitation.ts")) {
      expect(chemin, `Invitation.ts importe "${chemin}"`).not.toMatch(/famille|adhesion/);
      expect(
        chemin.startsWith("."),
        `Invitation.ts importe un paquet externe ("${chemin}"), interdit dans un agrégat`,
      ).toBe(true);
    }
  });
});

describe("Le noyau partagé reste un noyau", () => {
  it("shared/DomainEvent.ts n'importe rien du tout", () => {
    expect(importsDe("shared/DomainEvent.ts")).toEqual([]);
  });
});

describe("La coordination existe, et elle est au seul endroit qui en a le droit", () => {
  it("adhesion/ProcessusAdhesion.ts importe bien les DEUX agrégats", () => {
    const imports = importsDe("adhesion/ProcessusAdhesion.ts").join(" ");

    expect(imports, "le processus doit connaître la famille").toMatch(/famille/);
    expect(imports, "le processus doit connaître l'invitation").toMatch(/invitation/);
  });
});
