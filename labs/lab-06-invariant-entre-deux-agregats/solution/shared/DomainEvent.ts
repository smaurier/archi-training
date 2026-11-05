// Identique au starter : le noyau partagé est donné, il n'y a rien à trouver ici.
export interface DomainEvent {
  readonly kind: string;
  readonly id: string;
}
