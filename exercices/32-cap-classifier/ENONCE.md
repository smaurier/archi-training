# Exercice 32 — CAP classifier

> 🔵 **Difficulté** : Application | **Temps estimé** : 1h | **Ère** : 5 — La Communication
>
> **Prérequis** : Module 07 (cours 1)


## Objectif

Classifier les composants de ShopArch selon le theoreme CAP et choisir les stratégies de cohérence appropriees pour chaque cas d'usage.

## Contexte

ShopArch utilise PostgreSQL, Redis, Elasticsearch et un service de paiement externe. Chaque composant a des besoins différents en termes de Consistency, Availability et Partition tolerance.

## Temps estime

45 min

## Instructions

### Étape 1 — Classifier les composants
Pour chaque composant de ShopArch, déterminé s'il est CP ou AP :
- Catalogue produits (lecture seule, cache)
- Stock / inventaire (decrementation)
- Panier utilisateur (sessions)
- Commandes (transactions)
- Recherche full-text (Elasticsearch)
- Sessions utilisateur (Redis)

### Étape 2 — Justifier les choix
Pour chaque classification, explique :
- Quel est le risque si on perd la cohérence ? (ex: vendre un produit en rupture)
- Quel est le risque si on perd la disponibilité ? (ex: panier inaccessible)
- Quelle stratégie adopter en cas de partition réseau ?

### Étape 3 — Implémenter les stratégies
Implemente les mecanismes concrets :
- Stock : verrou pessimiste (CP) — `SELECT FOR UPDATE`
- Catalogue : eventual consistency (AP) — cache avec TTL + invalidation
- Panier : AP avec merge — si partition, chaque partition accepte les écritures, merge au retour

### Étape 4 — Stratégie de compensation
Quand la cohérence est eventuelle, implémenté une stratégie de compensation :
- Vérifier le stock au moment du paiement (pas seulement a l'ajout au panier)
- Notifier le client si le stock a change entre l'ajout et le checkout
- Saga de compensation si le paiement est accepte mais le stock insuffisant

### Bonus
- Implémenter un Read-Your-Writes guarantee pour le catalogue (apres update, lire la version fraiche)
- Dessiner un diagramme de sequence pour le scénario de partition

## Contraintes
- Chaque composant doit avoir une classification explicite CP ou AP avec justification
- Le stock ne doit jamais etre negatif (cohérence forte obligatoire)
- Le catalogue peut tolerer quelques secondes de stale data
