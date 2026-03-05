# Checklist — Exercice 42 : Cache multi-niveaux

- [ ] Cache-Control headers pour pages produit (public, max-age, stale-while-revalidate)
- [ ] Cache-Control immutable pour assets statiques
- [ ] Cache-Control no-store pour pages privees (panier, checkout)
- [ ] ETag pour validation conditionnelle
- [ ] CDN cache avec Surrogate-Control
- [ ] CDN bypass pour requêtes authentifiees
- [ ] CDN cache key avec tenant ID
- [ ] CDN purge programmable
- [ ] Redis cache-aside (read: cache → DB)
- [ ] Redis TTL par type de donnée
- [ ] Invalidation cohérente sur les 3 niveaux
- [ ] Invalidation event-driven (ProductUpdated)
- [ ] Pas de données sensibles dans le CDN

## Bonus
- [ ] Cache L0 in-process
- [ ] Cache warming
- [ ] Hit rate par niveau
