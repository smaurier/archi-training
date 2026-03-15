# Exercice 33 — CQRS catalogue + commandes

> 🟠 **Difficulté** : Arbitrage | **Temps estimé** : 2h | **Ère** : 5 — La Communication
>
> **Prérequis** : Module 07 (cours 2)


## Objectif

Implémenter le pattern CQRS (Command Query Responsibility Segregation) pour séparer les modèles de lecture et d'écriture du catalogue et des commandes de ShopArch.

## Contexte

Le catalogue de ShopArch a 50 000 produits lus 10 000 fois/seconde mais modifies 10 fois/seconde. Les commandes sont ecrites fréquemment mais lues principalement par les admins. Les modèles de lecture et d'écriture ont des besoins très différents.

## Temps estime

1h30

## Instructions

### Étape 1 — Séparation Command/Query
Separe les opérations du catalogue en Commands et Queries :
- Commands : CreateProduct, UpdatePrice, UpdateStock, PublishProduct
- Queries : GetProduct, SearchProducts, GetPopularProducts, GetProductsByCategory
- Chaque Command et Query est un objet type-safe

### Étape 2 — Modèles separes
Cree deux modèles distincts :
- Write model (PostgreSQL) : normalise, avec toutes les relations et validations
- Read model (PostgreSQL view ou table denormalisee) : optimise pour les lectures, avec les données pre-jointes
- Synchronisation via domain events

### Étape 3 — Command Bus et Query Bus
Implemente les bus :
- CommandBus : dispatch une Command vers son Handler (1 handler par command)
- QueryBus : dispatch une Query vers son Handler
- Middlewares : validation, logging, authorization

### Étape 4 — Projection du read model
Implemente la projection qui met a jour le read model quand le write model change :
- Ecoute les domain events (ProductCreated, PriceUpdated, StockUpdated)
- Met a jour la table de lecture de manière asynchrone
- Gere l'eventual consistency (le read model peut etre en retard de quelques ms)

### Bonus
- Ajouter un Event Store pour persister tous les events
- Implémenter un replay complet du read model depuis l'Event Store
- Ajouter des metriques sur le lag de projection (write → read)

## Contraintes
- Les Commands ne retournent jamais de données (void ou ID de la ressource créée)
- Les Queries ne modifient jamais l'état
- Le read model doit etre reconstructible à partir des events
