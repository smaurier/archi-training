# Cours 39 — Performance Front-end

> **Objectif** : Définir des performance budgets, comprendre les Core Web Vitals, maîtriser le code splitting, les images optimisees, et mettre en place des quality gates Lighthouse CI.

---

## Rappel du cours précédent

<details>
<summary>1. Qu'est-ce que le Personalization Shell Pattern et quel problème resout-il ?</summary>

Le shell pattern sert une page HTML **publique et CDN-cacheable** avec des skeletons a la place du contenu personnalise. Apres hydration, le client fetch les données privees (panier, user menu). Cela évité le header `Vary: Cookie` qui empeche le CDN de cacher la page.
</details>

<details>
<summary>2. Comment prevenir le FOUC (Flash Of Unstyled Content) en SSR ?</summary>

En injectant les design tokens CSS (custom properties) directement dans le `<head>` du HTML côté serveur, **avant le premier paint**. Ainsi le navigateur dispose des styles des le rendu initial, sans attendre le chargement du JavaScript.
</details>

---

## Analogie — Le journal (above the fold)

Un journal est plie en deux dans le kiosque. Le lecteur voit d'abord le haut de la page (above the fold) — les gros titres, la photo principale. Le reste (below the fold) est invisible tant qu'il n'a pas deplie le journal.

**La performance front-end suit le meme principe** :
- **Above the fold** = ce que l'utilisateur voit sans scroller → doit charger en premier (critical CSS, LCP image eager, preconnect)
- **Below the fold** = le reste → peut charger en differe (lazy loading, on-idle hydration)
- **Performance budget** = le poids maximal du journal — au-dela, il est trop lourd a transporter

---

## Théorie

### 1. Performance budgets

| Metrique | Budget | Pourquoi |
|---|---|---|
| HTML (gzip) | ≤ 80 KB | Au-dela, le TTFB augmente et le parsing ralentit |
| JS total (gzip) | ≤ 200 KB | Le JS est le contenu le plus couteux (parsing + exécution) |
| CSS (gzip) | ≤ 50 KB | Au-dela, le rendu est bloque |
| Images par page | ≤ 500 KB | Impact direct sur le LCP |
| Fonts | ≤ 100 KB | 2-3 fichiers max |
| TTFB | ≤ 600 ms | Au-dela, l'utilisateur percoit un delai |

### 2. Core Web Vitals

Les 3 metriques que Google utilise pour le ranking :

```
┌──────────────────────────────────────────────────────────┐
│                    Core Web Vitals                         │
│                                                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐│
│  │     LCP      │  │     CLS      │  │      INP         ││
│  │  Largest     │  │  Cumulative  │  │  Interaction to  ││
│  │  Contentful  │  │  Layout      │  │  Next Paint      ││
│  │  Paint       │  │  Shift       │  │                  ││
│  │              │  │              │  │                  ││
│  │  < 2.5s ✓   │  │  < 0.1  ✓   │  │  < 200ms  ✓     ││
│  │  < 4.0s ~   │  │  < 0.25 ~   │  │  < 500ms  ~     ││
│  │  > 4.0s ✗   │  │  > 0.25 ✗   │  │  > 500ms  ✗     ││
│  └──────────────┘  └──────────────┘  └──────────────────┘│
└──────────────────────────────────────────────────────────┘
```

| Metrique | Mesure | Comment l'ameliorer |
|---|---|---|
| **LCP** | Temps de rendu du plus grand élément visible | Preload LCP image, preconnect CDN, SSR, TTFB ≤600ms |
| **CLS** | Decalages de layout cumules | Dimensions explicites sur images/iframes, `min-height` sur lazy content |
| **INP** | Delai entre interaction et prochain paint | Éviter les long tasks (>50ms), `requestIdleCallback`, Web Workers |

### 3. Code splitting — vendor chunks nommes

```javascript
// vite.config.ts
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom'],
          'vendor-router': ['react-router-dom'],
          'vendor-i18n': ['i18next', 'react-i18next'],
          'vendor-charts': ['recharts'],
          'vendor-editor': ['@tiptap/core', '@tiptap/react'],
        },
      },
    },
  },
});
```

**Pourquoi des chunks nommes ?** Quand tu mets a jour ton code (pas tes dépendances), seul ton chunk change. Les chunks vendor restent caches par le navigateur.

### 4. Images optimisees

| Technique | Impact | Implémentation |
|---|---|---|
| **WebP/AVIF** | -30 a -50% taille | `<picture>` avec fallback JPG |
| **srcset responsive** | Image adaptee a l'ecran | `srcset` + `sizes` |
| **Lazy loading** | Charge a la demande | `loading="lazy"` (defaut) |
| **Eager pour LCP** | LCP image chargee en priorité | `loading="eager"` + `fetchpriority="high"` |
| **Blurhash placeholder** | Placeholder colore pendant le chargement | Canvas 4x3 pixels → base64 |
| **Focal-point cropping** | Cadrage intelligent | `object-position` + metadata |

### 5. Checklist performance

```
□ <link rel="preconnect" href="https://cdn.shoparch.com">
□ <link rel="preconnect" href="https://fonts.googleapis.com">
□ LCP image : loading="eager", fetchpriority="high"
□ Toutes les autres images : loading="lazy"
□ font-display: swap sur toutes les fonts
□ Critical CSS inline (above the fold)
□ JS differe : <script type="module"> (defer implicite)
□ Pas de render-blocking CSS (sauf critical)
□ Dimensions explicites sur toutes les images (width + height)
□ Performance budget verifie en CI
```

---

## Pratique

### Blurhash placeholder component

```tsx
import { useRef, useEffect, useState } from 'react';
import { decode } from 'blurhash';

interface OptimizedImageProps {
  src: string;
  alt: string;
  width: number;
  height: number;
  blurhash?: string;
  priority?: boolean; // true pour LCP images
}

function OptimizedImage({ src, alt, width, height, blurhash, priority }: OptimizedImageProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loaded, setLoaded] = useState(false);

  // Afficher le blurhash placeholder
  useEffect(() => {
    if (!blurhash || !canvasRef.current) return;
    const pixels = decode(blurhash, 4, 3); // Petit canvas 4x3
    const ctx = canvasRef.current.getContext('2d')!;
    const imageData = ctx.createImageData(4, 3);
    imageData.data.set(pixels);
    ctx.putImageData(imageData, 0, 0);
  }, [blurhash]);

  return (
    <div style={{ position: 'relative', width, height }}>
      {/* Blurhash placeholder (visible pendant le chargement) */}
      {blurhash && !loaded && (
        <canvas
          ref={canvasRef}
          width={4}
          height={3}
          style={{
            position: 'absolute', inset: 0,
            width: '100%', height: '100%',
            objectFit: 'cover', filter: 'blur(20px)',
          }}
        />
      )}

      {/* Image reelle */}
      <img
        src={src}
        alt={alt}
        width={width}
        height={height}
        loading={priority ? 'eager' : 'lazy'}
        fetchPriority={priority ? 'high' : 'auto'}
        onLoad={() => setLoaded(true)}
        style={{
          width: '100%', height: '100%',
          objectFit: 'cover',
          opacity: loaded ? 1 : 0,
          transition: 'opacity 0.3s',
        }}
      />
    </div>
  );
}
```

### Web Vitals reporter

```typescript
// hooks/useWebVitals.ts
import { onCLS, onINP, onLCP, type Metric } from 'web-vitals';

export function useWebVitals() {
  useEffect(() => {
    function reportMetric(metric: Metric) {
      // Envoyer a OpenTelemetry / analytics
      const body = {
        name: metric.name,
        value: metric.value,
        rating: metric.rating, // 'good', 'needs-improvement', 'poor'
        delta: metric.delta,
        navigationType: metric.navigationType,
        url: window.location.pathname,
      };

      // Beacon API — envoie meme si l'utilisateur quitte la page
      navigator.sendBeacon('/api/vitals', JSON.stringify(body));
    }

    onLCP(reportMetric);
    onCLS(reportMetric);
    onINP(reportMetric);
  }, []);
}
```

### Lighthouse CI config

```javascript
// lighthouserc.js
module.exports = {
  ci: {
    collect: {
      url: [
        'http://localhost:3000/',
        'http://localhost:3000/products',
        'http://localhost:3000/products/t-shirt-bio',
      ],
      numberOfRuns: 3, // Moyenne de 3 runs
    },
    assert: {
      assertions: {
        'categories:performance': ['error', { minScore: 0.9 }],
        'categories:accessibility': ['error', { minScore: 0.9 }],
        'categories:best-practices': ['error', { minScore: 0.9 }],
        'categories:seo': ['error', { minScore: 0.9 }],
        // Budgets specifiques
        'resource-summary:script:size': ['error', { maxNumericValue: 200000 }], // 200KB JS
        'first-contentful-paint': ['warn', { maxNumericValue: 1800 }],
        'largest-contentful-paint': ['error', { maxNumericValue: 2500 }],
        'cumulative-layout-shift': ['error', { maxNumericValue: 0.1 }],
        'interactive': ['warn', { maxNumericValue: 3500 }],
      },
    },
    upload: {
      target: 'temporary-public-storage', // Ou Loki/custom server
    },
  },
};
```

### Performance budget checker (CI)

```typescript
// scripts/check-bundle-size.ts
import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { gzipSync } from 'zlib';

const BUDGETS = {
  js: 200 * 1024,   // 200KB gzip
  css: 50 * 1024,   // 50KB gzip
  html: 80 * 1024,  // 80KB gzip
};

function getGzipSize(filePath: string): number {
  const content = readFileSync(filePath);
  return gzipSync(content).length;
}

function checkBudgets(distDir: string): void {
  const totals = { js: 0, css: 0, html: 0 };

  function walk(dir: string) {
    for (const entry of readdirSync(dir)) {
      const fullPath = join(dir, entry);
      if (statSync(fullPath).isDirectory()) {
        walk(fullPath);
      } else {
        const ext = entry.split('.').pop()!;
        const size = getGzipSize(fullPath);
        if (ext in totals) totals[ext as keyof typeof totals] += size;
      }
    }
  }

  walk(distDir);

  let failed = false;
  for (const [type, budget] of Object.entries(BUDGETS)) {
    const actual = totals[type as keyof typeof totals];
    const status = actual <= budget ? 'PASS' : 'FAIL';
    console.log(
      `${status} ${type}: ${(actual / 1024).toFixed(1)}KB / ${(budget / 1024).toFixed(1)}KB`,
    );
    if (actual > budget) failed = true;
  }

  if (failed) process.exit(1);
}

checkBudgets('./dist');
```

---

## Resume

1. **Performance budgets** : JS ≤200KB gzip, CSS ≤50KB, TTFB ≤600ms — vérifier en CI
2. **Core Web Vitals** : LCP <2.5s, CLS <0.1, INP <200ms — les 3 metriques Google pour le ranking
3. **Code splitting** : chunks vendor nommes (react, router, i18n) pour le caching long terme
4. **Images** : WebP/AVIF, lazy loading par defaut, `eager` + `fetchpriority="high"` pour le LCP, blurhash placeholders
5. **Lighthouse CI** : quality gates automatises en CI — score ≥90, budget JS ≤200KB, LCP ≤2.5s

---

> **Prochain cours** : [Cours 40 — i18n & SEO Architecture](./08-i18n-seo-architecture.md) — ou comment gérer l'internationalisation et l'optimisation pour les moteurs de recherche.

---

> **Lien fil rouge — ShopArch**
>
> - Audite les Core Web Vitals de ShopArch (LCP < 2.5s, CLS < 0.1, INP < 200ms)
> - Implémente le code splitting par route et les vendor chunks nommés
> - Exercice(s) associé(s) : `exercices/24-performance-audit/`
> - Checkpoint : Module 09, critère 4
