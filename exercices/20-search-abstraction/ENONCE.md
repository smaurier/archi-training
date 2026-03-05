# Exercice 20 — Search abstraction layer

> 🔵 **Difficulté** : Application | **Temps estimé** : 1h | **Ère** : 4 — L'Autre Côté
>
> **Prérequis** : Module 04 (cours 6)


## Objectif

Implémenter une couche d'abstraction de recherche (`SearchProvider`) qui permet de switcher entre PostgreSQL FTS et Elasticsearch sans changer le code métier.

## Contexte

ShopArch commence avec PostgreSQL FTS mais pourrait migrer vers Elasticsearch plus tard. Tu dois concevoir une interface qui découplé le code métier du moteur de recherche.

## Temps estime

1h

## Instructions

### Étape 1 — Interface SearchProvider

```typescript
interface SearchQuery {
  text: string;
  locale: string;
  filters?: Record<string, string | number | boolean>;
  sort?: { field: string; order: 'asc' | 'desc' };
  limit?: number;
  offset?: number;
}

interface SearchResult<T> {
  items: T[];
  total: number;
  took: number; // ms
}

interface SearchProvider {
  search(index: string, query: SearchQuery): Promise<SearchResult<unknown>>;
  index(index: string, id: string, document: Record<string, unknown>): Promise<void>;
  delete(index: string, id: string): Promise<void>;
}
```

### Étape 2 — Implémentation PostgreSQL

Implemente `PostgresSearchProvider` utilisant `tsvector` et `plainto_tsquery`.

### Étape 3 — Implémentation Elasticsearch

Implemente `ElasticsearchSearchProvider` utilisant l'API Elasticsearch.

### Étape 4 — Factory avec switch

Le provider est choisi via la variable `SEARCH_PROVIDER=postgres|elasticsearch`.

### Bonus

- Ajouter les facettes (comptages par categorie)
- Implémenter le debounce côté service (300ms)

## Contraintes

- Le code métier (controller, service) ne connait PAS l'implémentation
- Les deux providers doivent retourner le meme format
- Le switch se fait sans changer le code métier
