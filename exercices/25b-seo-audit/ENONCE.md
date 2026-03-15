# Exercice 25b — SEO audit (canonical, OG, structured data)

> 🟢 **Difficulté** : Découverte | **Temps estimé** : 1h | **Ère** : 3 — Le Front
>
> **Prérequis** : Module 05 (cours 8)


## Objectif

Auditer et corriger le SEO technique d'un site e-commerce : canonical URLs, Open Graph, structured data schema.org, et meta tags.

## Temps estime

45 min

## Instructions

### Étape 1 — Audit des pages existantes

Pour chaque type de page (home, listing, produit, article), vérifié :
- `<link rel="canonical">` present et correct
- `<title>` unique et < 60 caracteres
- `<meta name="description">` unique et < 160 caracteres
- Open Graph tags (`og:title`, `og:description`, `og:image`, `og:url`)
- Twitter Cards (`twitter:card`, `twitter:title`, `twitter:image`)
- Pages privees : `<meta name="robots" content="noindex, nofollow">`

### Étape 2 — Structured data

Implemente les schemas JSON-LD :
- `Product` pour les fiches produit (name, price, availability, reviews)
- `BreadcrumbList` pour la navigation
- `Organization` pour la page d'accueil

### Étape 3 — Hook useSeo

Cree un hook `useSeo()` (où une fonction `generateMetadata`) qui généré automatiquement tous les meta tags depuis les données de la page.

### Bonus
- Ajouter un breadcrumb généré depuis la hiérarchie de routes
- Valider les structured data avec le Rich Results Test

## Contraintes

- Chaque page à un canonical unique
- Open Graph et Twitter Cards sur toutes les pages publiques
- noindex sur les pages privees (/account, /cart, /checkout)
