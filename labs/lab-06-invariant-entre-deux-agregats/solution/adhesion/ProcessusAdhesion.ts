import type { DomainEvent } from "../shared/DomainEvent";
import { Famille, PlafondAtteintError } from "../famille/Famille";
import type { Invitation, InvitationAcceptee } from "../invitation/Invitation";

// Le contrat d'un événement, c'est son `kind`, pas sa classe : un fait qui a voyagé (file,
// base, HTTP) arrive désérialisé et ne passe plus `instanceof`. On discrimine donc sur le
// nom du fait, et on ne s'autorise la lecture des champs qu'après.
function estInvitationAcceptee(evenement: DomainEvent): evenement is InvitationAcceptee {
  return evenement.kind === "InvitationAcceptee";
}

export class ProcessusAdhesion {
  // La mémoire des faits déjà consommés. C'est elle qui rend `reagir` idempotent, et donc le
  // processus rejouable. Sans elle, une seconde livraison du même fait tenterait un second
  // refus et ferait exploser l'invitation (InvitationDejaTraiteeError) : une panne causée par
  // le transport, pas par le métier.
  private readonly faitsTraites = new Set<string>();

  constructor(
    private readonly famille: Famille,
    private readonly invitations: Invitation[],
  ) {}

  accepter(invitationId: string): DomainEvent[] {
    const invitation = this.invitations.find((i) => i.id === invitationId);
    if (!invitation) throw new Error(`invitation inconnue : ${invitationId}`);

    // L'acceptation est un fait accompli : elle réussit ou elle lève, mais elle ne dépend pas
    // de l'état de la famille. C'est exactement ce qui interdit la cohérence immédiate.
    const faits = invitation.accepter();

    const suites = faits.flatMap((fait) => this.reagir(fait));
    return [...faits, ...suites];
  }

  reagir(evenement: DomainEvent): DomainEvent[] {
    if (!estInvitationAcceptee(evenement)) return [];

    // Au moins une fois : le même fait peut revenir. Deuxième passage, aucune suite.
    if (this.faitsTraites.has(evenement.id)) return [];
    this.faitsTraites.add(evenement.id);

    try {
      return this.famille.accueillir(evenement.candidatId);
    } catch (erreur) {
      if (!(erreur instanceof PlafondAtteintError)) throw erreur;

      // Compensation. La place a disparu entre l'acceptation et son traitement : on ne
      // triche pas avec l'invariant de la famille, on produit le fait métier qui dit que
      // l'adhésion n'aboutit pas.
      const invitation = this.invitations.find((i) => i.id === evenement.invitationId);
      if (!invitation) throw erreur;
      return invitation.refuserFautePlace();
    }
  }
}
