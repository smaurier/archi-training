// Oracle de la COHÉRENCE À TERME. Ne pas modifier.
// Le décalage entre écriture et lecture n'est pas un défaut à cacher : c'est le prix annoncé
// du CQRS. Ces tests exigent que le décalage EXISTE, puis qu'il se résorbe.
import { describe, expect, it } from "vitest";
import { InMemoryEventStore } from "@lab/shared/EventStore";
import { Cagnotte } from "@lab/ecriture/Cagnotte";
import { CagnotteRepository } from "@lab/ecriture/CagnotteRepository";
import { SoldeParMembre } from "@lab/lecture/SoldeParMembre";
import { ReleveDepenses } from "@lab/lecture/ReleveDepenses";
import { FLUX, journalCourant } from "./_journal";

describe("Le décalage est réel, et il se rattrape", () => {
  it("une dépense écrite n'est pas encore visible du modèle de lecture", () => {
    const store = journalCourant();
    const depot = new CagnotteRepository(store);
    const projection = new SoldeParMembre();
    projection.appliquer(store.lireTout());

    const { cagnotte, version } = depot.charger(FLUX);
    depot.enregistrer(FLUX, version, cagnotte.depenser("d9", "bob", 1000, "sorties"));

    // Le côté écriture sait déjà. Le côté lecture n'a pas encore été rattrapé, et c'est normal.
    expect(cagnotte.soldeCentimes).toBe(12000);
    expect(projection.soldeCentimes()).toBe(13000);

    projection.appliquer(store.lireTout(projection.position));

    expect(projection.soldeCentimes()).toBe(12000);
  });
});

describe("Un modèle de lecture est jetable", () => {
  it("reconstruit de zéro depuis le journal, il dit exactement la même chose", () => {
    const store = journalCourant();
    const incremental = new ReleveDepenses();
    const tout = store.lireTout();
    for (const fait of tout) incremental.appliquer([fait]);

    const reconstruit = new ReleveDepenses();
    reconstruit.appliquer(tout);

    expect(reconstruit.lignes()).toEqual(incremental.lignes());
    expect(reconstruit.parCategorie()).toEqual(incremental.parCategorie());
  });

  it("et il retombe sur le solde de l'agrégat, qui est la seule vérité", () => {
    const store = journalCourant();
    const projection = new SoldeParMembre();
    projection.appliquer(store.lireTout());

    expect(projection.soldeCentimes()).toBe(Cagnotte.rejouer(store.lireFlux(FLUX)).soldeCentimes);
  });
});

describe("Un flux par agrégat", () => {
  it("l'agrégat ne voit que son flux, la projection voit le journal entier", () => {
    const store = new InMemoryEventStore();
    store.ajouter("cag-1", 0, [
      { kind: "ContributionEnregistree", payload: { membreId: "alice", montantCentimes: 10000 } },
    ]);
    store.ajouter("cag-2", 0, [
      { kind: "ContributionEnregistree", payload: { membreId: "bob", montantCentimes: 7000 } },
    ]);

    const depot = new CagnotteRepository(store);
    const projection = new SoldeParMembre();
    projection.appliquer(store.lireTout());

    expect(depot.charger("cag-1").cagnotte.soldeCentimes).toBe(10000);
    expect(depot.charger("cag-2").cagnotte.soldeCentimes).toBe(7000);
    expect(projection.soldeCentimes()).toBe(17000);
  });
});
