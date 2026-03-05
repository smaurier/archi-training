# Exercice 50 — Stratégie de test e-commerce

> 🟡 **Difficulté** : Conception | **Temps estimé** : 1h30 | **Ère** : 6 — La Défense
>
> **Prérequis** : Module 11 (cours 1)


## Objectif

Définir et implémenter une stratégie de test complete pour ShopArch couvrant les 4 niveaux de la pyramide de tests.

## Contexte

ShopArch a 200 tests unitaires mais aucun test d'intégration, aucun test de contrat, et les tests E2E sont manuels. La couverture reelle des cas critiques (checkout, paiement) est faible.

## Temps estime

1h30

## Instructions

### Étape 1 — Pyramide de tests
Definis la pyramide de tests pour ShopArch :
- **Unit** (70%) : logique métier pure (calcul prix, validation, FSM)
- **Intégration** (20%) : endpoints API avec DB reelle, composants React avec store
- **Contract** (5%) : contrats API entre services (Pact)
- **E2E** (5%) : parcours critiques (search → product → cart → checkout)

### Étape 2 — Tests unitaires critiques
Ecris les tests unitaires pour :
- Calcul du prix (prix de base + taxe + promotion + remise quantité)
- Validation d'une commande (stock suffisant, montant minimum, adresse valide)
- Transition FSM de commande (seules les transitions valides sont possibles)

### Étape 3 — Tests d'intégration API
Ecris les tests d'intégration pour :
- CRUD produit (create, read, update, soft delete)
- Isolation multi-tenant (tenant A ne voit pas les produits de tenant B)
- Pagination cursor (pas d'éléments manques/dupliques)

### Étape 4 — Test E2E du checkout
Ecris un test E2E complet du parcours checkout :
- Rechercher un produit → ouvrir la page produit → ajouter au panier → checkout → paiement → confirmation

### Bonus
- Ajouter des property-based tests (fast-check) pour le calcul de prix
- Implémenter des mutation tests pour mesurer la qualité des tests
- Ajouter un budget de performance dans les tests (response < 200ms)

## Contraintes
- Les tests unitaires doivent etre isoles (pas de DB, pas de réseau)
- Les tests d'intégration utilisent une vraie DB (Docker)
- Le coverage minimum est 80% sur la logique métier
