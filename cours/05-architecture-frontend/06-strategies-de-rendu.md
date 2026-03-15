# Cours 38 — Stratégies de rendu (SSR, SSG, ISR, Hybride)

> **Objectif** : Comprendre les 4 stratégies de rendu (SSR, SSG, ISR, SPA), savoir les combiner dans une architecture hybride, maîtriser l'hydration et prévenir le FOUC.

---

## Rappel du cours précédent

<details>
<summary>1. Quels sont les 3 niveaux de token layering et dans quel ordre ?</summary>

1. **Global** : valeurs brutes (`--color-blue-500`, `--space-4`)
2. **Semantique** : intentions (`--color-primary`, `--color-surface`, `--color-error`)
3. **Composant** : spécifique (`--button-bg`, `--card-radius`)

Le CSS consomme les tokens composant, qui referent aux semantiques, qui referent aux globaux. Pour le dark mode, on change le niveau semantique.
</details>

<details>
<summary>2. Pourquoi OKLCH plutot que HSL pour générer des palettes ?</summary>

OKLCH est **perceptuellement uniforme** : deux couleurs avec la même lightness OKLCH ont réellement la même luminosite percue par l'oeil humain. En HSL, un jaune a 50% de lightness parait beaucoup plus clair qu'un bleu a 50%. OKLCH garantit des palettes cohérentes et accessibles.
</details>

---

## Analogie — Les medias

- **SSG (Static Site Génération)** = le **journal imprime**. Redige et imprime une fois (build time). Ultra rapide a distribuer (CDN), mais pour mettre a jour il faut reimprimer toute l'edition.
- **SSR (Server-Side Rendering)** = la **radio en direct**. Chaque auditeur (requête) recoit le contenu en temps réel. Toujours a jour, mais le studio (serveur) travaille en permanence.
- **ISR (Incremental Static Regeneration)** = le **podcast**. Pre-enregistre, mais mis a jour periodiquement ou à la demandé. Le meilleur des deux mondes.
- **SPA (Single Page Application)** = le **streaming à la demandé**. L'app se charge une fois, puis tout se passe côté client. Rapide après le chargement initial, mais pas de contenu pour les moteurs de recherche.

---

## Théorie

### 1. Les 4 stratégies comparees

| Stratégie | Ou le rendu | Quand | SEO | TTFB | Données |
|---|---|---|---|---|---|
| **SSG** | Build server | Build time | Excellent | ~50ms (CDN) | Statique |
| **SSR** | App server | Chaque requête | Excellent | ~200-600ms | Temps réel |
| **ISR** | App server | On-demand/timer | Excellent | ~50ms (cache) | Quasi temps réel |
| **SPA** | Client browser | Au chargement | Mauvais | ~50ms (CDN) | Temps réel |

### 2. Architecture hybride — classification par type de route

```
Type de route              Strategie       Pourquoi
─────────────              ─────────       ────────
/ (landing page)           SSG             Immuable, ultra performant
/about, /legal             SSG             Contenu rare, SEO critique
/products (listing)        SSR             Filtres dynamiques, SEO
/products/:slug (fiche)    ISR (60s)       SEO + mise a jour reguliere
/blog/:slug                ISR (3600s)     Rarement modifie
/cart                      SPA             Prive, pas de SEO
/checkout                  SPA             Prive, sensible
/account/*                 SPA             Prive, dynamique
/admin/*                   SPA             Prive, interactif
```

> **Default recommande pour ShopArch** : SSR pour le catalogue (filtres dynamiques + SEO), ISR (60s) pour les fiches produit (SEO + mise a jour reguliere), SPA pour le panier et le checkout (prive, pas de SEO). Cette combinaison hybride maximise la performance percue et le SEO sans complexite inutile. Tu pourras changer plus tard si ton contexte l'exige.

### 3. Hydration — du HTML au composant interactif

```
Serveur                             Client
────────                            ──────
1. Rendu React → HTML statique
2. Envoie le HTML + JS bundle
                                    3. Affiche le HTML immediatement
                                    4. Telecharge le JS
                                    5. "Hydrate" : attache les event
                                       listeners au HTML existant
                                    6. L'app devient interactive
```

**Le problème** : entre les étapes 3 et 6, la page est visible mais **pas interactive**. C'est le "uncanny valley" de l'hydration.

#### Stratégies d'hydration avancees

| Stratégie | Quand hydrater | Avantage |
|---|---|---|
| **Full** | Immediatement | Simple, mais charge tout le JS |
| **On visible** | Quand le composant entre dans le viewport (Intersection Observer) | Les composants en bas de page ne bloquent pas |
| **On idle** | Quand le navigateur est idle (`requestIdleCallback`) | N'impacte pas le TTI |
| **On interaction** | Au premier clic/hover/focus | Minimum de JS possible |
| **Partial / Islands** | Seulement les iles interactives | HTML statique reste statique |

### 4. FOUC prevention

**FOUC** (Flash Of Unstyled Content) : l'utilisateur voit brievement la page sans styles (tokens CSS) avant que le theme soit applique.

```
SANS prevention :
1. HTML arrive (pas de tokens CSS)     ← FOUC ! Page blanche/non stylée
2. JS charge
3. JS injecte les tokens CSS
4. Page stylée

AVEC prevention (SSR token injection) :
1. HTML arrive AVEC les tokens CSS dans <head>  ← Stylée immédiatement
2. JS charge
3. JS hydrate (les tokens sont déjà là)
4. Page interactive
```

**Solution** : injecter les tokens CSS dans le `<head>` côté serveur, AVANT le premier paint.

### 5. Personalization Shell Pattern

Comment servir une page CDN-cacheable tout en ayant du contenu personnalise ?

```
┌───────────────────────────────────────┐
│           CDN-cached HTML              │
│                                        │
│  ┌──────────────────────────────────┐ │
│  │  Header (public)                 │ │
│  │  ┌──────────────┐               │ │
│  │  │  Skeleton    │ ← placeholder  │ │
│  │  │  (user menu) │   pour widget  │ │
│  │  └──────────────┘   prive        │ │
│  ├──────────────────────────────────┤ │
│  │  Product listing (public)        │ │
│  │  (SSR, identique pour tous)      │ │
│  ├──────────────────────────────────┤ │
│  │  Footer (public)                 │ │
│  └──────────────────────────────────┘ │
└───────────────────────────────────────┘
        │
        │ Client-side fetch (apres hydration)
        ▼
┌───────────────────┐
│  GET /api/me      │ → Remplacer skeleton par user menu
│  GET /api/cart    │ → Remplacer skeleton par cart badge
└───────────────────┘
```

Avantage : pas de `Vary: Cookie` → la page est cacheable par le CDN pour tous les utilisateurs. Le contenu prive est charge côté client.

---

## Pratique

### Next.js — SSG

```tsx
// app/about/page.tsx — genere au build time
export default function AboutPage() {
  return <div>About ShopArch...</div>;
}

// Aucun fetch dynamique = SSG automatique en Next.js App Router
```

### Next.js — SSR

```tsx
// app/products/page.tsx — rendu a chaque requete
export default async function ProductsPage({
  searchParams,
}: {
  searchParams: { q?: string; category?: string; page?: string };
}) {
  const products = await fetch(
    `${process.env.API_URL}/products?${new URLSearchParams(searchParams)}`,
    { cache: 'no-store' }, // Force SSR (pas de cache)
  ).then((r) => r.json());

  return <ProductList products={products} />;
}
```

### Next.js — ISR

```tsx
// app/products/[slug]/page.tsx — regenere periodiquement
export const revalidate = 60; // Revalider toutes les 60 secondes

export default async function ProductPage({ params }: { params: { slug: string } }) {
  const product = await fetch(
    `${process.env.API_URL}/products/${params.slug}`,
  ).then((r) => r.json());

  return <ProductDetail product={product} />;
}

// Generer les pages les plus populaires au build time
export async function generateStaticParams() {
  const products = await fetch(`${process.env.API_URL}/products/popular`).then((r) => r.json());
  return products.map((p: Product) => ({ slug: p.slug }));
}
```

### FOUC prevention — injection SSR des tokens

```typescript
// utils/inlineTokensCSS.ts
// A executer cote serveur (Next.js middleware, layout.tsx, ou _document.tsx)

export function getInlineTokensCSS(theme: 'light' | 'dark'): string {
  // Les tokens critiques qui doivent etre presents AVANT le premier paint
  const tokens = theme === 'dark'
    ? {
        '--color-surface': 'oklch(15% 0.02 240)',
        '--color-on-surface': 'oklch(93% 0.01 240)',
        '--color-primary': 'oklch(65% 0.15 240)',
      }
    : {
        '--color-surface': 'oklch(98% 0.01 240)',
        '--color-on-surface': 'oklch(15% 0.02 240)',
        '--color-primary': 'oklch(55% 0.15 240)',
      };

  const cssVars = Object.entries(tokens)
    .map(([key, value]) => `${key}:${value}`)
    .join(';');

  return `<style>:root{${cssVars};color-scheme:${theme}}</style>`;
}
```

```tsx
// Next.js app/layout.tsx
import { getInlineTokensCSS } from '@/utils/inlineTokensCSS';
import { cookies } from 'next/headers';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const theme = cookies().get('theme')?.value === 'dark' ? 'dark' : 'light';

  return (
    <html lang="fr" className={theme === 'dark' ? 'dark' : ''}>
      <head>
        {/* Tokens CSS injectes AVANT le premier paint */}
        <div dangerouslySetInnerHTML={{ __html: getInlineTokensCSS(theme) }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
```

### Hydration wrapper component (on-visible)

```tsx
import { useEffect, useRef, useState } from 'react';

function HydrateOnVisible({ children, fallback }: {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '200px' }, // Pre-charge 200px avant le viewport
    );

    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref}>
      {isVisible ? children : (fallback || <div style={{ minHeight: 200 }} />)}
    </div>
  );
}
```

---

## Résumé

1. **SSG** pour les pages immuables (landing, legal), **SSR** pour les pages dynamiques avec SEO, **ISR** pour le meilleur des deux, **SPA** pour les zones privees
2. **Architecture hybride** : classifier chaque route par son type → choisir la stratégie adaptee
3. **Hydration stratégies** : on-visible, on-idle, on-interaction — ne pas tout hydrater immédiatement
4. **FOUC prevention** : injecter les tokens CSS dans `<head>` côté serveur AVANT le premier paint
5. **Personalization Shell** : HTML public CDN-cache + skeletons → client-side fetch pour les widgets prives

---

> **Prochain cours** : [Cours 39 — Performance Front-end](./07-performance-frontend.md) — ou comment optimiser la performance front-end avec des budgets, Core Web Vitals et Lighthouse CI.

---

> **Lien fil rouge — ShopArch**
>
> - Configure ShopArch : SSR pour le catalogue, ISR pour les fiches produit, SPA pour le panier
> - Implémente la FOUC prevention (tokens CSS injectés dans `<head>` côté serveur)
> - Exercice(s) associé(s) : `exercices/23-ssr-isr-hybrid/`
> - Checkpoint : Module 05, critère 3-4
