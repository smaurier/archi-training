// Oracle du côté ÉCRITURE. Ne pas modifier.
// Ce que ces tests disent : l'état de l'agrégat est une CONSÉQUENCE de ses faits, et son
// invariant se tient sur cet état rejoué, jamais sur autre chose.
import { describe, expect, it } from "vitest";
import { InMemoryEventStore } from "@lab/shared/EventStore";
import {
  AnnulationImpossibleError,
  Cagnotte,
  DepenseDejaEnregistreeError,
  MontantInvalideError,
  SoldeInsuffisantError,
} from "@lab/ecriture/Cagnotte";
import { CagnotteRepository } from "@lab/ecriture/CagnotteRepository";

describe("Un flux vide est un état, pas une absence", () => {
  it("rejouer un flux vide donne une cagnotte à zéro", () => {
    expect(Cagnotte.rejouer([]).soldeCentimes).toBe(0);
  });
});

describe("Contribuer", () => {
  it("produit le fait et fait monter le solde", () => {
    const cagnotte = Cagnotte.rejouer([]);

    const faits = cagnotte.contribuer("alice", 10000);

    expect(faits).toEqual([
      { kind: "ContributionEnregistree", payload: { membreId: "alice", montantCentimes: 10000 } },
    ]);
    expect(cagnotte.soldeCentimes).toBe(10000);
  });

  it("refuse un montant nul, négatif ou non entier, sans rien changer", () => {
    const cagnotte = Cagnotte.rejouer([]);
    cagnotte.contribuer("alice", 10000);

    expect(() => cagnotte.contribuer("alice", 0)).toThrow(MontantInvalideError);
    expect(() => cagnotte.contribuer("alice", -500)).toThrow(MontantInvalideError);
    expect(() => cagnotte.contribuer("alice", 12.5)).toThrow(MontantInvalideError);
    expect(cagnotte.soldeCentimes).toBe(10000);
  });
});

describe("Dépenser : l'invariant du solde", () => {
  it("passe sous le solde et fait baisser le solde", () => {
    const cagnotte = Cagnotte.rejouer([]);
    cagnotte.contribuer("alice", 10000);

    const faits = cagnotte.depenser("d1", "alice", 3000, "courses");

    expect(faits).toEqual([
      {
        kind: "DepenseEnregistree",
        payload: {
          depenseId: "d1",
          membreId: "alice",
          montantCentimes: 3000,
          categorie: "courses",
        },
      },
    ]);
    expect(cagnotte.soldeCentimes).toBe(7000);
  });

  it("refuse la dépense de trop et ne touche à rien", () => {
    const cagnotte = Cagnotte.rejouer([]);
    cagnotte.contribuer("alice", 10000);

    expect(() => cagnotte.depenser("d1", "alice", 10001, "courses")).toThrow(SoldeInsuffisantError);
    expect(cagnotte.soldeCentimes).toBe(10000);
  });

  it("voit le solde déjà entamé par la dépense précédente, dans la même instance", () => {
    const cagnotte = Cagnotte.rejouer([]);
    cagnotte.contribuer("alice", 10000);
    cagnotte.depenser("d1", "alice", 6000, "courses");

    // Si une commande rendait son fait sans mettre l'état à jour, cette seconde dépense
    // passerait, et le solde finirait à -2000 sans que le journal y soit pour quoi que ce soit.
    expect(() => cagnotte.depenser("d2", "alice", 6000, "sorties")).toThrow(SoldeInsuffisantError);
    expect(cagnotte.soldeCentimes).toBe(4000);
  });

  it("refuse deux fois le même identifiant de dépense", () => {
    const cagnotte = Cagnotte.rejouer([]);
    cagnotte.contribuer("alice", 10000);
    cagnotte.depenser("d1", "alice", 1000, "courses");

    expect(() => cagnotte.depenser("d1", "alice", 1000, "courses")).toThrow(
      DepenseDejaEnregistreeError,
    );
    expect(cagnotte.soldeCentimes).toBe(9000);
  });
});

describe("Annuler n'est pas supprimer", () => {
  it("recrédite le montant d'origine", () => {
    const cagnotte = Cagnotte.rejouer([]);
    cagnotte.contribuer("alice", 10000);
    cagnotte.depenser("d1", "alice", 3000, "courses");

    const faits = cagnotte.annulerDepense("d1", "remboursée par le magasin");

    expect(faits).toEqual([
      { kind: "DepenseAnnulee", payload: { depenseId: "d1", motif: "remboursée par le magasin" } },
    ]);
    expect(cagnotte.soldeCentimes).toBe(10000);
  });

  it("refuse une annulation inconnue ou déjà faite", () => {
    const cagnotte = Cagnotte.rejouer([]);
    cagnotte.contribuer("alice", 10000);
    cagnotte.depenser("d1", "alice", 3000, "courses");
    cagnotte.annulerDepense("d1", "remboursée");

    expect(() => cagnotte.annulerDepense("d1", "encore")).toThrow(AnnulationImpossibleError);
    expect(() => cagnotte.annulerDepense("inconnue", "au hasard")).toThrow(
      AnnulationImpossibleError,
    );
    expect(cagnotte.soldeCentimes).toBe(10000);
  });
});

describe("L'état vient du journal, et de nulle part ailleurs", () => {
  it("une cagnotte rechargée depuis ses seuls faits décide exactement pareil", () => {
    const store = new InMemoryEventStore();
    const depot = new CagnotteRepository(store);

    const premiere = depot.charger("cag-1");
    const faits = [
      ...premiere.cagnotte.contribuer("alice", 10000),
      ...premiere.cagnotte.depenser("d1", "alice", 9000, "courses"),
    ];
    depot.enregistrer("cag-1", premiere.version, faits);

    const relue = depot.charger("cag-1");

    expect(relue.version).toBe(2);
    expect(relue.cagnotte.soldeCentimes).toBe(1000);
    expect(() => relue.cagnotte.depenser("d2", "bob", 2000, "sorties")).toThrow(
      SoldeInsuffisantError,
    );
  });

  it("un fait d'un kind inconnu ne casse pas le rejeu", () => {
    const store = new InMemoryEventStore();
    store.ajouter("cag-1", 0, [
      { kind: "ContributionEnregistree", payload: { membreId: "alice", montantCentimes: 5000 } },
      // Écrit par une version plus récente de l'application. Ce code-ci ne la connaît pas.
      { kind: "CagnotteArchivee", payload: { par: "alice" } },
    ]);

    const cagnotte = Cagnotte.rejouer(store.lireFlux("cag-1"));

    expect(cagnotte.soldeCentimes).toBe(5000);
  });
});
