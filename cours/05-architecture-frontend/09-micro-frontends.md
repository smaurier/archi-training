# Cours 41 — Micro-frontends

> **Objectif** : Comprendre les architectures micro-frontend (Module Federation, Single-SPA, Web Components), savoir quand les utiliser et quand NE PAS les utiliser, et maîtriser la communication inter-applications.

---

## Rappel du cours précédent

<details>
<summary>1. Quelle est la différence entre "UI locale" et "content locale" en i18n ?</summary>

- **UI locale** = la langue de l'interface (boutons, menus, messages d'erreur). Geree par un framework i18n (i18next).
- **Content locale** = la langue du contenu métier (articles, produits, pages). Stockee dans un `MultiLangField` JSONB.
Les deux sont independants : un editeur peut avoir l'interface en francais et editer du contenu en anglais.
</details>

<details>
<summary>2. Qu'est-ce que le redirect chain collapsing et pourquoi est-ce important pour le SEO ?</summary>

Quand un slug est modifie plusieurs fois, chaque changement cree un redirect 301. Sans collapsing, on obtient des chaines (A → B → C → D). Google penalise les chaines > 2 redirects et chaque redirect ajoute un round-trip. Le collapsing met a jour tous les anciens redirects pour pointer directement vers la destination finale.
</details>

---

## Analogie — Le centre commercial

Un centre commercial n'est pas un seul magasin geant — c'est un ensemble de boutiques independantes qui partagent un batiment :

- **Chaque boutique** (micro-frontend) a sa propre équipe, son propre stock, ses propres horaires
- **Le batiment** (shell application) fournit l'infrastructure commune : hall d'entree, escalators, parking
- **La signalisation** (routing) guide les visiteurs d'une boutique a l'autre
- **Le système de sécurité** (shared auth) est commun a tout le centre
- **La carte fidelite** (shared state) fonctionne dans toutes les boutiques

**Quand ne PAS faire un centre commercial** : si tu n'as qu'une boutique (petite équipe, un seul produit), le cout du batiment ne se justifie pas.

---

## Théorie

### 1. Pourquoi des micro-frontends ?

| Problème du monolithe front | Solution micro-frontend |
|---|---|
| Build de 10 min quand le projet grossit | Chaque app se build independamment (~1 min) |
| 3 équipes sur le meme repo = merge conflicts | Chaque équipe a son repo |
| Une lib React 16 bloque le passage a React 18 | Chaque app choisit sa version |
| Un bug dans l'admin casse le catalogue | Isolation : un crash ne propage pas |

### 2. Les 4 approches

```
┌──────────────────────────────────────────────────────────┐
│                 Micro-frontend Approaches                 │
│                                                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │   Module     │  │  Single-SPA  │  │   iframes    │  │
│  │  Federation  │  │              │  │              │  │
│  │  (Webpack 5) │  │  Orchestrator│  │  Sandboxed   │  │
│  │              │  │  + parcels   │  │  isolation   │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
│                                                           │
│  ┌──────────────────────────────────────────────────────┐│
│  │              Web Components                          ││
│  │  Custom Elements + Shadow DOM                        ││
│  │  Framework-agnostic boundary                          ││
│  └──────────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────┘
```

| Approche | Isolation | Shared deps | Complexite | Cas d'usage |
|---|---|---|---|---|
| **Module Federation** | Faible (meme runtime) | Oui (shared config) | Moyenne | Equipes React, build rapide |
| **Single-SPA** | Moyenne (parcels) | Via import maps | Elevee | Mix de frameworks |
| **iframes** | Totale (sandbox) | Non | Faible | Legacy, tiers non fiable |
| **Web Components** | Forte (Shadow DOM) | Non | Moyenne | Composants partages cross-framework |

### 3. Module Federation — comment ca marche

```
┌─────────────────┐      ┌─────────────────┐
│   Shell (host)   │      │  Catalog (remote)│
│                  │      │                  │
│  import('catalog │─────>│  exposes:        │
│  /ProductList')  │      │    ./ProductList │
│                  │      │    ./SearchBar   │
│  shared: {       │      │  shared: {       │
│    react: '^18'  │      │    react: '^18'  │
│  }               │      │  }               │
└─────────────────┘      └─────────────────┘
         │
         │ Aussi :
         ▼
┌─────────────────┐      ┌─────────────────┐
│   Cart (remote)  │      │  Admin (remote)  │
│                  │      │                  │
│  exposes:        │      │  exposes:        │
│    ./CartWidget  │      │    ./Dashboard   │
│    ./CartPage    │      │    ./ProductForm │
└─────────────────┘      └─────────────────┘
```

Les `shared` dependencies (React, React-DOM) sont chargees une seule fois et partagees entre toutes les apps.

### 4. Communication inter-micro-frontends

| Pattern | Mecanisme | Cas d'usage |
|---|---|---|
| **Custom Events** | `window.dispatchEvent(new CustomEvent(...))` | Notifications, actions simples |
| **Shared state** | Micro store expose (Zustand partagé) | Panier, auth |
| **URL** | Query params, path params | Navigation, filtres |
| **Props** | Passer des props au mount | Configuration initiale |

**Regle** : prefer les Custom Events (découplage total). Éviter le shared state sauf pour auth/panier.

### 5. Quand NE PAS faire de micro-frontends

| Situation | Pourquoi rester en monolithe |
|---|---|
| Équipe < 5 devs | Le cout d'orchestration depasse le benefice |
| Un seul domaine métier | Pas de frontiere naturelle pour couper |
| Stack homogene | Pas besoin de mixer les frameworks |
| MVP / prototype | Premature optimization |
| Pas de déploiement independant | Le principal avantage disparait |

**Le micro-frontend est un pattern organisationnel** — il resout des problèmes d'équipe, pas de code. Si tu n'as qu'une équipe, tu n'en as pas besoin.

---

## Pratique

### Module Federation config (Webpack 5)

```typescript
// shell/webpack.config.ts (host)
import type { Configuration } from 'webpack';
import { container } from 'webpack';

const { ModuleFederationPlugin } = container;

const config: Configuration = {
  plugins: [
    new ModuleFederationPlugin({
      name: 'shell',
      remotes: {
        catalog: 'catalog@http://localhost:3001/remoteEntry.js',
        cart: 'cart@http://localhost:3002/remoteEntry.js',
        admin: 'admin@http://localhost:3003/remoteEntry.js',
      },
      shared: {
        react: { singleton: true, requiredVersion: '^18.0.0' },
        'react-dom': { singleton: true, requiredVersion: '^18.0.0' },
        'react-router-dom': { singleton: true, requiredVersion: '^6.0.0' },
      },
    }),
  ],
};

export default config;

// catalog/webpack.config.ts (remote)
const catalogConfig: Configuration = {
  plugins: [
    new ModuleFederationPlugin({
      name: 'catalog',
      filename: 'remoteEntry.js',
      exposes: {
        './ProductList': './src/components/ProductList',
        './SearchBar': './src/components/SearchBar',
      },
      shared: {
        react: { singleton: true, requiredVersion: '^18.0.0' },
        'react-dom': { singleton: true, requiredVersion: '^18.0.0' },
      },
    }),
  ],
};

export { catalogConfig };
```

### Shell application avec lazy loading des remotes

```tsx
// shell/src/App.tsx
import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';

// Lazy-load des micro-frontends
const CatalogProductList = lazy(() => import('catalog/ProductList'));
const CartPage = lazy(() => import('cart/CartPage'));
const AdminDashboard = lazy(() => import('admin/Dashboard'));

function App() {
  return (
    <BrowserRouter>
      <ShellHeader />
      <Suspense fallback={<PageSkeleton />}>
        <Routes>
          <Route path="/products/*" element={<CatalogProductList />} />
          <Route path="/cart" element={<CartPage />} />
          <Route path="/admin/*" element={<AdminDashboard />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
```

### Communication avec Custom Events

```typescript
// Emettre un evenement (depuis n'importe quelle micro-app)
function addToCart(product: { id: string; name: string; price: number }) {
  window.dispatchEvent(
    new CustomEvent('shoparch:cart:add', {
      detail: { productId: product.id, quantity: 1 },
    }),
  );
}

// Ecouter l'evenement (dans le shell ou dans le cart micro-app)
useEffect(() => {
  function handleCartAdd(event: CustomEvent<{ productId: string; quantity: number }>) {
    cartStore.addItem(event.detail.productId, event.detail.quantity);
  }

  window.addEventListener('shoparch:cart:add', handleCartAdd as EventListener);
  return () => {
    window.removeEventListener('shoparch:cart:add', handleCartAdd as EventListener);
  };
}, []);

// Convention de nommage : {app}:{domain}:{action}
// shoparch:cart:add, shoparch:auth:logout, shoparch:theme:change
```

### Error boundary per micro-frontend

```tsx
function MicroFrontendBoundary({
  name,
  children,
}: {
  name: string;
  children: React.ReactNode;
}) {
  return (
    <ErrorBoundary
      fallback={
        <div className="mfe-error">
          <p>The {name} module is temporarily unavailable.</p>
          <button onClick={() => window.location.reload()}>Retry</button>
        </div>
      }
    >
      <Suspense fallback={<ModuleSkeleton />}>
        {children}
      </Suspense>
    </ErrorBoundary>
  );
}

// Usage
<MicroFrontendBoundary name="Catalog">
  <CatalogProductList />
</MicroFrontendBoundary>
```

---

## Resume

1. **Module Federation** (Webpack 5) pour partager des composants React entre apps avec des deps partagees (singleton)
2. **Communication** via Custom Events (`window.dispatchEvent`) — convention `{app}:{domain}:{action}`
3. **Error Boundary** par micro-frontend — un crash dans le catalogue ne casse pas le panier
4. **Quand NE PAS** : équipe < 5 devs, un seul domaine, stack homogene — le cout d'orchestration ne se justifie pas
5. **C'est un pattern organisationnel** — il resout des problèmes d'équipe (deploy independant, autonomie), pas de code

---

> **Prochain cours** : [Cours 42 — Offline-first & PWA](./10-offline-first-pwa.md) — ou comment faire fonctionner une application sans réseau.

---

> **Lien fil rouge — ShopArch**
>
> - Évalue si ShopArch a besoin de micro-frontends (réponse probable : non, monolithe frontend suffit)
> - Identifie quel module serait candidat si on devait découper (admin dashboard ?)
> - Exercice(s) associé(s) : `exercices/26-micro-frontend/`
> - Checkpoint : Module 05, critère 1
