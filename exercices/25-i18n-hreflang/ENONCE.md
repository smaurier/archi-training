# Exercice 25 — i18n + hreflang + sitemap

> 🔵 **Difficulté** : Application | **Temps estimé** : 1h | **Ère** : 3 — Le Front
>
> **Prérequis** : Module 05 (cours 8)


## Objectif

Implémenter l'i18n complete : MultiLangField, hreflang tags, sitemap multilingue, et locale fallback.

## Contexte

ShopArch est disponible en FR, EN, et DE. Chaque produit à un nom, une description et un slug par locale. Le SEO multilingue doit etre parfait.

## Temps estime

1h

## Instructions

### Étape 1 — MultiLangField hook
Implemente `useLocaleFallback(field, locale, fallbackLocale)` qui retourne la valeur dans la locale demandee ou le fallback.

### Étape 2 — hreflang tags
Genere automatiquement les tags `<link rel="alternate" hreflang="x" href="...">` pour chaque page avec Next.js `<Head>` ou `metadata`.

### Étape 3 — Sitemap multilingue
Genere un sitemap XML avec une entree par locale :
```xml
<url>
  <loc>https://shop.com/fr/produits/chaussure-cuir</loc>
  <xhtml:link rel="alternate" hreflang="fr" href="https://shop.com/fr/produits/chaussure-cuir"/>
  <xhtml:link rel="alternate" hreflang="en" href="https://shop.com/en/products/leather-shoe"/>
  <xhtml:link rel="alternate" hreflang="de" href="https://shop.com/de/produkte/lederschuh"/>
</url>
```

### Étape 4 — Auto-redirect sur changement de slug
Si un slug change (ex: renommage), créer une redirection 301 automatique de l'ancien vers le nouveau.

### Bonus
- Ajouter la détection automatique de locale via `Accept-Language`
- Implémenter le switcher de locale dans le header

## Contraintes

- URL structure : `/{locale}/...` (prefix strategy)
- Fallback locale : FR
- Slug unique par locale par site
- Pas de contenu duplique (canonical URL obligatoire)
