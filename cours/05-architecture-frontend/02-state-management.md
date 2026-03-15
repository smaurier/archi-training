# Cours 34 — State Management Patterns

> **Objectif** : Maîtriser les patterns de gestion d'état (stores globaux, state local, derived state), implémenter un store avec ETag tracking, et gérer la synchronisation cross-tab.

---

## Rappel du cours précédent

<details>
<summary>1. Quelle est la différence entre un headless component et un composant UI classique ?</summary>

Un **headless component** (où custom hook) encapsule la logique (toggle, formulaire, pagination) sans aucun rendu visuel. Il expose l'état et les actions via un hook (`useToggle`, `useForm`). Le composant UI consomme ce hook et decide du rendu. Avantage : la même logique peut etre réutilisée avec n'importe quel design.
</details>

<details>
<summary>2. Qu'est-ce qu'un Error Boundary et pourquoi est-ce important ?</summary>

Un Error Boundary est un composant qui capture les erreurs dans son sous-arbre de composants et affiche un fallback (message d'erreur, bouton retry) au lieu de faire crasher toute l'application. C'est la "graceful degradation" côté front-end — une erreur dans un widget ne casse pas la page entière.
</details>

---

## Analogie — Le bureau de poste central

Imagine un bureau de poste (le store) dans une ville (l'application) :

- **State global** (store) = le bureau de poste central. Tous les quartiers (composants) y deposent et recuperent leur courrier (données). Un seul endroit centralise.
- **State local** (`useState`) = la boite aux lettres de la maison. Le courrier ne concerne que cette maison.
- **Derived state** (`computed`/`selector`) = le facteur qui trie le courrier par quartier. Il ne stocke rien, il calcule à partir du courrier existant.
- **BroadcastChannel** = le telephone entre les bureaux de poste de villes voisines (onglets du navigateur). Quand le theme change dans un onglet, les autres sont notifies.

**Regle** : ne pas tout mettre au bureau de poste. La boite aux lettres locale suffit pour 80% des cas.

---

## Théorie

### 1. Ou mettre l'état ?

| Type d'état | Ou le mettre | Exemple |
|---|---|---|
| **UI local** | `useState` dans le composant | Menu ouvert/ferme, valeur d'un input |
| **Partage entre siblings** | Lifter dans le parent | Formulaire multi-étapes |
| **Partage app-wide** | Store global (Zustand/Redux) | Utilisateur connecte, panier, theme |
| **Serveur** | React Query / SWR | Données API (produits, commandes) |
| **URL** | Router params / query string | Filtres, pagination, recherche |
| **Persistant** | localStorage / SessionStorage | Préférences, tokens |

**Regle d'or** : utiliser le scope le plus petit possible. Global seulement quand nécessaire.

### 2. Stores — Zustand vs Redux vs Jotai

| Critère | Zustand | Redux Toolkit | Jotai |
|---|---|---|---|
| Boilerplate | Minimal | Moyen (slices, thunks) | Très minimal |
| Taille bundle | ~1KB | ~11KB | ~2KB |
| DevTools | Oui (middleware) | Oui (natif) | Oui (extension) |
| Async | Natif (dans l'action) | Thunks/RTK Query | Natif (async atoms) |
| TypeScript | Excellent | Excellent | Excellent |
| Learning curve | Faible | Moyenne | Faible |

> **Default recommande pour ShopArch** : Zustand pour l'état global (panier, auth, theme) et React Query pour l'état serveur (produits, commandes). Zustand offre le meilleur ratio simplicite/puissance avec ~1KB de bundle, et React Query géré automatiquement le cache, la revalidation et le loading state des donnees API. Tu pourras changer plus tard si ton contexte l'exige.

### 3. ETag tracking per entity

Pour l'optimistic locking, le front doit stocker le ETag de chaque entité :

```
Store state:
{
  products: {
    'abc-123': { data: Product, etag: '"v5"' },
    'def-456': { data: Product, etag: '"v3"' },
  }
}

PUT /api/products/abc-123
Headers: { "If-Match": '"v5"' }

→ 200 OK : mise a jour reussie, nouveau ETag '"v6"'
→ 412 Precondition Failed : quelqu'un a modifie entre-temps
```

### 4. Error handling par code HTTP

| Code | Action front-end |
|---|---|
| **401** | `authStore.logout()` → redirect `/login` |
| **403** | Afficher "accès refuse" |
| **409** | Rafraichir la ressource + notifier l'utilisateur |
| **412** | Rafraichir le ETag + proposer de reessayer |
| **422** | Afficher les violations sous chaque champ |
| **429** | Attendre `Retry-After` secondes + reessayer |

### 5. Cross-tab synchronisation (BroadcastChannel)

Quand l'utilisateur a plusieurs onglets ouverts, certains états doivent etre synchronises :

```
Onglet 1                    BroadcastChannel              Onglet 2
────────                    ────────────────              ────────
Toggle dark mode ──────────> { type: 'theme',      ──────> Appliquer dark mode
                              payload: 'dark' }

Logout ─────────────────────> { type: 'auth',      ──────> Redirect login
                              payload: 'logout' }
```

---

## Pratique

### Zustand store avec ETag tracking

```typescript
import { create } from 'zustand';

interface ProductState {
  products: Map<string, { data: Product; etag: string }>;
  loading: boolean;
  error: string | null;

  // Actions
  fetchProduct: (id: string) => Promise<void>;
  updateProduct: (id: string, updates: Partial<Product>) => Promise<void>;
}

export const useProductStore = create<ProductState>((set, get) => ({
  products: new Map(),
  loading: false,
  error: null,

  fetchProduct: async (id: string) => {
    set({ loading: true, error: null });
    try {
      const response = await fetch(`/api/products/${id}`);
      const data = await response.json();
      const etag = response.headers.get('ETag') || '';

      set((state) => {
        const products = new Map(state.products);
        products.set(id, { data, etag });
        return { products, loading: false };
      });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },

  updateProduct: async (id: string, updates: Partial<Product>) => {
    const entry = get().products.get(id);
    if (!entry) throw new Error(`Product ${id} not in store`);

    try {
      const response = await fetch(`/api/products/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'If-Match': entry.etag, // Optimistic locking
        },
        body: JSON.stringify({ ...entry.data, ...updates }),
      });

      if (response.status === 412) {
        // ETag mismatch → rafraichir et notifier
        await get().fetchProduct(id);
        throw new PreconditionFailedError('Resource modified by another user');
      }

      if (response.status === 422) {
        const error = await response.json();
        throw new ValidationError(error.violations);
      }

      const newEtag = response.headers.get('ETag') || '';
      const newData = await response.json();

      set((state) => {
        const products = new Map(state.products);
        products.set(id, { data: newData, etag: newEtag });
        return { products };
      });
    } catch (err) {
      if (err instanceof PreconditionFailedError || err instanceof ValidationError) {
        throw err; // Propager au composant
      }
      set({ error: (err as Error).message });
    }
  },
}));
```

### Error handler middleware Zustand

```typescript
// middleware/error-handler.ts
type ErrorHandler = (status: number, body: any) => void;

const errorHandlers: Record<number, ErrorHandler> = {
  401: () => {
    useAuthStore.getState().logout();
    window.location.href = '/login';
  },
  403: (_, body) => {
    useNotificationStore.getState().show({
      type: 'error',
      message: body.detail || 'Access denied',
    });
  },
  429: (_, body) => {
    const retryAfter = body.retryAfter || 60;
    useNotificationStore.getState().show({
      type: 'warning',
      message: `Rate limited. Retry in ${retryAfter}s`,
    });
  },
};

export async function apiCall<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, options);

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const handler = errorHandlers[response.status];
    if (handler) handler(response.status, body);
    throw new ApiError(response.status, body);
  }

  return response.json();
}
```

### Cross-tab sync avec BroadcastChannel

```typescript
// stores/cross-tab-sync.ts
type SyncMessage =
  | { type: 'theme'; payload: 'light' | 'dark' }
  | { type: 'auth'; payload: 'logout' }
  | { type: 'locale'; payload: string };

const channel = new BroadcastChannel('shoparch-sync');

// Envoyer un changement aux autres onglets
export function broadcastChange(message: SyncMessage): void {
  channel.postMessage(message);
}

// Ecouter les changements des autres onglets
channel.onmessage = (event: MessageEvent<SyncMessage>) => {
  const msg = event.data;

  switch (msg.type) {
    case 'theme':
      useThemeStore.getState().setTheme(msg.payload);
      break;
    case 'auth':
      if (msg.payload === 'logout') {
        useAuthStore.getState().clearSession();
        window.location.href = '/login';
      }
      break;
    case 'locale':
      useI18nStore.getState().setLocale(msg.payload);
      break;
  }
};

// Usage dans le store theme
export const useThemeStore = create<ThemeState>((set) => ({
  theme: (localStorage.getItem('theme') as 'light' | 'dark') || 'light',

  setTheme: (theme: 'light' | 'dark') => {
    set({ theme });
    localStorage.setItem('theme', theme);
    document.documentElement.classList.toggle('dark', theme === 'dark');
  },

  toggleTheme: () => {
    const current = useThemeStore.getState().theme;
    const next = current === 'light' ? 'dark' : 'light';
    useThemeStore.getState().setTheme(next);
    broadcastChange({ type: 'theme', payload: next }); // Notifier les autres onglets
  },
}));
```

### Quand utiliser quel type de stockage

```typescript
// SessionStorage — donnees de session (perdu a la fermeture de l'onglet)
// Usage : tokens d'auth, etat de formulaire multi-etapes
sessionStorage.setItem('auth_token', token);

// localStorage — donnees persistantes (survit a la fermeture)
// Usage : preferences (theme, langue), flags "vu une fois"
localStorage.setItem('theme', 'dark');
localStorage.setItem('onboarding_done', 'true');

// JAMAIS dans localStorage : tokens JWT sensibles (XSS → vol de session)
// Utiliser httpOnly cookies ou SessionStorage
```

---

## Résumé

1. **Scope minimal** : `useState` local > store global. Ne globaliser que ce qui doit etre partage (auth, panier, theme)
2. **ETag tracking** dans le store pour l'optimistic locking — chaque entité a son ETag, envoye via `If-Match`
3. **Error handling par code HTTP** : un handler par code (401→logout, 412→refresh ETag, 422→violations, 429→retry)
4. **BroadcastChannel** pour synchroniser theme, auth et locale entre onglets ouverts
5. **SessionStorage pour les tokens** (jamais localStorage — vulnerable XSS), **localStorage pour les préférences**

---

> **Prochain cours** : [Cours 35 — Routing & Navigation](./03-routing-navigation.md) — ou comment structurer les routes avec code splitting, guards et breadcrumbs.

---

> **Lien fil rouge — ShopArch**
>
> - Crée le Zustand store pour le panier ShopArch avec ETag tracking
> - Implémente la synchronisation cross-tab du panier via BroadcastChannel
> - Exercice(s) associé(s) : `exercices/21-component-tree/`
> - Checkpoint : Module 05, critère 1
