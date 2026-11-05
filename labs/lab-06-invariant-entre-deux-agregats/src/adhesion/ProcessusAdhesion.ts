// ProcessusAdhesion.ts : PAGE BLANCHE. C'est le cœur du lab.
//
// Ce fichier est le SEUL endroit du lab autorisé à importer les DEUX agrégats. C'est son
// métier : coordonner. Les agrégats, eux, ne s'appellent jamais directement, c'est ce que
// l'oracle de frontières vérifie en relisant les imports.
//
// ── CE QU'IL DOIT RÉSOUDRE ──────────────────────────────────────────────────────────────
// L'invariant « une invitation acceptée ne doit pas faire dépasser le plafond » porte sur
// DEUX agrégats à la fois. Aucun des deux ne peut le tenir seul : la famille ne sait pas
// qu'une invitation existe, l'invitation ne connaît pas le plafond.
//
// Deux issues, et deux seulement :
//   (a) cohérence IMMÉDIATE : alors les deux ne formaient qu'un seul agrégat, et il faut les
//       fusionner (voir la variante J+30 du README) ;
//   (b) cohérence À TERME : l'acceptation est un fait accompli, et si la place a disparu
//       entre-temps, il faut COMPENSER. C'est la voie imposée ici, parce que les deux
//       agrégats ont des cycles de vie séparés.
//
// La compensation n'est pas un rattrapage honteux : c'est une règle métier à part entière.
// « L'invitation a été acceptée mais l'adhésion est refusée faute de place » est un fait que
// le métier doit pouvoir raconter.
//
// ── CONTRAT ─────────────────────────────────────────────────────────────────────────────
// export class ProcessusAdhesion
//   constructor(famille: Famille, invitations: Invitation[])
//
//   accepter(invitationId: string): DomainEvent[]
//     La commande. Trouve l'invitation (si elle n'existe pas, lève une erreur), l'accepte,
//     puis fait réagir le processus à chaque fait produit. Retourne TOUS les faits, dans
//     l'ordre : d'abord `InvitationAcceptee`, puis la suite (`MembreAccueilli` si la place
//     existait, `AdhesionRefuseeFautePlace` sinon).
//
//   reagir(evenement: DomainEvent): DomainEvent[]
//     Le consommateur d'événements, public parce qu'un transport réel le rappellera tout
//     seul, parfois DEUX FOIS avec le même fait.
//     - un `InvitationAcceptee` déjà traité (même `evenement.id`) : retourne `[]`, ne lève
//       pas, ne change rien. C'est l'idempotence, et c'est ce qui distingue un consommateur
//       d'événements d'une simple fonction.
//     - un `InvitationAcceptee` neuf : tente `famille.accueillir(candidatId)`. Si la famille
//       est pleine (`PlafondAtteintError`), compense avec `invitation.refuserFautePlace()`.
//     - tout autre `kind` : retourne `[]` (ce processus ne réagit qu'à l'acceptation).
import type { DomainEvent } from "../shared/DomainEvent";
import { Famille } from "../famille/Famille";
import { Invitation } from "../invitation/Invitation";

export class ProcessusAdhesion {
  constructor(
    private readonly famille: Famille,
    private readonly invitations: Invitation[],
  ) {}

  accepter(_invitationId: string): DomainEvent[] {
    throw new Error("ProcessusAdhesion.accepter n'est pas encore implémenté");
  }

  reagir(_evenement: DomainEvent): DomainEvent[] {
    throw new Error("ProcessusAdhesion.reagir n'est pas encore implémenté");
  }
}
