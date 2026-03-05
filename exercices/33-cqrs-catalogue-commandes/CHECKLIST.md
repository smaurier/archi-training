# Checklist — Exercice 33 : CQRS catalogue + commandes

- [ ] Commands définies comme objets type-safe (CreateProduct, UpdatePrice, etc.)
- [ ] Queries définies comme objets type-safe (GetProduct, SearchProducts, etc.)
- [ ] Write model normalise (PostgreSQL)
- [ ] Read model denormalise (table ou vue materialisee)
- [ ] CommandBus avec dispatch vers handler unique
- [ ] QueryBus avec dispatch vers handler
- [ ] Middlewares (validation, logging)
- [ ] Domain events (ProductCreated, PriceUpdated, StockUpdated)
- [ ] Projection asynchrone du read model
- [ ] Commands ne retournent pas de données
- [ ] Queries ne modifient pas l'état

## Bonus
- [ ] Event Store
- [ ] Replay du read model
- [ ] Metriques lag de projection
