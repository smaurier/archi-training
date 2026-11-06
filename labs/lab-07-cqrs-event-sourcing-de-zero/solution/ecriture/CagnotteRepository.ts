import type { StoredEvent } from "../shared/StoredEvent";
import type { FaitAAjouter } from "../shared/EventStore";
import { InMemoryEventStore } from "../shared/EventStore";
import { Cagnotte } from "./Cagnotte";

export class CagnotteRepository {
  constructor(private readonly store: InMemoryEventStore) {}

  charger(cagnotteId: string): { cagnotte: Cagnotte; version: number } {
    const flux = this.store.lireFlux(cagnotteId);
    // La version rendue est celle sur laquelle l'appelant va décider. C'est une promesse, et
    // `enregistrer` la fera tenir.
    return { cagnotte: Cagnotte.rejouer(flux), version: flux.length };
  }

  enregistrer(
    cagnotteId: string,
    versionLue: number,
    faits: readonly FaitAAjouter[],
  ): StoredEvent[] {
    // Aucun fait : aucune écriture. Faire avancer la version d'un flux pour une décision qui
    // n'a rien produit ferait échouer les écritures concurrentes légitimes.
    if (faits.length === 0) return [];

    // `ConcurrenceError` n'est pas attrapée ici : c'est à l'appelant de recharger et de
    // redécider. Une couche technique n'a pas le droit de choisir à sa place.
    return this.store.ajouter(cagnotteId, versionLue, faits);
  }
}
