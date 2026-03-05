# Exercice 30b — Consumer webhook avec retry

> 🔵 **Difficulté** : Application | **Temps estimé** : 1h | **Ère** : 5 — La Communication
>
> **Prérequis** : Exercice 30


## Objectif

Implémenter le côté consumer d'un webhook : reception, vérification de signature, idempotence, et gestion des erreurs.

## Contexte

ShopArch recoit des webhooks d'un provider de paiement (Stripe-like). Chaque webhook notifie un changement de statut de paiement. Le consumer doit etre résilient : vérifier la signature, gérer les doublons, et traiter de manière fiable.

## Temps estime

45 min

## Instructions

### Étape 1 — Endpoint de reception
Cree un endpoint `POST /webhooks/payment` qui :
- Repond `200 OK` le plus vite possible (avant le traitement)
- Queue le traitement reel dans une job queue
- Retourne `200` meme si le traitement échoué (sinon le provider re-envoie)

### Étape 2 — Vérification de signature
Verifie la signature HMAC-SHA256 :
- Lire le body brut (pas parse en JSON avant la vérification)
- Comparer avec `timingSafeEqual`
- Rejeter si timestamp > 5 minutes (anti-replay)
- Retourner `401` si la signature est invalide

### Étape 3 — Idempotence
Previens le traitement en double :
- Stocke les delivery IDs traites (Redis SET avec TTL 7 jours)
- Si déjà traite, retourne `200` sans re-traiter
- Utilise une transaction pour garantir "exactly-once" processing

### Étape 4 — Traitement des events
Implemente un event handler type-safe :
- Router vers le bon handler selon `event.type`
- `payment.succeeded` → mettre a jour la commande + envoyer email
- `payment.failed` → notifier le client
- `payment.refunded` → créer un avoir

### Bonus
- Ajouter un mode debug qui log les webhooks sans les traiter
- Implémenter un replay endpoint pour re-traiter un webhook
- Ajouter des metriques (webhooks recus/traites/echoues par type)

## Contraintes
- Le body brut doit etre preserve pour la vérification de signature (pas de middleware JSON auto)
- Le traitement doit etre idempotent (meme webhook 2x = meme résultat)
- Les erreurs de traitement ne doivent pas bloquer les futurs webhooks
