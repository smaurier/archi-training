# Checklist — Exercice 03 : Injection de dépendances

## Identification

- [ ] Identifie `Pool` (pg) comme dépendance concrete de persistance
- [ ] Identifie `Redis` (ioredis) comme dépendance concrete de cache
- [ ] Identifie `axios.get()` comme dépendance concrete de client HTTP externe

## Interfaces

- [ ] Cree `ProductRepository` avec `findById(id)` et `search(query)`
- [ ] Cree `CacheService` avec `get(key)`, `set(key, value, ttl)`
- [ ] Cree `PricingClient` avec `getPrice(productId)`
- [ ] Les interfaces ne mentionnent aucune technologie (pas de `Redis`, `pg`, `axios`)

## Refactoring

- [ ] `ProductService` recoit les 3 interfaces par le constructeur
- [ ] Zero `new` dans le service
- [ ] Zero `import` de librairies concretes (pg, ioredis, axios)
- [ ] Zero `process.env` dans le service
- [ ] La logique métier (check cache → query DB → enrich → set cache) est preservee

## Test

- [ ] Test de `getProduct()` avec 3 mocks injectes
- [ ] Verifie le cas cache miss (appel DB + pricing + set cache)
- [ ] Verifie le cas cache hit (pas d'appel DB ni pricing)
- [ ] Le test ne nécessité aucune infra (pas de Docker, pas de Redis, pas de PostgreSQL)

## Bonus

- [ ] `InMemoryCacheService` implémenté `CacheService` avec un `Map<string, { value: string, expiresAt: number }>`
- [ ] Scopes NestJS documentes (repository=REQUEST, cache=SINGLETON)
