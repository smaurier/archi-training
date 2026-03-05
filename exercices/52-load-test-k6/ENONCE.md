# Exercice 52 — Load test avec k6

> 🔵 **Difficulté** : Application | **Temps estimé** : 1h30 | **Ère** : 6 — La Défense
>
> **Prérequis** : Module 11 (cours 4)


## Objectif

Écrire et exécuter un load test k6 pour ShopArch simulant un parcours utilisateur realiste et identifiant les bottlenecks.

## Contexte

ShopArch doit supporter 500 utilisateurs simultanes pendant le Black Friday. Les tests de charge permettent d'identifier les limites du système avant la mise en production.

## Temps estime

1h

## Instructions

### Étape 1 — Scénario utilisateur
Ecris un scénario k6 qui simule un parcours utilisateur :
1. Page d'accueil (GET /)
2. Recherche produit (GET /api/products?q=typescript)
3. Page produit (GET /api/products/:id)
4. Ajout au panier (POST /api/cart)
5. Checkout (POST /api/checkout)
- Think time entre chaque étape (1-3s, aleatoire)

### Étape 2 — Profil de charge
Configure les profils de charge :
- Smoke test : 1 VU, 30s (vérifier que ca fonctionne)
- Load test : 100 VU, 5 min (charge normale)
- Stress test : rampe 0→500 VU en 5 min, maintien 5 min, descente 5 min
- Spike test : 10 VU → 500 VU instantane → retour 10 VU

### Étape 3 — Seuils de performance
Definis les thresholds (critères de succes/echec) :
- p95 latence < 500ms
- p99 latence < 1000ms
- Taux d'erreur < 1%
- Throughput > 100 req/s sous charge

### Étape 4 — Analyse des résultats
Analyse les résultats et identifie :
- Le point de rupture (a combien de VU le système degrade)
- Les endpoints les plus lents
- Les correlations (CPU/RAM vs latence)
- Les recommandations d'optimisation

### Bonus
- Exporter les résultats vers Grafana (k6 Cloud ou InfluxDB)
- Ajouter des custom metrics (temps de checkout, taux de conversion)
- Comparer les résultats avant/apres une optimisation

## Contraintes
- Le scénario doit etre realiste (pas 100% de checkouts, distribution realiste)
- Les thresholds doivent etre dans le script (pas juste dans le rapport)
- Le test doit etre executable en CI (pas de dépendance externe)
