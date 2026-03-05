# Cours 35 — Routing & Navigation

> **Objectif** : Maîtriser le routing front-end avec code splitting, route guards ordonnees, RouteMeta typing pour RBAC, breadcrumbs depuis la hierarchie de routes, et gestion SEO des routes protégées.

---

## Rappel du cours précédent

<details>
<summary>1. Ou stocker les tokens d'authentification côté front-end et pourquoi ?</summary>

Dans **SessionStorage** (ou mieux, dans un cookie httpOnly via un BFF). Jamais dans localStorage car une faille XSS permettrait de voler le token. SessionStorage est vide a l'ouverture d'un nouvel onglet, ce qui limite la surface d'attaque.
</details>

<details>
<summary>2. Comment fonctionne le BroadcastChannel pour la synchronisation cross-tab ?</summary>

On cree un canal nomme (`new BroadcastChannel('app-sync')`). Quand un onglet envoie un message (`channel.postMessage({...})`), tous les autres onglets sur le meme domaine le recoivent via `channel.onmessage`. Utilise pour synchroniser le theme, la locale, et les événements de logout.
</details>

---

## Analogie — Le plan d'un musee

Un musee (l'application) a un plan (le router) :

- **Salle publique** = route accessible a tous (`/products`, `/about`)
- **Salle VIP** = route protégée par un billet (auth guard) → redirect vers la billetterie (login) si pas de billet
- **Reserve du musee** = route admin (RBAC guard) → seuls les conservateurs (role `admin`) entrent
- **Audioguide** = route meta → chaque salle a des informations (titre, permissions) attachees
- **Plan des salles** = breadcrumbs → "Musee > Aile Nord > Salle des Impressionnistes"
- **Porte automatique** = code splitting → la salle n'est chargee que quand tu y entres

---

## Théorie

### 1. Code splitting par route

Chaque route charge son code a la demande — pas besoin de telecharger l'admin quand on visite le catalogue :

```
Initial load : vendor.js (React, Router) + shell.js
                ↓
Route /products  →  catalog.chunk.js      (charge a la demande)
Route /cart      →  cart.chunk.js         (charge a la demande)
Route /admin     →  admin.chunk.js        (charge a la demande)
Route /checkout  →  checkout.chunk.js     (charge a la demande)
```

**Impact** : le bundle initial passe de 500KB a ~150KB. Chaque chunk fait 20-80KB.

### 2. Route guards ordonnees

L'ordre des guards est critique — chaque guard dépend du précédent :

```
Requete de navigation
        │
        ▼
┌───────────────────┐
│ 1. Restore session │  → Verifier si un token existe en SessionStorage
│    (async)         │     Si oui, restaurer l'etat auth
└────────┬──────────┘
         ▼
┌───────────────────┐
│ 2. Check auth     │  → La route requiert-elle une authentification ?
│                   │     Si oui et pas connecte → redirect /login
└────────┬──────────┘
         ▼
┌───────────────────┐
│ 3. Check RBAC     │  → L'utilisateur a-t-il le role requis ?
│                   │     Si non → redirect /forbidden (403)
└────────┬──────────┘
         ▼
┌───────────────────┐
│ 4. Allow          │  → Navigation autorisee
│    + Update title │     Mettre a jour document.title
└───────────────────┘
```

### 3. RouteMeta typing

Attacher des metadonnees typees a chaque route :

```typescript
interface RouteMeta {
  title: string;
  requiresAuth: boolean;
  roles?: string[];              // RBAC
  breadcrumb?: string;           // Label pour le fil d'ariane
  noIndex?: boolean;             // SEO : noindex, nofollow
  layout?: 'default' | 'admin' | 'minimal';
}
```

### 4. Routes protégées et SEO

| Type de route | SEO | `robots` meta | Sitemap |
|---|---|---|---|
| Publique (`/products`) | Indexee | — | Oui |
| Authentifiee (`/account`) | Non indexee | `noindex, nofollow` | Non |
| Admin (`/admin/*`) | Non indexee | `noindex, nofollow` | Non |
| Preview (`/preview/:token`) | Non indexee | `noindex, nofollow` | Non |

### 5. Breadcrumbs depuis la hierarchie de routes

Les breadcrumbs sont générés automatiquement depuis la structure des routes, **pas depuis les menus** (sinon ils changent quand le menu change) :

```
Route: /admin/products/abc-123/edit

Breadcrumb:
Admin > Products > T-shirt Bio > Edit

Genere depuis:
  /admin           → meta.breadcrumb = "Admin"
  /admin/products  → meta.breadcrumb = "Products"
  /admin/products/:id → meta.breadcrumb = product.name (dynamique)
  /admin/products/:id/edit → meta.breadcrumb = "Edit"
```

---

## Pratique

### Route configuration avec code splitting

```tsx
import { lazy, Suspense } from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';

// Lazy loading — chaque chunk est charge a la demande
const CatalogPage = lazy(() => import('./pages/catalog/CatalogPage'));
const ProductPage = lazy(() => import('./pages/catalog/ProductPage'));
const CartPage = lazy(() => import('./pages/cart/CartPage'));
const CheckoutPage = lazy(() => import('./pages/checkout/CheckoutPage'));
const AccountPage = lazy(() => import('./pages/account/AccountPage'));
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'));
const AdminProducts = lazy(() => import('./pages/admin/AdminProducts'));

const router = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout />,
    children: [
      // Routes publiques
      {
        path: 'products',
        element: <CatalogPage />,
        handle: { title: 'Catalog', breadcrumb: 'Products' },
      },
      {
        path: 'products/:id',
        element: <ProductPage />,
        handle: { title: 'Product', breadcrumb: ':name' }, // Dynamique
      },
      {
        path: 'cart',
        element: <CartPage />,
        handle: { title: 'Cart', breadcrumb: 'Cart' },
      },

      // Routes authentifiees
      {
        path: 'checkout',
        element: <AuthGuard><CheckoutPage /></AuthGuard>,
        handle: { title: 'Checkout', requiresAuth: true, breadcrumb: 'Checkout' },
      },
      {
        path: 'account',
        element: <AuthGuard><AccountPage /></AuthGuard>,
        handle: { title: 'My Account', requiresAuth: true, noIndex: true, breadcrumb: 'Account' },
      },

      // Routes admin (RBAC)
      {
        path: 'admin',
        element: <RbacGuard roles={['admin', 'editor']}><AdminLayout /></RbacGuard>,
        handle: { title: 'Admin', requiresAuth: true, roles: ['admin', 'editor'], noIndex: true, breadcrumb: 'Admin' },
        children: [
          { index: true, element: <AdminDashboard />, handle: { breadcrumb: 'Dashboard' } },
          { path: 'products', element: <AdminProducts />, handle: { breadcrumb: 'Products' } },
        ],
      },
    ],
  },
]);

function App() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <RouterProvider router={router} />
    </Suspense>
  );
}
```

### Auth guard component

```tsx
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../stores/auth';

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuthStore();
  const location = useLocation();

  // Attendre la restauration de session
  if (isLoading) return <PageSkeleton />;

  if (!isAuthenticated) {
    // Sauvegarder la route d'origine pour redirect apres login
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  return <>{children}</>;
}

function RbacGuard({ roles, children }: { roles: string[]; children: React.ReactNode }) {
  const { user } = useAuthStore();

  if (!user || !roles.some((role) => user.roles.includes(role))) {
    return <Navigate to="/forbidden" replace />;
  }

  return <>{children}</>;
}
```

### Breadcrumb generator

```tsx
import { useMatches, Link } from 'react-router-dom';

interface BreadcrumbHandle {
  breadcrumb: string;
}

function Breadcrumbs() {
  const matches = useMatches();

  const crumbs = matches
    .filter((match) => match.handle?.breadcrumb)
    .map((match) => ({
      path: match.pathname,
      label: resolveBreadcrumb(match.handle as BreadcrumbHandle, match.data),
    }));

  return (
    <nav aria-label="Breadcrumb">
      <ol className="breadcrumb">
        <li><Link to="/">Home</Link></li>
        {crumbs.map((crumb, i) => (
          <li key={crumb.path}>
            {i === crumbs.length - 1 ? (
              <span aria-current="page">{crumb.label}</span>
            ) : (
              <Link to={crumb.path}>{crumb.label}</Link>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

function resolveBreadcrumb(handle: BreadcrumbHandle, data: any): string {
  // Dynamique : si le breadcrumb commence par ":", resoudre depuis les data
  if (handle.breadcrumb.startsWith(':')) {
    const field = handle.breadcrumb.slice(1);
    return data?.[field] || handle.breadcrumb;
  }
  return handle.breadcrumb;
}
```

### SEO meta pour routes protégées

```tsx
import { Helmet } from 'react-helmet-async';
import { useMatches } from 'react-router-dom';

function PageHead() {
  const matches = useMatches();
  const current = matches[matches.length - 1];
  const meta = current?.handle as RouteMeta | undefined;

  return (
    <Helmet>
      <title>{meta?.title ? `${meta.title} | ShopArch` : 'ShopArch'}</title>
      {meta?.noIndex && (
        <meta name="robots" content="noindex, nofollow" />
      )}
      {!meta?.noIndex && (
        <link rel="canonical" href={`https://shoparch.com${current?.pathname}`} />
      )}
    </Helmet>
  );
}
```

---

## Resume

1. **Code splitting par route** (`lazy()` + `Suspense`) — chaque page est un chunk séparé, charge a la demande
2. **Guards ordonnees** : restore session → check auth → check RBAC → allow → update title
3. **RouteMeta typee** : attacher `title`, `roles`, `noIndex`, `breadcrumb` a chaque route
4. **Routes protégées** : `noindex, nofollow` + exclusion du sitemap pour toutes les routes authentifiees/admin
5. **Breadcrumbs depuis les routes** (pas les menus) — générés automatiquement via `useMatches()`

---

> **Prochain cours** : [Cours 36 — Data Fetching Patterns](./04-data-fetching-patterns.md) — ou comment gérer les requêtes API avec annulation, debounce, retry et cache.

---

> **Lien fil rouge — ShopArch**
>
> - Configure le routing Next.js de ShopArch : `/products`, `/products/[id]`, `/cart`, `/checkout`
> - Ajoute les route guards : pages `/admin/*` accessibles uniquement aux admins
> - Exercice(s) associé(s) : `exercices/23-ssr-isr-hybrid/`
> - Checkpoint : Module 05, critère 4
