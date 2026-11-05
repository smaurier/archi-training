// Famille.ts : PAGE BLANCHE (sauf l'erreur et l'événement, qui sont donnés).
//
// Agrégat n°1. Il ne sait RIEN de l'invitation : il n'importe ni `../invitation/`, ni
// `../adhesion/`, et aucun paquet npm. Son seul voisin autorisé est `../shared/`.
//
// ── INVARIANT QU'IL PROTÈGE, ET QUI N'EST QU'À LUI ──────────────────────────────────────
// Une famille n'a jamais plus de membres que son plafond. Cet invariant est tenu DANS cette
// classe, pas par l'appelant : si `accueillir` acceptait un membre de trop, aucune relecture
// extérieure ne pourrait le rattraper.
//
// ── CONTRAT ─────────────────────────────────────────────────────────────────────────────
// export class Famille
//   constructor(readonly id: string, readonly plafondMembres: number, membresInitiaux?: string[])
//
//   get membres(): readonly string[]
//     Les membres actuels. Un membre y figure AU PLUS une
//     fois : `membres` est un ensemble, pas une liste à doublons.
//
//   accueillir(membreId: string): DomainEvent[]
//     - si `membreId` est DÉJÀ membre : ne change rien et retourne `[]` (aucun fait nouveau
//       ne s'est produit ; accueillir deux fois la même personne n'est pas un événement).
//     - si la famille est PLEINE (`membres.length === plafondMembres`) : lève
//       `PlafondAtteintError` et ne change rien.
//     - sinon : ajoute le membre et retourne `[new MembreAccueilli(this.id, membreId)]`.
import type { DomainEvent } from "../shared/DomainEvent";

export class PlafondAtteintError extends Error {}

export class MembreAccueilli implements DomainEvent {
  readonly kind = "MembreAccueilli";
  readonly id = crypto.randomUUID();
  constructor(
    public readonly familleId: string,
    public readonly membreId: string,
  ) {}
}

export class Famille {
  constructor(
    public readonly id: string,
    public readonly plafondMembres: number,
    _membresInitiaux: string[] = [],
  ) {}

  get membres(): readonly string[] {
    throw new Error("Famille.membres n'est pas encore implémenté");
  }

  accueillir(_membreId: string): DomainEvent[] {
    throw new Error("Famille.accueillir n'est pas encore implémenté");
  }
}
