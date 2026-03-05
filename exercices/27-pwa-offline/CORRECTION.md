# Correction — Exercice 27 : PWA offline-first

## Service Worker avec Workbox

```typescript
// service-worker.ts
import { precacheAndRoute } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { CacheFirst, NetworkFirst, StaleWhileRevalidate } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { BackgroundSyncPlugin } from 'workbox-background-sync';

// Precache les assets build-time
precacheAndRoute(self.__WB_MANIFEST);

// Assets statiques — Cache-First
registerRoute(
  ({ request }) => ['style', 'script', 'image'].includes(request.destination),
  new CacheFirst({
    cacheName: 'static-assets',
    plugins: [new ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 30 * 24 * 3600 })],
  }),
);

// API produits — Network-First (fresh si possible, cache sinon)
registerRoute(
  ({ url }) => url.pathname.startsWith('/api/products'),
  new NetworkFirst({
    cacheName: 'api-products',
    plugins: [new ExpirationPlugin({ maxEntries: 200, maxAgeSeconds: 24 * 3600 })],
    networkTimeoutSeconds: 3,
  }),
);

// Pages — Stale-While-Revalidate
registerRoute(
  ({ request }) => request.mode === 'navigate',
  new StaleWhileRevalidate({
    cacheName: 'pages',
    plugins: [new ExpirationPlugin({ maxEntries: 50 })],
  }),
);

// Offline fallback
self.addEventListener('fetch', (event) => {
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => caches.match('/offline')),
    );
  }
});

// Background Sync pour les mutations panier
const bgSyncPlugin = new BackgroundSyncPlugin('cart-mutations', {
  maxRetentionTime: 24 * 60, // 24 heures
});

registerRoute(
  ({ url, request }) =>
    url.pathname.startsWith('/api/cart') && request.method === 'POST',
  new NetworkFirst({ plugins: [bgSyncPlugin] }),
  'POST',
);
```

## Manifest

```json
{
  "name": "ShopArch — E-commerce",
  "short_name": "ShopArch",
  "start_url": "/",
  "display": "standalone",
  "theme_color": "#4f46e5",
  "background_color": "#ffffff",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

## Online/Offline détection

```typescript
// hooks/useOnlineStatus.ts
import { useState, useEffect } from 'react';

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true,
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return { isOnline };
}

// Usage :
// function App() {
//   const { isOnline } = useOnlineStatus();
//   return !isOnline ? <OfflineBanner /> : <MainApp />;
// }
```

## Ce que tu aurais pu oublier

### 1. Cache-First pour les API
```
FAUX — l'utilisateur voit toujours les memes produits (stale)
CORRECT — Network-First pour les API (fresh si possible, cache en fallback)
```

### 2. Pas de fallback offline
```
FAUX — page blanche quand offline et page pas en cache
CORRECT — page /offline avec message "Vous etes hors ligne"
```

### 3. Mutations perdues en offline
```
FAUX — l'ajout au panier echoue silencieusement en offline
CORRECT — Background Sync queue la mutation et sync au retour du reseau
```
