# Checklist — Exercice 35 : Outbox pattern

- [ ] Table outbox_events (id, aggregate_type, event_type, payload, published_at)
- [ ] Insertion outbox dans la même transaction que l'écriture métier
- [ ] Worker de polling (toutes les 500ms)
- [ ] Publication vers message broker
- [ ] Marquage published_at après envoi
- [ ] Retry avec max 5 tentatives
- [ ] Dead letter après echec final
- [ ] Cleanup des events publies (> 7 jours)
- [ ] Monitoring : events en attente, age moyen

## Bonus
- [ ] CDC avec pg_logical
- [ ] Ordering guarantee par aggregate
- [ ] Comparaison polling vs CDC
