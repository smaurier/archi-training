# Checklist — Exercice 30b : Consumer webhook avec retry

- [ ] Endpoint POST /webhooks/payment
- [ ] Réponse 200 immédiate (traitement asynchrone)
- [ ] Vérification HMAC-SHA256 avec timingSafeEqual
- [ ] Anti-replay (timestamp < 5 min)
- [ ] Body brut preserve pour la vérification
- [ ] Idempotence via delivery ID (Redis SET)
- [ ] Event routing type-safe par event.type
- [ ] Handlers : payment.succeeded, payment.failed, payment.refunded
- [ ] Erreurs de traitement isolees (pas de blocage)

## Bonus
- [ ] Mode debug (log sans traiter)
- [ ] Replay endpoint
- [ ] Metriques par type d'event
