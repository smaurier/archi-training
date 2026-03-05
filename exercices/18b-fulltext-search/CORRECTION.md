# Correction — Exercice 18b : Full-text search

## Solution complete

```sql
-- 1. Ajouter la colonne
ALTER TABLE products ADD COLUMN search_vector tsvector;

-- 2. Populer la colonne existante
UPDATE products SET search_vector =
    setweight(to_tsvector('french', COALESCE(name->>'fr', '')), 'A') ||
    setweight(to_tsvector('french', COALESCE(description->>'fr', '')), 'B');

-- 3. Index GIN
CREATE INDEX idx_products_search ON products USING GIN (search_vector);

-- 4. Trigger de mise a jour automatique
CREATE OR REPLACE FUNCTION products_search_trigger() RETURNS trigger AS $$
BEGIN
    NEW.search_vector :=
        setweight(to_tsvector('french', COALESCE(NEW.name->>'fr', '')), 'A') ||
        setweight(to_tsvector('french', COALESCE(NEW.description->>'fr', '')), 'B');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_products_search
    BEFORE INSERT OR UPDATE OF name, description ON products
    FOR EACH ROW EXECUTE FUNCTION products_search_trigger();

-- 5. Requete de recherche avec ranking
SELECT
    id,
    name->>'fr' AS name,
    price,
    ts_rank(search_vector, query) AS rank
FROM products, plainto_tsquery('french', 'chaussure cuir') AS query
WHERE search_vector @@ query
  AND status = 'active'
ORDER BY rank DESC
LIMIT 20;

-- 6. Highlighting (bonus)
SELECT
    id,
    ts_headline('french', name->>'fr', plainto_tsquery('french', 'chaussure'),
        'StartSel=<mark>, StopSel=</mark>, MaxWords=50') AS highlighted_name,
    ts_rank(search_vector, plainto_tsquery('french', 'chaussure')) AS rank
FROM products
WHERE search_vector @@ plainto_tsquery('french', 'chaussure')
ORDER BY rank DESC;
```

## Multi-locale (bonus)

```sql
-- Combiner FR et EN dans le meme vecteur
UPDATE products SET search_vector =
    setweight(to_tsvector('french', COALESCE(name->>'fr', '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(name->>'en', '')), 'A') ||
    setweight(to_tsvector('french', COALESCE(description->>'fr', '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(description->>'en', '')), 'B');
```

## NestJS intégration

```typescript
@Injectable()
export class ProductSearchService {
  constructor(private readonly dataSource: DataSource) {}

  async search(query: string, locale: string = 'fr', limit: number = 20) {
    const config = locale === 'en' ? 'english' : 'french';

    return this.dataSource.query(`
      SELECT id, name->>$2 AS name, price,
             ts_rank(search_vector, plainto_tsquery($3, $1)) AS rank
      FROM products
      WHERE search_vector @@ plainto_tsquery($3, $1)
        AND status = 'active'
      ORDER BY rank DESC
      LIMIT $4
    `, [query, locale, config, limit]);
  }
}
```

## Alternatives et arbitrages

> En architecture, ta valeur n'est pas de connaître UNE solution,
> mais de savoir POURQUOI tu choisis celle-ci plutôt qu'une autre.

### Option A : PostgreSQL Full-Text Search (solution présentée)
**Quand la choisir :** Déjà sur PostgreSQL, volume modéré (<1M documents), pas besoin de facettes avancées, budget infra limité (pas de service supplémentaire).
**Limites :** Pas de fuzzy matching natif, pas de facettes/agrégations, performance dégradée sur très gros volumes, pas de scoring personnalisé avancé.

### Option B : Elasticsearch / OpenSearch
**Quand la choisir :** Volume important (>1M documents), besoin de facettes (filtres par catégorie, prix, taille), scoring personnalisé, autocomplete avancé, recherche géographique.
**Limites :** Infrastructure lourde (cluster JVM, RAM intensive), complexité opérationnelle (shards, replicas, mapping), coût significatif, eventual consistency.

### Option C : Meilisearch
**Quand la choisir :** Expérience de recherche "à la Algolia" (typo-tolerant, instant), setup simple (un seul binaire), petite/moyenne équipe, <10M documents.
**Limites :** Moins de fonctionnalités que Elasticsearch (pas de requêtes complexes), pas de clustering natif (v1.x), communauté plus petite.

### Option D : Typesense
**Quand la choisir :** Alternative open-source à Algolia, search-as-you-type, haute disponibilité native (Raft consensus), API simple.
**Limites :** Moins mature que Elasticsearch, fonctionnalités analytiques limitées, adoption encore faible.

### Matrice de décision
| Critère | PG FTS | Elasticsearch | Meilisearch | Typesense |
|---|---|---|---|---|
| Complexité ops | Nulle | Élevée | Faible | Faible |
| Typo-tolerance | Non | Plugin | Natif | Natif |
| Facettes | Non | Oui | Oui | Oui |
| Scaling | Limité | Excellent | Moyen | Bon |
| Coût infra | 0 (inclus) | Élevé | Faible | Faible |

### Pour ShopArch, on choisit...
PostgreSQL FTS pour démarrer (Module 04) car c'est gratuit et suffisant pour le catalogue initial (<50K produits). Quand le volume ou les besoins en facettes augmentent, on migre vers Meilisearch (simple à opérer) ou Elasticsearch (si besoin d'analytics avancées). L'abstraction SearchPort dans le code hexagonal rend ce changement transparent.

---

## Ce que tu aurais pu oublier

### 1. Oublier les poids

```sql
-- FAUX — tout au meme poids
to_tsvector('french', name || ' ' || description)

-- CORRECT — titre poids A, description poids B
setweight(to_tsvector('french', name), 'A') ||
setweight(to_tsvector('french', description), 'B')
-- Un match dans le titre rank plus haut
```

### 2. Utiliser LIKE au lieu de tsvector

```sql
-- FAUX — pas de stemming, pas de ranking
WHERE name ILIKE '%chaussure%'
-- "chaussures" ne match pas "chaussure"

-- CORRECT — tsvector avec stemming
WHERE search_vector @@ plainto_tsquery('french', 'chaussure')
-- "chaussures", "chaussure" matchent tous les deux
```

### 3. Oublier le trigger

```
FAUX — mettre a jour search_vector manuellement dans le code applicatif
  → Risque d'oubli, desynchronisation

CORRECT — trigger PostgreSQL
  → Mise a jour automatique a chaque INSERT/UPDATE
```
