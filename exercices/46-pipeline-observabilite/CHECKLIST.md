# Checklist — Exercice 46 : Pipeline d'observabilité

- [ ] Logger structure JSON (timestamp, level, message, requestId, tenantId)
- [ ] PII masquees dans les logs
- [ ] Contexte automatique via middleware
- [ ] RED metrics (Rate, Errors, Duration)
- [ ] Business metrics (commandes/min, revenus)
- [ ] Saturation metrics (DB connexions, Redis mémoire)
- [ ] Histogramme latences (p50, p95, p99)
- [ ] Traces distribuees (OpenTelemetry)
- [ ] Propagation W3C Trace Context
- [ ] Spans : HTTP, DB, Redis, external APIs
- [ ] Dashboard avec latence, erreurs, throughput
- [ ] Alertes (p99 > 500ms, error rate > 1%)

## Bonus
- [ ] Correlation ID dans messages async
- [ ] Sampling intelligent
- [ ] Dashboard as code
