# Exercice 15 — Job queue avec BullMQ

> 🔵 **Difficulté** : Application | **Temps estimé** : 1h30 | **Ère** : 4 — L'Autre Côté
>
> **Prérequis** : Module 03 (cours 7)


## Objectif

Implémenter une queue de jobs background avec BullMQ pour des taches asynchrones (envoi d'emails, génération de thumbnails, import CSV).

## Contexte

ShopArch doit traiter des taches lourdes sans bloquer les requêtes HTTP : envoi d'emails de confirmation, génération de thumbnails d'images, et import de catalogues CSV.

## Temps estime

45 min

## Instructions

### Étape 1 — Définir les queues

Cree 3 queues :
- `email` : envoi d'emails (priorité haute)
- `media` : génération de thumbnails (priorité normale)
- `import` : import de fichiers CSV (priorité basse, long)

### Étape 2 — Producer

Depuis le controller ou service, ajoute des jobs a la queue :

```typescript
// Quand une commande est creee
await emailQueue.add('order-confirmation', {
  to: user.email,
  orderId: order.id,
  total: order.total,
});

// Quand un media est uploade
await mediaQueue.add('generate-thumbnails', {
  mediaId: media.id,
  sizes: [150, 800, 1920],
});
```

### Étape 3 — Consumer (Worker)

Implemente les workers qui traitent les jobs :
- Le worker email envoie le mail via SMTP
- Le worker media généré les thumbnails et les uploade sur S3
- Le worker import parse le CSV ligne par ligne avec progression

### Étape 4 — Retry et error handling

- Retry 3 fois avec backoff exponentiel (1s, 5s, 30s)
- Dead letter queue pour les jobs en echec apres 3 retries
- Logging structure de chaque job (start, progress, complete, fail)

### Bonus

- Ajouter une progression pour l'import CSV (0% → 100%)
- Implémenter un rate limiting sur la queue email (max 10/s)

## Contraintes

- Les jobs sont persistes dans Redis (survivent a un restart)
- Les workers tournent dans un process séparé de l'API
- Chaque job est idempotent (safe to retry)
