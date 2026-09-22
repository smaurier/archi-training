// Family.ts — PAGE BLANCHE. Le DOMAINE : la logique métier pure, ZÉRO import hors de
// `domain/` (pas de framework, pas d'infrastructure, pas même de `application/`). C'est la
// frontière la plus stricte de l'architecture hexagonale — l'oracle la VÉRIFIE (relecture du
// code source, pas juste "en théorie").
//
// export class Family
//   constructor(id: string, name: string, memberEmails: string[] = [])
//   readonly id, readonly name, propriété (accès contrôlé) memberEmails
//
//   canAcceptNewMember(): boolean — règle métier : une famille a AU PLUS 8 membres.
//   hasMember(email: string): boolean — un email déjà membre (comparaison insensible à la casse).
//   addMember(email: string): void — ajoute l'email SI canAcceptNewMember() ET !hasMember(email),
//     sinon lève une erreur du domaine (voir errors.ts).
//
// export class FamilyFullError extends Error — levée par addMember quand la famille est pleine.
// export class DuplicateMemberError extends Error — levée par addMember sur un email déjà membre.
export const MAX_MEMBERS = 8;

export class FamilyFullError extends Error {}
export class DuplicateMemberError extends Error {}

export class Family {
  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly memberEmails: string[] = [],
  ) {}

  canAcceptNewMember(): boolean {
    throw new Error("canAcceptNewMember n'est pas encore implémenté");
  }

  hasMember(_email: string): boolean {
    throw new Error("hasMember n'est pas encore implémenté");
  }

  addMember(_email: string): void {
    throw new Error("addMember n'est pas encore implémenté");
  }
}
