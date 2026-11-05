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
  private _statut: StatutInvitation = "emise";

  constructor(
    public readonly id: string,
    public readonly familleId: string,
    public readonly candidatId: string,
  ) {}

  get statut(): StatutInvitation {
    return this._statut;
  }

  accepter(): DomainEvent[] {
    if (this._statut !== "emise") {
      throw new InvitationDejaTraiteeError(`invitation ${this.id} déjà ${this._statut}`);
    }
    this._statut = "acceptee";
    return [new InvitationAcceptee(this.id, this.familleId, this.candidatId)];
  }

  refuserFautePlace(): DomainEvent[] {
    // On ne refuse faute de place que ce qu'on avait accepté. Un statut "emise" qui arrive
    // ici signale un processus cassé, pas un cas métier : il faut le dire fort.
    if (this._statut !== "acceptee") {
      throw new InvitationDejaTraiteeError(
        `invitation ${this.id} : refus faute de place impossible depuis le statut ${this._statut}`,
      );
    }
    this._statut = "refusee";
    return [new AdhesionRefuseeFautePlace(this.id, this.familleId, this.candidatId)];
  }
}
