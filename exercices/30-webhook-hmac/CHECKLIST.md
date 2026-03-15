# Checklist — Exercice 30 : Webhook system avec HMAC

- [ ] CRUD webhook subscriptions (URL HTTPS, secret auto-généré, events)
- [ ] Signature HMAC-SHA256 dans X-Webhook-Signature
- [ ] X-Webhook-Timestamp pour anti-replay
- [ ] Delivery ID unique (UUID) pour idempotence
- [ ] Envoi asynchrone via BullMQ
- [ ] Retry avec backoff exponentiel (5 tentatives)
- [ ] Dead letter queue
- [ ] Timeout 10s par requête
- [ ] Historique des deliveries (status, response, durée)
- [ ] Secret write-only (jamais expose en lecture)

## Bonus
- [ ] Circuit breaker (desactivation après 10 echecs)
- [ ] Fan-out multi-subscribers
- [ ] Filtre par event type
