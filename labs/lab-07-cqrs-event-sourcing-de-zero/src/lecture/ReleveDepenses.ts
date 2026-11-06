// ReleveDepenses.ts : PAGE BLANCHE.
//
// Second modèle de lecture, sur le MÊME flux, pour une question encore différente : le relevé
// chronologique des dépenses et leur total par catégorie. Deux projections d'un seul journal,
// aucune des deux n'étant « la » base de données : c'est ça, le R de CQRS.
//
// C'est aussi ici que l'upcast se voit. Les dépenses v1 du journal n'avaient pas de catégorie ;
// elles doivent apparaître dans `CATEGORIE_PAR_DEFAUT`, avec un montant juste. Si tu vois des
// `NaN` ou des `undefined` dans cette projection, le problème n'est pas ici, il est dans
// `materialiser`.
//
// ── CONTRAT ─────────────────────────────────────────────────────────────────────────────────
// export interface LigneDepense
//   { position, depenseId, membreId, categorie, montantCentimes, annulee }
//
// export class ReleveDepenses
//
//   get position(): number
//   appliquer(faits: readonly StoredEvent[]): void
//     Mêmes deux règles que `SoldeParMembre` (position déjà vue ignorée, position qui avance
//     malgré un `kind` inconnu).
//
//   lignes(): readonly LigneDepense[]
//     Une ligne par dépense, triées par `position` croissante. Une annulation ne SUPPRIME pas
//     la ligne : elle la marque `annulee: true`. Le relevé raconte ce qui s'est passé, y compris
//     ce qui a été défait. C'est la différence entre un journal et un état.
//
//   parCategorie(): Record<string, number>
//     Total des dépenses NON annulées, par catégorie. Une catégorie dont toutes les dépenses
//     sont annulées vaut 0 et reste présente (elle a existé).
import type { StoredEvent } from "../shared/StoredEvent";

export interface LigneDepense {
  readonly position: number;
  readonly depenseId: string;
  readonly membreId: string;
  readonly categorie: string;
  readonly montantCentimes: number;
  readonly annulee: boolean;
}

export class ReleveDepenses {
  get position(): number {
    throw new Error("ReleveDepenses.position n'est pas encore implémenté");
  }

  appliquer(_faits: readonly StoredEvent[]): void {
    throw new Error("ReleveDepenses.appliquer n'est pas encore implémenté");
  }

  lignes(): readonly LigneDepense[] {
    throw new Error("ReleveDepenses.lignes n'est pas encore implémenté");
  }

  parCategorie(): Record<string, number> {
    throw new Error("ReleveDepenses.parCategorie n'est pas encore implémenté");
  }
}
