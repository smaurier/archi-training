# Cours 36 — Data Fetching Patterns

> **Objectif** : Maîtriser les patterns de data fetching front-end — AbortController, debounce, Stale-While-Revalidate, request priority, retry avec exponential backoff, et typing des réponses API.

---

## Rappel du cours précédent

<details>
<summary>1. Pourquoi l'ordre des route guards est-il critique ?</summary>

Chaque guard dépend du précédent : on doit d'abord restaurer la session (async), puis vérifier l'authentification, puis vérifier le RBAC, puis autoriser et mettre a jour le titre. Si on vérifié le RBAC avant la session, un utilisateur avec un token valide sera redirige vers /login inutilement.
</details>

<details>
<summary>2. D'ou doivent venir les breadcrumbs et pourquoi ?</summary>

De la **hierarchie des routes**, pas des menus. Les menus peuvent changer independamment de la structure des pages. Les routes sont stables et refletent la vraie hierarchie de navigation. On généré les crumbs automatiquement via `useMatches()`.
</details>

---

## Analogie — Le serveur du restaurant

Le serveur (le hook de data fetching) géré les commandes du client (l'utilisateur) :

- **AbortController** = le client annule sa commande ("en fait, je ne veux plus la salade"). Le serveur arrete de preparer le plat au lieu de le servir pour rien.
- **Debounce** = le serveur attend que le client ait fini de parler avant de transmettre a la cuisine. "Je veux... euh... un steak... non, un poulet... finalement un steak" → une seule commande
- **Stale-While-Revalidate** = le serveur sert les restes d'hier (cache stale) pendant que la cuisine prepare le plat frais. Le client mange immédiatement.
- **Priority** = les plats VIP (critical) passent avant les accompagnements (low). La cuisine traite dans l'ordre d'importance.
- **Retry** = le serveur retourne en cuisine si le plat est rate, mais pas indefiniment (max 2 tentatives).

---

## Théorie

### 1. AbortController — annuler les requêtes inutiles

Deux cas d'annulation essentiels :

| Cas | Pourquoi annuler |
|---|---|
| **Unmount** | Le composant disparait → la réponse n'a plus de destinataire |
| **Route change** | L'utilisateur navigue → les requêtes de l'ancienne page sont inutiles |

Sans annulation, les réponses arrivent et mettent a jour un état qui n'existe plus → memory leaks, erreurs React.

### 2. Debounce patterns

| Contexte | Delai | Pourquoi |
|---|---|---|
| Recherche front-office | 300ms | L'utilisateur tape vite, une requête par mot suffit |
| Recherche back-office | 800ms | L'editeur reflechit plus longtemps entre les frappes |
| Auto-save | 1000ms | Sauvegarder apres que l'utilisateur ait arrete de taper |
| Resize observer | 200ms | Éviter des recalculs a chaque pixel |

### 3. Stale-While-Revalidate (SWR)

```
1ere visite                              2eme visite
────────────                             ────────────
GET /products                            GET /products
    │                                        │
    ▼                                        ▼
┌───────────┐                         ┌──────────────┐
│ Loading...│ (500ms)                 │ Cached data  │ (0ms — instantane !)
└───────────┘                         │ (peut-etre   │
    │                                 │  stale)      │
    ▼                                 └──────┬───────┘
┌───────────┐                                │ En background :
│ Fresh data│                                │ Revalidate
│ + cache   │                                ▼
└───────────┘                         ┌──────────────┐
                                      │ Fresh data   │ (update silencieux)
                                      │ (si different)│
                                      └──────────────┘
```

### 4. Request priority system

```
Priority     Timeout SSR    Timeout Client    Exemple
──────────   ───────────    ──────────────    ────────
CRITICAL     2s             5s                Auth check, page data
HIGH         3s             8s                Liste produits, panier
NORMAL       5s             10s               Recherche, filtres
LOW          5s             15s               Analytics, suggestions
```

### 5. Retry avec exponential backoff

```
Tentative 1 : delai 0     → echoue
Tentative 2 : delai 1s    → echoue
Tentative 3 : delai 2s    → echoue (ou 5s)
→ Abandon : afficher erreur a l'utilisateur

Avec jitter (aleatoire) pour eviter le "thundering herd" :
Tentative 2 : delai 1s + random(0, 500ms)
Tentative 3 : delai 2s + random(0, 1000ms)
```

Ne **jamais** retrier les erreurs 4xx (sauf 429). Ce sont des erreurs client — retrier ne changera rien.

> **Default recommande pour ShopArch** : React Query (TanStack Query) pour tout le data fetching. Il fournit nativement AbortController, Stale-While-Revalidate, retry avec backoff, et le cache avec invalidation — tout ce que le hook custom ci-dessous reimplemente manuellement. Tu pourras changer plus tard si ton contexte l'exige.

---

## Pratique

### Custom hook useFetch avec abort + SWR + retry

```typescript
import { useState, useEffect, useRef, useCallback } from 'react';

interface FetchOptions {
  priority?: 'critical' | 'high' | 'normal' | 'low';
  maxRetries?: number;
  staleTime?: number;      // Duree avant revalidation (ms)
  cacheKey?: string;
}

interface FetchResult<T> {
  data: T | null;
  error: Error | null;
  isLoading: boolean;
  isStale: boolean;
  refetch: () => Promise<void>;
}

// Cache global simple (en production, utiliser React Query ou SWR lib)
const cache = new Map<string, { data: any; timestamp: number }>();

export function useFetch<T>(url: string, options: FetchOptions = {}): FetchResult<T> {
  const {
    priority = 'normal',
    maxRetries = 2,
    staleTime = 5 * 60 * 1000, // 5 min par defaut
    cacheKey = url,
  } = options;

  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isStale, setIsStale] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const timeouts: Record<string, number> = {
    critical: 5000, high: 8000, normal: 10000, low: 15000,
  };

  const fetchWithRetry = useCallback(async (signal: AbortSignal) => {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          // Exponential backoff + jitter
          const delay = Math.pow(2, attempt - 1) * 1000 + Math.random() * 500;
          await new Promise((r) => setTimeout(r, delay));
        }

        const timeoutId = setTimeout(() => abortRef.current?.abort(), timeouts[priority]);

        const response = await fetch(url, { signal });
        clearTimeout(timeoutId);

        if (!response.ok) {
          // Ne pas retrier les erreurs client (sauf 429)
          if (response.status < 500 && response.status !== 429) {
            throw new ApiError(response.status, await response.json());
          }
          throw new Error(`HTTP ${response.status}`);
        }

        return await response.json() as T;
      } catch (err) {
        if ((err as Error).name === 'AbortError') throw err;
        lastError = err as Error;
      }
    }

    throw lastError;
  }, [url, maxRetries, priority]);

  const refetch = useCallback(async () => {
    abortRef.current?.abort();
    abortRef.current = new AbortController();

    setIsLoading(true);
    setError(null);

    try {
      const result = await fetchWithRetry(abortRef.current.signal);
      setData(result);
      setIsStale(false);
      cache.set(cacheKey, { data: result, timestamp: Date.now() });
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setError(err as Error);
      }
    } finally {
      setIsLoading(false);
    }
  }, [fetchWithRetry, cacheKey]);

  useEffect(() => {
    // Check cache first (SWR)
    const cached = cache.get(cacheKey);
    if (cached) {
      setData(cached.data);
      setIsLoading(false);
      const age = Date.now() - cached.timestamp;
      if (age > staleTime) {
        setIsStale(true);
        refetch(); // Revalidate in background
      }
      return;
    }

    refetch();

    return () => {
      abortRef.current?.abort(); // Cleanup on unmount
    };
  }, [cacheKey, staleTime, refetch]);

  return { data, error, isLoading, isStale, refetch };
}
```

### Debounce hook pour la recherche

```typescript
function useDebouncedSearch(delay: number = 300) {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), delay);
    return () => clearTimeout(timer);
  }, [query, delay]);

  const results = useFetch<SearchResult>(
    debouncedQuery.length >= 2
      ? `/api/search?q=${encodeURIComponent(debouncedQuery)}`
      : '',
    { priority: 'normal', staleTime: 60_000 },
  );

  return { query, setQuery, ...results };
}
```

### Typed API response wrapper

```typescript
// ApiResponse wrapper — toutes les reponses API suivent ce format
interface ApiResponse<T> {
  data: T;
  meta?: {
    total: number;
    page: number;
    limit: number;
  };
}

// Hydra collection (JSON-LD) — format API Platform
interface HydraCollection<T> {
  '@context': string;
  '@id': string;
  '@type': 'hydra:Collection';
  'hydra:totalItems': number;
  'hydra:member': T[];
  'hydra:view'?: {
    '@id': string;
    'hydra:first': string;
    'hydra:last': string;
    'hydra:next'?: string;
    'hydra:previous'?: string;
  };
}

// Usage type-safe
const { data } = useFetch<HydraCollection<Product>>('/api/products');
const products = data?.['hydra:member'] ?? [];
const total = data?.['hydra:totalItems'] ?? 0;
```

---

## Resume

1. **AbortController** sur unmount et route change — éviter les memory leaks et les updates sur des composants demontees
2. **Debounce 300ms** pour la recherche front, 800ms pour le back-office — une requête quand l'utilisateur a fini de taper
3. **Stale-While-Revalidate** : servir le cache instantanement, revalider en background — UX percue ultra rapide
4. **Priority system** : timeouts adaptatifs (critical 5s, low 15s) — les requêtes essentielles ne sont pas penalisees
5. **Retry avec exponential backoff** (max 2) — uniquement pour les erreurs 5xx et 429, jamais pour les 4xx

---

> **Prochain cours** : [Cours 37 — Design Tokens & Design Systems](./05-design-tokens-systems.md) — ou comment architecturer un système de design tokens avec génération OKLCH et theming runtime.

---

> **Lien fil rouge — ShopArch**
>
> - Implémente le data fetching du catalogue avec React Query + Stale-While-Revalidate
> - Ajoute l'AbortController pour annuler les requêtes de recherche en cours
> - Exercice(s) associé(s) : `exercices/24-performance-audit/`
> - Checkpoint : Module 05, critère 4
