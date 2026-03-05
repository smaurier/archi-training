# Cours 55 — Consistency Patterns avances

> **Objectif** : Maîtriser les patterns de consistance dans les systèmes distribues — distributed locking, leader election, Lamport timestamps, conflict résolution, idempotent consumers, et le mythe de l'exactly-once delivery.

---

## Rappel du cours précédent

<details>
<summary>1. Qu'est-ce que le Strangler Fig pattern et pourquoi éviter le Big Bang rewrite ?</summary>

Le Strangler Fig migre un système legacy **feature par feature** derriere un proxy. Chaque feature est reimplementee, testee, puis basculee. Le Big Bang (tout reconstruire d'un coup) échoué presque toujours car : les specs sont incompletes, les edge cases sont decouverts trop tard, et le risque est concentre en un seul moment.
</details>

<details>
<summary>2. Qu'est-ce que le shadow traffic et a quoi sert-il ?</summary>

On envoie les requêtes aux **deux systèmes** en parallele (legacy + nouveau). Le legacy sert la réponse au client, le nouveau est compare en background. Si les réponses différent, on log l'ecart pour investigation. Quand la pariteest atteinte, on bascule avec confiance.
</details>

---

## Analogie — Les horloges dans les gares

Avant les satellites GPS, synchroniser les horloges de 100 gares etait un defi :
- **Horloge centrale** (lock centralise) : une seule horloge fait référence. Simple, mais si elle tombe en panne, plus personne n'a l'heure.
- **Horloge par gare** (horloge logique) : chaque gare a sa propre horloge et echange l'heure avec ses voisines. Pas de synchronisation parfaite, mais un **ordre relatif** (si A envoie un message a B, B sait que A etait "avant").
- **Conflit** : deux gares changent l'horaire du meme train en meme temps. Qui gagne ? Il faut une règle de résolution.

---

## Théorie

### 1. Distributed locking

Quand plusieurs instances d'un service accedent a la meme ressource :

| Mecanisme | Technologie | Cas d'usage | Limitation |
|---|---|---|---|
| **Optimistic lock** | Version field en DB | Updates concurrents | Retry nécessaire |
| **Pessimistic lock** | `SELECT FOR UPDATE` | Opérations critiques | 1 seul noeud DB |
| **Advisory lock PG** | `pg_advisory_lock()` | Lock logique (pas une row) | 1 seul cluster PG |
| **Redis SETNX** | `SET key NX PX ttl` | Multi-noeud | Pas parfaitement safe (Redlock controversé) |
| **ZooKeeper/etcd** | Consensus distribue | Besoin de forte garantie | Complexite ops |

### 2. Leader election

Quand un seul noeud doit exécuter une tache (cron, migration, reindexation) :

```
Node 1: SET leader:cron NX PX 30000 → OK (je suis le leader)
Node 2: SET leader:cron NX PX 30000 → null (quelqu'un d'autre est leader)
Node 3: SET leader:cron NX PX 30000 → null

Node 1 execute le cron.
Si Node 1 crash, le TTL expire (30s) et un autre noeud prend le relais.
```

### 3. Lamport timestamps (horloges logiques)

Pas besoin de synchroniser les horloges physiques — on peut définir un **ordre causal** :

```
Regle : a chaque evenement, incrementer le compteur local.
        a chaque message recu, prendre max(local, recu) + 1.

Node A:   [1] ─── send msg ───> [2] ─── [3]
Node B:           [1] ─── [2] ─── receive msg → max(2, 1)+1 = [3] ─── [4]
Node C:   [1] ──────────────── [2] ── receive msg → max(2, 3)+1 = [4]

Si event X a un timestamp < event Y, ALORS X est "avant" Y (ou concurrent).
```

C'est la base des CRDT et des systèmes event-sourced.

### 4. Conflict résolution stratégies

| Stratégie | Description | Quand utiliser |
|---|---|---|
| **Last-Write-Wins (LWW)** | Le timestamp le plus recent gagne | Données remplacables (préférences, status) |
| **Merge** | Combiner les changements | Collections (panier : union des items) |
| **Application-level** | L'utilisateur decide | Contenu (documents, articles) |
| **CRDT** | Résolution mathematique automatique | Editeur collaboratif (cours 88) |

```typescript
// Last-Write-Wins
function resolveLWW<T>(local: Versioned<T>, remote: Versioned<T>): T {
  return local.updatedAt > remote.updatedAt ? local.data : remote.data;
}

// Merge pour un panier
function mergeCart(local: CartItem[], remote: CartItem[]): CartItem[] {
  const merged = new Map<string, CartItem>();

  for (const item of [...local, ...remote]) {
    const existing = merged.get(item.productId);
    if (!existing || item.quantity > existing.quantity) {
      merged.set(item.productId, item);
    }
  }

  return Array.from(merged.values());
}
```

### 5. Idempotent consumers

Un consumer DOIT etre idempotent — traiter le meme message 2 fois ne doit pas changer le résultat :

```typescript
async function handleOrderCreated(event: OrderCreatedEvent): Promise<void> {
  // Idempotence check : l'event a-t-il deja ete traite ?
  const processed = await db.findProcessedEvent(event.id);
  if (processed) return; // Deja traite → skip

  // Traiter l'event
  await sendConfirmationEmail(event.orderId);

  // Marquer comme traite (dans la meme transaction si possible)
  await db.markEventProcessed(event.id);
}
```

### 6. Exactly-once delivery — le mythe

```
At-most-once  : le message peut etre perdu (pas de retry)
At-least-once : le message est delivre au moins une fois (retry, possibles doublons)
Exactly-once  : le message est delivre exactement une fois

La verite : exactly-once est IMPOSSIBLE dans un systeme distribue.
Ce qu'on fait : at-least-once delivery + idempotent processing = exactly-once SEMANTICS
```

La différence est subtile mais critique :
- Le **transport** garantit at-least-once (Kafka, RabbitMQ avec acks)
- Le **consumer** garantit l'idempotence
- Le **résultat** est équivalent a exactly-once

---

## Pratique

### Distributed lock service

```typescript
@Injectable()
export class DistributedLockService {
  constructor(private readonly redis: Redis) {}

  async withLock<T>(
    key: string,
    fn: () => Promise<T>,
    ttlMs: number = 10_000,
  ): Promise<T> {
    const token = crypto.randomUUID();
    const lockKey = `lock:${key}`;

    // Acquerer le lock
    const acquired = await this.redis.set(lockKey, token, 'PX', ttlMs, 'NX');
    if (acquired !== 'OK') {
      throw new ConflictException(`Resource ${key} is locked`);
    }

    try {
      return await fn();
    } finally {
      // Relacher le lock (atomique avec Lua)
      await this.redis.eval(
        `if redis.call("get", KEYS[1]) == ARGV[1] then
           return redis.call("del", KEYS[1])
         end
         return 0`,
        1,
        lockKey,
        token,
      );
    }
  }
}

// Usage
await lockService.withLock(`import:${tenantId}`, async () => {
  await importService.processFile(file);
});
```

### Idempotent event processor

```typescript
@Injectable()
export class IdempotentEventProcessor {
  constructor(
    private readonly db: DataSource,
  ) {}

  async process<T>(
    eventId: string,
    handler: () => Promise<T>,
  ): Promise<T | null> {
    // Utiliser une transaction pour atomicite
    return this.db.transaction(async (manager) => {
      // Check si deja traite
      const existing = await manager.findOne(ProcessedEvent, {
        where: { eventId },
      });

      if (existing) {
        return null; // Deja traite
      }

      // Executer le handler
      const result = await handler();

      // Marquer comme traite
      await manager.save(ProcessedEvent, {
        eventId,
        processedAt: new Date(),
      });

      return result;
    });
  }
}

// Usage avec un event Kafka/RabbitMQ
@EventHandler('order.created')
async handleOrderCreated(event: OrderCreatedEvent): Promise<void> {
  await this.processor.process(event.id, async () => {
    await this.emailService.sendConfirmation(event.orderId);
    await this.inventoryService.reserveStock(event.items);
  });
}
```

### Leader election avec Redis

```typescript
@Injectable()
export class LeaderElection {
  private isLeader = false;
  private renewInterval: NodeJS.Timer | null = null;

  constructor(
    private readonly redis: Redis,
    private readonly nodeId: string = crypto.randomUUID(),
  ) {}

  async tryBecomeLeader(key: string, ttlMs: number = 30_000): Promise<boolean> {
    const result = await this.redis.set(`leader:${key}`, this.nodeId, 'PX', ttlMs, 'NX');
    this.isLeader = result === 'OK';

    if (this.isLeader) {
      // Renouveler le lease periodiquement (TTL / 3)
      this.renewInterval = setInterval(async () => {
        const current = await this.redis.get(`leader:${key}`);
        if (current === this.nodeId) {
          await this.redis.pexpire(`leader:${key}`, ttlMs);
        } else {
          this.isLeader = false;
          if (this.renewInterval) clearInterval(this.renewInterval);
        }
      }, ttlMs / 3);
    }

    return this.isLeader;
  }

  getIsLeader(): boolean {
    return this.isLeader;
  }
}
```

---

## Resume

1. **Distributed lock** (Redis SETNX + TTL + Lua release) pour opérations exclusives multi-noeud — toujours avec un TTL
2. **Leader election** : un seul noeud exécuté les taches cron/batch — lease renouvelable avec TTL
3. **Lamport timestamps** : ordre causal sans synchronisation d'horloge — base des CRDT
4. **Exactly-once = mythe** : on fait at-least-once delivery + idempotent processing = exactly-once semantics
5. **Conflict résolution** : LWW pour le simple, merge pour les collections, dialogue utilisateur pour le critique

---

> **Prochain cours** : [Cours 56 — OWASP Top 10 & Threat Modeling](../08-sécurité/01-owasp-stride.md)

---

> **Lien fil rouge — ShopArch**
>
> - Implémente l'eventual consistency entre le catalogue et le search index ShopArch
> - Définis la stratégie de résolution de conflits pour le panier (last-write-wins)
> - Exercice(s) associé(s) : `exercices/32-cap-classifier/`
> - Checkpoint : Module 07, critère 4
