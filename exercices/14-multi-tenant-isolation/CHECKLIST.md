# Checklist — Exercice 14 : Multi-tenant isolation

## Extraction du tenant

- [ ] Le tenantId est extrait du JWT claim `tenant_id`
- [ ] Fallback sur le header `X-Tenant-Id` si pas de JWT
- [ ] 403 si aucun tenantId n'est trouve
- [ ] Le tenantId est valide (existe dans la liste des tenants)

## Schema-per-tenant

- [ ] `SET search_path TO tenant_{slug}, public` est exécuté avant chaque requête
- [ ] Le schema est reset apres la requête
- [ ] Le middleware s'exécuté avant le controller

## S3 prefix

- [ ] Les fichiers sont prefixes par `{tenantId}/{siteId}/`
- [ ] Le service de storage ajoute le prefix automatiquement
- [ ] Pas de path traversal possible (`../` interdit)

## Tests

- [ ] Tenant A ne voit pas les données de Tenant B
- [ ] Requête sans tenantId → 403
- [ ] Le schema est bien switche entre requêtes concurrentes

## Bonus

- [ ] Backup per-tenant fonctionne
- [ ] Quota de storage par tenant
