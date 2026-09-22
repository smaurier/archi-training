# Lab 01 — Architecture hexagonale de zéro : frontières prouvées par les tests, ADR par coupe

> **Outcome :** à la fin, tu as construit une fonctionnalité complète en hexagonale
> (domaine → port → application → adaptateur) et tu sais PROUVER chaque frontière — pas
> juste la dessiner sur un schéma. Le domaine n'importe rien d'externe (vérifié en relisant
> le code source, pas en le déclarant) ; l'application est testée avec un FAUX port, jamais
> le vrai adaptateur ; un vrai test d'intégration prouve que tout s'assemble quand même.
> **Vrai outil :** TypeScript pur, vitest. Aucun framework — l'architecture hexagonale n'a
> besoin de rien d'autre pour exister.
> **Feedback :** `npm run lab:01` — RED tant que `src/` ne satisfait pas l'oracle.
> `npm run solution:01` prouve l'oracle. L'ADR (`ADR-001-frontieres-hexagonales.md`) se
> remplit APRÈS ton GREEN, le correcteur le lit avec ton code.

## Prérequis technique

`npm install` depuis `13-architecture/labs`.

## Lire avant (une lecture bornée)

- Module [`06-architecture-hexagonale.md`](../../modules/06-architecture-hexagonale.md) —
  domaine, port, adaptateur, pourquoi l'application ne connaît jamais une implémentation
  concrète.
- Module [`04-dependency-injection-ioc.md`](../../modules/04-dependency-injection-ioc.md) —
  inversion de dépendance : le use case DÉPEND d'une interface qu'IL définit (via le
  domaine), pas l'inverse.

## Énoncé

Construis, de zéro, la fonctionnalité "inviter un membre dans une famille" TribuZen :

- `domain/Family.ts` + `domain/family.repository.port.ts` — la logique métier ET le contrat
  (interface) dont l'application aura besoin, ZÉRO import hors de `domain/`.
- `application/invite-member.usecase.ts` — orchestre via le PORT uniquement.
- `infrastructure/in-memory-family.repository.ts` — un adaptateur concret du port.

Lis les commentaires en tête de chaque fichier — ils décrivent le contrat exact.

**Le piège à éviter.** Importer `InMemoryFamilyRepository` dans le use case "pour aller plus
vite" fait marcher le code, mais casse l'inversion de dépendance : l'application devient
couplée à UN choix d'infrastructure. Le test d'application de ce lab utilise un FAUX port
écrit dans le test lui-même — s'il fallait la vraie classe pour que ça marche, ce ne serait
plus une preuve d'isolation.

## Étapes (en friction)

1. `npm run lab:01` : RED partout sauf la vérification des frontières (qui porte sur les
   `import`, pas sur le comportement — elle passe déjà, rien à y faire).
2. Implémente `Family` (règles métier), puis `InMemoryFamilyRepository` (le plus simple),
   puis `InviteMemberUseCase` en dernier — il a besoin des deux autres.
3. Relance à chaque étape. Les tests DOMAINE, puis APPLICATION, puis INTÉGRATION
   s'allument dans cet ordre si tu avances comme ça.
4. Une fois GREEN, remplis `ADR-001-frontieres-hexagonales.md`.

## Vérifier

```bash
cd 13-architecture/labs
npm install
npm run lab:01
npm run solution:01
```

**Ce que l'oracle vérifie**

Frontières (relecture statique des `import`) : le domaine n'importe rien depuis
`application/`/`infrastructure/` ni aucun paquet npm ; l'application n'importe rien depuis
`infrastructure/`. Domaine : les règles métier (limite de membres, doublon d'email) en test
unitaire pur. Application : le use case testé avec un FAUX port (écrit dans le test), preuve
d'isolation réelle. Intégration : le VRAI câblage (use case + `InMemoryFamilyRepository`)
fonctionne de bout en bout.

## Variante J+30 (fading)

Le produit veut notifier l'invité par email après l'ajout. Cette notification appartient-
elle au domaine, à l'application, ou à un troisième port (`NotificationPort`) ? Justifie.

## Application TribuZen

Même structure sur `tribuzen-api` (cours 09 NestJS) : le port `FamilyRepository`
s'implémente alors avec Prisma/PostgreSQL (cours 10) au lieu d'une Map en mémoire — le use
case, lui, ne change pas d'une ligne. Commit :
`feat(members): invite-member en hexagonale, frontières prouvées par les tests`.
