# Exercice 47 — SLOs et error budgets

> 🟡 **Difficulté** : Conception | **Temps estimé** : 1h30 | **Ère** : 6 — La Défense
>
> **Prérequis** : Module 10 (cours 2)


## Objectif

Définir des SLIs, SLOs et error budgets pour les services critiques de ShopArch, et implémenter un système de suivi automatise.

## Contexte

ShopArch n'a pas de SLOs définis. L'équipe ne sait pas si le service est "assez rapide" ou "assez disponible". Il faut des objectifs mesurables pour prioriser les efforts de fiabilité vs les nouvelles features.

## Temps estime

1h

## Instructions

### Étape 1 — Définir les SLIs
Identifie les SLIs (Service Level Indicators) pour chaque service :
- Disponibilité : % de requêtes avec status 2xx ou 4xx (hors 5xx)
- Latence : % de requêtes completees en < X ms
- Correctness : % de réponses avec les bonnes données (checkout amount correct)
- Freshness : % du temps ou les données sont a jour (cache < 5 min de retard)

### Étape 2 — Définir les SLOs
Fixe des SLOs realistes :
- API Catalogue : 99.9% disponibilité, 95% des requêtes < 200ms
- Checkout : 99.95% disponibilité, 99% des requêtes < 1s
- Recherche : 99.5% disponibilité, 90% des requêtes < 500ms
- Justifie chaque SLO (pourquoi 99.9% et pas 99.99% ?)

### Étape 3 — Calculer l'error budget
Pour chaque SLO, calcule l'error budget :
- Error budget = 1 - SLO (ex: 99.9% → 0.1% d'erreurs autorisees)
- En minutes par mois : 0.1% × 43 800 min = 43.8 min de downtime autorise
- Consommation actuelle de l'error budget

### Étape 4 — Politique d'error budget
Définir les actions quand l'error budget est consomme :
- > 50% consomme : alerte, review des deployments
- > 80% consomme : gel des features, focus fiabilité
- 100% consomme : rollback automatique des deployments, post-mortem obligatoire

### Bonus
- Implémenter un SLO dashboard en temps réel
- Calculer le composite SLO (SLO global de ShopArch)
- Implémenter des burn rate alerts (alerte si consommation trop rapide)

## Contraintes
- Chaque SLO doit etre mesurable automatiquement (pas de SLO subjectif)
- Les SLIs doivent etre bases sur les metriques Prometheus de l'exercice précédent
- L'error budget doit etre suivi sur une fenêtre glissante de 30 jours
