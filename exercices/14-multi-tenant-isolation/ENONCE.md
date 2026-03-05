# Exercice 14 — Multi-tenant isolation

> 🟠 **Difficulté** : Arbitrage | **Temps estimé** : 1h30 | **Ère** : 4 — L'Autre Côté
>
> **Prérequis** : Module 03 (cours 4)


## Objectif

Implémenter l'isolation multi-tenant avec schema-per-tenant PostgreSQL et des filtres automatiques.

## Contexte

ShopArch est multi-tenant : chaque client (tenant) a ses propres données, complètement isolees. L'isolation se fait a 3 niveaux : DB schema, query filter, et storage prefix S3.

## Temps estime

1h

## Instructions

### Étape 1 — Schema-per-tenant

Implemente la logique qui :
1. Extrait le `tenantId` du JWT (claim `tenant_id`)
2. Fallback sur le header `X-Tenant-Id` si pas de JWT
3. Set le `search_path` PostgreSQL vers le schema du tenant

```sql
SET search_path TO tenant_acme, public;
```

### Étape 2 — Tenant filter automatique

Cree un middleware/interceptor qui :
- S'exécuté avant chaque requête
- Extrait le tenantId
- Configure le schema PostgreSQL
- Ajoute le tenantId au contexte de la requête

### Étape 3 — S3 storage prefix

Les fichiers uploades sont prefixes par le tenantId :
```
s3://cms-media/{tenantId}/{siteId}/uploads/...
```

Implemente un service de storage qui ajoute automatiquement le prefix.

### Étape 4 — Tests d'isolation

Ecris un test qui vérifié :
- Le tenant A ne peut PAS voir les données du tenant B
- Une requête sans tenantId est rejetee (403)
- Le schema PostgreSQL est bien switche entre les requêtes

### Bonus

- Implémenter un per-tenant backup avec `pg_dump -n tenant_{slug}`
- Ajouter un quota de storage par tenant

## Contraintes

- L'isolation est AUTOMATIQUE (pas besoin de passer le tenantId a chaque query)
- 3 couches : DB schema + query filter + S3 prefix
- Zero accès cross-tenant possible
- Le middleware s'exécuté AVANT le controller
