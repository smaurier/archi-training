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
  // Un ensemble, pas un tableau : l'unicité du membre est une propriété de la structure,
  // pas une vérification qu'on pourrait oublier d'écrire.
  private readonly _membres: Set<string>;

  constructor(
    public readonly id: string,
    public readonly plafondMembres: number,
    membresInitiaux: string[] = [],
  ) {
    this._membres = new Set(membresInitiaux);
  }

  get membres(): readonly string[] {
    return [...this._membres];
  }

  accueillir(membreId: string): DomainEvent[] {
    // Rien de nouveau ne s'est produit : pas d'événement, et surtout pas d'erreur. Accueillir
    // deux fois la même personne est un non-événement, pas une faute.
    if (this._membres.has(membreId)) return [];

    // L'invariant est refusé ICI. Le plafond n'est pas « vérifié par l'appelant » : l'agrégat
    // est incapable d'entrer dans un état interdit, même appelé n'importe comment.
    if (this._membres.size >= this.plafondMembres) {
      throw new PlafondAtteintError(
        `famille ${this.id} : plafond de ${this.plafondMembres} membres atteint`,
      );
    }

    this._membres.add(membreId);
    return [new MembreAccueilli(this.id, membreId)];
  }
}
