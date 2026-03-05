# Correction — Exercice 23 : SSR/ISR hybrid

## Classification

| Route | Stratégie | Justification |
|---|---|---|
| `/` (home) | **ISR** (60s) | SEO, change peu, CDN-cacheable + shell pattern |
| `/about`, `/contact` | **SSG** | 100% statique, prerendu au build |
| `/products` (listing) | **ISR** (300s) | SEO, filtres dynamiques, revalidation 5min |
| `/products/:slug` | **ISR** (on-demand) | SEO, revalide quand le produit change |
| `/cart` | **Client-only** | Prive, pas de SEO, données session |
| `/checkout` | **Client-only** | Prive, sécurisé, pas de cache |
| `/account/*` | **Client-only** | Authentifie, noindex |
| `/blog/:slug` | **ISR** (on-demand) | SEO, revalide quand l'article change |
| `/sitemap.xml` | **SSR** | Genere dynamiquement, cache CDN 1h |

## Configuration Next.js (App Router)

```typescript
// app/page.tsx — Home (ISR 60s)
export const revalidate = 60;

export default async function HomePage() {
  const featured = await fetch(`${API_URL}/products/featured`, {
    next: { revalidate: 60 },
  }).then((r) => r.json());

  return (
    <>
      <HeroBanner />
      <FeaturedProducts products={featured} />
      <PersonalizedSection /> {/* client component */}
    </>
  );
}

// app/about/page.tsx — SSG (statique)
// Par defaut, le App Router genere statiquement les pages sans donnees dynamiques
export default function AboutPage() {
  return <div>A propos de ShopArch</div>;
}

// app/products/page.tsx — ISR 300s
export const revalidate = 300;

export default async function ProductsPage() {
  const products = await fetch(`${API_URL}/products`, {
    next: { revalidate: 300 },
  }).then((r) => r.json());

  return <ProductList products={products} />;
}

// app/products/[slug]/page.tsx — ISR on-demand
export const revalidate = 0; // revalidation uniquement on-demand

export async function generateStaticParams() {
  const products = await fetch(`${API_URL}/products?limit=100`).then((r) => r.json());
  return products.map((p: Product) => ({ slug: p.slug }));
}

export default async function ProductPage({ params }: { params: { slug: string } }) {
  const product = await fetch(`${API_URL}/products/${params.slug}`, {
    next: { tags: [`product-${params.slug}`] },
  }).then((r) => r.json());

  return <ProductDetail product={product} />;
}

// app/cart/page.tsx — Client-only (pas de SSR)
'use client';

export default function CartPage() {
  const { items, total } = useCart();
  return <CartView items={items} total={total} />;
}

// app/account/layout.tsx — Client-only + noindex
import { Metadata } from 'next';

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  return <AuthGuard>{children}</AuthGuard>;
}
```

## Revalidation on-demand

```typescript
// app/api/revalidate/route.ts
import { revalidateTag, revalidatePath } from 'next/cache';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const secret = request.headers.get('x-revalidation-secret');
  if (secret !== process.env.REVALIDATION_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { type, slug } = await request.json();

  if (type === 'product') {
    revalidateTag(`product-${slug}`);
    revalidatePath(`/products/${slug}`);
  }
  if (type === 'blog') {
    revalidateTag(`blog-${slug}`);
    revalidatePath(`/blog/${slug}`);
  }

  return NextResponse.json({ revalidated: true });
}
```

## Lazy loading et hydration stratégies

```tsx
// app/products/[slug]/page.tsx — composants de la page produit
import dynamic from 'next/dynamic';
import { Suspense } from 'react';

// Above the fold → import statique, rendu immediatement
import { ProductGallery } from '@/components/ProductGallery';
import { ProductInfo } from '@/components/ProductInfo';

// Below the fold → lazy load avec Suspense
const ProductDescription = dynamic(
  () => import('@/components/ProductDescription'),
  { loading: () => <DescriptionSkeleton /> },
);

const RelatedProducts = dynamic(
  () => import('@/components/RelatedProducts'),
  { loading: () => <RelatedSkeleton /> },
);

// Client-only → pas de SSR (interactif uniquement)
const Reviews = dynamic(
  () => import('@/components/Reviews'),
  { ssr: false, loading: () => <ReviewsSkeleton /> },
);

export default async function ProductPage({ params }: { params: { slug: string } }) {
  const product = await fetchProduct(params.slug);

  return (
    <div className="product-page">
      {/* Above the fold — rendu immediatement */}
      <ProductGallery images={product.images} />
      <ProductInfo product={product} />

      {/* Below the fold — lazy loaded */}
      <Suspense fallback={<DescriptionSkeleton />}>
        <ProductDescription description={product.description} />
      </Suspense>

      <Suspense fallback={<RelatedSkeleton />}>
        <RelatedProducts categoryId={product.categoryId} />
      </Suspense>

      {/* Client-only — hydrate au premier clic */}
      <Suspense fallback={<ReviewsSkeleton />}>
        <Reviews productId={product.id} />
      </Suspense>
    </div>
  );
}
```

## Personalization Shell Pattern (bonus)

```tsx
// app/page.tsx — Home : shell public ISR + zones privees client-only
import dynamic from 'next/dynamic';

// Client-only components (personnalisation)
const PersonalizedRecommendations = dynamic(
  () => import('@/components/PersonalizedRecommendations'),
  { ssr: false, loading: () => <RecommendationsSkeleton /> },
);

const RecentlyViewed = dynamic(
  () => import('@/components/RecentlyViewed'),
  { ssr: false, loading: () => <RecentlyViewedSkeleton /> },
);

export default async function HomePage() {
  const page = await fetchHomePage();

  return (
    <>
      {/* Public (SSR, CDN cached) */}
      <HeroBanner content={page.hero} />
      <FeaturedProducts products={page.featured} />

      {/* Private (client-side only, pas de cache CDN) */}
      <PersonalizedRecommendations />
      <RecentlyViewed />
    </>
  );
}
```

## FOUC prevention

```tsx
// app/layout.tsx — injecter le theme avant le paint
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <head>
        {/* Detecter le theme AVANT le premier paint pour eviter le flash */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                var t = localStorage.getItem('shoparch-theme');
                if (t === 'dark' || (!t && matchMedia('(prefers-color-scheme:dark)').matches)) {
                  document.documentElement.classList.add('dark');
                }
              })();
            `,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
```

## Ce que tu aurais pu oublier

### 1. SSR le panier

```
FAUX — le panier est rendu cote serveur
  → Le CDN cache le HTML avec les items du panier d'un utilisateur
  → Un autre utilisateur voit le mauvais panier

CORRECT — Client-only pour le panier ('use client')
  → Rendu uniquement cote client
  → Pas de donnees privees dans le HTML cache
```

### 2. Pas de revalidation on-demand

```
FAUX — ISR avec TTL fixe de 5 minutes
  → Un produit modifie n'apparait qu'apres 5 minutes

CORRECT — ISR on-demand + webhook
  → Quand un produit change, appeler POST /api/revalidate
  → Le cache est purge immediatement pour cette page (revalidateTag)
```

### 3. Charger tout immédiatement

```
FAUX — tous les composants sont importes au load
  → 500KB de JS execute pour des sections non visibles

CORRECT — chargement progressif
  → Above the fold : import statique (immediatement)
  → Below the fold : dynamic import (quand necessaire)
  → Client-only : dynamic({ ssr: false }) (au premier clic)
```
