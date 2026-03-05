# Correction — Exercice 25b : SEO audit

## generateMetadata (App Router)

Next.js App Router fournit une API native pour les meta tags via `generateMetadata`. C'est l'approche recommandee.

```typescript
// lib/seo.ts — helper pour generer les metadata
import { Metadata } from 'next';

interface SeoParams {
  title: string;
  description: string;
  image?: string;
  type?: 'website' | 'article' | 'product';
  noindex?: boolean;
  canonicalPath?: string;
}

export function buildMetadata(params: SeoParams): Metadata {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL!;
  const canonical = `${siteUrl}${params.canonicalPath ?? ''}`;

  return {
    title: params.title,
    description: params.description,
    robots: params.noindex ? { index: false, follow: false } : undefined,
    alternates: { canonical },
    openGraph: {
      title: params.title,
      description: params.description,
      url: canonical,
      type: (params.type ?? 'website') as any,
      images: params.image ? [{ url: params.image }] : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title: params.title,
      description: params.description,
      images: params.image ? [params.image] : undefined,
    },
  };
}

// Usage dans une page produit :
// app/products/[slug]/page.tsx
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const product = await fetchProduct(params.slug);
  return buildMetadata({
    title: product.name,
    description: product.description.slice(0, 155),
    image: product.images[0]?.url,
    type: 'product',
    canonicalPath: `/products/${params.slug}`,
  });
}
```

**Alternative avec le Pages Router** (hook + Head) :

```tsx
// hooks/useSeo.tsx — pour le Pages Router
import Head from 'next/head';

interface SeoParams {
  title: string;
  description: string;
  image?: string;
  type?: 'website' | 'article' | 'product';
  noindex?: boolean;
  canonicalPath?: string;
}

export function SeoHead({ title, description, image, type = 'website', noindex, canonicalPath }: SeoParams) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL!;
  const canonical = `${siteUrl}${canonicalPath ?? ''}`;

  return (
    <Head>
      <title>{title}</title>
      <meta name="description" content={description} />
      {noindex && <meta name="robots" content="noindex, nofollow" />}
      <link rel="canonical" href={canonical} />
      {/* Open Graph */}
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={canonical} />
      <meta property="og:type" content={type} />
      {image && <meta property="og:image" content={image} />}
      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      {image && <meta name="twitter:image" content={image} />}
    </Head>
  );
}
```

## JSON-LD Product

```tsx
// components/ProductSchema.tsx
export function ProductSchema({ product }: { product: Product }) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: product.description,
    image: product.images[0]?.url,
    sku: product.id,
    offers: {
      '@type': 'Offer',
      price: product.price,
      priceCurrency: 'EUR',
      availability: product.stock > 0
        ? 'https://schema.org/InStock'
        : 'https://schema.org/OutOfStock',
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}
```

## JSON-LD Breadcrumb

```tsx
// components/BreadcrumbSchema.tsx
interface BreadcrumbItem {
  name: string;
  url: string;
}

export function BreadcrumbSchema({ items }: { items: BreadcrumbItem[] }) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: item.url,
    })),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}
```

## Ce que tu aurais pu oublier

### 1. Canonical URL avec query params
```
FAUX — canonical inclut les filtres: /products?category=shoes&sort=price
CORRECT — canonical sans query params: /products
  → Les filtres ne sont pas des pages distinctes
```

### 2. og:image manquant
```
FAUX — pas d'og:image → apercu generique sur les reseaux sociaux
CORRECT — toujours une image OG (1200x630 minimum)
  → Image du produit ou image par defaut du site
```

### 3. noindex oublie sur /account
```
FAUX — Google indexe /account/settings, /account/orders
CORRECT — noindex + nofollow sur toutes les pages privees
```
