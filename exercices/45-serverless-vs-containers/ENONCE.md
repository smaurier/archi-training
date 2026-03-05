# Exercice 45 — Serverless vs containers

> 🟠 **Difficulté** : Arbitrage | **Temps estimé** : 1h30 | **Ère** : 6 — La Défense
>
> **Prérequis** : Module 09 (cours 6)


## Objectif

Comparer les architectures serverless et containerisee pour 3 workloads de ShopArch, et choisir la meilleure option pour chaque.

## Contexte

ShopArch hesite entre Lambda/Cloud Functions et Kubernetes pour ses services. Chaque workload a des caractéristiques différentes : trafic API continu, processing d'images sporadique, import CSV ponctuel.

## Temps estime

45 min

## Instructions

### Étape 1 — Classifier les workloads
Analyse 3 workloads et leurs caractéristiques :
1. **API Catalogue** : 600 req/s continu, latence < 50ms, 24/7
2. **Image processing** : 0-50 images/heure, bursts sporadiques, 5-30s par image
3. **Import CSV** : 1-2 fois/semaine, 100 000 lignes, 5-10 min par import

### Étape 2 — Architecture pour chaque workload
Pour chaque workload, propose l'architecture serverless ET containerisee :
- Serverless : service utilise, config, cold start estime
- Container : deployment, scaling, ressources
- Compare : cout, complexité operationnelle, performance, scaling

### Étape 3 — Decision framework
Cree un framework de decision avec les critères :
- Fréquence d'invocation (continu vs sporadique)
- Duree d'exécution (< 1s vs > 5s vs > 15 min)
- Latence requise (< 50ms = cold start inacceptable)
- Cout a scale (> 1M invocations/mois)
- Besoin de GPU ou ressources spécifiques
- État (stateless vs stateful)

### Étape 4 — Tableau comparatif
Remplis le tableau de decision pour chaque workload avec une recommandation claire.

### Bonus
- Implémenter un service serverless concret (Lambda + API Gateway)
- Calculer le TCO (Total Cost of Ownership) sur 12 mois pour chaque option
- Proposer une architecture hybride (API en containers, processing en serverless)

## Contraintes
- Chaque choix doit etre justifie par des metriques (pas de préférence subjective)
- Le cold start doit etre mesure ou estime pour chaque service serverless
- Le cout doit inclure les couts operationnels (pas seulement le compute)
