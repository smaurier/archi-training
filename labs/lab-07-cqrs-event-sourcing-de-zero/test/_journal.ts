// Aide de test partagée (pas un fichier de test). Ne pas modifier.
// Construit un journal réaliste : des faits d'aujourd'hui, un fait v1 écrit par une version
// précédente de l'application, et un fait d'un kind que ce code ne connaît pas.
import { InMemoryEventStore } from "@lab/shared/EventStore";

export const FLUX = "cag-1";

export function journalCourant(): InMemoryEventStore {
  const store = new InMemoryEventStore();
  store.ajouter(FLUX, 0, [
    { kind: "ContributionEnregistree", payload: { membreId: "alice", montantCentimes: 10000 } },
    {
      kind: "DepenseEnregistree",
      payload: { depenseId: "d1", membreId: "alice", montantCentimes: 3000, categorie: "courses" },
    },
    { kind: "ContributionEnregistree", payload: { membreId: "bob", montantCentimes: 5000 } },
    {
      kind: "DepenseEnregistree",
      payload: { depenseId: "d2", membreId: "bob", montantCentimes: 2000, categorie: "sorties" },
    },
    { kind: "DepenseAnnulee", payload: { depenseId: "d1", motif: "remboursée par le magasin" } },
  ]);
  return store;
}

// Une dépense écrite AVANT deux décisions prises depuis : montant en euros, pas de catégorie.
export function ajouterDepenseV1(store: InMemoryEventStore): void {
  store.ajouter(FLUX, store.versionDe(FLUX), [
    { kind: "DepenseEnregistree", payload: { depenseId: "d3", membreId: "carla", montant: 12.34 } },
  ]);
}

export function ajouterFaitInconnu(store: InMemoryEventStore): void {
  store.ajouter(FLUX, store.versionDe(FLUX), [
    { kind: "CagnotteArchivee", payload: { par: "alice" } },
  ]);
}
