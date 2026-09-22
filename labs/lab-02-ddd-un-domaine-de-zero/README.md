# Lab 02 — DDD tactique de zéro : Value Object vs Entité, invariants, domain events

> **Outcome :** à la fin, tu sais distinguer dans ton CODE (pas juste sur un schéma) une
> ENTITÉ (identité stable, comparée par id) d'un VALUE OBJECT (immuable, comparé par
> valeur) — et tu sais protéger un invariant métier dans une racine d'agrégat, en émettant
> les domain events qui en découlent.
> **Vrai outil :** TypeScript pur, vitest. Aucun framework, aucune base de données — le DDD
> tactique se prouve avec des tests unitaires sur des objets, rien de plus.
> **Feedback :** `npm run lab:02` — RED tant que `src/Routine.ts` ne satisfait pas l'oracle.
> `npm run solution:02` prouve l'oracle.

## Prérequis technique

`npm install` depuis `13-architecture/labs`.

## Lire avant (une lecture bornée)

- Module [`10-ddd-tactique.md`](../../modules/10-ddd-tactique.md) — entité vs value object,
  racine d'agrégat, invariant métier, domain event nommé au passé.

## Énoncé

Modélise l'agrégat "Routine" de TribuZen (le fil rouge du streak — voir Quetzal). Lis les
commentaires en tête de `src/Routine.ts` : ils décrivent le contrat exact de `TimeOfDay`
(value object) et `Routine` (entité, racine d'agrégat).

**Le piège à éviter — et le cœur du lab.** `TimeOfDay.equals` et `Routine.equals` doivent se
comporter DIFFÉREMMENT : le premier compare les VALEURS (deux `TimeOfDay(8, 30)` distincts
en mémoire sont égaux), le second compare l'IDENTITÉ (deux `Routine` avec le même id sont
"la même routine" même si leur `label`/`streak` ont divergé). Coder les deux de la même
façon (par exemple, comparer tous les attributs de `Routine`) rate le point du DDD tactique :
une entité qui vient de changer d'état reste la MÊME entité.

## Étapes (en friction)

1. `npm run lab:02` : RED — seul le test de validation des bornes de `TimeOfDay` passe (il
   passe même sans implémentation, puisque `.of` lève toujours une erreur).
2. Implémente `TimeOfDay.of` (validation) et `.equals` (par valeur).
3. Implémente `Routine.complete` : invariant "pas deux fois le même jour", calcul du streak
   (consécutif vs remise à 1), émission des events.
4. Implémente `Routine.equals` (par id).
5. Relance : les 12 tests doivent passer.

## Vérifier

```bash
cd 13-architecture/labs
npm install
npm run lab:02
npm run solution:02
```

**Ce que l'oracle vérifie**

`TimeOfDay` : égalité par valeur (deux objets différents, mêmes hour/minute → égaux),
rejet des bornes invalides. `Routine` : égalité par identité (même id, état différent →
égaux ; id différent, état identique → PAS égaux). Invariants : streak à 1 le premier jour,
incrémenté sur des jours consécutifs, remis à 1 sur un jour manqué, `AlreadyCompletedError`
sur une double complétion le même jour. Domain events : `RoutineCompleted` à chaque
complétion, `StreakMilestoneReached` UNIQUEMENT quand le streak atteint exactement 7, 30 ou
100 (pas à 8, pas "à partir de 7").

## Variante J+30 (fading)

Le produit veut un streak "flexible" : un jour manqué ne remet PAS le streak à zéro s'il y a
un "joker" disponible (max 1 par mois). Où cette règle vit-elle : dans `Routine.complete`
directement, ou dans un domain service séparé ? Justifie avec le critère du module 10
("où est le foyer de la règle").

## Application TribuZen

Même agrégat sur `tribuzen-api` (cours 09 NestJS), persisté via un `RoutineRepository` port
(cours 13 lab 01) implémenté avec Prisma/PostgreSQL (cours 10). Commit :
`feat(routines): agrégat Routine, streak et domain events, VO/entité distingués`.
