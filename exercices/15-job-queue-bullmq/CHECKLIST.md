# Checklist — Exercice 15 : Job queue BullMQ

## Queues

- [ ] 3 queues définies (email, media, import)
- [ ] Les queues sont configurees avec Redis
- [ ] Les jobs sont persistes (survivent a un restart)

## Producer

- [ ] Les jobs sont ajoutes depuis les services
- [ ] Chaque job a un type et un payload type
- [ ] Les jobs critiques ont une priorité haute

## Consumer

- [ ] Les workers sont dans un process séparé
- [ ] Le worker email envoie un email
- [ ] Le worker media généré des thumbnails
- [ ] Le worker import parse un CSV

## Error handling

- [ ] Retry 3 fois avec backoff exponentiel
- [ ] Dead letter queue pour les echecs
- [ ] Logging structure de chaque état (start/complete/fail)
- [ ] Les jobs sont idempotents

## Bonus

- [ ] Progression pour l'import CSV
- [ ] Rate limiting sur la queue email
