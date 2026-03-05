# Exercice 43 — CDN & image pipeline

> 🟡 **Difficulté** : Conception | **Temps estimé** : 1h30 | **Ère** : 6 — La Défense
>
> **Prérequis** : Module 09 (cours 2)


## Objectif

Implémenter un pipeline d'optimisation d'images pour ShopArch : upload, resize, conversion WebP/AVIF, CDN delivery avec responsive images.

## Contexte

Les images produit de ShopArch representent 70% du poids des pages. Les utilisateurs uploadent des images de 5-20 MB. Les images doivent etre servies en plusieurs tailles et formats pour optimiser les Core Web Vitals (LCP).

## Temps estime

1h

## Instructions

### Étape 1 — Upload et processing
Implemente le pipeline d'upload :
- Accepter les images (JPEG, PNG, WebP) jusqu'a 20 MB
- Valider le type MIME reel (pas juste l'extension)
- Générer des variantes : thumbnail (150px), medium (600px), large (1200px), original
- Convertir en WebP et AVIF (en plus du format original)

### Étape 2 — Stockage S3
Stocke les images dans S3 :
- Structure : `{tenant-id}/products/{product-id}/{size}.{format}`
- Metadata : content-type, cache-control (1 an), original filename
- Signed URLs pour l'upload direct (presigned POST)
- Processing asynchrone via job queue (pas de resize dans la requête HTTP)

### Étape 3 — CDN delivery
Configure le CDN pour servir les images :
- URL pattern : `https://cdn.shoparch.com/img/{product-id}/{size}.{format}`
- Auto-negotiation du format via `Accept` header (WebP si supporte, AVIF si supporte)
- Cache immutable (1 an, hash dans le filename)

### Étape 4 — Responsive images
Implemente le composant front-end :
- `<picture>` avec `<source>` pour AVIF, WebP, et JPEG fallback
- `srcset` avec les tailles 150, 600, 1200
- `sizes` adapte au layout (mobile: 100vw, desktop: 33vw)
- `loading="lazy"` pour les images below the fold
- Placeholder blur (LQIP — Low Quality Image Placeholder)

### Bonus
- Générer le blur hash (Blurhash) au moment du processing
- Implémenter l'image focal point (crop intelligent)
- Ajouter un budget de taille par image (alerte si > 200 KB en WebP)

## Contraintes
- Le processing d'image ne doit PAS bloquer la requête HTTP (asynchrone)
- Les images doivent etre servies en < 100ms depuis le CDN
- Le LCP doit etre < 2.5s sur une connexion 3G
