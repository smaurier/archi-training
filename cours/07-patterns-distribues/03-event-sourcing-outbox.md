# Cours 51 — Event Sourcing & Outbox Pattern

> **Objectif** : Comprendre l'Event Sourcing (stocker les événements, pas l'état), maîtriser l'event store avec snapshots et projections, implémenter l'Outbox Pattern pour la publication fiable d'événements, et savoir quand l'Event Sourcing fait plus de mal que de bien.

---

## Rappel du cours précédent

<details>
<summary>1. Quels sont les 3 niveaux de read store en CQRS ?</summary>

1. **Même DB avec vues materialisees** — le plus simple, consistance forte, suffisant pour la plupart des cas
2. **Read replica séparée** — scalabilité horizontale des lectures, eventual consistency (~100ms lag)
3. **Store specialise** (Elasticsearch, Redis) — latence très basse, ideal pour search et dashboards, mais consistance eventual (~secondes)

On commence toujours par le niveau 1 et on monte quand c'est mesure.
</details>

<details>
<summary>2. Qu'est-ce que la surrogate-key cache invalidation et pourquoi est-ce superieur à un TTL ?</summary>

Chaque réponse CDN est taguee avec des surrogate keys (`product:123`, `category:shoes`). Quand un produit change, on purge uniquement les réponses portant ce tag — pas tout le cache. Un TTL invalide le cache après un delai fixe (même si rien n'a change), alors que la surrogate-key invalide immédiatement et seulement ce qui est concerne.
</details>

---

## Analogie — Le grand livre comptable

Depuis des siecles, les comptables ne modifient jamais un solde directement. Ils enregistrent chaque transaction dans un **grand livre** (journal) :

- **Écriture classique** (state-based) = tu notes le solde actuel sur un post-it. Quelqu'un change le post-it → l'ancien solde est perdu
- **Grand livre** (event-sourced) = tu notes chaque transaction : "+500 salaire", "-120 loyer", "+15 remboursement"
- **Solde actuel** (projection) = tu additionnes toutes les lignes du journal → le solde se deduit des événements
- **Photo annuelle** (snapshot) = chaque annee, tu notes le solde au 31/12 pour ne pas tout recalculer depuis 1950
- **Audit** = tu peux retracer chaque centime, détecter les erreurs, rejouer depuis n'importe quelle date

L'Event Sourcing applique cette logique au code : stocker les événements, pas l'état.

---

## Théorie

### 1. State-based vs Event-sourced

```
State-based (CRUD classique) :
  ┌────────────────────────┐
  │ orders                  │
  │ id: abc-123             │
  │ status: shipped         │  ← Seul l'etat actuel est connu
  │ total: 150.00           │     L'historique est perdu
  │ updated_at: 2026-03-03  │
  └────────────────────────┘

Event-sourced :
  ┌──────────────────────────────────────────────────┐
  │ event_store                                       │
  │                                                   │
  │ 1. OrderCreated     { id: abc-123, total: 150 }  │
  │ 2. PaymentReceived  { amount: 150 }              │
  │ 3. OrderConfirmed   { confirmedBy: admin-1 }     │
  │ 4. OrderShipped     { trackingId: TR-789 }       │
  │                                                   │
  │ → L'etat se reconstruit en rejouant les events   │
  └──────────────────────────────────────────────────┘
```

| Aspect | State-based (CRUD) | Event Sourcing |
|---|---|---|
| Stockage | État actuel (dernière version) | Tous les événements depuis la création |
| Historique | Perdu (sauf versioning explicite) | Complet par nature |
| Audit trail | A construire séparément | Gratuit (c'est la source de vérité) |
| Replay | Impossible | Rejouer les events pour reconstruire n'importe quel état |
| Complexite | Basse | Elevee (projections, snapshots, versioning) |
| Suppression | DELETE → disparu | Jamais de DELETE — on ajoute un event "Deleted" |

### 2. Event Store — la source de vérité

```
┌────────────────────────────────────────────────────────┐
│                    Event Store                          │
│                                                        │
│  aggregate_id │ version │ event_type      │ payload    │
│  ─────────────┼─────────┼─────────────────┼────────────│
│  order-abc    │    1    │ OrderCreated    │ { ... }    │
│  order-abc    │    2    │ PaymentReceived │ { ... }    │
│  order-abc    │    3    │ OrderConfirmed  │ { ... }    │
│  order-abc    │    4    │ OrderShipped    │ { ... }    │
│  order-def    │    1    │ OrderCreated    │ { ... }    │
│  order-def    │    2    │ OrderCancelled  │ { ... }    │
└────────────────────────────────────────────────────────┘

Regles :
  1. Append-only — jamais de UPDATE ni DELETE
  2. Ordonne par (aggregate_id, version) — version strictement croissante
  3. Chaque event est immuable — une fois ecrit, jamais modifie
  4. Optimistic concurrency — si 2 writes avec meme version → conflit
```

### 3. Snapshots — éviter de tout rejouer

Pour un agregat avec 10 000 événements, rejouer depuis le debut est lent :

```
Sans snapshot :
  Event 1 → Event 2 → ... → Event 10000 → Etat actuel
  O(n) : 10 000 events a rejouer (~500ms)

Avec snapshot (tous les 100 events) :
  Snapshot@9900 → Event 9901 → ... → Event 10000 → Etat actuel
  O(100) : 100 events a rejouer (~5ms)
```

| Stratégie snapshot | Declenchement | Avantage |
|---|---|---|
| Tous les N events | Après 100 events | Simple, previsible |
| Periodique | Toutes les heures | Bon pour les agregats fréquents |
| A la demandé | Quand la reconstruction > seuil | Optimise, mais plus complexe |

### 4. Projections — construire des vues de lecture

Les événements seuls ne sont pas queryables efficacement. Les **projections** transforment les événements en modèles de lecture :

```
Event Store                           Projections (Read Models)
┌────────────────────────┐
│ OrderCreated           │──────────> ┌────────────────────────┐
│ PaymentReceived        │            │ orders_view            │
│ OrderShipped           │            │ (denormalise, indexe)  │
└────────────────────────┘            └────────────────────────┘
          │
          │──────────> ┌────────────────────────┐
          │            │ revenue_dashboard      │
          │            │ (agregations par jour) │
          │            └────────────────────────┘
          │
          └──────────> ┌────────────────────────┐
                       │ search_index           │
                       │ (Elasticsearch)        │
                       └────────────────────────┘
```

**Une projection = un consumer qui transforme un flux d'events en une structure optimisee pour un cas d'usage.**

### 5. Outbox Pattern — publication fiable des événements

Le problème : comment garantir qu'un event est à la fois sauvegarde ET publie ?

```
DANGER — dual write :
  1. BEGIN transaction
  2. INSERT INTO orders (...) VALUES (...)
  3. COMMIT
  4. publish('OrderCreated', { ... })   ← Si le serveur crash ici,
                                           l'event est PERDU

SOLUTION — Outbox Pattern :
  1. BEGIN transaction
  2. INSERT INTO orders (...) VALUES (...)
  3. INSERT INTO outbox (event_type, payload, ...) VALUES (...)
  4. COMMIT                              ← Les deux sont dans la MEME transaction
  5. Un poller/CDC lit l'outbox et publie l'event
```

```
┌──────────────────────────────────────────────┐
│                  PostgreSQL                   │
│                                              │
│  ┌───────────┐     ┌──────────────────────┐ │
│  │  orders    │     │  outbox              │ │
│  │  (table)   │     │  id, event_type,     │ │
│  │            │     │  payload, created_at,│ │
│  │            │     │  published_at (null)  │ │
│  └───────────┘     └──────────┬───────────┘ │
│                               │              │
│       MEME TRANSACTION       │              │
└──────────────────────────────┼──────────────┘
                               │
                    ┌──────────┴──────────┐
                    │  Outbox Poller       │
                    │  (cron every 1s)     │
                    │  OU                  │
                    │  CDC (Debezium)      │
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌──────────────────────┐
                    │  Message Broker      │
                    │  (RabbitMQ, Kafka)   │
                    └──────────────────────┘
```

### 6. CDC avec Debezium

Le poller à un inconvenient : il introduit un delai (polling interval). Debezium lit directement le WAL (Write-Ahead Log) de PostgreSQL :

```
PostgreSQL WAL ──────> Debezium ──────> Kafka
  (chaque INSERT         (CDC            (topic:
   dans outbox)          connector)       outbox.events)

Avantages :
  - Quasi temps reel (pas de polling delay)
  - Ne charge pas la base (lit le WAL, pas la table)
  - Garantie at-least-once delivery
```

### 7. Quand l'Event Sourcing fait plus de mal que de bien

| Situation | Event Sourcing ? | Pourquoi |
|---|---|---|
| CRUD simple (blog, profil) | Non | Overkill massif — CRUD suffit |
| Audit reglementaire (finance, sante) | Oui | L'audit trail est gratuit |
| Temporal queries ("état au 15 janvier ?") | Oui | Replay jusqu'a cette date |
| Équipe < 5 devs | Non | Complexite trop élevée pour la taille |
| Schema d'events qui change souvent | Attention | Le versioning d'events est difficile |
| Beaucoup de DELETE | Non | Event Sourcing ne supprime jamais rien |
| Données sensibles (RGPD droit a l'oubli) | Complique | Crypto-shredding nécessaire |
| Read-heavy avec peu d'historique | Non | CQRS seul (sans ES) suffit |

**Regle** : si tu n'as pas besoin de l'historique complet ou de l'audit trail, CQRS sans Event Sourcing est presque toujours suffisant.

---

## Pratique

### Event Store en PostgreSQL

```typescript
// event-store/event-store.ts
interface StoredEvent {
  id: string;
  aggregateId: string;
  aggregateType: string;
  version: number;
  eventType: string;
  payload: Record<string, unknown>;
  metadata: { userId?: string; correlationId?: string; timestamp: string };
}

@Injectable()
export class EventStore {
  constructor(private readonly dataSource: DataSource) {}

  async append(
    aggregateId: string,
    aggregateType: string,
    events: DomainEvent[],
    expectedVersion: number,
  ): Promise<void> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.startTransaction();

    try {
      // Optimistic concurrency : verifier la version actuelle
      const current = await queryRunner.query(
        `SELECT MAX(version) as max_version FROM event_store
         WHERE aggregate_id = $1`,
        [aggregateId],
      );

      const currentVersion = current[0]?.max_version ?? 0;
      if (currentVersion !== expectedVersion) {
        throw new Error(
          `Concurrency conflict: expected version ${expectedVersion}, ` +
          `but current is ${currentVersion}`,
        );
      }

      // Append les events avec version incrementale
      for (let i = 0; i < events.length; i++) {
        const event = events[i];
        const version = expectedVersion + i + 1;

        await queryRunner.query(
          `INSERT INTO event_store
           (id, aggregate_id, aggregate_type, version, event_type, payload, metadata)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            crypto.randomUUID(),
            aggregateId,
            aggregateType,
            version,
            event.type,
            JSON.stringify(event.data),
            JSON.stringify(event.metadata),
          ],
        );

        // Outbox : inserer dans la meme transaction
        await queryRunner.query(
          `INSERT INTO outbox (id, event_type, aggregate_id, payload, created_at)
           VALUES ($1, $2, $3, $4, NOW())`,
          [
            crypto.randomUUID(),
            event.type,
            aggregateId,
            JSON.stringify({ ...event.data, aggregateId, version }),
          ],
        );
      }

      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async loadEvents(aggregateId: string, afterVersion = 0): Promise<StoredEvent[]> {
    return this.dataSource.query(
      `SELECT * FROM event_store
       WHERE aggregate_id = $1 AND version > $2
       ORDER BY version ASC`,
      [aggregateId, afterVersion],
    );
  }
}
```

### Agregat event-sourced (Order)

```typescript
// domain/order.aggregate.ts
interface DomainEvent {
  type: string;
  data: Record<string, unknown>;
  metadata: { timestamp: string; userId?: string; correlationId?: string };
}

class Order {
  private id: string;
  private status: 'created' | 'confirmed' | 'shipped' | 'cancelled';
  private total: number;
  private items: OrderItem[];
  private version: number;
  private uncommittedEvents: DomainEvent[] = [];

  private constructor() {
    this.version = 0;
    this.status = 'created';
    this.total = 0;
    this.items = [];
  }

  // --- Factory : creer depuis des events (reconstruction) ---
  static fromEvents(events: StoredEvent[]): Order {
    const order = new Order();
    for (const event of events) {
      order.apply(event, false); // false = ne pas ajouter aux uncommitted
    }
    order.version = events.length > 0 ? events[events.length - 1].version : 0;
    return order;
  }

  // --- Commands ---
  static create(id: string, items: OrderItem[], userId: string): Order {
    const order = new Order();
    const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

    order.raise({
      type: 'OrderCreated',
      data: { id, items, total },
      metadata: { timestamp: new Date().toISOString(), userId },
    });
    return order;
  }

  confirm(userId: string): void {
    if (this.status !== 'created') {
      throw new Error(`Cannot confirm order in status: ${this.status}`);
    }
    this.raise({
      type: 'OrderConfirmed',
      data: { confirmedAt: new Date().toISOString() },
      metadata: { timestamp: new Date().toISOString(), userId },
    });
  }

  ship(trackingId: string, userId: string): void {
    if (this.status !== 'confirmed') {
      throw new Error(`Cannot ship order in status: ${this.status}`);
    }
    this.raise({
      type: 'OrderShipped',
      data: { trackingId, shippedAt: new Date().toISOString() },
      metadata: { timestamp: new Date().toISOString(), userId },
    });
  }

  // --- Event application ---
  private apply(event: StoredEvent | DomainEvent, isNew: boolean = true): void {
    const eventType = 'type' in event ? event.type : event.eventType;
    const data = 'data' in event ? event.data : event.payload;

    switch (eventType) {
      case 'OrderCreated':
        this.id = data.id as string;
        this.items = data.items as OrderItem[];
        this.total = data.total as number;
        this.status = 'created';
        break;
      case 'OrderConfirmed':
        this.status = 'confirmed';
        break;
      case 'OrderShipped':
        this.status = 'shipped';
        break;
      case 'OrderCancelled':
        this.status = 'cancelled';
        break;
    }

    if (isNew) this.uncommittedEvents.push(event as DomainEvent);
  }

  private raise(event: DomainEvent): void {
    this.apply(event, true);
  }

  getUncommittedEvents(): DomainEvent[] {
    return [...this.uncommittedEvents];
  }

  getVersion(): number {
    return this.version;
  }
}
```

### Outbox Poller

```typescript
// outbox/outbox-poller.ts
@Injectable()
export class OutboxPoller implements OnModuleInit {
  private readonly BATCH_SIZE = 100;
  private readonly POLL_INTERVAL_MS = 1000;

  constructor(
    private readonly dataSource: DataSource,
    private readonly messageBroker: MessageBroker,
  ) {}

  onModuleInit() {
    this.startPolling();
  }

  private async startPolling(): Promise<void> {
    setInterval(async () => {
      await this.processOutbox();
    }, this.POLL_INTERVAL_MS);
  }

  private async processOutbox(): Promise<void> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.startTransaction();

    try {
      // SELECT FOR UPDATE SKIP LOCKED — ne bloque pas les autres pollers
      const events = await queryRunner.query(
        `SELECT * FROM outbox
         WHERE published_at IS NULL
         ORDER BY created_at ASC
         LIMIT $1
         FOR UPDATE SKIP LOCKED`,
        [this.BATCH_SIZE],
      );

      for (const event of events) {
        await this.messageBroker.publish(event.event_type, event.payload);

        await queryRunner.query(
          `UPDATE outbox SET published_at = NOW() WHERE id = $1`,
          [event.id],
        );
      }

      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      // Le prochain poll reessaiera — at-least-once delivery
    } finally {
      await queryRunner.release();
    }
  }
}
```

### Projection (read model builder)

```typescript
// projections/order-listing.projection.ts
@Injectable()
export class OrderListingProjection {
  constructor(private readonly dataSource: DataSource) {}

  async handleEvent(event: { type: string; data: Record<string, unknown> }): Promise<void> {
    switch (event.type) {
      case 'OrderCreated':
        await this.dataSource.query(
          `INSERT INTO order_listing_view
           (id, status, total, item_count, created_at)
           VALUES ($1, 'created', $2, $3, $4)`,
          [event.data.id, event.data.total, (event.data.items as any[]).length, new Date()],
        );
        break;

      case 'OrderConfirmed':
        await this.dataSource.query(
          `UPDATE order_listing_view SET status = 'confirmed' WHERE id = $1`,
          [event.data.orderId],
        );
        break;

      case 'OrderShipped':
        await this.dataSource.query(
          `UPDATE order_listing_view SET status = 'shipped',
           tracking_id = $2 WHERE id = $1`,
          [event.data.orderId, event.data.trackingId],
        );
        break;
    }
  }
}
```

---

## Résumé

1. **Event Sourcing** stocke les événements (faits immuables), pas l'état — l'état se reconstruit en rejouant les events depuis le debut
2. **Snapshots** evitent de tout rejouer : photo de l'état tous les N events, puis replay uniquement depuis le dernier snapshot
3. **Projections** transforment le flux d'events en modèles de lecture optimises (vues denormalisees, Elasticsearch, dashboards)
4. **Outbox Pattern** : insérer l'event dans la même transaction SQL que la modification métier, puis un poller ou CDC (Debezium) le publie — garantie at-least-once sans dual write
5. **Event Sourcing est overkill** pour les CRUDs simples — ne l'utiliser que quand l'audit trail complet ou le replay temporel sont des besoins réels

---

> **Prochain cours** : [Cours 52 — Saga Pattern](./04-saga-pattern.md) — ou comment coordonner des transactions distribuees entre plusieurs services sans 2PC.

---

> **Lien fil rouge — ShopArch**
>
> - Implémente le transactional outbox pour publier les events OrderPlaced de manière fiable
> - Le polling publisher lit la table outbox et publie vers Redis/BullMQ
> - Exercice(s) associé(s) : `exercices/35-outbox-pattern/`
> - Checkpoint : Module 07, critère 2
