// Oracle de la CONTESTATION D'ADR. Ne pas modifier. La preuve n'est pas "les UUID c'est
// mieux" — c'est une démonstration MESURABLE que le schéma actuel (ADR-001) permet
// d'énumérer les identifiants, et que le nouveau schéma (visé par ADR-002) ne le permet
// plus.
import { describe, expect, it } from "vitest";
import { nextId } from "@lab/IdGenerator";

describe("IdGenerator — démonstration de l'énumérabilité (le problème qu'ADR-001 sous-estimait)", () => {
  it("connaître un id ne permet PAS de prédire le suivant en l'incrémentant", () => {
    const ids = Array.from({ length: 20 }, () => nextId());

    // Le schéma contesté (ADR-001) : id N+1 = Number(id N) + 1. Si CE calcul retombe sur le
    // prochain id réellement généré, l'énumération est triviale — un attaquant avec UN lien
    // valide reconstruit toute la liste des familles avec une simple boucle.
    let predictions = 0;
    for (let i = 0; i < ids.length - 1; i++) {
      const idActuel = ids[i];
      const idSuivantReel = ids[i + 1];
      const commeEntier = Number(idActuel);
      const predictionSiSequentiel = Number.isNaN(commeEntier) ? null : String(commeEntier + 1);
      if (predictionSiSequentiel === idSuivantReel) predictions++;
    }

    expect(predictions).toBe(0);
  });

  it("chaque id ressemble à un UUID v4 (aléatoire, non-séquentiel par construction)", () => {
    const id = nextId();
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  });

  it("20 identifiants générés sont tous distincts (pas de collision triviale)", () => {
    const ids = Array.from({ length: 20 }, () => nextId());
    expect(new Set(ids).size).toBe(20);
  });
});
