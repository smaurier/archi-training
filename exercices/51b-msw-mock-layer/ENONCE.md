# Exercice 51b — MSW mock layer

> 🔵 **Difficulté** : Application | **Temps estimé** : 1h | **Ère** : 6 — La Défense
>
> **Prérequis** : Module 11 (cours 2)


## Objectif

Implémenter une couche de mock API avec MSW (Mock Service Worker) pour les tests front-end et le développement local de ShopArch.

## Contexte

Les développeurs front-end de ShopArch dependent de l'API back-end pour développer. Quand l'API est down ou change, le front est bloque. MSW permet de mocker l'API au niveau réseau (intercept fetch) sans modifier le code applicatif.

## Temps estime

45 min

## Instructions

### Étape 1 — Setup MSW
Configure MSW pour les tests Vitest :
- Intercepter les appels fetch vers `/api/*`
- Définir les handlers pour GET /products, GET /products/:id, POST /cart
- Retourner des réponses JSON realistes

### Étape 2 — Handlers par scénario
Cree des handlers pour différents scénarios :
- Happy path : produits retournes, ajout au panier OK
- Erreur : produit non trouve (404), serveur down (500)
- Edge case : liste vide, pagination dernière page
- Slow response : delai de 3s pour tester les loading states

### Étape 3 — Intégration avec les tests composants
Utilise MSW dans les tests React/Vitest :
- Tester un composant ProductList avec des données mockees
- Tester les états loading, error, empty
- Overrider un handler pour un test spécifique (ex: forcer une erreur)

### Étape 4 — Mode développement
Configure MSW pour le développement local :
- Service Worker dans le navigateur (pas de proxy)
- Memes handlers que les tests
- Console qui montre les requêtes interceptees

### Bonus
- Générer les handlers MSW depuis une spec OpenAPI
- Ajouter des delays realistes (simuler la latence réseau)
- Implémenter un mode "record & replay" (enregistrer les vrais appels et les rejouer)

## Contraintes
- Le code applicatif ne doit PAS etre modifie pour utiliser MSW
- Les handlers doivent etre type-safe (TypeScript)
- Les mocks doivent etre realistes (structure identique a l'API reelle)
