# Correction — Exercice 26 : Micro-frontend

## Architecture

```
┌─────────────────────────────────────────┐
│              Shell (Host)               │
│  ┌──────┐  ┌──────────┐  ┌──────────┐  │
│  │Header│  │   Main   │  │  Footer  │  │
│  │(auth)│  │ Content  │  │          │  │
│  └──────┘  └──────────┘  └──────────┘  │
│                 │                        │
│    ┌────────────┼────────────┐           │
│    ▼            ▼            ▼           │
│ ┌────────┐ ┌─────────┐ ┌─────────┐     │
│ │Catalog │ │  Cart/   │ │Account  │     │
│ │ (MFE)  │ │Checkout  │ │ (MFE)   │     │
│ │        │ │ (MFE)    │ │         │     │
│ └────────┘ └─────────┘ └─────────┘     │
└─────────────────────────────────────────┘
```

## Module Federation config

```typescript
// Shell (host) — webpack.config.js
const { ModuleFederationPlugin } = require('webpack').container;

module.exports = {
  plugins: [
    new ModuleFederationPlugin({
      name: 'shell',
      remotes: {
        catalog: 'catalog@http://localhost:3001/remoteEntry.js',
        cart: 'cart@http://localhost:3002/remoteEntry.js',
        account: 'account@http://localhost:3003/remoteEntry.js',
      },
      shared: {
        react: { singleton: true, requiredVersion: '^18.0.0' },
        'react-dom': { singleton: true, requiredVersion: '^18.0.0' },
        'react-router-dom': { singleton: true, requiredVersion: '^6.0.0' },
      },
    }),
  ],
};

// Catalog (remote) — webpack.config.js
module.exports = {
  plugins: [
    new ModuleFederationPlugin({
      name: 'catalog',
      filename: 'remoteEntry.js',
      exposes: {
        './ProductList': './src/components/ProductList',
        './ProductDetail': './src/components/ProductDetail',
      },
      shared: {
        react: { singleton: true, requiredVersion: '^18.0.0' },
        'react-dom': { singleton: true, requiredVersion: '^18.0.0' },
        'react-router-dom': { singleton: true, requiredVersion: '^6.0.0' },
      },
    }),
  ],
};
```

## Communication par Custom Events

```typescript
// Catalog MFE — emet un event quand on ajoute au panier
function addToCart(product: Product) {
  window.dispatchEvent(new CustomEvent('product:add-to-cart', {
    detail: { productId: product.id, name: product.name, price: product.price },
  }));
}

// Cart MFE — ecoute les ajouts au panier
useEffect(() => {
  const handler = (e: CustomEvent) => {
    cartStore.addItem(e.detail);
    window.dispatchEvent(new CustomEvent('cart:updated', {
      detail: { count: cartStore.itemCount },
    }));
  };
  window.addEventListener('product:add-to-cart', handler as EventListener);
  return () => window.removeEventListener('product:add-to-cart', handler as EventListener);
}, []);

// Shell — ecoute pour le badge panier
function useCartBadge() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const handler = (e: CustomEvent) => setCount(e.detail.count);
    window.addEventListener('cart:updated', handler as EventListener);
    return () => window.removeEventListener('cart:updated', handler as EventListener);
  }, []);

  return count;
}
```

## Fallback si MFE indisponible

```tsx
// Shell — charge le MFE avec fallback via Error Boundary
import { Suspense, lazy } from 'react';

const CatalogProducts = lazy(() => import('catalog/ProductList'));

function MFEErrorBoundary({ children, fallback }: {
  children: React.ReactNode;
  fallback: React.ReactNode;
}) {
  // Utiliser react-error-boundary ou implementer un class component ErrorBoundary
  return (
    <ErrorBoundary fallback={fallback}>
      <Suspense fallback={<CatalogSkeleton />}>
        {children}
      </Suspense>
    </ErrorBoundary>
  );
}

// Usage
function ShellPage() {
  return (
    <MFEErrorBoundary fallback={<CatalogFallback />}>
      <CatalogProducts />
    </MFEErrorBoundary>
  );
}
```

## Ce que tu aurais pu oublier

### 1. Import direct entre MFEs
```
FAUX — Cart importe directement un composant de Catalog
CORRECT — Communication par events, pas d'imports croises
```

### 2. Dupliquer React dans chaque MFE
```
FAUX — chaque MFE bundle sa propre copie de React (3x la taille)
CORRECT — shared dependencies avec singleton: true dans Module Federation
```

### 3. Pas de fallback
```
FAUX — si le MFE Catalog est down, le site affiche une erreur blanche
CORRECT — Error Boundary + fallback component avec un message graceful
```
