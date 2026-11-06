// SoldeParMembre.ts : PAGE BLANCHE.
//
// Premier modèle de LECTURE. Il répond à une question que le côté écriture ne sait pas poser :
// « qui a mis combien, qui a dépensé combien ». L'agrégat, lui, ne connaît qu'un solde global :
// c'est exactement pour ça qu'un modèle de lecture existe.
//
// Il ne connaît PAS `Cagnotte`. Il ne connaît que le journal et le langage publié. L'oracle de
// frontières le vérifie : si une projection importe l'agrégat, le CQRS est décoratif.
//
// ── CONTRAT ─────────────────────────────────────────────────────────────────────────────────
// export class SoldeParMembre
//
//   get position(): number
//     Le POINT DE REPRISE : la position du dernier fait consommé, 0 au départ. C'est l'état de
//     la projection, au même titre que les chiffres qu'elle expose.
//
//   appliquer(faits: readonly StoredEvent[]): void
//     Consomme les faits dans l'ordre. Deux règles, et ce sont elles le geste :
//       - un fait dont la `position` est <= `position` est DÉJÀ consommé : on l'ignore.
//         C'est ce qui rend la projection idempotente, donc rejouable, donc réparable. Un
//         transport réel livre « au moins une fois » : sans ça, une dépense se compte deux fois.
//       - la position avance même sur un `kind` inconnu. Sinon la projection se bloquerait pour
//         toujours sur le premier fait qu'elle ne comprend pas.
//
//   contributionDe(membreId: string): number
//   depenseDe(membreId: string): number
//     Totaux en centimes pour ce membre, 0 s'il est inconnu. Les dépenses ANNULÉES ne comptent
//     pas : une annulation retire le montant du total du membre.
//
//   soldeCentimes(): number
//     Contributions totales moins dépenses non annulées. Doit retomber sur le solde de
//     l'agrégat : c'est l'objet de `test/coherence.spec.ts`.
//
// ── LE DÉTAIL QUI PIQUE ─────────────────────────────────────────────────────────────────────
// `DepenseAnnulee` ne porte que `depenseId` et `motif` : ni le membre, ni le montant. Pour
// défalquer, la projection doit avoir gardé de quoi retrouver la dépense d'origine. Une
// projection n'est pas une somme, c'est une petite machine avec sa mémoire.
import type { StoredEvent } from "../shared/StoredEvent";

export class SoldeParMembre {
  get position(): number {
    throw new Error("SoldeParMembre.position n'est pas encore implémenté");
  }

  appliquer(_faits: readonly StoredEvent[]): void {
    throw new Error("SoldeParMembre.appliquer n'est pas encore implémenté");
  }

  contributionDe(_membreId: string): number {
    throw new Error("SoldeParMembre.contributionDe n'est pas encore implémenté");
  }

  depenseDe(_membreId: string): number {
    throw new Error("SoldeParMembre.depenseDe n'est pas encore implémenté");
  }

  soldeCentimes(): number {
    throw new Error("SoldeParMembre.soldeCentimes n'est pas encore implémenté");
  }
}
