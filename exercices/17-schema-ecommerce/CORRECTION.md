# Correction — Exercice 17 : Schema e-commerce

## Résultat attendu

Un schema PostgreSQL complet, normalise, avec UUID PKs, JSONB i18n, et index performants.

## Schema SQL

```sql
-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Categories (self-referencing)
CREATE TABLE categories (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    site_id     UUID NOT NULL,
    parent_id   UUID REFERENCES categories(id) ON DELETE RESTRICT,
    name        JSONB NOT NULL DEFAULT '{}',  -- { "fr": "Mode", "en": "Fashion" }
    slug        JSONB NOT NULL DEFAULT '{}',  -- { "fr": "mode", "en": "fashion" }
    sort_order  INTEGER NOT NULL DEFAULT 0,
    status      VARCHAR(20) NOT NULL DEFAULT 'active',
    version     INTEGER NOT NULL DEFAULT 1,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Products
CREATE TABLE products (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    site_id       UUID NOT NULL,
    category_id   UUID REFERENCES categories(id) ON DELETE RESTRICT,
    name          JSONB NOT NULL DEFAULT '{}',
    description   JSONB NOT NULL DEFAULT '{}',
    slug          JSONB NOT NULL DEFAULT '{}',
    price         NUMERIC(10,2) NOT NULL CHECK (price >= 0),
    stock         INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
    images        JSONB NOT NULL DEFAULT '[]',  -- [{ url, alt, position }]
    seo_title     JSONB DEFAULT '{}',
    seo_desc      JSONB DEFAULT '{}',
    status        VARCHAR(20) NOT NULL DEFAULT 'draft',
    version       INTEGER NOT NULL DEFAULT 1,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Users (tenant-scoped, not site-scoped)
CREATE TABLE users (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email         VARCHAR(255) NOT NULL,
    display_name  VARCHAR(255),
    role          VARCHAR(50) NOT NULL DEFAULT 'viewer',
    status        VARCHAR(20) NOT NULL DEFAULT 'active',
    version       INTEGER NOT NULL DEFAULT 1,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(email)  -- Unique par tenant (schema-per-tenant)
);

-- Orders
CREATE TABLE orders (
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    site_id           UUID NOT NULL,
    user_id           UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    status            VARCHAR(20) NOT NULL DEFAULT 'created'
                      CHECK (status IN ('created','paid','shipped','delivered','cancelled')),
    total             NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (total >= 0),
    shipping_address  JSONB NOT NULL DEFAULT '{}',
    payment_id        UUID,
    tracking_number   VARCHAR(100),
    version           INTEGER NOT NULL DEFAULT 1,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Order Lines (prix fige au moment de la commande)
CREATE TABLE order_lines (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id      UUID NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
    product_id    UUID NOT NULL,  -- Pas de FK : le produit peut etre supprime
    product_name  VARCHAR(255) NOT NULL,  -- Copie figee
    unit_price    NUMERIC(10,2) NOT NULL CHECK (unit_price >= 0),
    quantity      INTEGER NOT NULL CHECK (quantity > 0),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Content Versions (bonus)
CREATE TABLE content_versions (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    entity_type VARCHAR(50) NOT NULL,   -- 'product', 'article'
    entity_id   UUID NOT NULL,
    version     INTEGER NOT NULL,
    data        JSONB NOT NULL,          -- Snapshot (v1) ou diff (v2+)
    is_snapshot BOOLEAN NOT NULL DEFAULT false,
    author_id   UUID REFERENCES users(id),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(entity_type, entity_id, version)
);
```

## Index

```sql
-- Soft delete filter (partial index — n'indexe que les actifs)
CREATE INDEX idx_products_active ON products(status) WHERE status != 'deleted';
CREATE INDEX idx_categories_active ON categories(status) WHERE status != 'deleted';
CREATE INDEX idx_orders_status ON orders(status);

-- FK indexes
CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_products_site ON products(site_id);
CREATE INDEX idx_orders_user ON orders(user_id);
CREATE INDEX idx_orders_site ON orders(site_id);
CREATE INDEX idx_order_lines_order ON order_lines(order_id);

-- JSONB GIN pour recherche i18n
CREATE INDEX idx_products_name_gin ON products USING GIN (name jsonb_path_ops);
CREATE INDEX idx_products_description_gin ON products USING GIN (description jsonb_path_ops);

-- Full-text search (tsvector sur le nom FR)
CREATE INDEX idx_products_fts_fr ON products
    USING GIN (to_tsvector('french', name->>'fr'));

-- Slug unique par site et locale
CREATE UNIQUE INDEX idx_products_slug_fr_site
    ON products ((slug->>'fr'), site_id)
    WHERE status != 'deleted';

CREATE UNIQUE INDEX idx_products_slug_en_site
    ON products ((slug->>'en'), site_id)
    WHERE status != 'deleted';

-- Tri par date de creation
CREATE INDEX idx_products_created ON products(created_at DESC);
CREATE INDEX idx_orders_created ON orders(created_at DESC);
```

## Vue materialisee (bonus)

```sql
CREATE MATERIALIZED VIEW product_stats AS
SELECT
    p.category_id,
    c.name AS category_name,
    COUNT(p.id) AS product_count,
    AVG(p.price) AS avg_price,
    SUM(p.stock) AS total_stock,
    COUNT(CASE WHEN p.stock = 0 THEN 1 END) AS out_of_stock_count
FROM products p
JOIN categories c ON p.category_id = c.id
WHERE p.status = 'active'
GROUP BY p.category_id, c.name;

-- Rafraichir periodiquement
REFRESH MATERIALIZED VIEW CONCURRENTLY product_stats;
```

## Alternatives et arbitrages

> En architecture, ta valeur n'est pas de connaître UNE solution,
> mais de savoir POURQUOI tu choisis celle-ci plutôt qu'une autre.

### Option A : PostgreSQL normalisé (solution présentée)
**Quand la choisir :** Données relationnelles avec intégrité référentielle forte, transactions ACID nécessaires, requêtes ad-hoc complexes (JOINs), équipe SQL expérimentée.
**Limites :** Les JOINs multiples ralentissent les lectures à grande échelle, scaling horizontal limité (read replicas seulement), schéma rigide face aux évolutions fréquentes.

### Option B : PostgreSQL dénormalisé (materialized views)
**Quand la choisir :** Lectures intensives (catalogue produit, dashboards), données qui changent peu, besoin de performances en lecture sans sacrifier l'intégrité en écriture.
**Limites :** Les materialized views doivent être rafraîchies (latence acceptable ?), stockage doublé, complexité de maintenance (quand rafraîchir ?).

### Option C : NoSQL (MongoDB / DynamoDB)
**Quand la choisir :** Schéma très variable (produits avec attributs différents), scaling horizontal natif nécessaire, pattern d'accès prévisible (lookup par clé), données dénormalisées par design.
**Limites :** Pas de JOINs natifs, pas de transactions multi-documents (MongoDB 4.0+ les supporte mais avec overhead), eventual consistency par défaut.

### Matrice de décision
| Critère | PG normalisé | PG dénormalisé | NoSQL |
|---|---|---|---|
| Intégrité référentielle | Excellente | Bonne | Faible |
| Performance lecture | Moyenne | Excellente | Excellente |
| Flexibilité schéma | Faible | Faible | Excellente |
| Scaling horizontal | Limité | Limité | Natif |
| Requêtes ad-hoc | Excellentes | Bonnes | Limitées |

### Pour ShopArch, on choisit...
PostgreSQL normalisé avec des materialized views pour les lectures intensives (catalogue, stats). Le domaine e-commerce a des relations fortes (produit → catégorie, commande → lignes → produit) qui bénéficient de l'intégrité référentielle. On ajoute des materialized views pour le dashboard admin et le listing produits.

---

## Ce que tu aurais pu oublier

### 1. SERIAL au lieu de UUID

```sql
-- FAUX — ID sequentiel = IDOR (enumeration facile)
id SERIAL PRIMARY KEY -- /api/products/1, /api/products/2, ...

-- CORRECT — UUID
id UUID PRIMARY KEY DEFAULT uuid_generate_v4()
```

### 2. FK sur order_lines.product_id

```sql
-- FAUX — FK stricte vers products
product_id UUID REFERENCES products(id)
-- Si le produit est soft-delete → impossible de garder la commande

-- CORRECT — pas de FK, le product_name est copie
product_id UUID NOT NULL, -- Reference sans FK
product_name VARCHAR(255) NOT NULL, -- Copie figee
unit_price NUMERIC(10,2) NOT NULL,  -- Copie figee
```

### 3. Oublier les partial indexes

```sql
-- FAUX — index sur tous les status
CREATE INDEX idx_products_status ON products(status);
-- 95% des produits sont 'active' → l'index est inutile

-- CORRECT — partial index sur les non-supprimes
CREATE INDEX idx_products_active ON products(status)
    WHERE status != 'deleted';
```

### 4. Pas de CHECK constraint

```sql
-- FAUX — le stock peut etre negatif
stock INTEGER NOT NULL DEFAULT 0

-- CORRECT — constraint CHECK
stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0)
```
