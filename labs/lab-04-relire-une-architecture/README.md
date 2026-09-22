# Lab 04 — Intervention : relire une architecture, findings avant correction

> **Outcome :** à la fin, tu sais repérer, dans du code qui MARCHE et dont la démo passe,
> une violation de frontière architecturale discrète (un domaine qui importe
> l'infrastructure) — et tu sais la corriger par inversion de dépendance (le fait est passé
> en paramètre, pas recherché par le domaine lui-même).
> **Vrai outil :** TypeScript pur, vitest. Deux preuves : une relecture statique des
> `import` (comme lab 01), ET un test comportemental qui prouve que le paramètre est
> vraiment UTILISÉ, pas juste ajouté et ignoré.
> **Feedback :** `npm run lab:04` — la non-régression est déjà VERTE, la revue
> d'architecture est ROUGE. `npm run solution:04` prouve l'oracle. `FINDINGS.md` se remplit
> AVANT tout code, le correcteur le lit en premier.

## Prérequis technique

`npm install` depuis `13-architecture/labs`.

## Lire avant (une lecture bornée)

- Module [`06-architecture-hexagonale.md`](../../modules/06-architecture-hexagonale.md) —
  ce qu'un domaine a le droit de savoir.
- Ton lab 01 (ce cours) — la même technique de preuve (relecture des `import`), appliquée
  cette fois à trouver une violation existante plutôt qu'à en garantir l'absence dès le
  départ.

## Énoncé

`src/domain/NotificationPolicy.ts` est **en production**, consommée par
`application/send-notification.usecase.ts`. Un collègue sent qu'il y a un problème
architectural mais n'arrive pas à le nommer précisément.

**0. `FINDINGS.md`, avant toute ligne de code.** Ouvre UNIQUEMENT
`src/domain/NotificationPolicy.ts` et `src/infrastructure/EmailGateway.ts` — rien d'autre —
et remplis `FINDINGS.md`.

**1. Corrige.** `shouldNotify` devient une fonction PURE : elle reçoit
`emailGatewayAvailable: boolean` en paramètre au lieu d'appeler `isEmailGatewayUp()`
elle-même. `application/send-notification.usecase.ts` s'adapte pour faire cet appel et
transmettre le résultat — c'est LUI qui orchestre l'I/O, pas le domaine.

**Le piège à éviter.** Ajouter le paramètre `emailGatewayAvailable` à `shouldNotify` sans
retirer l'appel à `isEmailGatewayUp()` À L'INTÉRIEUR (garder les deux "au cas où") laisse la
violation intacte — le domaine importe toujours l'infrastructure, le paramètre ajouté ne
sert à rien. Le test comportemental de ce lab le démasque : si le paramètre est ignoré, lui
passer `false` ne change rien au résultat.

## Étapes (en friction)

1. Remplis `FINDINGS.md`.
2. `npm run lab:04` : non-régression verte, revue rouge.
3. Change la signature de `shouldNotify`, retire l'import infrastructure du domaine.
4. Adapte `send-notification.usecase.ts` pour appeler `isEmailGatewayUp()` et transmettre le
   résultat.
5. Relance : les 6 tests doivent passer.

## Vérifier

```bash
cd 13-architecture/labs
npm install
npm run lab:04
npm run solution:04
```

**Ce que l'oracle vérifie**

Non-régression, via le VRAI point d'entrée `decideNotification` : la décision ne change pas.
Revue : `domain/NotificationPolicy.ts` n'importe plus rien depuis `infrastructure/`
(relecture du source) ; `shouldNotify` utilise VRAIMENT le paramètre reçu — passer `false`
change le résultat, même avec un utilisateur opted-in.

## Variante J+30 (fading)

Le produit ajoute un canal SMS. `shouldNotify`, telle que corrigée, sert-elle tel quel pour
ce nouveau canal ? Qu'est-ce que ta correction du lab a rendu possible que la version
originale ne permettait pas ?

## Application TribuZen

Même revue sur une vraie PR de `tribuzen-api` : un domaine qui importe discrètement un
détail d'infrastructure est le genre de violation qui passe une revue rapide sans FINDINGS.
Commit : `refactor(notifications): domaine pur, l'application orchestre l'I/O`.
