# Cours 29 — Indexation & Performance

> **Objectif** : Comprendre les types d'index PostgreSQL (B-tree, GIN, GiST), savoir lire un `EXPLAIN ANALYZE`, et maîtriser les stratégies d'indexation avancees (partial, covering, tsvector).

---

## Rappel du cours précédent

<details>
<summary>1. Qu'est-ce que la stratégie Expand-Contract pour les migrations zero-downtime ?</summary>

En 3 étapes sur 3 déploiements :
1. **Expand** : ajouter la nouvelle colonne + sync trigger
2. **Migrate** : déployer le code qui utilise la nouvelle colonne (les deux versions coexistent)
3. **Contract** : supprimer l'ancienne colonne et le trigger

Chaque migration est compatible avec la version N et N-1 du code.
</details>

<details>
<summary>2. Pourquoi créer des snapshots periodiques dans le content versioning diff-based ?</summary>

Sans snapshots intermédiaires, reconstruire la version 100 nécessité d'appliquer 99 diffs sequentiellement. En creant un snapshot toutes les 20 versions, on n'applique au maximum que 19 diffs depuis le dernier snapshot, ce qui maintient la reconstruction sous ~5ms.
</details>

---

## Analogie — L'index d'un livre

Imagine un livre de 500 pages sans index ni table des matières :

- **Sans index** (sequential scan) : tu lis les 500 pages pour trouver "PostgreSQL" → O(n)
- **Avec un index alphabetique** (B-tree) : tu cherches a "P", puis "Po" → O(log n)
- **Avec un index thematique** (GIN) : tu trouves tous les chapitres qui mentionnent "full-text search" → recherche inversee
- **Avec un index partiel** : l'index ne couvre que les chapitres "avances" — plus petit, plus rapide

Chaque index supplementaire prend de la place (pages d'index) et ralentit l'écriture (mettre a jour l'index a chaque modification). L'art est de choisir les bons index.

---

## Théorie

### 1. Types d'index PostgreSQL

| Type | Structure | Cas d'usage | Operateurs supportes |
|---|---|---|---|
| **B-tree** | Arbre équilibre | Egalite, plage, tri (`=`, `<`, `>`, `BETWEEN`, `ORDER BY`) | Tous les types scalaires |
| **Hash** | Table de hachage | Egalite stricte (`=`) uniquement | Entiers, strings |
| **GIN** | Inverted index | Full-text search, JSONB, arrays | `@>`, `@@`, `?`, `?&` |
| **GiST** | Arbre generalise | Geometrie, plages, proximity | `&&`, `@>`, `<->` |
| **BRIN** | Block range | Grandes tables triees (dates, timestamps) | `<`, `>`, `=` sur colonnes ordonnees |

### 2. B-tree en detail

```
                    [M]
                   /   \
              [D, H]    [R, X]
             / | \     / | \
          [A-C][E-G][I-L][N-Q][S-W][Y-Z]

Recherche "PostgreSQL" → commence par P
→ P > M → branche droite
→ P < R → branche gauche
→ Feuille [N-Q] → scan lineaire → trouve !
Complexite : O(log n) — pour 1M rows, ~20 comparaisons
```

### 3. GIN (Generalized Inverted Index)

Le GIN est un **index inverse** — il mappe chaque "mot" vers la liste des documents qui le contiennent :

```
Mot          → Documents
─────────────────────────
"postgresql" → [doc_1, doc_5, doc_12]
"index"      → [doc_1, doc_3, doc_7]
"full-text"  → [doc_5, doc_12]

Recherche "postgresql AND index"
→ intersection [doc_1, doc_5, doc_12] ∩ [doc_1, doc_3, doc_7]
→ resultat : [doc_1]
```

Ideal pour : `tsvector` (full-text), JSONB (`@>`), arrays (`&&`).

### 4. EXPLAIN ANALYZE — lire un plan d'exécution

```sql
EXPLAIN ANALYZE SELECT * FROM products WHERE category_id = 'abc';
```

```
Seq Scan on products  (cost=0.00..1234.00 rows=50000 width=120) (actual time=0.01..45.23 rows=50000 loops=1)
  Filter: (category_id = 'abc')
  Rows Removed by Filter: 450000
Planning Time: 0.1 ms
Execution Time: 52.4 ms
```

**Alerte** : `Seq Scan` sur 500K rows = problème. Ajoutons un index :

```sql
CREATE INDEX idx_products_category ON products (category_id);

EXPLAIN ANALYZE SELECT * FROM products WHERE category_id = 'abc';
```

```
Index Scan using idx_products_category on products (cost=0.42..123.45 rows=50000 width=120) (actual time=0.02..5.12 rows=50000 loops=1)
  Index Cond: (category_id = 'abc')
Planning Time: 0.1 ms
Execution Time: 8.3 ms
```

**De 52ms a 8ms** — le query planner utilise maintenant l'index.

| Signal d'alerte | Signification |
|---|---|
| `Seq Scan` sur grande table | Index manquant |
| `Rows Removed by Filter` élevé | L'index ne filtre pas assez |
| `Sort` avec `external merge` | Sort en mémoire insuffisante |
| `Nested Loop` avec beaucoup de loops | JOIN mal indexe |
| `actual rows` >> `rows` (estime) | Statistiques obsoletes → `ANALYZE` |

### 5. Stratégies d'indexation avancees

#### Partial index

Index seulement un sous-ensemble des rows :

```sql
-- Index seulement les produits publies (ignore les drafts)
CREATE INDEX idx_products_published
ON products (name, category_id)
WHERE status = 'published';
-- Taille d'index reduite de ~60% si 40% des produits sont en draft
```

#### Covering index (INCLUDE)

Inclut des colonnes non-filtrantes pour éviter un "index-only scan" :

```sql
-- L'index contient tout ce dont la requete a besoin
CREATE INDEX idx_products_category_covering
ON products (category_id) INCLUDE (name, price);

-- Cette requete n'a PAS besoin d'aller lire la table (index-only scan)
SELECT name, price FROM products WHERE category_id = 'abc';
```

#### Composite index

L'ordre des colonnes compte :

```sql
-- BON pour : WHERE category_id = X AND status = Y
-- BON pour : WHERE category_id = X (prefixe de l'index)
-- MAUVAIS pour : WHERE status = Y (pas le prefixe)
CREATE INDEX idx_products_cat_status ON products (category_id, status);
```

**Regle** : la colonne la plus selective (celle qui filtre le plus) en premier.

### 6. Full-text search avec tsvector + GIN

```sql
-- 1. Ajouter la colonne tsvector
ALTER TABLE products ADD COLUMN search_vector tsvector;

-- 2. Trigger pour maintenir la colonne a jour
CREATE FUNCTION products_search_update() RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('french', COALESCE(NEW.name, '')), 'A') ||
    setweight(to_tsvector('french', COALESCE(NEW.description, '')), 'B') ||
    setweight(to_tsvector('french', COALESCE(NEW.category_name, '')), 'C');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_products_search_update
BEFORE INSERT OR UPDATE ON products
FOR EACH ROW EXECUTE FUNCTION products_search_update();

-- 3. Index GIN sur la colonne tsvector
CREATE INDEX idx_products_search ON products USING GIN (search_vector);

-- 4. Requete full-text avec ranking
SELECT id, name, ts_rank(search_vector, query) AS rank
FROM products, plainto_tsquery('french', 'chaussure cuir') AS query
WHERE search_vector @@ query
ORDER BY rank DESC
LIMIT 20;
```

Les **weights** (A, B, C, D) permettent de booster certains champs : un match dans le `name` (A) vaut plus qu'un match dans la `description` (B).

---

## Pratique

### Script d'audit des index manquants

```sql
-- Trouver les sequential scans les plus couteux
SELECT
  schemaname,
  relname AS table_name,
  seq_scan,
  seq_tup_read,
  idx_scan,
  CASE WHEN seq_scan > 0
    THEN round(seq_tup_read::numeric / seq_scan, 2)
    ELSE 0
  END AS avg_rows_per_scan
FROM pg_stat_user_tables
WHERE seq_scan > 100           -- Plus de 100 seq scans
  AND seq_tup_read > 100000   -- Plus de 100K rows lues en sequential
ORDER BY seq_tup_read DESC
LIMIT 20;
```

### Taille des index

```sql
-- Verifier la taille de chaque index
SELECT
  indexrelname AS index_name,
  pg_size_pretty(pg_relation_size(indexrelid)) AS index_size,
  idx_scan AS times_used
FROM pg_stat_user_indexes
ORDER BY pg_relation_size(indexrelid) DESC
LIMIT 20;

-- Index jamais utilises → candidats a la suppression
SELECT indexrelname, idx_scan
FROM pg_stat_user_indexes
WHERE idx_scan = 0
  AND indexrelname NOT LIKE 'pg_%';
```

### TypeORM entity avec index

```typescript
@Entity('products')
@Index('idx_products_category', ['categoryId'])
@Index('idx_products_published', ['name', 'categoryId'], {
  where: '"status" = \'published\'', // Partial index
})
export class ProductEntity {
  @PrimaryColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  description: string;

  @Column('uuid')
  categoryId: string;

  @Column({ default: 'draft' })
  status: string;

  @Column('tsvector', { select: false })
  searchVector: string;
}
```

---

## Resume

1. **B-tree** pour egalite/plage (defaut), **GIN** pour full-text/JSONB, **BRIN** pour grandes tables ordonnees
2. **`EXPLAIN ANALYZE`** est l'outil n°1 — un `Seq Scan` sur une grande table = index manquant
3. **Partial index** pour indexer un sous-ensemble (`WHERE status = 'published'`) → plus petit, plus rapide
4. **Covering index** (`INCLUDE`) pour les index-only scans — évité de lire la table
5. **tsvector + GIN** pour le full-text search natif PostgreSQL — poids A/B/C pour le ranking

---

> **Prochain cours** : [Cours 30 — Patterns lecture/écriture](./04-patterns-lecture-écriture.md) — ou comment séparer les chemins de lecture et d'écriture pour la performance.

---

> **Lien fil rouge — ShopArch**
>
> - Ajoute un index GIN sur le champ full-text des produits ShopArch
> - Vérifie avec EXPLAIN ANALYZE que les requêtes principales utilisent les index
> - Exercice(s) associé(s) : `exercices/18-optimisation-requetes/`
> - Checkpoint : Module 04, critère 3-4
