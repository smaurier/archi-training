# Exercice 27 — PWA offline-first

> 🔵 **Difficulté** : Application | **Temps estimé** : 1h30 | **Ère** : 3 — Le Front
>
> **Prérequis** : Module 05 (cours 10)


## Objectif

Implémenter une PWA avec Service Worker, cache stratégies, et offline support pour le catalogue produits.

## Temps estime

1h

## Instructions

### Étape 1 — Service Worker
Implemente un Service Worker avec Workbox :
- Cache les assets statiques (CSS, JS, images) en Cache-First
- Cache les API produits en Network-First avec fallback cache
- Cache les pages en Stale-While-Revalidate

### Étape 2 — Manifest.json
Cree le `manifest.json` pour l'installation PWA (name, icons, start_url, display: standalone, theme_color).

### Étape 3 — Offline page
Cree une page `/offline` affichee quand le réseau est indisponible et que la page n'est pas en cache.

### Étape 4 — Background sync
Quand l'utilisateur ajoute un produit au panier en offline, queue l'action et sync quand le réseau revient.

### Bonus
- Ajouter les push notifications pour les commandes
- Détecter l'état online/offline avec `navigator.onLine` et afficher un banner

## Contraintes
- Les assets statiques sont toujours disponibles offline
- Le catalogue est disponible en mode degrade (dernière version cached)
- Les mutations (panier) sont queuees en offline et sync quand le réseau revient
