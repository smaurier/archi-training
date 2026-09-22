# Lab 03 — Intervention : extraire un domaine d'un monolithe, sans casser les appelants

> **Outcome :** à la fin, tu sais extraire un domaine cohérent (membership) d'une classe qui
> mélange plusieurs responsabilités (membership + facturation), sans toucher au seul
> appelant existant — et tu sais PROUVER que l'extraction est réelle, pas cosmétique (le
> nouveau module doit être utilisable SEUL, et l'ancien doit vraiment déléguer).
> **Vrai outil :** TypeScript pur, vitest. `InviteFlow.ts` (le vrai appelant) vit à la
> racine du lab — il n'est même pas dans `src/`, tu ne peux structurellement pas le toucher.
> **Feedback :** `npm run lab:03` — la non-régression est déjà VERTE, l'extraction est
> ROUGE. `npm run solution:03` prouve l'oracle.

## Prérequis technique

`npm install` depuis `13-architecture/labs`.

## Lire avant (une lecture bornée)

- Module [`09-ddd-strategique.md`](../../modules/09-ddd-strategique.md) — bounded contexts :
  pourquoi membership et facturation sont deux domaines, même s'ils vivent dans la même
  classe aujourd'hui.
- Module [`10-ddd-tactique.md`](../../modules/10-ddd-tactique.md) — une règle métier a un
  "foyer" ; la déplacer dans le bon module est un refactoring, pas une réécriture.

## Énoncé

`FamilyService` (`src/FamilyService.ts`) est **en production**, consommée par `InviteFlow.ts`
(à la racine du lab — **donné, ne se modifie pas**). Ticket : *« membership et facturation
sont deux domaines différents, mélangés dans une seule classe — extrais le domaine
MEMBERSHIP dans son propre module, sans changer l'API publique de FamilyService. »*

Lis le contrat exact en tête de `src/FamilyService.ts`. Crée `src/MembershipDomain.ts`
(déjà présent en page blanche), fais-y vivre la règle d'adhésion (limite de 8, pas de
doublon), et fais déléguer `FamilyService.inviteMember` à ce nouveau module.

**Le piège à éviter.** Créer `MembershipDomain.ts` mais garder la vérification `>= 8` ET
`.includes(email)` À L'INTÉRIEUR de `FamilyService` (juste "en plus" d'appeler le nouveau
module quelque part) donne l'illusion d'une extraction sans en être une : la règle vit
toujours à DEUX endroits, un jour ils divergeront. L'oracle relit littéralement le code
source de `FamilyService` pour vérifier que la règle n'y est plus.

## Étapes (en friction)

1. `npm run lab:03` : la non-régression passe déjà (rien n'est cassé) — mais MembershipDomain
   n'existe pas encore, l'extraction échoue.
2. Implémente `MembershipDomain` (contrat en tête de `FamilyService.ts`) — teste-le SEUL,
   sans jamais toucher `FamilyService`.
3. Fais déléguer `FamilyService.inviteMember` à `MembershipDomain` — retire la logique
   inline, garde la même signature publique.
4. Relance : les 9 tests (5 non-régression + 4 extraction) doivent passer ensemble.

## Vérifier

```bash
cd 13-architecture/labs
npm install
npm run lab:03
npm run solution:03
```

**Ce que l'oracle vérifie**

Non-régression, via le VRAI appelant `InviteFlow.ts` : inviter un membre fonctionne, un
doublon et une famille pleine sont refusés, les trois paliers de facturation renvoient le
bon prix. Extraction : `MembershipDomain` fonctionne seule (sans `FamilyService` ni concept
de facturation) ; `FamilyService.ts` importe bien `MembershipDomain` et ne contient plus la
règle inline (relecture du code source).

## Variante J+30 (fading)

Le produit veut maintenant une limite de membres différente selon le palier de facturation
(`free`: 4, `plus`: 8, `family`: illimité). Cette règle appartient-elle à
`MembershipDomain` (qui ne connaît pas la facturation) ou ailleurs ? Où tracerais-tu la
nouvelle frontière ?

## Application TribuZen

Même extraction sur `tribuzen-api`, avec en plus une vraie mesure de couverture de tests
avant/après pour prouver que rien n'a régressé silencieusement. Commit :
`refactor(family): extrait MembershipDomain, FamilyService délègue — API publique inchangée`.
