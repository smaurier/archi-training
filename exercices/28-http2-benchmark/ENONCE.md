# Exercice 28 — HTTP/2 vs HTTP/1.1 benchmark

> 🔵 **Difficulté** : Application | **Temps estimé** : 1h | **Ère** : 5 — La Communication
>
> **Prérequis** : Module 06 (cours 1)


## Objectif

Comparer les performances HTTP/1.1 et HTTP/2 sur un scénario e-commerce realiste (chargement page produit avec images, CSS, JS).

## Contexte

La page produit de ShopArch charge 1 document HTML, 3 CSS, 5 JS, 12 images produit. En HTTP/1.1, le navigateur ouvre 6 connexions TCP max par domaine. HTTP/2 multiplexe tout sur une seule connexion.

## Temps estime

45 min

## Instructions

### Étape 1 — Serveur HTTP/1.1 et HTTP/2
Configure un serveur Node.js qui sert les memes assets en HTTP/1.1 et HTTP/2. Utilise le module natif `http2` avec TLS (certificat auto-signe pour le test).

### Étape 2 — Assets de test
Cree un scénario realiste :
- 1 page HTML avec 20 ressources (CSS, JS, images)
- Des fichiers de tailles variees (1 KB a 500 KB)
- Simule la latence réseau avec un delai artificiel de 50ms par requête

### Étape 3 — Benchmark
Mesure avec `autocannon` ou un script custom :
- Temps total de chargement de la page complete
- Nombre de connexions TCP ouvertes
- Waterfall des requêtes (sequentiel vs multiplexe)

### Étape 4 — Server Push (HTTP/2)
Implemente le Server Push pour les ressources critiques (CSS principal, JS principal). Compare les temps avec et sans push.

### Bonus
- Tester avec différentes latences réseau (10ms, 50ms, 200ms)
- Comparer avec HTTP/3 (QUIC) si disponible
- Mesurer l'impact du header compression (HPACK)

## Contraintes
- Le benchmark doit etre reproductible (script automatise)
- Comparer au moins 3 metriques : temps total, TTFB, nombre de connexions
- Les résultats doivent etre presentes dans un tableau comparatif
