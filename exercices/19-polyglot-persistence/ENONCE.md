# Exercice 19 — Polyglot persistence

> 🟡 **Difficulté** : Conception | **Temps estimé** : 1h | **Ère** : 4 — L'Autre Côté
>
> **Prérequis** : Module 04 (cours 5)


## Objectif

Choisir le bon type de base de données pour chaque besoin de ShopArch et justifier chaque choix.

## Contexte

ShopArch a différents besoins de stockage : données relationnelles, cache, recherche full-text, sessions, analytics. Un seul PostgreSQL ne suffit pas pour tout faire de manière optimale.

## Temps estime

45 min

## Instructions

### Étape 1 — Analyser les besoins

| Besoin | Caractéristiques |
|---|---|
| Catalogue produits | Relationnel, FK, transactions, i18n JSONB |
| Sessions utilisateur | Ephemeres (TTL 30min), key-value, rapide |
| Cache API | TTL variable, invalidation par tag, rapide |
| Recherche produits | Full-text, facettes, ranking, stemming |
| Analytics / events | Append-only, time-series, aggregations |
| Panier | Semi-structure, TTL 7 jours, rapide |
| File d'attente jobs | FIFO, persistent, retry, dead-letter |

### Étape 2 — Choisir la base

Pour chaque besoin, choisis UNE technologie et justifie :

| Technologie | Type |
|---|---|
| PostgreSQL | Relationnel |
| Redis | Key-value / Cache |
| Elasticsearch | Search engine |
| MongoDB | Document store |
| ClickHouse | Column-oriented analytics |
| TimescaleDB | Time-series (extension PG) |

### Étape 3 — Architecture polyglot

Dessine l'architecture montrant comment les différentes bases interagissent avec l'API.

### Bonus

- Proposer une stratégie de sync entre PostgreSQL et Elasticsearch
- Évaluer le cout operationnel de chaque base ajoutee

## Contraintes

- Justifier chaque choix par au moins 2 arguments techniques
- Identifier quand NE PAS ajouter une base supplementaire (PostgreSQL suffit)
- Le nombre de bases doit rester raisonnable pour l'équipe
