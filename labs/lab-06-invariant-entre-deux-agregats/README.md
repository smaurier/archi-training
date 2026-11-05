# Lab 06 : l'invariant qui traverse deux agrégats

> **Outcome :** à la fin, tu sais quoi faire d'une règle métier qui porte sur DEUX agrégats à la
> fois. Tu sais trancher entre les deux seules issues possibles (cohérence immédiate, donc un
> seul agrégat ; ou cohérence à terme, donc un fait et une compensation), tu sais le prouver par
> des tests, et tu sais pourquoi la troisième voie (un agrégat qui appelle l'autre) n'existe pas.
> **Vrai outil :** TypeScript pur, vitest. Aucun framework, aucune base, aucun broker. Le choix
> de frontière se prouve sur des objets, avant toute infrastructure.
> **Feedback :** `npm run lab:06` : RED tant que les trois fichiers de `src/` ne satisfont pas
> l'oracle. `npm run solution:06` prouve l'oracle.

## Prérequis technique

`npm install` depuis `13-architecture/labs`.

## Lire avant (une lecture bornée)

- Module [`10-ddd-tactique.md`](../../modules/10-ddd-tactique.md), section sur la frontière
  transactionnelle de l'agrégat : pourquoi un agrégat est l'unité de cohérence immédiate.
- Module [`17-event-driven-et-messaging.md`](../../modules/17-event-driven-et-messaging.md),
  seulement la partie sur la livraison « au moins une fois ».

⛔ Ne lis pas le module 18 (CQRS, event sourcing, saga) avant ton GREEN : il raconte la fin.

## Énoncé

TribuZen. Une famille a un plafond de membres. On invite des gens, ils acceptent plus tard.

La règle à tenir : **une invitation acceptée ne doit jamais faire dépasser le plafond de la
famille.** Elle porte sur deux agrégats, et aucun des deux ne peut la tenir seul : la famille
ignore qu'une invitation existe, l'invitation ignore le plafond.

Lis les commentaires en tête des trois fichiers de `src/` : ils décrivent le contrat exact de
`Famille`, `Invitation` et `ProcessusAdhesion`. Les erreurs et les événements sont donnés, la
logique est à toi.

### Le piège, et le cœur du lab

La solution qui vient à l'esprit est d'appeler `famille.accueillir()` depuis `Invitation`, ou
l'inverse. Elle ferait passer tous les tests de comportement, et elle est fausse : deux agrégats
qui s'appellent directement ne sont plus deux agrégats, ils sont un seul agrégat mal découpé,
avec deux transactions qui se croisent et un invariant que plus personne ne tient.

C'est pour ça que l'oracle relit tes imports (`test/frontieres.test.ts`). Le comportement juste
ne suffit pas : il faut que la coordination soit **au seul endroit qui a le droit de coordonner**.

### Les deux issues, et le choix est déjà fait ici

- **Cohérence immédiate.** La vérification et l'ajout tiennent dans une seule transaction. Mais
  alors l'invitation n'avait pas de cycle de vie propre, et les deux objets ne formaient qu'un
  agrégat. C'est la variante J+30 ci-dessous.
- **Cohérence à terme.** L'acceptation est un fait accompli : elle ne peut pas échouer parce que
  la famille a changé entre-temps. Si la place a disparu, il faut **compenser** par un autre fait
  métier (`AdhesionRefuseeFautePlace`). C'est la voie imposée ici, parce que les deux agrégats
  ont des cycles de vie séparés.

La compensation n'est pas un pansement technique : « ton invitation a été acceptée mais ton
adhésion est refusée faute de place » est un fait que le métier doit savoir raconter. Si ça te
paraît inacceptable côté produit, c'est le signal que le découpage était faux, et la variante
J+30 est ta réponse.

## Étapes (en friction)

1. `npm run lab:06` : 16 rouges sur 20. Les 4 verts sont `test/frontieres.test.ts`, et c'est
   normal : le squelette a déjà les bons imports. Ce fichier n'est pas un objectif, c'est un
   garde-fou. S'il passe au rouge pendant que tu codes, c'est que tu viens de faire parler un
   agrégat à l'autre.
2. `Famille` : l'ensemble des membres, le plafond refusé dans l'agrégat, l'accueil d'un membre
   déjà présent qui ne produit aucun fait.
3. `Invitation` : le cycle de vie `emise` puis `acceptee` puis éventuellement `refusee`.
4. `ProcessusAdhesion.accepter` : accepter, puis réagir au fait produit.
5. `ProcessusAdhesion.reagir` : accueillir si la place existe, compenser sinon. Lance les tests :
   il t'en reste un rouge.
6. Le dernier rouge est le rejeu. Trouve pourquoi un second passage du MÊME fait fait exploser
   une invitation déjà refusée, et rends `reagir` idempotent.

## Vérifier

```bash
cd 13-architecture/labs
npm install
npm run lab:06
npm run solution:06
```

**Ce que l'oracle vérifie**

`Famille` seule : accueil sous le plafond avec son fait, refus du membre de trop sans aucune
mutation, double accueil du même membre traité comme un non-événement (y compris famille pleine).
`Invitation` seule : statut initial, acceptation unique, refus faute de place impossible depuis
un autre statut que `acceptee`, identité propre à chaque fait. Coordination : le chemin normal
produit `InvitationAcceptee` puis `MembreAccueilli` dans cet ordre ; sur la dernière place, la
seconde acceptation produit `AdhesionRefuseeFautePlace`, la famille ne dépasse JAMAIS son
plafond, et le refus est inscrit dans l'invitation. Rejeu : le même fait livré deux fois
n'accueille pas deux fois, ne lève pas sur le chemin compensé, et ne produit aucun fait nouveau.
Frontières (relecture statique des imports) : `famille/` ignore `invitation/` et `adhesion/`,
`invitation/` ignore `famille/` et `adhesion/`, le noyau partagé n'importe rien, et
`adhesion/ProcessusAdhesion.ts` importe bien les deux.

## Variante J+30 (fading)

Le produit refuse la compensation : le candidat doit voir l'échec **immédiatement**, pas
recevoir un refus après coup. Refais le découpage avec cette contrainte : qui absorbe qui, quelle
transaction unique porte alors l'invariant, et qu'est-ce que tu perds (sur le cycle de vie de
l'invitation, sur la concurrence, sur la taille de l'agrégat) ? Écris le verdict en trois lignes
avant de toucher au code, puis dis si l'oracle de frontières de ce lab a encore un sens.

## Application TribuZen

Le plafond de membres est une vraie règle de TribuZen (palier gratuit contre palier payant), et
l'invitation y a bien un cycle de vie propre, asynchrone, avec un e-mail au milieu. Le geste
appris ici est donc directement réutilisable, et le choix fait dans ce lab (cohérence à terme) est
celui que la réalité du produit impose.
