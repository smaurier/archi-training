# Correction — Exercice 25 : i18n + hreflang

## useLocaleFallback

```typescript
// hooks/useLocaleFallback.ts
export function useLocaleFallback(
  field: Record<string, string> | null,
  locale: string,
  fallback: string = 'fr',
): string {
  if (!field) return '';
  return field[locale] ?? field[fallback] ?? Object.values(field)[0] ?? '';
}
```

## hreflang tags

```typescript
// components/HreflangTags.tsx — genere les tags <link> hreflang
import Head from 'next/head';

interface HreflangTagsProps {
  slugs: Record<string, string>;
  basePath: string;
  currentLocale: string;
}

export function HreflangTags({ slugs, basePath, currentLocale }: HreflangTagsProps) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL!;
  const locales = ['fr', 'en', 'de'];

  const links = locales
    .filter((locale) => slugs[locale])
    .map((locale) => ({
      rel: 'alternate' as const,
      hreflang: locale,
      href: `${siteUrl}/${locale}${basePath}/${slugs[locale]}`,
    }));

  // x-default pointe vers FR
  links.push({
    rel: 'alternate',
    hreflang: 'x-default',
    href: `${siteUrl}/fr${basePath}/${slugs.fr}`,
  });

  const canonical = `${siteUrl}/${currentLocale}${basePath}/${slugs[currentLocale]}`;

  return (
    <Head>
      {links.map((link) => (
        <link key={link.hreflang} rel={link.rel} hrefLang={link.hreflang} href={link.href} />
      ))}
      <link rel="canonical" href={canonical} />
    </Head>
  );
}

// Usage dans la page produit :
// <HreflangTags slugs={product.slug} basePath="/produits" currentLocale={locale} />
```

**Alternative avec le App Router metadata** :

```typescript
// app/[locale]/products/[slug]/page.tsx
import { Metadata } from 'next';

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const product = await fetchProduct(params.slug);
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL!;

  return {
    alternates: {
      canonical: `${siteUrl}/${params.locale}/produits/${product.slug[params.locale]}`,
      languages: {
        fr: `${siteUrl}/fr/produits/${product.slug.fr}`,
        en: `${siteUrl}/en/products/${product.slug.en}`,
        de: `${siteUrl}/de/produkte/${product.slug.de}`,
        'x-default': `${siteUrl}/fr/produits/${product.slug.fr}`,
      },
    },
  };
}
```

## Sitemap multilingue

```typescript
// app/sitemap.ts — Next.js sitemap generation
import { MetadataRoute } from 'next';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const products = await fetchAllProducts();
  const locales = ['fr', 'en', 'de'];
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL!;

  const entries: MetadataRoute.Sitemap = [];

  for (const product of products) {
    for (const locale of locales) {
      const slug = product.slug[locale];
      if (!slug) continue;

      entries.push({
        url: `${baseUrl}/${locale}/produits/${slug}`,
        lastModified: product.updatedAt,
        alternates: {
          languages: Object.fromEntries(
            locales
              .filter((l) => product.slug[l])
              .map((l) => [l, `${baseUrl}/${l}/produits/${product.slug[l]}`]),
          ),
        },
      });
    }
  }

  return entries;
}
```

**Alternative manuelle** (si tu veux générer le XML toi-meme) :

```typescript
// app/sitemap.xml/route.ts — API route handler
import { NextResponse } from 'next/server';

export async function GET() {
  const products = await fetchAllProducts();
  const locales = ['fr', 'en', 'de'];
  const baseUrl = 'https://shop.com';

  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" ';
  xml += 'xmlns:xhtml="http://www.w3.org/1999/xhtml">\n';

  for (const product of products) {
    for (const locale of locales) {
      const slug = product.slug[locale];
      if (!slug) continue;

      xml += '  <url>\n';
      xml += `    <loc>${baseUrl}/${locale}/produits/${slug}</loc>\n`;

      for (const altLocale of locales) {
        if (product.slug[altLocale]) {
          xml += `    <xhtml:link rel="alternate" hreflang="${altLocale}" `;
          xml += `href="${baseUrl}/${altLocale}/produits/${product.slug[altLocale]}"/>\n`;
        }
      }

      xml += '  </url>\n';
    }
  }

  xml += '</urlset>';

  return new NextResponse(xml, {
    headers: { 'Content-Type': 'application/xml' },
  });
}
```

## Auto-redirect 301

```typescript
// Quand un slug change, creer une redirection
async function onSlugChanged(productId: string, locale: string, oldSlug: string, newSlug: string) {
  await redirectRepo.save({
    fromPath: `/${locale}/produits/${oldSlug}`,
    toPath: `/${locale}/produits/${newSlug}`,
    statusCode: 301,
    createdAt: new Date(),
  });
}

// middleware.ts — Next.js middleware pour les redirections
import { NextRequest, NextResponse } from 'next/server';

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // Verifier s'il existe une redirection en base
  const redirect = await findRedirect(path);
  if (redirect) {
    return NextResponse.redirect(
      new URL(redirect.toPath, request.url),
      redirect.statusCode,
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/(fr|en|de)/produits/:path*'],
};
```

## Ce que tu aurais pu oublier

### 1. Oublier x-default
```html
<!-- FAUX — pas de x-default -->
<link rel="alternate" hreflang="fr" href="..." />

<!-- CORRECT — x-default pour les moteurs de recherche -->
<link rel="alternate" hreflang="x-default" href="..." />
```

### 2. Contenu duplique sans canonical
```
FAUX — /fr/produits/chaussure et /en/products/shoe sont des pages differentes
  mais Google peut les voir comme du contenu duplique

CORRECT — canonical sur chaque page + hreflang
```

### 3. Slug non-translitere
```
FAUX — slug FR "Etagere en bois" → "etagere-en-bois" (accents supprimes manuellement)
CORRECT — transliteration automatique avec fallback
  → slugify("Etagere en bois") → "etagere-en-bois"
```
