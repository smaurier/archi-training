# Checklist — Exercice 49 : Blue-green deployment

- [ ] Architecture blue-green documentee (diagramme)
- [ ] Load balancer switch configure
- [ ] Health checks sur green avant switch
- [ ] Switch progressif (1% → 10% → 50% → 100%)
- [ ] Monitoring pendant le switch
- [ ] Rollback < 30s (re-switch vers blue)
- [ ] Migrations backward-compatible (add column safe)
- [ ] Dual-write pour renommer une colonne
- [ ] Pas de migration destructive en une étape
- [ ] Cleanup de blue apres 1h
- [ ] Zero downtime pendant le deployment

## Bonus
- [ ] Canary deployment alternatif
- [ ] Migration safety check CI
- [ ] Script Kubernetes automatise
