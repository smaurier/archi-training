# Correction — Exercice 18 : Optimisation de requêtes

## Résultat attendu

Des requêtes optimisees passant de Seq Scan a Index Scan avec des temps divises par 10-100x.

## Requête 1 — Listing par categorie

### Avant (sans index)
```
Seq Scan on products  (cost=0.00..25000.00 rows=500 width=256)
  Filter: (category_id = 'cat-123' AND status = 'active')
  Rows Removed by Filter: 99500
Sort  (cost=25000.00..25001.25 rows=500 width=256)
  Sort Key: created_at DESC
  Sort Method: quicksort  Memory: 128kB
```

### Index propose
```sql
-- Index composite couvrant la requete
CREATE INDEX idx_products_cat_status_created
    ON products (category_id, status, created_at DESC)
    WHERE status = 'active'; -- Partial index
```

### Apres (avec index)
```
Index Scan using idx_products_cat_status_created on products
  Index Cond: (category_id = 'cat-123')
  → 20 rows en < 1ms (vs 500ms avant)
```

### Covering index (bonus)
```sql
-- INCLUDE evite de retourner a la table pour les colonnes frequentes
CREATE INDEX idx_products_listing
    ON products (category_id, created_at DESC)
    INCLUDE (name, price, slug, images)
    WHERE status = 'active';
```

## Requête 2 — Recherche full-text

### Problème
```sql
-- ILIKE '%chaussure%' ne peut PAS utiliser un B-tree index
-- → Seq Scan obligatoire sur 100K lignes
WHERE name->>'fr' ILIKE '%chaussure%'
```

### Solution A — tsvector (meilleure)
```sql
-- Ajouter une colonne tsvector
ALTER TABLE products ADD COLUMN search_vector tsvector;

UPDATE products SET search_vector =
    to_tsvector('french', COALESCE(name->>'fr', '') || ' ' || COALESCE(description->>'fr', ''));

CREATE INDEX idx_products_fts ON products USING GIN (search_vector);

-- Requete optimisee
SELECT * FROM products
WHERE search_vector @@ plainto_tsquery('french', 'chaussure')
  AND status = 'active'
ORDER BY ts_rank(search_vector, plainto_tsquery('french', 'chaussure')) DESC;
```

### Solution B — pg_trgm (pour ILIKE)
```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX idx_products_name_trgm
    ON products USING GIN ((name->>'fr') gin_trgm_ops);

-- Maintenant ILIKE utilise l'index GIN trigram
SELECT * FROM products
WHERE name->>'fr' ILIKE '%chaussure%'
  AND status = 'active';
```

## Requête 3 — Commandes utilisateur

### Problème
```
Hash Join  (cost=5000.00..10000.00)
  → Seq Scan on order_lines  (99% du temps ici)
  → Index Scan on orders using idx_orders_user
```

### Index propose
```sql
-- L'index sur order_lines.order_id est CRITIQUE pour le JOIN
CREATE INDEX idx_order_lines_order ON order_lines (order_id);

-- Optionnel : index composite pour le WHERE + ORDER BY
CREATE INDEX idx_orders_user_created
    ON orders (user_id, created_at DESC);
```

### Reecriture (éviter json_agg sur trop de lignes)
```sql
-- Mieux : requete en 2 etapes
-- 1. Charger les commandes (avec index)
SELECT * FROM orders
WHERE user_id = 'user-456'
ORDER BY created_at DESC
LIMIT 10;

-- 2. Charger les lignes pour ces commandes
SELECT * FROM order_lines
WHERE order_id IN ('ord-1', 'ord-2', ..., 'ord-10');
```

## Resume des index créés

```sql
-- Requete 1 : listing par categorie
CREATE INDEX idx_products_cat_status_created
    ON products (category_id, status, created_at DESC)
    WHERE status = 'active';

-- Requete 2 : recherche full-text
CREATE INDEX idx_products_fts ON products USING GIN (search_vector);

-- Requete 3 : commandes utilisateur
CREATE INDEX idx_order_lines_order ON order_lines (order_id);
CREATE INDEX idx_orders_user_created ON orders (user_id, created_at DESC);
```

## Ce que tu aurais pu oublier

### 1. Index sur chaque colonne individuellement

```sql
-- FAUX — un index par colonne
CREATE INDEX idx1 ON products (category_id);
CREATE INDEX idx2 ON products (status);
CREATE INDEX idx3 ON products (created_at);
-- PostgreSQL ne combinera probablement pas les 3

-- CORRECT — index composite dans l'ordre de la requete
CREATE INDEX idx ON products (category_id, status, created_at DESC);
```

### 2. ILIKE sans index trigram

```sql
-- FAUX — B-tree ne supporte pas les patterns avec % au debut
CREATE INDEX idx ON products ((name->>'fr'));
WHERE name->>'fr' ILIKE '%chaussure%' -- Seq Scan malgre l'index !

-- CORRECT — GIN trigram ou tsvector
CREATE INDEX idx ON products USING GIN ((name->>'fr') gin_trgm_ops);
```

### 3. Oublier WHERE dans le partial index

```sql
-- FAUX — indexe aussi les 'deleted' (inutile)
CREATE INDEX idx ON products (category_id, created_at DESC);

-- CORRECT — partial index, exclut les supprimes
CREATE INDEX idx ON products (category_id, created_at DESC)
    WHERE status = 'active';
-- Plus petit, plus rapide, moins de maintenance
```
