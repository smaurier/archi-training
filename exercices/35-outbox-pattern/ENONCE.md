# Exercice 35 — Outbox pattern

> 🟡 **Difficulté** : Conception | **Temps estimé** : 1h30 | **Ère** : 5 — La Communication
>
> **Prérequis** : Module 07 (cours 3)


## Objectif

Implémenter le Transactional Outbox pattern pour garantir l'envoi fiable d'events apres une écriture en base, sans double-write problem.

## Contexte

Quand ShopArch cree une commande, il faut a la fois sauvegarder en base ET publier un event `OrderCreated`. Si on fait les deux séparément, on risque : save OK + event perdu (crash entre les deux) ou event envoye + save échoué (donnée inconsistante).

## Temps estime

1h

## Instructions

### Étape 1 — Table outbox
Cree une table `outbox_events` :
- id (UUID), aggregate_type, aggregate_id, event_type, payload (JSONB), created_at
- published_at (nullable), retry_count
- L'insertion dans outbox se fait DANS la meme transaction que l'écriture métier

### Étape 2 — Publisher (polling)
Implemente un worker qui :
- Poll la table outbox toutes les 500ms pour les events non publies
- Publie vers le message broker (ou appelle les webhooks)
- Marque les events comme publies
- Gere les retries (max 5, puis dead letter)

### Étape 3 — Écriture transactionnelle
Modifie le service de commande pour écrire l'event dans la meme transaction :
- `BEGIN` → `INSERT INTO orders` → `INSERT INTO outbox_events` → `COMMIT`
- Si le commit échoué, ni la commande ni l'event ne sont créés (atomicite)

### Étape 4 — Cleanup et monitoring
Implemente le nettoyage :
- Supprimer les events publies avec succes apres 7 jours
- Dashboard : events en attente, age moyen, taux d'echec
- Alerte si un event est en attente depuis plus de 5 minutes

### Bonus
- Implémenter CDC (Change Data Capture) avec pg_logical comme alternative au polling
- Ajouter un ordering guarantee (events du meme aggregate dans l'ordre)
- Comparer polling vs CDC en termes de latence et charge DB

## Contraintes
- Aucun event ne doit etre perdu (at-least-once delivery)
- Les consumers doivent gérer les doublons (idempotence)
- Le polling ne doit pas surcharger la base (batch + backoff)
