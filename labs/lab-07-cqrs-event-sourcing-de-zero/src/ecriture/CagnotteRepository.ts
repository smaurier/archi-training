// CagnotteRepository.ts : PAGE BLANCHE.
//
// L'adaptateur entre l'agrégat et le journal. C'est le SEUL fichier du côté écriture qui a le
// droit de connaître `InMemoryEventStore`, et c'est lui qui porte la concurrence optimiste.
//
// ── CONTRAT ─────────────────────────────────────────────────────────────────────────────────
// export class CagnotteRepository
//   constructor(store: InMemoryEventStore)
//
//   charger(cagnotteId: string): { cagnotte: Cagnotte; version: number }
//     Rejoue le flux et rend AUSSI la version lue. Cette version n'est pas une information de
//     confort : c'est la promesse « voilà l'état du monde sur lequel j'ai décidé ».
//
//   enregistrer(cagnotteId, versionLue, faits): StoredEvent[]
//     - `faits` vide : ne touche pas au journal et retourne `[]`. Une décision qui ne produit
//       aucun fait ne doit pas faire avancer la version du flux pour rien.
//     - sinon : ajoute les faits en déclarant `versionLue` comme version attendue, et laisse
//       remonter `ConcurrenceError` sans l'attraper.
//
// ── POURQUOI LA VERSION EST LE CŒUR DU SUJET ────────────────────────────────────────────────
// Sans elle, deux requêtes qui chargent la même cagnotte au même instant décident toutes les
// deux sur l'ancien solde, écrivent toutes les deux, et la cagnotte passe en négatif. L'invariant
// de l'agrégat était juste, et il a quand même été violé : le trou n'était pas dans le métier,
// il était dans l'écriture. C'est l'objet de `test/concurrence.spec.ts`.
import type { StoredEvent } from "../shared/StoredEvent";
import type { FaitAAjouter } from "../shared/EventStore";
import { InMemoryEventStore } from "../shared/EventStore";
import { Cagnotte } from "./Cagnotte";

export class CagnotteRepository {
  constructor(private readonly store: InMemoryEventStore) {}

  charger(_cagnotteId: string): { cagnotte: Cagnotte; version: number } {
    throw new Error("CagnotteRepository.charger n'est pas encore implémenté");
  }

  enregistrer(
    _cagnotteId: string,
    _versionLue: number,
    _faits: readonly FaitAAjouter[],
  ): StoredEvent[] {
    throw new Error("CagnotteRepository.enregistrer n'est pas encore implémenté");
  }
}
