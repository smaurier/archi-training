# Correction — Exercice 24 : Performance audit

## Plan d'optimisation par metrique

### LCP (4.8s → < 2.5s)
1. **Preload l'image hero** : `<link rel="preload" as="image" href="hero.webp">`
2. **Images WebP/AVIF** : conversion automatique, `srcset` responsive
3. **Cache serveur Redis** : TTFB 1.2s → 200ms

### CLS (0.35 → < 0.1)
1. **Dimensions images** : `width` + `height` sur chaque `<img>`
2. **font-display: swap** : éviter le font flash invisible
3. **Skeleton placeholders** : reserver l'espace avant chargement

### INP (380ms → < 200ms)
1. **Code splitting** : dynamic imports pour les routes (Next.js le fait automatiquement)
2. **Lazy loading** : composants below the fold charges à la demandé
3. **Debounce interactions** : 300ms sur search, 100ms sur scroll

### TTFB (1.2s → < 600ms)
1. **Cache Redis** : pages catalogue en cache 5min
2. **CDN** : edge caching avec surrogate keys
3. **DB index** : queries principales < 10ms

## Hook useWebVitals

```typescript
// hooks/useWebVitals.ts
import { useEffect } from 'react';

export function useWebVitals() {
  useEffect(() => {
    async function reportVitals() {
      const { onLCP, onCLS, onINP } = await import('web-vitals');

      function report(metric: { name: string; value: number; id: string }) {
        navigator.sendBeacon('/api/analytics/vitals', JSON.stringify({
          name: metric.name,
          value: Math.round(metric.value),
          id: metric.id,
          page: window.location.pathname,
          timestamp: new Date().toISOString(),
        }));
      }

      onLCP(report);
      onCLS(report);
      onINP(report);
    }

    reportVitals();
  }, []);
}

// Usage dans le layout racine
// app/layout.tsx
'use client';
function WebVitalsReporter() {
  useWebVitals();
  return null;
}
```

## Lighthouse CI config

```yaml
# lighthouserc.yml
ci:
  collect:
    url:
      - http://localhost:3000/
      - http://localhost:3000/products
      - http://localhost:3000/products/test-product
    numberOfRuns: 3
  assert:
    assertions:
      categories:performance:
        - error
        - minScore: 0.9
      first-contentful-paint:
        - warn
        - maxNumericValue: 1800
      largest-contentful-paint:
        - error
        - maxNumericValue: 2500
      cumulative-layout-shift:
        - error
        - maxNumericValue: 0.1
```

## Ce que tu aurais pu oublier

### 1. Optimiser sans mesurer
```
FAUX — appliquer toutes les optimisations "a l'aveugle"
CORRECT — mesurer AVANT, optimiser, mesurer APRES
  → Lighthouse, WebPageTest, RUM en production
```

### 2. Oublier le preload de l'image LCP
```html
<!-- FAUX — l'image LCP est decouverte tard -->
<img src="hero.webp" />

<!-- CORRECT — preload dans le <head> -->
<link rel="preload" as="image" href="hero.webp" fetchpriority="high" />
```

### 3. loading="lazy" sur l'image LCP
```html
<!-- FAUX — retarde l'image la plus importante -->
<img src="hero.webp" loading="lazy" />

<!-- CORRECT — eager pour LCP, lazy pour le reste -->
<img src="hero.webp" loading="eager" fetchpriority="high" />
```
