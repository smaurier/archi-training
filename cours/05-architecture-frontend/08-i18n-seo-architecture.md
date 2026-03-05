# Cours 40 — i18n & SEO Architecture

> **Objectif** : Architecturer l'internationalisation (i18n UI + contenu) et le SEO technique (hreflang, sitemaps, canonical, structured data, Open Graph).

---

## Rappel du cours précédent

<details>
<summary>1. Quels sont les 3 Core Web Vitals et leurs seuils "bon" ?</summary>

- **LCP** (Largest Contentful Paint) : < 2.5s — temps de rendu du plus grand élément visible
- **CLS** (Cumulative Layout Shift) : < 0.1 — stabilité visuelle (pas de decalages de layout)
- **INP** (Interaction to Next Paint) : < 200ms — reactivite aux interactions utilisateur
</details>

<details>
<summary>2. Pourquoi séparer les vendor chunks par nom (react, router, i18n) plutot qu'un seul vendor.js ?</summary>

Quand le code applicatif change (fréquent), seul le chunk app change. Les chunks vendor (dépendances stables) restent inchanges et en cache navigateur. Avec un seul vendor.js, tout le cache est invalide a chaque build meme si les dépendances n'ont pas change.
</details>

---

## Analogie — L'ambassade

Chaque ambassade d'un pays represente le **meme pays** (contenu), mais :
- Elle parle la **langue locale** (UI locale) et adapte ses documents (content locale)
- Elle a une **adresse différente** dans chaque ville (`/{locale}/...`)
- Elle est **reconnue officiellement** par les autorites locales (Google indexe chaque version avec `hreflang`)
- Son **passeport** (URL canonique) indique quelle est la version de référence

---

## Théorie

### 1. Deux concepts d'i18n a ne pas confondre

| Concept | Ce que c'est | Exemple |
|---|---|---|
| **UI locale** | Langue de l'interface (boutons, menus, labels) | "Ajouter au panier" vs "Add to cart" |
| **Content locale** | Langue du contenu métier (articles, produits) | Fiche produit en francais vs en anglais |

Les deux sont **independants** : un editeur francophone peut vouloir l'interface en francais mais editer un contenu en anglais.

### 2. MultiLangField — i18n au niveau du champ

```typescript
// Le meme champ contient toutes les traductions
interface MultiLangField {
  fr: string;
  en: string;
  nl?: string;
  de?: string;
}

// Stocke en JSONB PostgreSQL
// { "fr": "T-shirt bio", "en": "Organic t-shirt", "nl": "Bio t-shirt" }
```

### 3. URL strategy

```
URL prefix strategy (recommande) :
  /fr/produits/t-shirt-bio
  /en/products/organic-t-shirt
  /nl/producten/bio-t-shirt

Alternatives (NON recommandees pour SEO) :
  ?lang=fr                    → Pas indexable par Google
  Accept-Language header      → Google ignore les headers
  Sous-domaines (fr.shop.com) → Complexite DNS + certificats
```

**Per-locale slugs** : chaque langue a son propre slug (`t-shirt-bio` en FR, `organic-t-shirt` en EN). Si un slug n'est pas traduit, utiliser un **transliteration fallback** du titre.

### 4. hreflang — dire a Google quelle version servir

```html
<!-- Sur /fr/produits/t-shirt-bio -->
<link rel="alternate" hreflang="fr" href="https://shop.com/fr/produits/t-shirt-bio" />
<link rel="alternate" hreflang="en" href="https://shop.com/en/products/organic-t-shirt" />
<link rel="alternate" hreflang="nl" href="https://shop.com/nl/producten/bio-t-shirt" />
<link rel="alternate" hreflang="x-default" href="https://shop.com/en/products/organic-t-shirt" />
```

**x-default** = la version servie quand aucune locale ne correspond au visiteur.

### 5. SEO technique complet

| Élément | Objectif | Implémentation |
|---|---|---|
| **Canonical URL** | Éviter le contenu duplique | `<link rel="canonical" href="...">` |
| **Structured data** | Rich snippets dans Google | JSON-LD (schema.org) |
| **Open Graph** | Preview dans les réseaux sociaux | `<meta property="og:...">` |
| **Twitter Cards** | Preview sur Twitter/X | `<meta name="twitter:...">` |
| **Sitemap XML** | Index des pages pour Google | Per-locale avec sitemap index |
| **noindex** | Exclure pages privees | `<meta name="robots" content="noindex, nofollow">` |
| **Redirect 301** | Slug change → redirect permanent | Post-persist listener |

### 6. Redirect chain collapsing

Quand un slug change (le produit est renomme), on cree un redirect 301 :

```
/fr/produits/t-shirt → 301 → /fr/produits/t-shirt-bio → 301 → /fr/produits/t-shirt-bio-v2
```

**Problème** : chaque redirect ajoute un round-trip. Google penalise les chaines > 2.

**Solution** : collapse automatique. Quand un nouveau redirect est cree, mettre a jour tous les anciens redirects pour pointer directement vers la destination finale :

```
/fr/produits/t-shirt     → 301 → /fr/produits/t-shirt-bio-v2
/fr/produits/t-shirt-bio → 301 → /fr/produits/t-shirt-bio-v2
```

---

## Pratique

### i18n URL setup (React Router)

```tsx
const router = createBrowserRouter([
  {
    path: '/:locale',
    element: <LocaleLayout />,
    children: [
      { path: '', element: <HomePage /> },
      { path: 'products', element: <ProductsPage /> },
      { path: 'products/:slug', element: <ProductPage /> },
    ],
  },
  // Redirect root to default locale
  { path: '/', element: <Navigate to="/fr" replace /> },
]);

function LocaleLayout() {
  const { locale } = useParams();
  const validLocales = ['fr', 'en', 'nl'];

  if (!validLocales.includes(locale!)) {
    return <Navigate to={`/fr${location.pathname.slice(3)}`} replace />;
  }

  return (
    <I18nProvider locale={locale!}>
      <Outlet />
    </I18nProvider>
  );
}
```

### SEO Head component

```tsx
interface SEOProps {
  title: string;
  description: string;
  canonical: string;
  locale: string;
  alternates: Array<{ locale: string; href: string }>;
  image?: string;
  type?: 'website' | 'product' | 'article';
  structuredData?: object;
  noIndex?: boolean;
}

function SEOHead({
  title, description, canonical, locale, alternates,
  image, type = 'website', structuredData, noIndex,
}: SEOProps) {
  return (
    <Helmet>
      <title>{title} | ShopArch</title>
      <meta name="description" content={description} />

      {/* Canonical */}
      <link rel="canonical" href={canonical} />

      {/* Robots */}
      {noIndex && <meta name="robots" content="noindex, nofollow" />}

      {/* hreflang */}
      {alternates.map((alt) => (
        <link key={alt.locale} rel="alternate" hreflang={alt.locale} href={alt.href} />
      ))}
      <link rel="alternate" hreflang="x-default" href={alternates[0]?.href} />

      {/* Open Graph */}
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={canonical} />
      <meta property="og:type" content={type} />
      <meta property="og:locale" content={locale} />
      {image && <meta property="og:image" content={image} />}

      {/* Twitter Cards */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      {image && <meta name="twitter:image" content={image} />}

      {/* Structured Data */}
      {structuredData && (
        <script type="application/ld+json">
          {JSON.stringify(structuredData)}
        </script>
      )}
    </Helmet>
  );
}
```

### Product page with structured data

```tsx
function ProductPage() {
  const { slug } = useParams();
  const { locale } = useI18n();
  const { data: product } = useFetch<Product>(`/api/products/${slug}`);

  if (!product) return <ProductSkeleton />;

  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name[locale],
    description: product.description[locale],
    image: product.images[0]?.url,
    offers: {
      '@type': 'Offer',
      price: product.price.amount / 100,
      priceCurrency: product.price.currency,
      availability: product.stock > 0
        ? 'https://schema.org/InStock'
        : 'https://schema.org/OutOfStock',
    },
  };

  return (
    <>
      <SEOHead
        title={product.name[locale]}
        description={product.description[locale]?.slice(0, 160)}
        canonical={`https://shop.com/${locale}/products/${product.slugs[locale]}`}
        locale={locale}
        alternates={Object.entries(product.slugs).map(([loc, sl]) => ({
          locale: loc,
          href: `https://shop.com/${loc}/products/${sl}`,
        }))}
        image={product.images[0]?.url}
        type="product"
        structuredData={structuredData}
      />
      <ProductDetail product={product} />
    </>
  );
}
```

### Sitemap generator per-locale

```typescript
// scripts/generate-sitemap.ts
interface SitemapEntry {
  loc: string;
  lastmod: string;
  changefreq: 'daily' | 'weekly' | 'monthly';
  priority: number;
  alternates: Array<{ locale: string; href: string }>;
}

function generateSitemapXML(entries: SitemapEntry[]): string {
  const urls = entries.map((e) => `
  <url>
    <loc>${e.loc}</loc>
    <lastmod>${e.lastmod}</lastmod>
    <changefreq>${e.changefreq}</changefreq>
    <priority>${e.priority}</priority>
    ${e.alternates.map((a) =>
      `<xhtml:link rel="alternate" hreflang="${a.locale}" href="${a.href}" />`
    ).join('\n    ')}
  </url>`).join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls}
</urlset>`;
}

// Sitemap index (pointe vers chaque sitemap par locale)
function generateSitemapIndex(locales: string[]): string {
  const sitemaps = locales.map((loc) => `
  <sitemap>
    <loc>https://shop.com/sitemaps/sitemap-${loc}.xml</loc>
    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
  </sitemap>`).join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemaps}
</sitemapindex>`;
}
```

---

## Resume

1. **Deux i18n** : UI locale (interface) et content locale (contenu métier) — independants
2. **URL prefix** (`/{locale}/...`) avec per-locale slugs et transliteration fallback
3. **hreflang** obligatoire sur chaque page avec `x-default` pour les visiteurs non matches
4. **SEO technique** : canonical, structured data JSON-LD, Open Graph, Twitter Cards, noindex sur les pages privees
5. **Redirect chain collapsing** : quand un slug change, mettre a jour tous les anciens redirects → max 1 hop

---

> **Prochain cours** : [Cours 41 — Micro-frontends](./09-micro-frontends.md) — ou comment decomposer le front-end en applications independantes.

---

> **Lien fil rouge — ShopArch**
>
> - Ajoute les balises hreflang et canonical sur les pages publiques de ShopArch
> - Implémente les structured data schema.org sur les fiches produit
> - Exercice(s) associé(s) : `exercices/25-i18n-hreflang/`, `exercices/25b-seo-audit/`
> - Checkpoint : Module 05, critère 5
