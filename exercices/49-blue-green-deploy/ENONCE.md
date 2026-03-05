# Exercice 49 — Blue-green deployment

> 🟠 **Difficulté** : Arbitrage | **Temps estimé** : 1h30 | **Ère** : 6 — La Défense
>
> **Prérequis** : Module 10 (cours 4)


## Objectif

Implémenter une stratégie blue-green deployment pour ShopArch avec zero downtime, rollback instantane, et migration de base de données compatible.

## Contexte

ShopArch a actuellement du downtime lors des deployments (2-5 min). Les migrations de schema cassent parfois la retrocompatibilite. L'objectif est de déployer sans interruption de service.

## Temps estime

1h

## Instructions

### Étape 1 — Architecture blue-green
Dessine l'architecture blue-green :
- Blue = environnement actif (recoit le trafic)
- Green = environnement de pre-production (nouvelle version)
- Load balancer / router switch le trafic de blue → green
- Les deux environnements partagent la base de données

### Étape 2 — Migrations backward-compatible
Ecris des migrations de schema qui ne cassent pas la version active :
- Ajouter une colonne : migrer d'abord, déployer ensuite
- Renommer une colonne : add new → deploy (dual-write) → migrate data → drop old
- Supprimer une colonne : déployer sans la colonne → migrer ensuite
- Jamais de migration destructive en une seule étape

### Étape 3 — Switch et vérification
Implemente le switch de trafic :
- Health check sur green avant de switcher
- Switch progressif (1% → 10% → 50% → 100%)
- Monitoring pendant le switch (latence, erreurs)
- Rollback : re-switcher vers blue si erreurs > seuil

### Étape 4 — Cleanup
Apres un deployment réussi :
- Garder blue en standby pendant 1h (rollback possible)
- Mettre a jour blue avec la nouvelle version (pour le prochain deploy)
- Supprimer les colonnes deprecated de la migration précédente

### Bonus
- Implémenter un canary deployment comme alternative
- Ajouter un database migration safety check dans le CI
- Automatiser le switch avec un script Kubernetes

## Contraintes
- Zero downtime pendant le deployment
- Rollback en < 30 secondes
- Les migrations de schema doivent etre backward-compatible
