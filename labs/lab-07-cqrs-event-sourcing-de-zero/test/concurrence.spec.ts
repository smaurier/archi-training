// Oracle de la CONCURRENCE OPTIMISTE. Ne pas modifier.
// C'est le test qui sépare un event sourcing qui tient d'un event sourcing décoratif :
// l'invariant de l'agrégat est juste, et sans la version il serait violé quand même.
import { describe, expect, it } from "vitest";
import { ConcurrenceError, InMemoryEventStore } from "@lab/shared/EventStore";
import { Cagnotte, SoldeInsuffisantError } from "@lab/ecriture/Cagnotte";
import { CagnotteRepository } from "@lab/ecriture/CagnotteRepository";

function cagnotteAvec10000(): { store: InMemoryEventStore; depot: CagnotteRepository } {
  const store = new InMemoryEventStore();
  store.ajouter("cag-1", 0, [
    { kind: "ContributionEnregistree", payload: { membreId: "alice", montantCentimes: 10000 } },
  ]);
  return { store, depot: new CagnotteRepository(store) };
}

describe("Charger rend l'état ET la version sur laquelle on décide", () => {
  it("la version est le nombre de faits du flux", () => {
    const { depot } = cagnotteAvec10000();

    const { cagnotte, version } = depot.charger("cag-1");

    expect(version).toBe(1);
    expect(cagnotte.soldeCentimes).toBe(10000);
  });

  it("un flux jamais écrit est à la version 0", () => {
    const { depot } = cagnotteAvec10000();

    expect(depot.charger("cag-inconnue").version).toBe(0);
  });
});

describe("Une décision sans fait n'écrit pas", () => {
  it("enregistrer une liste vide ne fait pas avancer la version", () => {
    const { store, depot } = cagnotteAvec10000();

    expect(depot.enregistrer("cag-1", 1, [])).toEqual([]);
    expect(store.versionDe("cag-1")).toBe(1);
  });
});

describe("Deux décisions sur le même état : une seule gagne", () => {
  it("la seconde écriture est refusée, et le journal n'a que deux faits", () => {
    const { store, depot } = cagnotteAvec10000();

    // Deux requêtes concurrentes chargent la MÊME version, et décident toutes les deux
    // légitimement : 6000 est disponible pour chacune, prise isolément.
    const premiere = depot.charger("cag-1");
    const seconde = depot.charger("cag-1");

    const faitsA = premiere.cagnotte.depenser("d1", "alice", 6000, "courses");
    const faitsB = seconde.cagnotte.depenser("d2", "bob", 6000, "sorties");

    depot.enregistrer("cag-1", premiere.version, faitsA);

    expect(() => depot.enregistrer("cag-1", seconde.version, faitsB)).toThrow(ConcurrenceError);
    expect(store.lireFlux("cag-1")).toHaveLength(2);
  });

  it("après le refus, recharger et redécider donne le bon verdict", () => {
    const { store, depot } = cagnotteAvec10000();

    const premiere = depot.charger("cag-1");
    const seconde = depot.charger("cag-1");
    depot.enregistrer("cag-1", premiere.version, premiere.cagnotte.depenser("d1", "alice", 6000, "courses"));
    try {
      depot.enregistrer("cag-1", seconde.version, seconde.cagnotte.depenser("d2", "bob", 6000, "sorties"));
    } catch {
      // Le rejeu de la décision est la responsabilité de l'appelant, pas du dépôt.
    }

    const relue = depot.charger("cag-1");

    expect(relue.cagnotte.soldeCentimes).toBe(4000);
    expect(() => relue.cagnotte.depenser("d2", "bob", 6000, "sorties")).toThrow(
      SoldeInsuffisantError,
    );
    // Et l'invariant n'a jamais été franchi, même transitoirement dans le journal.
    expect(Cagnotte.rejouer(store.lireFlux("cag-1")).soldeCentimes).toBeGreaterThanOrEqual(0);
  });
});
