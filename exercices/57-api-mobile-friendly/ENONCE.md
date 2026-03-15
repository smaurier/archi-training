# Exercice 57 — API mobile-friendly

> 🔵 **Difficulté** : Application | **Temps estimé** : 1h | **Ère** : 7 — L'Architecte
>
> **Prérequis** : Module 13 (cours 1)


## Objectif

Adapter l'API de ShopArch pour les clients mobiles : optimiser la taille des réponses, gérer la connectivite intermittente, et supporter le mode offline.

## Contexte

60% du trafic de ShopArch vient de mobiles. Les pages sont 3x plus lentes sur mobile que sur desktop a cause de la taille des payloads, du nombre de requêtes, et de la latence réseau (100-300ms en 4G).

## Temps estime

1h

## Instructions

### Étape 1 — Response shaping
Optimise les réponses API pour le mobile :
- Champ `fields` pour selectionner les champs retournes (`?fields=id,name,price,thumbnail`)
- `Prefer: return=minimal` pour les réponses légères
- Compression gzip/brotli automatique
- Pagination avec limite réduite par defaut (10 au lieu de 20)

### Étape 2 — Batch endpoint
Cree un endpoint batch pour regrouper plusieurs requêtes :
- `POST /api/batch` avec un tableau de requêtes
- Execute en parallele côté serveur, retourne un tableau de réponses
- Limite : max 10 requêtes par batch
- Timeout individuel par sous-requête

### Étape 3 — Optimistic UI support
Adapte l'API pour supporter l'Optimistic UI :
- Retourner l'entité complete après chaque mutation (pour mettre a jour le cache client)
- Supporter `If-Match` pour la résolution de conflits
- Ajouter des timestamps de dernière modification pour la synchronisation

### Étape 4 — Connectivity awareness
Gere la connectivite intermittente :
- Endpoint de health check léger (`GET /ping` → `204`)
- Headers `X-Retry-After` pour les erreurs temporaires
- Idempotency keys pour les mutations (éviter les doublons lors des retries)
- Support du `Range` header pour les telechargements resiliants

### Bonus
- Implémenter un endpoint de sync delta (`GET /products/changes?since=timestamp`)
- Ajouter le support JSON:API sparse fieldsets
- Implémenter le HTTP/2 Server Push pour les ressources critiques

## Contraintes
- La taille moyenne d'une réponse API mobile doit etre < 5 KB
- Le batch endpoint ne doit pas depasser 50 KB de réponse totale
- Les idempotency keys doivent expirer après 24h
