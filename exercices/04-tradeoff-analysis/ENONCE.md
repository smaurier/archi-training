# Exercice 04 — Trade-off analysis d'un cas reel

> 🟡 **Difficulté** : Conception | **Temps estimé** : 1h30 | **Ère** : 1 — Les Fondations
>
> **Prérequis** : Module 00 (cours 6)


## Objectif

Pratiquer le raisonnement d'architecte : analyser un besoin, identifier les options, évaluer les trade-offs, et justifier un choix.

## Temps estime

1h

## Contexte

ShopArch doit ajouter un système de recherche produits. L'équipe hesite entre 3 approches :

| Option | Description |
|---|---|
| **A** | PostgreSQL `LIKE` / `ILIKE` sur le champ `name` |
| **B** | PostgreSQL Full-Text Search (`tsvector` + `GIN` index) |
| **C** | Elasticsearch dédié (cluster séparé) |

Le contexte :
- 50 000 produits aujourd'hui, objectif 500 000 dans 2 ans
- Équipe de 4 développeurs back-end
- Budget infra modere (cloud manage, pas de DBA dédié)
- Besoin : recherche par nom, description, categorie. Pas de recherche semantique pour l'instant.
- Temps de réponse cible : < 200ms p95

## Instructions

### Étape 1 — Identifier les architecture characteristics (15 min)

Pour ce besoin de recherche, classe ces "-ilities" par importance (1 = critique, 5 = nice-to-have) :

| -ility | Importance (1-5) | Justification |
|---|---|---|
| Performance (latence) | | |
| Scalabilite (volume de données) | | |
| Maintenabilite (complexité ops) | | |
| Cout (infra + dev) | | |
| Evolvabilite (ajouter des features de recherche) | | |
| Fiabilite (tolerance de panne) | | |

### Étape 2 — Matrice de trade-offs (20 min)

Remplis cette matrice pour les 3 options :

| Critère | Option A (ILIKE) | Option B (FTS PG) | Option C (Elasticsearch) |
|---|---|---|---|
| Performance a 50K produits | | | |
| Performance a 500K produits | | | |
| Pertinence des résultats | | | |
| Complexite d'implémentation | | | |
| Cout operationnel | | | |
| Courbe d'apprentissage équipe | | | |
| Evolvabilite (facettes, suggestions, typo-tolerance) | | | |
| Single point of failure | | | |

Utilise : ✓✓ (excellent), ✓ (bon), ~ (acceptable), ✗ (mauvais), ✗✗ (tres mauvais)

### Étape 3 — Rediger un ADR (25 min)

Ecris un Architecture Decision Record en suivant ce template :

```markdown
# ADR-XXX : Choix du moteur de recherche produits

## Statut
Propose

## Contexte
[Decris le besoin et les contraintes]

## Options envisagees
### Option A — ...
### Option B — ...
### Option C — ...

## Decision
[Quelle option et POURQUOI]

## Consequences
### Positives
- ...
### Negatives
- ...
### Risques
- ...

## Plan d'evolution
[Comment migrer si les besoins changent]
```

## Bonus

- Dessine un diagramme ASCII de l'architecture cible avec l'option choisie
- Definis 2 fitness functions qui verifieront automatiquement que la recherche respecte les contraintes (ex: "p95 < 200ms", "index < 5GB")

## Contraintes

- Pas de réponse "ca dépend" sans justification precise
- Chaque choix doit etre argumente avec des données (meme estimees)
- Si tu recommandes B avec migration possible vers C, explique le trigger de migration
