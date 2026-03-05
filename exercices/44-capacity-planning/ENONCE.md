# Exercice 44 — Capacity planning

> 🟠 **Difficulté** : Arbitrage | **Temps estimé** : 1h30 | **Ère** : 6 — La Défense
>
> **Prérequis** : Module 09 (cours 3-4)


## Objectif

Realiser un exercice de capacity planning pour ShopArch en prevision du Black Friday : estimer les ressources nécessaires pour gérer 10x le trafic normal.

## Contexte

ShopArch traite normalement 100 requêtes/seconde. Pour le Black Friday, on prevoit un pic de 1000 req/s pendant 4 heures. L'infrastructure actuelle est : 2 serveurs API, 1 PostgreSQL, 1 Redis, 1 Elasticsearch.

## Temps estime

1h

## Instructions

### Étape 1 — Baseline metrics
Documente les metriques actuelles :
- Throughput : requêtes/seconde par service
- Latence : p50, p95, p99 par endpoint
- Ressources : CPU, RAM, disk I/O, connexions DB par serveur
- Bottleneck : quel composant sature en premier ?

### Étape 2 — Modèle de charge
Cree un modèle de charge pour le Black Friday :
- Estimation du trafic par endpoint (catalogue 60%, recherche 20%, panier 15%, checkout 5%)
- Ratio lecture/écriture par service
- Taille moyenne des requêtes/réponses
- Connexions simultanees estimees

### Étape 3 — Dimensionnement
Calcule les ressources nécessaires :
- Nombre de pods API pour 1000 req/s (sachant que 1 pod géré 200 req/s)
- Taille du pool de connexions PostgreSQL
- Mémoire Redis pour les sessions et le cache
- Replicas Elasticsearch pour la recherche

### Étape 4 — Plan de scaling
Ecris le plan de scaling :
- Horizontal : nombre de replicas par service
- Vertical : augmentation des ressources (CPU, RAM)
- Auto-scaling rules (CPU > 70% → scale up, < 30% → scale down)
- Pre-warming : augmenter les replicas AVANT le pic (pas pendant)

### Bonus
- Calculer le cout AWS/GCP estime pour le Black Friday
- Implémenter un load test avec k6 pour valider les estimations
- Définir un plan de degradation graceful si le pic depasse les previsions

## Contraintes
- Les calculs doivent etre documentes (pas de "on ajoute des serveurs")
- Le plan doit inclure un budget et un timeline
- Le plan de degradation doit lister les features a désactiver en priorité
