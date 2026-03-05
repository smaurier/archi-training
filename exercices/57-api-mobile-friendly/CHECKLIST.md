# Checklist — Exercice 57 : API mobile-friendly

- [ ] Field selection (?fields=id,name,price)
- [ ] Prefer: return=minimal
- [ ] Compression gzip/brotli
- [ ] Pagination réduite par defaut (10)
- [ ] Batch endpoint (POST /api/batch, max 10 requêtes)
- [ ] Timeout individuel par sous-requête dans le batch
- [ ] Entité complete retournee apres mutation
- [ ] If-Match pour résolution de conflits
- [ ] Health check léger (GET /ping → 204)
- [ ] Idempotency keys pour les mutations
- [ ] X-Retry-After sur erreurs temporaires
- [ ] Réponse API < 5 KB en moyenne

## Bonus
- [ ] Endpoint sync delta (/changes?since=)
- [ ] JSON:API sparse fieldsets
- [ ] HTTP/2 Server Push
