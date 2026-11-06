// Oracle STATIQUE des frontières du CQRS. Ne pas modifier.
// Le comportement peut être juste avec une architecture fausse : si une projection importait
// l'agrégat, ou si l'agrégat consultait une projection pour décider, tous les tests de
// comportement de ce lab passeraient quand même. On relit donc qui importe qui.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const ROOT = process.env.LAB_ROOT!;

const ECRITURE = ["ecriture/Cagnotte.ts", "ecriture/CagnotteRepository.ts"];
const LECTURE = ["lecture/SoldeParMembre.ts", "lecture/ReleveDepenses.ts"];
const PARTAGE = ["shared/StoredEvent.ts", "shared/EventStore.ts", "shared/evenements.ts"];

function importsDe(fichier: string): string[] {
  const source = readFileSync(`${ROOT}/${fichier}`, "utf8");
  const sansCommentaires = source
    .split("\n")
    .filter((ligne) => !ligne.trim().startsWith("//"))
    .join("\n");
  return [...sansCommentaires.matchAll(/from\s+["']([^"']+)["']/g)].map((m) => m[1]);
}

describe("Le côté lecture ne connaît pas le côté écriture", () => {
  it.each(LECTURE)("%s n'importe ni l'agrégat ni son dépôt", (fichier) => {
    for (const chemin of importsDe(fichier)) {
      expect(chemin, `${fichier} importe "${chemin}"`).not.toMatch(/ecriture|Cagnotte/);
    }
  });
});

describe("Le côté écriture ne consulte aucun modèle de lecture", () => {
  it.each(ECRITURE)("%s n'importe rien de lecture/", (fichier) => {
    for (const chemin of importsDe(fichier)) {
      expect(chemin, `${fichier} importe "${chemin}"`).not.toMatch(/lecture|Solde|Releve/);
    }
  });
});

describe("L'agrégat ignore la persistance", () => {
  it("ecriture/Cagnotte.ts ne connaît pas le journal", () => {
    const imports = importsDe("ecriture/Cagnotte.ts").join(" ");

    // Le TYPE d'un fait à ajouter vient de EventStore.ts et c'est admis : c'est un contrat.
    // Ce qui est interdit, c'est que l'agrégat tienne une référence au store pour aller lire.
    expect(imports).not.toMatch(/InMemoryEventStore/);
  });

  it("ecriture/CagnotteRepository.ts est le seul à connaître le journal ET l'agrégat", () => {
    const imports = importsDe("ecriture/CagnotteRepository.ts").join(" ");

    expect(imports, "le dépôt doit connaître le journal").toMatch(/EventStore/);
    expect(imports, "le dépôt doit connaître l'agrégat").toMatch(/Cagnotte/);
  });
});

describe("Le langage publié reste un noyau", () => {
  it.each(PARTAGE)("%s n'importe rien en dehors de shared/", (fichier) => {
    for (const chemin of importsDe(fichier)) {
      expect(chemin.startsWith("./"), `${fichier} importe "${chemin}"`).toBe(true);
    }
  });
});

describe("Aucun paquet externe dans le domaine", () => {
  it.each([...ECRITURE, ...LECTURE])("%s n'importe que du code local", (fichier) => {
    for (const chemin of importsDe(fichier)) {
      expect(
        chemin.startsWith("."),
        `${fichier} importe un paquet externe ("${chemin}")`,
      ).toBe(true);
    }
  });
});
