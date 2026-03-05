# Exercice 31 — BFF pour e-commerce

> 🟠 **Difficulté** : Arbitrage | **Temps estimé** : 2h | **Ère** : 5 — La Communication
>
> **Prérequis** : Module 06 (cours 6)


## Objectif

Implémenter un Backend-For-Frontend (BFF) qui agrege plusieurs microservices (Catalog, Cart, User) en une API optimisee pour le front-end de ShopArch.

## Contexte

Le front-end mobile de ShopArch fait 6 appels API pour afficher la page d'accueil (produits populaires, panier, user info, categories, promotions, recommandations). Sur un réseau 3G, ces 6 round-trips prennent 3 secondes. Un BFF peut agreger ces appels en un seul.

## Temps estime

1h

## Instructions

### Étape 1 — BFF Layer
Cree un service BFF NestJS qui :
- Expose des endpoints optimises par ecran (`/bff/home`, `/bff/product/:id`, `/bff/checkout`)
- Agrege les appels aux microservices en parallele (Promise.all)
- Retourne uniquement les champs nécessaires au front-end (pas de sur-fetching)

### Étape 2 — Aggregation intelligente
Implemente la page d'accueil (`/bff/home`) :
- Produits populaires (Catalog service)
- Panier résumé (Cart service — juste le count)
- Categories principales (Catalog service)
- Promotions actives (Promotion service)
- Appels en parallele, avec timeout individuel de 2s
- Si un service est down, retourne une valeur par defaut (degraded mode)

### Étape 3 — Cache et optimisation
Ajoute un cache Redis au niveau du BFF :
- Cache les données peu changeantes (categories: 5 min, promos: 1 min)
- Pas de cache pour les données utilisateur (panier, profil)
- Cache-key inclut le tenant ID

### Étape 4 — Adaptation par device
Adapte la réponse selon le device :
- Header `X-Device-Type: mobile | tablet | desktop`
- Mobile : moins d'images, descriptions tronquees, pas de recommandations
- Desktop : données completes

### Bonus
- Implémenter le DataLoader pattern pour éviter les N+1 sur les produits
- Ajouter un endpoint GraphQL comme alternative au BFF REST
- Implémenter un response streaming (chunks progressifs)

## Contraintes
- Le BFF ne doit contenir aucune logique métier (juste aggregation + transformation)
- Si un microservice est down, le BFF retourne une réponse degradee (pas une erreur)
- Le temps de réponse du BFF doit etre < max(services) + 50ms overhead
