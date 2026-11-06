// Cagnotte.ts : PAGE BLANCHE (les erreurs sont données).
//
// L'agrégat du côté ÉCRITURE, et il est event-sourced : il n'a pas d'état stocké quelque part
// qu'on relirait. Son état n'existe que comme CONSÉQUENCE de ses faits, recalculée à chaque
// chargement. C'est la bascule mentale du lab, et elle est inconfortable au début.
//
// Il ne connaît ni le journal (`EventStore`), ni le dépôt, ni aucune projection. Il reçoit des
// faits, il rend des faits. L'oracle de frontières le vérifie.
//
// ── L'INVARIANT, ET IL N'EST QU'À LUI ───────────────────────────────────────────────────────
// Le solde d'une cagnotte n'est JAMAIS négatif. Aucune relecture extérieure ne peut rattraper
// une dépense de trop : c'est ici, sur l'état rejoué, que la décision se prend.
//
// ── CONTRAT ─────────────────────────────────────────────────────────────────────────────────
// export class Cagnotte
//
//   static rejouer(faits: readonly StoredEvent[]): Cagnotte
//     Reconstruit l'état depuis le début du flux. Un flux vide donne une cagnotte à 0. Les
//     `kind` inconnus sont IGNORÉS (cf. `estKindConnu`), pas une erreur.
//
//   get soldeCentimes(): number
//     Le solde courant, en centimes. Dérivé des faits, jamais assigné de l'extérieur.
//
//   contribuer(membreId: string, montantCentimes: number): FaitAAjouter[]
//     - montant non entier ou <= 0 : lève `MontantInvalideError`, ne change rien.
//     - sinon : retourne `[ContributionEnregistree]` et le solde monte.
//
//   depenser(depenseId, membreId, montantCentimes, categorie): FaitAAjouter[]
//     Dans CET ordre de vérification, pour que l'erreur levée soit prévisible :
//     1. montant non entier ou <= 0 : `MontantInvalideError`.
//     2. `depenseId` déjà enregistré dans ce flux : `DepenseDejaEnregistreeError`.
//     3. montant > solde courant : `SoldeInsuffisantError`.
//     - sinon : retourne `[DepenseEnregistree]` et le solde baisse.
//
//   annulerDepense(depenseId: string, motif: string): FaitAAjouter[]
//     - dépense inconnue, ou déjà annulée : lève `AnnulationImpossibleError`.
//     - sinon : retourne `[DepenseAnnulee]` et le solde est recrédité du montant d'origine.
//
// ── DEUX POINTS QUI DÉCIDENT DE TOUT ────────────────────────────────────────────────────────
//
// 1. Une commande qui réussit doit mettre à jour l'état de l'instance EN MÊME TEMPS qu'elle
//    rend son fait. Sinon deux `depenser` d'affilée voient le même solde et passent toutes les
//    deux : l'invariant tomberait sans que le journal soit en cause. Le plus simple est d'avoir
//    une seule fonction privée qui applique un `Evenement` à l'état, et de l'utiliser aux DEUX
//    endroits : dans `rejouer`, et dans chaque commande.
//
// 2. Une commande qui lève ne doit rien changer. Vérifie avant de muter, pas l'inverse.
import type { StoredEvent } from "../shared/StoredEvent";
import type { FaitAAjouter } from "../shared/EventStore";

export class MontantInvalideError extends Error {}
export class SoldeInsuffisantError extends Error {}
export class DepenseDejaEnregistreeError extends Error {}
export class AnnulationImpossibleError extends Error {}

export class Cagnotte {
  static rejouer(_faits: readonly StoredEvent[]): Cagnotte {
    throw new Error("Cagnotte.rejouer n'est pas encore implémenté");
  }

  get soldeCentimes(): number {
    throw new Error("Cagnotte.soldeCentimes n'est pas encore implémenté");
  }

  contribuer(_membreId: string, _montantCentimes: number): FaitAAjouter[] {
    throw new Error("Cagnotte.contribuer n'est pas encore implémenté");
  }

  depenser(
    _depenseId: string,
    _membreId: string,
    _montantCentimes: number,
    _categorie: string,
  ): FaitAAjouter[] {
    throw new Error("Cagnotte.depenser n'est pas encore implémenté");
  }

  annulerDepense(_depenseId: string, _motif: string): FaitAAjouter[] {
    throw new Error("Cagnotte.annulerDepense n'est pas encore implémenté");
  }
}
