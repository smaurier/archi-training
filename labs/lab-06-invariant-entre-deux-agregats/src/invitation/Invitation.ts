// Invitation.ts : PAGE BLANCHE (sauf l'erreur et les événements, qui sont donnés).
//
// Agrégat n°2. Il ne sait RIEN de la famille : il n'importe ni `../famille/`, ni
// `../adhesion/`, et aucun paquet npm. Il ne connaît même pas le plafond, il ne peut donc
// PAS vérifier lui-même qu'il reste une place. C'est tout le problème de ce lab.
//
// ── INVARIANT QU'IL PROTÈGE ─────────────────────────────────────────────────────────────
// Une invitation se traite une seule fois. Son cycle de vie est à elle : `emise` → `acceptee`
// → éventuellement `refusee` (quand l'adhésion n'a finalement pas pu aboutir).
//
// ── CONTRAT ─────────────────────────────────────────────────────────────────────────────
// export type StatutInvitation = "emise" | "acceptee" | "refusee"
//
// export class Invitation
//   constructor(readonly id: string, readonly familleId: string, readonly candidatId: string)
//
//   get statut(): StatutInvitation
//     "emise" au départ.
//
//   accepter(): DomainEvent[]
//     - si le statut n'est PAS "emise" : lève `InvitationDejaTraiteeError`, ne change rien.
//     - sinon : passe à "acceptee" et retourne
//       `[new InvitationAcceptee(this.id, this.familleId, this.candidatId)]`.
//
//   refuserFautePlace(): DomainEvent[]
//     - si le statut n'est PAS "acceptee" : lève `InvitationDejaTraiteeError`, ne change rien.
//       (on ne refuse faute de place qu'une invitation qu'on avait acceptée)
//     - sinon : passe à "refusee" et retourne
//       `[new AdhesionRefuseeFautePlace(this.id, this.familleId, this.candidatId)]`.
import type { DomainEvent } from "../shared/DomainEvent";

export class InvitationDejaTraiteeError extends Error {}

export type StatutInvitation = "emise" | "acceptee" | "refusee";

export class InvitationAcceptee implements DomainEvent {
  readonly kind = "InvitationAcceptee";
  readonly id = crypto.randomUUID();
  constructor(
    public readonly invitationId: string,
    public readonly familleId: string,
    public readonly candidatId: string,
  ) {}
}

export class AdhesionRefuseeFautePlace implements DomainEvent {
  readonly kind = "AdhesionRefuseeFautePlace";
  readonly id = crypto.randomUUID();
  constructor(
    public readonly invitationId: string,
    public readonly familleId: string,
    public readonly candidatId: string,
  ) {}
}

export class Invitation {
  constructor(
    public readonly id: string,
    public readonly familleId: string,
    public readonly candidatId: string,
  ) {}

  get statut(): StatutInvitation {
    throw new Error("Invitation.statut n'est pas encore implémenté");
  }

  accepter(): DomainEvent[] {
    throw new Error("Invitation.accepter n'est pas encore implémenté");
  }

  refuserFautePlace(): DomainEvent[] {
    throw new Error("Invitation.refuserFautePlace n'est pas encore implémenté");
  }
}
