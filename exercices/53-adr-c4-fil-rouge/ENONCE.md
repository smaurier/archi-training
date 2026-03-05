# Exercice 53 — ADR et diagrammes C4 du fil rouge

> 🟠 **Difficulté** : Arbitrage | **Temps estimé** : 2h | **Ère** : 7 — L'Architecte
>
> **Prérequis** : Module 12 (cours 1)


## Objectif

Documenter l'architecture de ShopArch avec des ADR (Architecture Decision Records) et des diagrammes C4 (Context, Container, Component).

## Contexte

ShopArch n'a pas de documentation architecturale formelle. Les decisions sont prises en reunion et oubliees. Les nouveaux développeurs ne comprennent pas pourquoi certains choix ont ete faits.

## Temps estime

1h30

## Instructions

### Étape 1 — ADR template
Adopte le format ADR de Michael Nygard :
- Titre, Date, Statut (proposed/accepted/deprecated/superseded)
- Contexte (pourquoi cette decision est nécessaire)
- Decision (ce qu'on a decide)
- Consequences (positives, negatives, risques)

### Étape 2 — 3 ADR pour ShopArch
Redige 3 ADR pour des decisions architecturales cles :
1. **ADR-001** : Choix de PostgreSQL vs MongoDB pour la base principale
2. **ADR-002** : Schema-per-tenant vs Row-Level Security pour le multi-tenant
3. **ADR-003** : BFF vs API Gateway pour l'aggregation front-end

### Étape 3 — Diagrammes C4
Dessine les 3 premiers niveaux de C4 :
- **Level 1 — Context** : ShopArch dans son environnement (utilisateurs, systèmes externes)
- **Level 2 — Container** : les conteneurs (API, BFF, DB, Redis, ES, queues)
- **Level 3 — Component** : les composants du service Order (controller, service, repository, FSM)

### Étape 4 — C4 as code
Ecris les diagrammes C4 en Structurizr DSL ou Mermaid (versionnable dans git) :
- Le diagramme est généré depuis le code (pas un PNG dans un wiki)
- Le code est a côté du code source (dans /docs)
- CI valide que le DSL est syntaxiquement correct

### Bonus
- Ajouter le Level 4 — Code pour le module Order
- Implémenter un script de génération automatique des diagrammes
- Lier les ADR aux diagrammes (ADR-002 → zoom sur la couche DB du C4)

## Contraintes
- Les ADR doivent lister les alternatives considerees (pas juste la decision finale)
- Les diagrammes C4 doivent etre générés depuis du code (pas dessinés dans un outil)
- Chaque ADR doit avoir au moins 1 consequence negative (decision = trade-off)
