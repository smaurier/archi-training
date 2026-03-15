# Checklist — Exercice 20 : Search abstraction layer

- [ ] Interface `SearchProvider` définie avec search/index/delete
- [ ] `PostgresSearchProvider` utilise tsvector + plainto_tsquery
- [ ] `ElasticsearchSearchProvider` utilise l'API ES
- [ ] Factory switch via env var `SEARCH_PROVIDER`
- [ ] Le code métier utilise uniquement l'interface (pas l'implémentation)
- [ ] Les deux providers retournent le même format `SearchResult<T>`
- [ ] Le switch ne nécessité aucun changement dans les controllers

## Bonus
- [ ] Facettes implémentées
- [ ] Debounce 300ms
