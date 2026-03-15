# Cours 84 — Architecture mobile (React Native, Flutter)

> **Objectif** : Comprendre les architectures mobile natives vs cross-platform, maîtriser le sync bidirectionnel offline-first, et adapter le design d'API pour les contraintes mobiles (réseau intermittent, App Store, delta sync).

---

## Rappel du cours précédent

<details>
<summary>1. Qu'est-ce qu'une architecture évolutive et comment les fitness functions la protegent ?</summary>

Une architecture évolutive evolue avec le produit via un feedback loop : construire → mesurer → adapter. Les **fitness functions** sont des tests automatises qui verifient des invariants architecturaux (bundle < 200KB, pas de circular deps, domaine isole). Elles empechent l'erosion et guident l'évolution.
</details>

<details>
<summary>2. Comment decider entre build et buy pour un composant ?</summary>

Build si : avantage concurrentiel, expertise interne, équipe dédiée disponible. Buy si : pas un differenciateur, expertise faible, time-to-market urgent. Le **Wardley Map** aide : composants en genesis/custom → build, composants en commodity → buy (auth, hosting, email).
</details>

---

## Analogie — L'ambassade en territoire etranger

L'application mobile est comme une **ambassade** : elle represente ton pays (ton service), mais elle opere en territoire etranger (le telephone de l'utilisateur) avec ses propres règles :
- **Pas de mise a jour instantanee** : il faut passer par l'App Store (review 1-3 jours)
- **Réseau intermittent** : le metro, l'avion, la campagne — tout doit marcher offline
- **Ressources limitees** : batterie, mémoire, CPU — pas de gaspillage
- **Plusieurs versions en prod** : certains utilisateurs restent sur v1 pendant que tu deploies v3

---

## Théorie

### 1. Native vs Cross-platform

| | Native | React Native | Flutter |
|---|---|---|---|
| Langage | Swift/Kotlin | TypeScript | Dart |
| Performance | Optimale | Proche du natif (bridge) | Proche du natif (Skia) |
| UI | Composants natifs | Composants natifs (via bridge) | Widgets propres |
| Équipe | iOS + Android séparées | 1 équipe JS/TS | 1 équipe Dart |
| Partage code web | Non | Oui (React) | Possible (Flutter Web) |
| Hot reload | Non | Oui | Oui |

### 2. Offline-first mandatory

```
Mobile ≠ Web : le reseau est INTERMITTENT

Strategie :
  1. Toutes les operations sont executees localement d'abord
  2. Les mutations sont mises en queue (mutation queue)
  3. Quand le reseau revient → sync vers le serveur
  4. Conflits resolus (last-write-wins ou merge)

┌──────────┐     Queue      ┌──────────┐
│  Local   │───(offline)───>│  Server  │
│  Store   │<──(sync)───────│  API     │
│(SQLite/  │                │          │
│IndexedDB)│                └──────────┘
└──────────┘
```

### 3. Delta sync

```
Full sync (MAUVAIS pour mobile) :
  GET /api/products → 10,000 produits × 2KB = 20MB
  A chaque ouverture de l'app !

Delta sync (BON) :
  GET /api/products?since=2024-03-01T12:00:00Z
  → Seulement les produits modifies depuis le dernier sync
  → 50 produits × 2KB = 100KB

Implementation :
  Client stocke : lastSyncTimestamp
  Serveur filtre : WHERE updated_at > :since
  Header : X-Last-Sync: 2024-03-01T12:00:00Z
```

### 4. API design pour mobile

| Pattern web | Pattern mobile | Pourquoi |
|---|---|---|
| N requêtes | 1 requête agregee (BFF) | Latence réseau mobile (100-300ms RTT) |
| Pagination offset | Pagination cursor stable | Données changent entre les pages |
| Pas de compression | gzip/brotli obligatoire | Bande passante limitee |
| Cache navigateur | Cache local persistant (SQLite) | App fermee → cache survit |
| WebSocket permanent | Push notifications + poll | Batterie : WebSocket tue la batterie |
| Infinite scroll | Pull-to-refresh + pagination | UX mobile naturelle |

### 5. App Store constraints

```
Pas de deploiement instantane :
  Review Apple : 1-3 jours (parfois rejet)
  Review Google : quelques heures

Consequences architecturales :
  - Feature flags obligatoires (activer/desactiver sans deploy)
  - API backward-compatible (v1 et v2 cohabitent)
  - Minimum version check (forcer la mise a jour si critique)
  - OTA updates (CodePush / Expo Updates) pour les changements JS
  - Rollback impossible : la version est deja sur les telephones

Force update flow :
  App start → GET /api/app-config
  Si currentVersion < minimumVersion → ecran "Mise a jour requise"
```

### 6. Bridge vs FFI

```
React Native : Bridge (JS ←→ Native via messages serialises)
  Avantage : ecrit en JS/TS
  Inconvenient : overhead de serialisation (JSON)
  New Architecture (Turbo Modules) : JSI direct (pas de bridge)

Flutter : FFI (Dart ←→ Native via appels directs)
  Avantage : pas de serialisation
  Inconvenient : ecrit en Dart (pas de partage JS)
```

---

## Pratique

### Mutation queue offline-first

```typescript
interface PendingMutation {
  id: string;
  method: 'POST' | 'PUT' | 'DELETE';
  url: string;
  body: unknown;
  createdAt: string;
  retries: number;
}

class MutationQueue {
  private queue: PendingMutation[] = [];

  async enqueue(mutation: Omit<PendingMutation, 'id' | 'createdAt' | 'retries'>): Promise<void> {
    const entry: PendingMutation = {
      ...mutation,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      retries: 0,
    };

    this.queue.push(entry);
    await this.persistQueue();

    // Tenter de sync immediatement si en ligne
    if (navigator.onLine) {
      await this.flush();
    }
  }

  async flush(): Promise<void> {
    const pending = [...this.queue];

    for (const mutation of pending) {
      try {
        await fetch(mutation.url, {
          method: mutation.method,
          body: JSON.stringify(mutation.body),
          headers: { 'Content-Type': 'application/json' },
        });

        // Succes → retirer de la queue
        this.queue = this.queue.filter((m) => m.id !== mutation.id);
      } catch {
        mutation.retries++;
        if (mutation.retries > 5) {
          // Abandonner et notifier l'utilisateur
          this.queue = this.queue.filter((m) => m.id !== mutation.id);
          this.notifyFailure(mutation);
        }
      }
    }

    await this.persistQueue();
  }

  private async persistQueue(): Promise<void> {
    await AsyncStorage.setItem('mutation_queue', JSON.stringify(this.queue));
  }
}

// Ecouter les changements de connectivite
window.addEventListener('online', () => mutationQueue.flush());
```

### Delta sync service

```typescript
class DeltaSyncService {
  private lastSync: Record<string, string> = {};

  async sync<T>(
    resource: string,
    apiUrl: string,
  ): Promise<T[]> {
    const since = this.lastSync[resource];
    const url = since
      ? `${apiUrl}?since=${encodeURIComponent(since)}`
      : apiUrl;

    const response = await fetch(url, {
      headers: { 'X-Last-Sync': since ?? '' },
    });

    const data = await response.json();
    const items = data['hydra:member'] as T[];

    // Merger avec le store local
    await this.mergeLocal(resource, items);

    // Mettre a jour le timestamp
    this.lastSync[resource] = new Date().toISOString();
    await AsyncStorage.setItem('last_sync', JSON.stringify(this.lastSync));

    return items;
  }

  private async mergeLocal<T extends { id: string }>(
    resource: string,
    remoteItems: T[],
  ): Promise<void> {
    const localItems = await this.getLocal<T>(resource);
    const merged = new Map(localItems.map((i) => [i.id, i]));

    for (const item of remoteItems) {
      merged.set(item.id, item); // Remote wins (LWW)
    }

    await this.setLocal(resource, Array.from(merged.values()));
  }
}
```

---

## Résumé

1. **Cross-platform** (React Native, Flutter) : 1 équipe pour iOS + Android — trade-off performance vs vitesse de dev
2. **Offline-first obligatoire** : mutation queue locale, sync quand le réseau revient, conflict résolution (LWW ou merge)
3. **Delta sync** : `?since=timestamp` pour ne telecharger que les changements — economise bande passante et batterie
4. **API mobile-friendly** : 1 requête agregee (BFF), pagination cursor stable, compression gzip, cache persistant local
5. **App Store constraints** : feature flags, backward-compatible API, force update check, OTA updates pour les hotfixes JS

---

> **Prochain cours** : [Cours 85 — MLOps & AI Systems Architecture](./02-mlops-ai-systems.md)

---

> **Lien fil rouge — ShopArch**
>
> - Implémente le delta sync sur l'API ShopArch (`?updatedSince=...`)
> - Optimise les payloads API pour les clients mobiles (champs sélectifs, compression)
> - Exercice(s) associé(s) : `exercices/57-api-mobile-friendly/`
> - Checkpoint : Module 13, critère 1
