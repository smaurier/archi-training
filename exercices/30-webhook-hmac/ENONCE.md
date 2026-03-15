# Exercice 30 — Webhook system avec HMAC

> 🟡 **Difficulté** : Conception | **Temps estimé** : 1h30 | **Ère** : 5 — La Communication
>
> **Prérequis** : Module 06 (cours 5)


## Objectif

Implémenter un système de webhooks sortants sécurisé avec signature HMAC-SHA256 pour notifier les partenaires de ShopArch des événements (commande créée, paiement recu, stock modifie).

## Contexte

ShopArch doit notifier des systèmes externes (ERP, CRM, logistique) quand des événements se produisent. Les webhooks doivent etre sécurisés (signature), fiables (retry), et observables (logs).

## Temps estime

1h

## Instructions

### Étape 1 — Enregistrement des webhooks
Cree un CRUD pour les webhook subscriptions :
- URL de callback, secret (généré automatiquement), events souscrits
- Validation que l'URL est HTTPS
- Test ping pour vérifier que l'URL repond

### Étape 2 — Signature HMAC-SHA256
Implemente la signature des payloads :
- Header `X-Webhook-Signature` = HMAC-SHA256(secret, body)
- Header `X-Webhook-Timestamp` pour prévenir les replay attacks
- Le payload inclut : event type, timestamp, data, delivery ID (UUID)

### Étape 3 — Envoi asynchrone avec retry
Envoie les webhooks via une job queue (BullMQ) :
- Retry avec backoff exponentiel (1s, 5s, 30s, 5min, 30min)
- Max 5 tentatives
- Dead letter queue après echec final
- Timeout de 10 secondes par requête

### Étape 4 — Dashboard et logs
Implemente un historique des deliveries :
- Status (pending, success, failed, dead_letter)
- Response status code et body (tronque)
- Duree de chaque tentative
- Possibilite de re-envoyer manuellement

### Bonus
- Ajouter un circuit breaker : désactiver le webhook après 10 echecs consecutifs
- Implémenter un webhook fan-out (même event → N subscribers)
- Ajouter un filtre par event type sur les subscriptions

## Contraintes
- Le secret ne doit jamais etre expose dans les réponses API (write-only)
- La vérification de signature doit etre documentee pour les consumers
- Les payloads doivent etre idempotents (delivery ID unique)
