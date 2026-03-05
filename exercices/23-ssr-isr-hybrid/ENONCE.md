# Exercice 23 — SSR/ISR hybrid routing

> 🟡 **Difficulté** : Conception | **Temps estimé** : 1h30 | **Ère** : 3 — Le Front
>
> **Prérequis** : Module 05 (cours 6)


## Objectif

Classifier les routes d'un e-commerce par stratégie de rendu (SSR, SSG, ISR, SPA) et implémenter la configuration hybride.

## Contexte

ShopArch a différents types de pages avec des besoins différents : les pages statiques ne changent jamais, le catalogue change rarement, le panier est prive et dynamique.

## Temps estime

1h

## Instructions

### Étape 1 — Classifier les routes

| Route | Stratégie | Justification |
|---|---|---|
| `/` (home) | | |
| `/about`, `/contact` | | |
| `/products` (listing) | | |
| `/products/:slug` (fiche) | | |
| `/cart` | | |
| `/checkout` | | |
| `/account/*` | | |
| `/blog/:slug` | | |
| `/sitemap.xml` | | |

### Étape 2 — Configurer Next.js

Configure les stratégies de rendu dans le App Router de Next.js pour chaque type de page.

### Étape 3 — Hydration stratégies

Pour chaque composant de la page produit, choisis la stratégie de chargement :
- `eager` : charge et hydrate immédiatement (above the fold)
- `lazy + Suspense` : charge quand visible (Intersection Observer)
- `dynamic({ ssr: false })` : client-only (pas de SSR)

### Bonus

- Implémenter le Personalization Shell Pattern pour la home
- Ajouter le FOUC prevention (tokens CSS dans le `<head>`)

## Contraintes

- SSR pour les pages SEO-critical
- Client-only pour les pages authentifiees
- ISR avec revalidation on-demand pour le contenu editorial
- Pas de SSR pour le panier (données privees)
