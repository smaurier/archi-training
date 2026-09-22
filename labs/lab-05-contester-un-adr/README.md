# Lab 05 — Intervention : contester un ADR existant, avec preuves

> **Outcome :** à la fin, tu sais qu'une décision d'architecture acceptée il y a 8 mois
> n'est pas gravée dans le marbre — mais qu'on ne la conteste pas avec une opinion plus
> récente, on la conteste avec un FAIT NOUVEAU et une preuve mesurable. Ce lab te fait vivre
> les deux : la démonstration (un test qui prouve l'énumérabilité du schéma actuel), puis la
> correction, puis l'ADR qui documente le changement.
> **Vrai outil :** TypeScript pur, `node:crypto` (`randomUUID`), vitest. La preuve n'est pas
> "les UUID c'est mieux" — c'est un test qui compte combien d'identifiants sur 20 sont
> devinables à partir du précédent (19/20 sur le schéma actuel, 0/20 après correction).
> **Feedback :** `npm run lab:05` — RED : la démonstration d'énumérabilité échoue (le
> schéma actuel EST énumérable, exactement ce qu'ADR-001 avait sous-estimé). `npm run
> solution:05` prouve l'oracle.

## Prérequis technique

`npm install` depuis `13-architecture/labs`.

## Lire avant (une lecture bornée)

- `ADR-001-identifiants-familles.md` (dans ce lab) — la décision originale, à contester.
- `FINDINGS.md` (dans ce lab) — le fait nouveau qui la remet en question.
- Module [`23-decisions-culture-et-capstone.md`](../../modules/23-decisions-culture-et-capstone.md)
  — comment contester une décision d'architecture sans juste dire "je ne suis pas
  d'accord".

## Énoncé

`src/IdGenerator.ts` génère des identifiants séquentiels, conformément à ADR-001. Le fait
nouveau (voir `FINDINGS.md`) : ces identifiants sont maintenant exposés dans un lien public.

**0. `FINDINGS.md` d'abord**, puis lis `src/IdGenerator.ts`.

**1. Corrige** `nextId()` pour qu'il génère des identifiants non-énumérables (UUID v4,
`node:crypto.randomUUID()`).

**2. Complète `ADR-002-identifiants-familles-uuid.md`** — il doit citer le fait nouveau
comme preuve, pas juste affirmer "c'est plus sûr". Un ADR honnête nomme aussi ce que la
décision COÛTE (indice : relis la conséquence "compact, index B-tree optimal" d'ADR-001 —
est-elle toujours vraie ?).

**Le piège à éviter.** "Mélanger" les deux schémas (garder un compteur ET y ajouter du
hasard, par exemple `${counter}-${Math.random()}`) donne l'impression d'avoir corrigé le
problème, mais le premier segment reste séquentiel et devinable — le test le détecte
précisément parce qu'il compare CHAQUE id généré au suivant, pas juste "est-ce que ça
ressemble à un UUID".

## Étapes (en friction)

1. Lis `FINDINGS.md`, puis `ADR-001-identifiants-familles.md`, puis `src/IdGenerator.ts`.
2. `npm run lab:05` : RED — la démonstration d'énumérabilité échoue sur le schéma actuel.
3. Remplace l'implémentation par `randomUUID()`.
4. Relance : les 3 tests doivent passer.
5. Complète `ADR-002-identifiants-familles-uuid.md`.

## Vérifier

```bash
cd 13-architecture/labs
npm install
npm run lab:05
npm run solution:05
```

**Ce que l'oracle vérifie**

Sur 20 identifiants générés, AUCUN ne se déduit du précédent par incrémentation (preuve
mesurée, pas supposée) ; chaque identifiant respecte le format UUID v4 ; les 20 identifiants
sont tous distincts (pas de collision triviale).

## Variante J+30 (fading)

ADR-001 vantait un index B-tree "optimal" avec des entiers séquentiels. Un UUID v4
aléatoire dégrade-t-il vraiment les performances d'index en pratique ? Cherche ce que
PostgreSQL propose pour limiter ce coût (indice : cours 10, UUID v7 / `ulid`).

## Application TribuZen

Même contestation sur `tribuzen-api` : migration réelle des IDs de `Family` vers UUID,
avec une migration de données non-destructive (cours 10, lab 05). Commit :
`fix(families): identifiants UUID non-énumérables — ADR-002 supersède ADR-001`.
