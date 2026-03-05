# Exercice 46 — Pipeline d'observabilité

> 🟡 **Difficulté** : Conception | **Temps estimé** : 1h30 | **Ère** : 6 — La Défense
>
> **Prérequis** : Module 10 (cours 1-3)


## Objectif

Mettre en place les 3 piliers de l'observabilité pour ShopArch : logs structures, metriques, et traces distribuees.

## Contexte

ShopArch a des `console.log` eparpilles dans le code. Quand un problème survient, l'équipe passe des heures a chercher dans les logs de différents services. Il n'y a pas de metriques business ni de traces pour suivre une requête a travers les services.

## Temps estime

1h30

## Instructions

### Étape 1 — Logs structures
Remplace les console.log par un logger structure :
- Format JSON avec champs : timestamp, level, message, service, requestId, tenantId
- Niveaux : error, warn, info, debug
- Contexte automatique (requestId, userId, tenantId) injecte par middleware
- PII masquees dans les logs (email → m***@example.com)

### Étape 2 — Metriques
Implemente les metriques avec Prometheus/OpenTelemetry :
- RED metrics : Rate, Errors, Duration par endpoint
- Business metrics : commandes/min, panier abandonne, revenus
- Saturation : connexions DB, mémoire Redis, queue BullMQ
- Histogramme des latences (p50, p95, p99)

### Étape 3 — Traces distribuees
Implemente le tracing avec OpenTelemetry :
- Trace une requête du BFF → OrderService → PostgreSQL
- Propagation du trace ID via headers (W3C Trace Context)
- Spans pour : HTTP, DB queries, Redis, external APIs
- Attributs : tenantId, userId, endpoint

### Étape 4 — Dashboard et alertes
Configure un dashboard avec :
- Latence p99 par service
- Taux d'erreur (5xx) par endpoint
- Throughput (req/s) global et par service
- Alertes : p99 > 500ms, error rate > 1%, CPU > 80%

### Bonus
- Ajouter un correlation ID qui traverse les messages asynchrones (BullMQ)
- Implémenter le sampling intelligent (100% pour les erreurs, 10% pour le reste)
- Créer un Grafana dashboard as code (JSON)

## Contraintes
- Les logs ne doivent contenir aucune PII en clair
- Le tracing ne doit pas ajouter plus de 5% de latence
- Les metriques doivent inclure au moins 3 metriques business
