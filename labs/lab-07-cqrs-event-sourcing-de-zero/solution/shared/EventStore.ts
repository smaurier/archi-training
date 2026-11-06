// DONNÉ, ne pas modifier. Le journal : la seule source de vérité du côté écriture.
//
// Deux propriétés non négociables, et ce sont elles qui font de l'event sourcing autre chose
// qu'une table de logs :
//
//  1. on n'écrase jamais un fait, on n'en supprime jamais un. `ajouter` ne fait qu'ajouter.
//     Annuler une dépense n'est donc PAS la supprimer : c'est ajouter le fait qu'elle est annulée.
//  2. toute écriture déclare la version qu'elle croyait voir. Si le flux a bougé entre-temps,
//     elle est REFUSÉE (`ConcurrenceError`) au lieu d'écraser la décision de l'autre.
//
// La mémoire remplace la base, mais le contrat est celui d'un vrai store : une table `events`
// avec un index unique sur (stream_id, version) suffit à obtenir exactement ce comportement.
import type { StoredEvent } from "./StoredEvent";

export class ConcurrenceError extends Error {
  constructor(
    readonly streamId: string,
    readonly versionAttendue: number,
    readonly versionReelle: number,
  ) {
    super(
      `flux ${streamId} : écriture refusée, version attendue ${versionAttendue}, version réelle ${versionReelle}`,
    );
  }
}

// Ce qu'un agrégat PRODUIT : un fait sans rang ni position. C'est le journal qui les attribue.
export interface FaitAAjouter {
  readonly kind: string;
  readonly payload: Record<string, unknown>;
}

export class InMemoryEventStore {
  private readonly journal: StoredEvent[] = [];

  versionDe(streamId: string): number {
    return this.journal.filter((f) => f.streamId === streamId).length;
  }

  lireFlux(streamId: string): readonly StoredEvent[] {
    return this.journal.filter((f) => f.streamId === streamId);
  }

  lireTout(depuisPosition = 0): readonly StoredEvent[] {
    return this.journal.filter((f) => f.position > depuisPosition);
  }

  ajouter(
    streamId: string,
    versionAttendue: number,
    faits: readonly FaitAAjouter[],
  ): StoredEvent[] {
    const versionReelle = this.versionDe(streamId);
    if (versionReelle !== versionAttendue) {
      throw new ConcurrenceError(streamId, versionAttendue, versionReelle);
    }

    const ajoutes = faits.map((fait, rang) => ({
      position: this.journal.length + rang + 1,
      streamId,
      version: versionReelle + rang + 1,
      kind: fait.kind,
      payload: fait.payload,
    }));
    this.journal.push(...ajoutes);
    return ajoutes;
  }
}
