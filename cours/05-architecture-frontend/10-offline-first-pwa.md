# Cours 42 — Offline-first & PWA

> **Objectif** : Comprendre les Service Workers, maîtriser les stratégies de cache (Cache First, Network First, SWR), implémenter Background Sync et IndexedDB, et gérer les conflits de données offline.

---

## Rappel du cours précédent

<details>
<summary>1. Quand NE PAS utiliser des micro-frontends ?</summary>

Quand l'équipe fait < 5 devs, quand il n'y a qu'un seul domaine métier, quand la stack est homogene, ou pour un MVP. Le micro-frontend est un pattern **organisationnel** qui resout des problèmes d'équipe (déploiement independant, autonomie), pas des problèmes de code. Le cout d'orchestration ne se justifie pas sans ces benefices.
</details>

<details>
<summary>2. Quel pattern de communication est recommande entre micro-frontends et pourquoi ?</summary>

Les **Custom Events** (`window.dispatchEvent(new CustomEvent(...))`) avec la convention `{app}:{domain}:{action}`. Ils offrent un découplage total — l'emetteur ne connait pas le recepteur. Éviter le shared state (couplage) sauf pour l'auth et le panier qui sont transversaux.
</details>

---

## Analogie — L'avion en mode avion

Quand tu prends l'avion, tu passes en mode avion — plus de réseau. Pourtant, tu veux :

- **Lire tes emails** déjà telecharges → **Cache First** (lire le cache offline)
- **Écrire un email** pour l'envoyer a l'atterrissage → **Background Sync** (queue d'actions)
- **Consulter le plan de vol** → **IndexedDB** (données locales structurees)
- **Savoir si tu as du réseau** → **navigator.onLine** (détection)
- **Ne pas perdre tes brouillons** si deux appareils modifient → **Conflict résolution**

Une PWA offline-first suit le même principe : tout doit marcher sans réseau, et se synchroniser quand le réseau revient.

---

## Théorie

### 1. Service Worker — le proxy entre l'app et le réseau

```
┌──────────────┐       ┌──────────────┐       ┌──────────┐
│  Application  │──────>│   Service    │──────>│  Network │
│  (main thread)│       │   Worker     │       │  (API)   │
│               │<──────│  (proxy)     │<──────│          │
└──────────────┘       └──────┬───────┘       └──────────┘
                              │
                       ┌──────┴───────┐
                       │  Cache API   │
                       │  (offline)   │
                       └──────────────┘
```

Le Service Worker **intercepte** chaque requête réseau. Il peut :
- Servir une réponse depuis le cache (offline)
- Aller chercher sur le réseau et mettre en cache
- Combiner les deux (SWR)

### 2. Lifecycle du Service Worker

```
                 install          activate
  Registre ────────────> Installe ────────────> Actif
                  │                                │
                  │  (pre-cache assets)             │ (intercepte fetch)
                  │                                │
                  └──── wait (si ancien SW actif) ──┘

  Mise a jour :
  Nouveau SW installe → attend que l'ancien soit inactif → activate
  (pas de "Hot Module Replacement" — c'est un remplacement complet)
```

### 3. Stratégies de cache

| Stratégie | Comportement | Cas d'usage |
|---|---|---|
| **Cache First** | Cache → si absent, Network | Assets statiques (CSS, JS, images) |
| **Network First** | Network → si échoué, Cache | Données API (produits, commandes) |
| **Stale-While-Revalidate** | Cache immédiate + Network en background | Pages editoriales, listes |
| **Network Only** | Toujours Network | Paiement, auth, données sensibles |
| **Cache Only** | Toujours Cache | Assets pre-caches au build |

### 4. IndexedDB pour les données locales

| Storage | Capacité | Persistence | Requetes | Cas d'usage |
|---|---|---|---|---|
| localStorage | 5 MB | Oui | Cle/valeur seulement | Préférences, flags |
| SessionStorage | 5 MB | Session | Cle/valeur seulement | Tokens, état formulaire |
| **IndexedDB** | Illimite* | Oui | Index, curseurs, transactions | Panier offline, brouillons |
| Cache API | Illimite* | Oui | URL-based | Réponses HTTP |

*Illimite = limites du navigateur (généralement > 50% du disque disponible).

### 5. Background Sync

Quand l'utilisateur fait une action offline, on la met en queue :

```
Offline                              Online
────────                             ──────
POST /api/orders (echoue)
    │
    ▼
┌──────────────────────┐
│  Queue IndexedDB      │
│  { action: 'create_  │
│    order', body: {...}│
│    createdAt: ...     │
│  }                    │
└──────────────────────┘
    │
    │  navigator.onLine → true
    │  OU ServiceWorker sync event
    ▼
Replay la queue :
  POST /api/orders → 201 OK
  → Supprimer de la queue
```

### 6. Conflict résolution

Quand deux appareils modifient la même donnée offline :

| Stratégie | Description | Cas d'usage |
|---|---|---|
| **Last-Write-Wins** | Le dernier timestamp gagne | Notes, préférences |
| **Merge** | Fusionner les changements | Panier (additionner les quantités) |
| **User decides** | Afficher un dialogue de conflit | Documents, contenus importants |
| **CRDT** | Résolution automatique mathematique | Editeur collaboratif (cours 88) |

---

## Pratique

### Service Worker registration

```typescript
// src/sw-register.ts
export async function registerServiceWorker(): Promise<void> {
  if (!('serviceWorker' in navigator)) return;

  try {
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
    });

    // Ecouter les mises a jour
    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing;
      if (!newWorker) return;

      newWorker.addEventListener('statechange', () => {
        if (newWorker.state === 'activated') {
          // Notifier l'utilisateur qu'une nouvelle version est disponible
          showUpdateNotification();
        }
      });
    });
  } catch (error) {
    console.error('SW registration failed:', error);
  }
}
```

### Service Worker avec stratégies de cache

```typescript
// public/sw.js
const CACHE_NAME = 'shoparch-v1';
const STATIC_ASSETS = [
  '/',
  '/offline.html',
  '/styles/tokens.css',
  '/images/logo.svg',
];

// Install — pre-cache les assets statiques
self.addEventListener('install', (event: ExtendableEvent) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)),
  );
  self.skipWaiting(); // Activer immediatement
});

// Activate — nettoyer les anciens caches
self.addEventListener('activate', (event: ExtendableEvent) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(
        names
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name)),
      ),
    ),
  );
  self.clients.claim(); // Prendre le controle immediatement
});

// Fetch — strategie par type de requete
self.addEventListener('fetch', (event: FetchEvent) => {
  const url = new URL(event.request.url);

  // Assets statiques → Cache First
  if (url.pathname.match(/\.(js|css|png|jpg|svg|woff2)$/)) {
    event.respondWith(cacheFirst(event.request));
    return;
  }

  // API → Network First
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirst(event.request));
    return;
  }

  // Pages → Stale-While-Revalidate
  event.respondWith(staleWhileRevalidate(event.request));
});

async function cacheFirst(request: Request): Promise<Response> {
  const cached = await caches.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  const cache = await caches.open(CACHE_NAME);
  cache.put(request, response.clone());
  return response;
}

async function networkFirst(request: Request): Promise<Response> {
  try {
    const response = await fetch(request);
    const cache = await caches.open(CACHE_NAME);
    cache.put(request, response.clone());
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    return new Response(JSON.stringify({ error: 'Offline' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

async function staleWhileRevalidate(request: Request): Promise<Response> {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);

  const fetchPromise = fetch(request).then((response) => {
    cache.put(request, response.clone());
    return response;
  }).catch(() => cached || new Response('Offline', { status: 503 }));

  return cached || fetchPromise;
}
```

### IndexedDB wrapper pour la queue offline

```typescript
class OfflineQueue {
  private dbName = 'shoparch-offline';
  private storeName = 'pending-actions';

  private async getDb(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName, { keyPath: 'id', autoIncrement: true });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async enqueue(action: { method: string; url: string; body: any }): Promise<void> {
    const db = await this.getDb();
    const tx = db.transaction(this.storeName, 'readwrite');
    tx.objectStore(this.storeName).add({
      ...action,
      createdAt: new Date().toISOString(),
    });
  }

  async replayAll(): Promise<void> {
    const db = await this.getDb();
    const tx = db.transaction(this.storeName, 'readwrite');
    const store = tx.objectStore(this.storeName);
    const all = await this.getAllFromStore(store);

    for (const action of all) {
      try {
        await fetch(action.url, {
          method: action.method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(action.body),
        });
        store.delete(action.id); // Succes → supprimer de la queue
      } catch {
        break; // Encore offline → arreter le replay
      }
    }
  }

  private getAllFromStore(store: IDBObjectStore): Promise<any[]> {
    return new Promise((resolve) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
    });
  }
}

// Detecter le retour en ligne et replay
window.addEventListener('online', () => {
  const queue = new OfflineQueue();
  queue.replayAll();
});
```

### manifest.json

```json
{
  "name": "ShopArch",
  "short_name": "ShopArch",
  "description": "E-commerce simplifie",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#2563eb",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

---

## Résumé

1. **Service Worker** intercepte les requêtes réseau — proxy programmable entre l'app et le serveur
2. **3 stratégies de cache** : Cache First (assets), Network First (API), SWR (pages) — choisir par type de contenu
3. **IndexedDB** pour les données structurees offline (panier, brouillons) — capacité quasi illimitee
4. **Background Sync** : queue les actions offline dans IndexedDB, replay quand `navigator.onLine` revient
5. **Conflict résolution** : Last-Write-Wins pour les cas simples, merge pour le panier, dialogue utilisateur pour les contenus importants

---

> **Prochain cours** : [Cours 43 — Fondamentaux réseau pour architectes](../06-communication-intégration/01-fondamentaux-réseau.md) — ou comment comprendre HTTP/2, HTTP/3, TLS et les fondamentaux réseau essentiels pour un architecte.

---

> **Lien fil rouge — ShopArch**
>
> - Implémente le Service Worker pour ShopArch : cache-first sur le catalogue, network-first sur le panier
> - Ajoute le manifest.json et l'installabilité PWA
> - Exercice(s) associé(s) : `exercices/27-pwa-offline/`
> - Checkpoint : Module 05, critère 4

---

<!-- parcours-recommande -->

::: tip Parcours recommandé
1. **Exercice** : [21-component-tree](../../exercices/21-component-tree/ENONCE)
2. **Exercice** : [22-design-tokens-theme](../../exercices/22-design-tokens-theme/ENONCE)
3. **Exercice** : [23-ssr-isr-hybrid](../../exercices/23-ssr-isr-hybrid/ENONCE)
4. **Exercice** : [24-performance-audit](../../exercices/24-performance-audit/ENONCE)
5. **Exercice** : [25-i18n-hreflang](../../exercices/25-i18n-hreflang/ENONCE)
6. **Renforcement** : [25b-seo-audit](../../exercices/25b-seo-audit/ENONCE)
7. **Exercice** : [26-micro-frontend](../../exercices/26-micro-frontend/ENONCE)
8. **Exercice** : [27-pwa-offline](../../exercices/27-pwa-offline/ENONCE)
:::
