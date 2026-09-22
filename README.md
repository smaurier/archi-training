# Architecture Logicielle — Front, Back, Globale

![VitePress](https://img.shields.io/badge/-VitePress-646CFF?style=flat-square&logo=vite&logoColor=white)
![TypeScript](https://img.shields.io/badge/-TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white)
[![fullstack-autotraining](https://img.shields.io/badge/curriculum-fullstack--autotraining-4C1?style=flat-square)](https://github.com/smaurier/fullstack-autotraining)

<!-- labs-gestes:start -->
## Labs — refonte du 22/09/2026 : un lab = un geste métier complet

> Règle qualité 5 du parcours : chaque lab est **un geste métier complet**, sous deux formes — **Zéro** (construire de zéro un artefact réel et entier) ou **Intervention** (modifier de l'existant avec consommateurs, findings avant code, non-régression). Un lab n'entre en file qu'avec un **oracle exécutable** (`src/` starter · `test/` · `solution/` séparée). Les labs historiques de ce cours (un concept par lab, sans oracle) restent dans `labs/` jusqu'à remplacement et **ne sont plus la file**. Cible détaillée : [`docs/gestes-complets.md`](../docs/gestes-complets.md). État : **5/5 avec oracle**.

| # | Lab | Forme | Geste | Oracle |
|---|-----|-------|-------|--------|
| 01 | [`lab-01-clean-hexagonal-de-zero`](labs/lab-01-clean-hexagonal-de-zero/README.md) | Zéro | frontières prouvées par les tests, ADR par coupe | ✅ vérifié |
| 02 | [`lab-02-ddd-un-domaine-de-zero`](labs/lab-02-ddd-un-domaine-de-zero/README.md) | Zéro | modélisation + tests du domaine | ✅ vérifié |
| 03 | [`lab-03-extraire-un-domaine`](labs/lab-03-extraire-un-domaine/README.md) | Intervention | d'un monolithe existant, sans casser les consommateurs | ✅ vérifié |
| 04 | [`lab-04-relire-une-architecture`](labs/lab-04-relire-une-architecture/README.md) | Intervention | findings, sparring archi | ✅ vérifié |
| 05 | [`lab-05-contester-un-adr`](labs/lab-05-contester-un-adr/README.md) | Intervention | réécrire un ADR existant avec preuves | ✅ vérifié |

<!-- labs-gestes:end -->

## Lancer le cours

Ce cours n'utilise pas VitePress. Ouvre directement les fichiers Markdown dans `cours/` avec ton éditeur, ou lis-les sur GitHub.

Pour les exercices :
```bash
cd exercices/
# Chaque exercice contient un ENONCE.md, une CHECKLIST.md et une CORRECTION.md
```

## Structure

```
10-architecture/
├── cours/            ← Leçons Markdown par module thématique
├── exercices/        ← Exercices (ENONCE + CORRECTION)
├── projet-fil-rouge/ ← Projet qui grandit au fil du cours
└── cours/parcours.md ← Plan de formation complet
```

## Parcours

Consulte `cours/parcours.md` ou ouvre le site VitePress pour le plan de formation détaillé.

Le parcours relie les cours, les exercices et le projet fil rouge pour appliquer les choix d'architecture sur des cas concrets : decoupage monolithe vs microservices, architecture hexagonale/clean, integration inter-services (sync/async) et arbitrages entre simplicite, fiabilite et cout d'exploitation.
