# Checklist — Exercice 14b : Multi-site

## Modèle

- [ ] L'entité Site a : id, tenantId, slug, domain, defaultLocale, theme
- [ ] Un site appartient à un tenant (relation Many-to-One)

## Extraction

- [ ] Le siteId est extrait du header `X-Site-Id`
- [ ] Fallback sur la résolution de domaine
- [ ] Fallback sur le site par defaut du tenant
- [ ] Le site est valide (appartient au tenant actuel)

## Filtrage

- [ ] Les entités site-scoped ont un filtre `site_id` automatique
- [ ] Les entités tenant-scoped ne sont PAS filtrees par site
- [ ] Le filtre est transparent pour le code métier

## Bonus

- [ ] Résolution domaine → siteId avec cache Redis
- [ ] Invalidation du cache quand un site change de domaine
