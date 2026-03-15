# Exercice 42 — Cache multi-niveaux

> 🟡 **Difficulté** : Conception | **Temps estimé** : 1h30 | **Ère** : 6 — La Défense
>
> **Prérequis** : Module 09 (cours 1)


## Objectif

Implémenter une stratégie de cache a 3 niveaux (navigateur, CDN, Redis) pour le catalogue produits de ShopArch, avec invalidation cohérente.

## Contexte

La page produit est la plus visitee de ShopArch (80% du trafic). Elle est actuellement servie à chaque requête depuis PostgreSQL. L'objectif est de servir 95% des requêtes depuis le cache.

## Temps estime

1h

## Instructions

### Étape 1 — Cache navigateur (L1)
Configure les headers HTTP pour le cache navigateur :
- Pages produit : `Cache-Control: public, max-age=60, stale-while-revalidate=300`
- Assets statiques : `Cache-Control: public, max-age=31536000, immutable`
- Pages panier/checkout : `Cache-Control: private, no-store`
- ETag pour la validation conditionnelle

### Étape 2 — Cache CDN (L2)
Configure le cache CDN (Cloudflare/Fastly) :
- Cache les pages produit avec `Surrogate-Control: max-age=300`
- Bypass le cache pour les requêtes authentifiees
- Cache key : URL + tenant ID (pas de données user)
- Purge programmable par API (quand un produit est modifie)

### Étape 3 — Cache Redis (L3)
Implemente un cache Redis applicatif :
- Cache les entités produit serializees (TTL 5 min)
- Cache les résultats de recherche (TTL 1 min)
- Pattern Cache-Aside (read: cache → DB, write: DB → invalidate cache)

### Étape 4 — Invalidation cohérente
Implemente l'invalidation a travers les 3 niveaux :
- Quand un produit est modifie : invalider Redis → purger CDN → le browser re-valide au prochain access
- Event-driven : écouter `ProductUpdated` pour déclencher l'invalidation
- Invalidation par tag (purger tous les produits d'une categorie)

### Bonus
- Ajouter un cache L0 in-process (Map avec TTL pour les hot keys)
- Implémenter un cache warming (pre-populer au déploiement)
- Mesurer le hit rate par niveau de cache

## Contraintes
- Les données sensibles (panier, profil) ne doivent JAMAIS etre cachees dans le CDN
- Le cache doit etre tenant-aware (pas de leak entre tenants)
- L'invalidation doit etre < 10 secondes après une modification
