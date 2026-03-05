# Exercice 17 — Schema e-commerce PostgreSQL

> 🟡 **Difficulté** : Conception | **Temps estimé** : 2h | **Ère** : 4 — L'Autre Côté
>
> **Prérequis** : Module 04 (cours 1), SQL basics


## Objectif

Concevoir le schema PostgreSQL de ShopArch avec UUID PKs, colonnes JSON i18n, soft deletes, et champs partages obligatoires.

## Contexte

Tu dois créer le schema de base de données pour le catalogue, les commandes et les utilisateurs de ShopArch. Le schema doit supporter le multi-tenant, l'i18n, et le versioning.

## Temps estime

1h

## Instructions

### Étape 1 — Conventions

Chaque table doit avoir ces champs obligatoires :
- `id` UUID (PK, généré par l'application)
- `site_id` UUID (FK vers sites, pour les entités site-scoped)
- `created_at` TIMESTAMPTZ NOT NULL DEFAULT NOW()
- `updated_at` TIMESTAMPTZ NOT NULL DEFAULT NOW()
- `version` INTEGER NOT NULL DEFAULT 1
- `status` VARCHAR(20) NOT NULL DEFAULT 'active'

### Étape 2 — Tables principales

Cree les tables suivantes :
1. `products` — id, name (JSONB i18n), description (JSONB i18n), slug (JSONB i18n), price, category_id, stock
2. `categories` — id, name (JSONB i18n), slug (JSONB i18n), parent_id (self-referencing)
3. `orders` — id, user_id, status (FSM), total, shipping_address (JSONB)
4. `order_lines` — id, order_id, product_id, product_name, unit_price, quantity
5. `users` — id, email, role, display_name

### Étape 3 — Index

Cree les index nécessaires :
- Index sur `status` (pour les soft deletes)
- Index GIN sur les colonnes JSONB i18n
- Index unique sur `slug` par site et locale
- Index sur les FK (category_id, order_id, user_id)

### Étape 4 — Contraintes

- FK avec `ON DELETE RESTRICT` (pas de cascade delete)
- CHECK sur `price >= 0`
- CHECK sur `stock >= 0`
- UNIQUE sur `email` par tenant

### Bonus

- Ajouter une table `content_versions` pour le versioning diff-based
- Créer une vue materialisee pour les stats produits

## Contraintes

- UUID pour toutes les PKs (pas de SERIAL)
- Colonnes JSONB pour l'i18n (`{ "fr": "...", "en": "..." }`)
- Soft delete via `status = 'deleted'` (pas de DELETE physique)
- Tous les champs partages obligatoires
