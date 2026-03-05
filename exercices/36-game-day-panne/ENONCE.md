# Exercice 36 — Game day : simuler une panne

> 🟡 **Difficulté** : Conception | **Temps estimé** : 1h30 | **Ère** : 5 — La Communication
>
> **Prérequis** : Module 07 (cours 5)


## Objectif

Planifier et exécuter un Game Day pour ShopArch : simuler des pannes (DB down, service lent, réseau partitionne) et vérifier la résilience du système.

## Contexte

ShopArch n'a jamais ete teste en conditions de panne. L'équipe ne sait pas comment le système reagit quand Redis tombe, quand le service de paiement est lent (5s de latence), ou quand Elasticsearch est indisponible.

## Temps estime

1h

## Instructions

### Étape 1 — Plan du Game Day
Redige un plan de Game Day avec :
- 5 scénarios de panne a simuler
- Pour chaque scénario : hypothese, injection de la panne, metriques a observer, critère de succes/echec
- Ordre d'exécution (du moins au plus risque)
- Rollback plan pour chaque scénario

### Étape 2 — Scripts d'injection
Cree les scripts pour simuler les pannes :
- Redis indisponible : `iptables` ou feature flag
- Service paiement lent : proxy avec latence artificielle
- Elasticsearch down : arreter le conteneur
- Database read-only : `SET default_transaction_read_only = on`
- Perte réseau partielle : drop 50% des paquets

### Étape 3 — Observabilite
Prepare le monitoring AVANT d'injecter les pannes :
- Dashboard avec les metriques cles (latence p99, taux d'erreur, throughput)
- Alertes configurees (pour vérifier qu'elles se declenchent)
- Logs centralises pour correlate les erreurs

### Étape 4 — Rapport post-mortem
Apres chaque scénario, documente :
- Ce qui s'est passe (comportement observe)
- Ce qui etait attendu vs realite
- Actions correctives si le système n'a pas ete résilient
- Priorite de correction (P0/P1/P2)

### Bonus
- Automatiser les scénarios avec Chaos Monkey ou Litmus
- Implémenter les corrections pour les scénarios echoues
- Planifier un Game Day recurrent (trimestriel)

## Contraintes
- Tester en staging, jamais en production (pour cet exercice)
- Avoir un rollback plan AVANT d'injecter chaque panne
- Documenter chaque scénario avec le template fourni
