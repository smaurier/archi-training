import type { StoredEvent } from "../shared/StoredEvent";
import { estKindConnu, materialiser } from "../shared/evenements";

export interface LigneDepense {
  readonly position: number;
  readonly depenseId: string;
  readonly membreId: string;
  readonly categorie: string;
  readonly montantCentimes: number;
  readonly annulee: boolean;
}

// Mutable en interne, exposée en lecture seule : une annulation ne supprime pas une ligne,
// elle la retourne.
interface LigneInterne {
  position: number;
  depenseId: string;
  membreId: string;
  categorie: string;
  montantCentimes: number;
  annulee: boolean;
}

export class ReleveDepenses {
  private pos = 0;
  private readonly index = new Map<string, LigneInterne>();

  get position(): number {
    return this.pos;
  }

  appliquer(faits: readonly StoredEvent[]): void {
    for (const stored of faits) {
      if (stored.position <= this.pos) continue;
      this.pos = stored.position;
      if (!estKindConnu(stored.kind)) continue;

      const evenement = materialiser(stored);
      switch (evenement.kind) {
        case "DepenseEnregistree":
          this.index.set(evenement.depenseId, {
            position: stored.position,
            depenseId: evenement.depenseId,
            membreId: evenement.membreId,
            categorie: evenement.categorie,
            montantCentimes: evenement.montantCentimes,
            annulee: false,
          });
          break;

        case "DepenseAnnulee": {
          const ligne = this.index.get(evenement.depenseId);
          if (ligne) ligne.annulee = true;
          break;
        }

        // Une contribution n'est pas une dépense : ce relevé ne la raconte pas. Deux modèles de
        // lecture sur le même flux n'ont aucune raison de retenir les mêmes faits.
        case "ContributionEnregistree":
          break;
      }
    }
  }

  lignes(): readonly LigneDepense[] {
    return [...this.index.values()]
      .map((ligne) => ({ ...ligne }))
      .sort((a, b) => a.position - b.position);
  }

  parCategorie(): Record<string, number> {
    const totaux: Record<string, number> = {};
    for (const ligne of this.index.values()) {
      // La catégorie reste présente même si tout est annulé : elle a existé dans la vie de la
      // cagnotte, et un relevé ne fait pas disparaître le passé.
      totaux[ligne.categorie] ??= 0;
      if (!ligne.annulee) totaux[ligne.categorie] += ligne.montantCentimes;
    }
    return totaux;
  }
}
