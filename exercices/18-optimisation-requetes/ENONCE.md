# Exercice 18 — Optimisation de requêtes (EXPLAIN)

> 🔵 **Difficulté** : Application | **Temps estimé** : 1h30 | **Ère** : 4 — L'Autre Côté
>
> **Prérequis** : Module 04 (cours 3)


## Objectif

Utiliser `EXPLAIN ANALYZE` pour diagnostiquer et optimiser des requêtes lentes sur le schema ShopArch.

## Contexte

L'API ShopArch devient lente : la page catalogue met 3 secondes a charger, la recherche produits est inutilisable. Tu dois identifier et corriger les requêtes problématiques.

## Temps estime

45 min

## Instructions

### Étape 1 — Diagnostiquer avec EXPLAIN ANALYZE

Pour chaque requête ci-dessous, ecris ce que tu t'attends a voir dans le plan d'exécution et propose un index :

**Requête 1 — Listing produits par categorie**
```sql
SELECT * FROM products
WHERE category_id = 'cat-123'
  AND status = 'active'
ORDER BY created_at DESC
LIMIT 20;
```

**Requête 2 — Recherche full-text**
```sql
SELECT * FROM products
WHERE name->>'fr' ILIKE '%chaussure%'
  AND status = 'active';
```

**Requête 3 — Commandes d'un utilisateur**
```sql
SELECT o.*, json_agg(ol.*) AS lines
FROM orders o
JOIN order_lines ol ON ol.order_id = o.id
WHERE o.user_id = 'user-456'
GROUP BY o.id
ORDER BY o.created_at DESC;
```

### Étape 2 — Proposer des index

Pour chaque requête, propose :
1. L'index a créer (type, colonnes, WHERE clause)
2. L'impact attendu (Seq Scan → Index Scan)
3. Le cout de l'index (espace, write overhead)

### Étape 3 — Recrire si nécessaire

Certaines requêtes ne peuvent pas etre optimisees juste avec un index. Reecris-les si nécessaire.

### Bonus

- Proposer un covering index (INCLUDE) pour la requête 1
- Proposer un index GIN trigram pour la recherche ILIKE

## Contraintes

- Toujours mesurer AVANT et APRES avec EXPLAIN ANALYZE
- Pas de sur-indexation (chaque index a un cout en écriture)
- Privilegier les partial indexes quand possible
