// Oracle des MODÈLES DE LECTURE. Ne pas modifier.
// Deux projections, un seul journal, et trois propriétés qu'aucune projection correcte ne peut
// perdre : elle est idempotente, elle est reprenable, et elle sait lire le passé.
import { describe, expect, it } from "vitest";
import { SoldeParMembre } from "@lab/lecture/SoldeParMembre";
import { ReleveDepenses } from "@lab/lecture/ReleveDepenses";
import { ajouterDepenseV1, ajouterFaitInconnu, journalCourant } from "./_journal";

describe("SoldeParMembre répond à une question que l'agrégat ne sait pas poser", () => {
  it("ventile les contributions et les dépenses par membre", () => {
    const store = journalCourant();
    const projection = new SoldeParMembre();

    projection.appliquer(store.lireTout());

    expect(projection.contributionDe("alice")).toBe(10000);
    expect(projection.contributionDe("bob")).toBe(5000);
    expect(projection.contributionDe("inconnu")).toBe(0);
    // La dépense d1 d'alice a été annulée : elle ne lui est plus comptée.
    expect(projection.depenseDe("alice")).toBe(0);
    expect(projection.depenseDe("bob")).toBe(2000);
    expect(projection.soldeCentimes()).toBe(13000);
  });

  it("avance son point de reprise jusqu'au dernier fait consommé", () => {
    const store = journalCourant();
    const projection = new SoldeParMembre();

    expect(projection.position).toBe(0);
    projection.appliquer(store.lireTout());
    expect(projection.position).toBe(5);
  });
});

describe("Livré au moins une fois : la projection est idempotente", () => {
  it("rejouer tout le journal une seconde fois ne double rien", () => {
    const store = journalCourant();
    const projection = new SoldeParMembre();

    projection.appliquer(store.lireTout());
    projection.appliquer(store.lireTout());

    expect(projection.contributionDe("alice")).toBe(10000);
    expect(projection.depenseDe("bob")).toBe(2000);
    expect(projection.soldeCentimes()).toBe(13000);
    expect(projection.position).toBe(5);
  });

  it("consommer en deux lots donne le même résultat qu'en un seul", () => {
    const store = journalCourant();
    const tout = store.lireTout();

    const parLots = new SoldeParMembre();
    parLots.appliquer(tout.slice(0, 3));
    parLots.appliquer(tout.slice(3));

    const dUnCoup = new SoldeParMembre();
    dUnCoup.appliquer(tout);

    expect(parLots.soldeCentimes()).toBe(dUnCoup.soldeCentimes());
    expect(parLots.depenseDe("bob")).toBe(dUnCoup.depenseDe("bob"));
    expect(parLots.position).toBe(dUnCoup.position);
  });

  it("reprendre depuis son point de reprise ne reconsomme pas le passé", () => {
    const store = journalCourant();
    const projection = new SoldeParMembre();
    projection.appliquer(store.lireTout());

    ajouterDepenseV1(store);
    projection.appliquer(store.lireTout(projection.position));

    expect(projection.contributionDe("alice")).toBe(10000);
    expect(projection.depenseDe("carla")).toBe(1234);
  });
});

describe("ReleveDepenses raconte ce qui s'est passé, annulations comprises", () => {
  it("liste les dépenses dans l'ordre et marque l'annulée sans la supprimer", () => {
    const store = journalCourant();
    const releve = new ReleveDepenses();

    releve.appliquer(store.lireTout());

    expect(releve.lignes()).toEqual([
      {
        position: 2,
        depenseId: "d1",
        membreId: "alice",
        categorie: "courses",
        montantCentimes: 3000,
        annulee: true,
      },
      {
        position: 4,
        depenseId: "d2",
        membreId: "bob",
        categorie: "sorties",
        montantCentimes: 2000,
        annulee: false,
      },
    ]);
  });

  it("ne totalise que les dépenses vivantes, et garde la catégorie vidée", () => {
    const store = journalCourant();
    const releve = new ReleveDepenses();

    releve.appliquer(store.lireTout());

    expect(releve.parCategorie()).toEqual({ courses: 0, sorties: 2000 });
  });
});

describe("Le passé ne se réécrit pas, il se traduit", () => {
  it("une dépense v1 remonte en centimes et dans la catégorie par défaut", () => {
    const store = journalCourant();
    ajouterDepenseV1(store);

    const releve = new ReleveDepenses();
    releve.appliquer(store.lireTout());
    const solde = new SoldeParMembre();
    solde.appliquer(store.lireTout());

    // 12,34 € arrondis au centime, pas tronqués : 12.34 * 100 ne vaut pas exactement 1234 en
    // flottant, et une troncature ferait dériver tous les totaux historiques.
    expect(solde.depenseDe("carla")).toBe(1234);
    expect(releve.parCategorie()["non categorisee"]).toBe(1234);
    expect(releve.lignes().at(-1)).toMatchObject({
      depenseId: "d3",
      categorie: "non categorisee",
      montantCentimes: 1234,
      annulee: false,
    });
  });
});

describe("Un journal vit plus longtemps que le code qui le lit", () => {
  it("un kind inconnu est ignoré, mais le point de reprise avance quand même", () => {
    const store = journalCourant();
    ajouterFaitInconnu(store);

    const solde = new SoldeParMembre();
    const releve = new ReleveDepenses();
    solde.appliquer(store.lireTout());
    releve.appliquer(store.lireTout());

    expect(solde.soldeCentimes()).toBe(13000);
    expect(releve.lignes()).toHaveLength(2);
    // Si la position restait bloquée à 5, la projection repasserait indéfiniment sur ce fait.
    expect(solde.position).toBe(6);
    expect(releve.position).toBe(6);
  });
});
