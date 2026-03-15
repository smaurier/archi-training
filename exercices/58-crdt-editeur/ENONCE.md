# Exercice 58 — CRDT pour editeur collaboratif

> 🟠 **Difficulté** : Arbitrage | **Temps estimé** : 2h | **Ère** : 7 — L'Architecte
>
> **Prérequis** : Module 13 (cours 5)


## Objectif

Implémenter un editeur de descriptions produit collaboratif en temps réel pour le back-office de ShopArch, en utilisant les CRDTs (Conflict-free Replicated Data Types).

## Contexte

Deux admins de ShopArch editent parfois la même description produit en même temps. Actuellement, le dernier qui sauvegarde ecrase le travail de l'autre. L'objectif est de permettre l'edition collaborative sans conflits.

## Temps estime

1h

## Instructions

### Étape 1 — Comprendre les CRDTs
Implemente un G-Counter (Grow-only Counter) comme premier CRDT :
- Chaque noeud a son propre compteur
- Merge = prendre le max de chaque noeud
- Le compteur ne peut que croitre (pas de decrement)

### Étape 2 — LWW-Register (Last-Writer-Wins)
Implemente un LWW-Register pour un champ texte simple :
- Chaque écriture à un timestamp
- Merge = garder la valeur avec le timestamp le plus recent
- Résoudre les egalites par un ID de noeud (déterministe)

### Étape 3 — LWW-Map pour les champs produit
Implemente un LWW-Map pour un produit avec plusieurs champs :
- Chaque champ (name, description, price) est un LWW-Register independant
- Deux admins peuvent modifier des champs différents sans conflit
- Merge du map = merge de chaque champ independamment

### Étape 4 — Synchronisation
Implemente la synchronisation via WebSocket :
- Chaque modification locale est diffusee aux autres clients
- A la reception, merge avec l'état local
- Afficher les conflits resolus automatiquement
- Indicateur "Editing..." pour les autres utilisateurs

### Bonus
- Implémenter un CRDT texte (RGA ou Yjs) pour l'edition de description
- Ajouter un historique des modifications avec undo/redo
- Comparer CRDT vs OT (Operational Transform) pour ce cas d'usage

## Contraintes
- Le merge doit etre commutatif, associatif et idempotent
- Aucune perte de données lors d'un merge
- Le système doit fonctionner même si un client est temporairement deconnecte
