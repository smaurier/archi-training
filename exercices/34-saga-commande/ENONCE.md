# Exercice 34 — Saga de commande

> 🟠 **Difficulté** : Arbitrage | **Temps estimé** : 2h | **Ère** : 5 — La Communication
>
> **Prérequis** : Module 07 (cours 4)


## Objectif

Implémenter une saga orchestree pour le processus de commande de ShopArch : reservation stock → paiement → confirmation → notification.

## Contexte

La création d'une commande implique 4 services : Stock (reserver), Payment (debiter), Order (confirmer), Notification (email). Si une étape échoué, les étapes précédentes doivent etre compensees (ex: annuler la reservation si le paiement échoué).

## Temps estime

1h30

## Instructions

### Étape 1 — Définir les étapes de la saga
Définir la sequence et les compensations :
1. `ReserveStock` → compensation: `ReleaseStock`
2. `ProcessPayment` → compensation: `RefundPayment`
3. `ConfirmOrder` → compensation: `CancelOrder`
4. `SendNotification` → pas de compensation (best-effort)

### Étape 2 — Saga orchestrateur
Implemente un orchestrateur qui :
- Execute les étapes sequentiellement
- En cas d'echec, exécuté les compensations dans l'ordre inverse
- Persiste l'état de la saga (pour recovery après crash)
- Chaque étape est idempotente

### Étape 3 — Persistence de l'état
Stocke l'état de la saga en base :
- Saga ID, type, étape courante, status
- Données de chaque étape (input/output)
- Timestamp de chaque transition
- Permet de reprendre une saga après un crash

### Étape 4 — Gestion des echecs
Implemente les scénarios d'echec :
- Paiement refuse → libérer le stock
- Timeout du service de paiement → retry 3x puis compensation
- Service de notification down → continuer (best-effort)
- Crash de l'orchestrateur → recovery depuis l'état persiste

### Bonus
- Implémenter un timeout global sur la saga (5 minutes max)
- Ajouter un dashboard des sagas en cours / echouees
- Implémenter une saga choregraphiee (sans orchestrateur) comme alternative

## Contraintes
- Chaque étape et compensation doit etre idempotente
- L'état de la saga doit survivre à un crash
- Les compensations doivent TOUJOURS réussir (retry infini si nécessaire)
