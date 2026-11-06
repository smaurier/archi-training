// Le LANGAGE PUBLIÉ du flux. Les types sont DONNÉS. `materialiser` est à toi.
//
// Ce fichier est le contrat entre le côté écriture et le côté lecture, et c'est le seul. Que les
// deux côtés l'importent n'est pas une fuite : un événement est précisément ce qu'on publie.
// Ce qui serait une fuite, c'est que la lecture importe `Cagnotte`, ou que l'écriture importe une
// projection. L'oracle de frontières relit les imports pour ça.
import type { StoredEvent } from "./StoredEvent";

export type Evenement =
  | { readonly kind: "ContributionEnregistree"; readonly membreId: string; readonly montantCentimes: number }
  | {
      readonly kind: "DepenseEnregistree";
      readonly depenseId: string;
      readonly membreId: string;
      readonly montantCentimes: number;
      readonly categorie: string;
    }
  | { readonly kind: "DepenseAnnulee"; readonly depenseId: string; readonly motif: string };

export const KINDS_CONNUS = [
  "ContributionEnregistree",
  "DepenseEnregistree",
  "DepenseAnnulee",
] as const;

// DONNÉ. À utiliser AVANT `materialiser`, partout où tu parcours le journal.
//
// Pourquoi : un flux n'est pas une liste que tu contrôles. Il contient les faits d'aujourd'hui,
// ceux d'il y a un an, et ceux qu'une version plus récente de l'application y écrira demain. Un
// `kind` inconnu n'est pas une erreur, c'est le cas normal d'un journal qui vit plus longtemps
// que le code qui le lit : on l'ignore, et on continue.
export function estKindConnu(kind: string): boolean {
  return (KINDS_CONNUS as readonly string[]).includes(kind);
}

export const CATEGORIE_PAR_DEFAUT = "non categorisee";

export class EvenementInconnuError extends Error {}

// ── À ÉCRIRE ────────────────────────────────────────────────────────────────────────────────
//
// `materialiser(stored)` transforme un fait PERSISTÉ (payload `unknown`, forme d'époque) en un
// `Evenement` de la forme d'AUJOURD'HUI. C'est le seul endroit du code qui a le droit de savoir
// que le passé était différent du présent. On appelle ça un upcast, et c'est ce qui décide si un
// projet en event sourcing survit à sa deuxième année.
//
// Contrat exact :
//
//   - `kind` inconnu  → lève `EvenementInconnuError`. (Tu ne devines pas un fait que tu ne
//     connais pas. C'est pour ça que `estKindConnu` se teste AVANT d'appeler cette fonction.)
//
//   - `ContributionEnregistree` et `DepenseAnnulee` : le payload a déjà la bonne forme.
//
//   - `DepenseEnregistree` a DEUX formes dans le journal, et les deux doivent sortir d'ici
//     identiques :
//       · forme actuelle : `{ depenseId, membreId, montantCentimes, categorie }`
//       · forme v1, écrite avant deux décisions prises depuis :
//         `{ depenseId, membreId, montant }`, où `montant` est en EUROS (nombre décimal),
//         et sans `categorie` du tout.
//       → un fait v1 se matérialise avec `montantCentimes` converti depuis les euros (arrondi
//         à l'entier le plus proche) et `categorie` valant `CATEGORIE_PAR_DEFAUT`.
//
// Le piège : il est tentant de « corriger » les vieux faits en base une fois pour toutes. C'est
// la seule chose que l'event sourcing interdit absolument. Le passé ne se réécrit pas, il se
// traduit à la lecture.
export function materialiser(_stored: StoredEvent): Evenement {
  throw new Error("materialiser n'est pas encore implémenté");
}
