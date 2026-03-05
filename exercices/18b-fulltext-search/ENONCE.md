# Exercice 18b — Full-text search PostgreSQL

> 🔵 **Difficulté** : Application | **Temps estimé** : 1h | **Ère** : 4 — L'Autre Côté
>
> **Prérequis** : Module 04 (cours 6)


## Objectif

Implémenter la recherche full-text avec PostgreSQL `tsvector`, `plainto_tsquery`, et `ts_rank`.

## Contexte

ShopArch a besoin d'une recherche produits performante. Avant d'investir dans Elasticsearch, tu veux tirer le maximum de PostgreSQL natif.

## Temps estime

45 min

## Instructions

### Étape 1 — Colonnes tsvector

Ajoute une colonne `search_vector` de type `tsvector` a la table `products`. Elle doit combiner le nom (poids A) et la description (poids B) en francais.

### Étape 2 — Index GIN

Cree un index GIN sur la colonne `search_vector`.

### Étape 3 — Trigger de mise a jour

Cree un trigger qui met a jour `search_vector` automatiquement quand `name` ou `description` change.

### Étape 4 — Requête de recherche

Implemente la recherche avec ranking :
```sql
SELECT *, ts_rank(search_vector, query) AS rank
FROM products, plainto_tsquery('french', 'chaussure cuir') AS query
WHERE search_vector @@ query
ORDER BY rank DESC
LIMIT 20;
```

### Bonus

- Ajouter le highlighting avec `ts_headline`
- Supporter la recherche multi-locale (fr + en)

## Contraintes

- Utiliser la configuration 'french' pour le stemming
- Poids A pour le titre, B pour la description
- Index GIN obligatoire
- La mise a jour du vecteur est automatique (trigger)
