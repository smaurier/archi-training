# Correction — Exercice 19 : Polyglot persistence

## Choix par besoin

| Besoin | Choix | Justification |
|---|---|---|
| Catalogue produits | **PostgreSQL** | Relations, FK, transactions ACID, JSONB pour i18n |
| Sessions | **Redis** | TTL natif, ultra-rapide (~1ms), ephemere |
| Cache API | **Redis** | Tags, TTL variable, invalidation atomique |
| Recherche produits | **PostgreSQL FTS** (puis Elasticsearch si besoin) | Commence simple, migre quand les limites sont atteintes |
| Analytics | **PostgreSQL** (puis ClickHouse si volume) | Pas besoin d'une DB séparée avant 10M events |
| Panier | **Redis** (HASH + TTL) | Rapide, TTL 7j, structure flexible |
| File d'attente jobs | **Redis** (via BullMQ) | BullMQ utilise Redis, déjà en place |

## Architecture recommandee (pragmatique)

```
Pour une equipe de 5-10 devs, 2-3 bases suffisent :

┌──────────┐     ┌──────────────┐
│   API    │────>│  PostgreSQL  │  Source de verite
│  NestJS  │     │  (donnees,   │  (catalogue, commandes,
│          │     │   FTS, ana.) │   users, analytics)
│          │     └──────────────┘
│          │
│          │────>┌──────────────┐
│          │     │    Redis     │  Cache + Sessions + Queues
│          │     │              │  + Paniers
└──────────┘     └──────────────┘

Quand scaler (> 50K produits, > 1M events/mois) :

┌──────────┐     ┌──────────────┐     ┌───────────────┐
│   API    │────>│  PostgreSQL  │────>│ Elasticsearch │
│          │     └──────────────┘     │ (search)      │
│          │                    CDC   └───────────────┘
│          │────>┌──────────────┐
│          │     │    Redis     │
└──────────┘     └──────────────┘
```

## Quand NE PAS ajouter une base

```
PostgreSQL SUFFIT pour :
  ✓ Full-text search basique (tsvector + GIN) — jusqu'a ~100K docs
  ✓ Analytics simples (COUNT, AVG, GROUP BY) — jusqu'a ~10M rows
  ✓ Time-series basiques — avec partitioning ou TimescaleDB extension
  ✓ JSONB documents — quand les relations existent aussi

NE PAS ajouter Elasticsearch si :
  ✗ Moins de 50K documents a indexer
  ✗ Pas besoin de facettes complexes
  ✗ PostgreSQL FTS couvre les besoins

NE PAS ajouter MongoDB si :
  ✗ Les donnees ont des relations (FK)
  ✗ Tu as deja PostgreSQL avec JSONB
  ✗ Tu as besoin de transactions multi-documents
```

## Sync PostgreSQL → Elasticsearch

```typescript
// Option 1 : Dual-write (simple mais risque de desync)
async saveProduct(product: Product): Promise<void> {
  await this.pgRepo.save(product);         // Source de verite
  await this.esClient.index({              // Index de recherche
    index: `products_${product.tenantId}`,
    id: product.id,
    body: this.toSearchDocument(product),
  });
}

// Option 2 : CDC via Debezium (robuste, pas de dual-write)
// Debezium lit le WAL PostgreSQL et pousse vers Kafka → Elasticsearch
// Zero changement dans le code applicatif
```

## Ce que tu aurais pu oublier

### 1. Ajouter une base pour chaque besoin

```
FAUX — PostgreSQL + Redis + Elasticsearch + MongoDB + ClickHouse + Cassandra
  → 6 bases pour une equipe de 5 devs = ingerable

CORRECT — Commencer avec PostgreSQL + Redis
  → Ajouter Elasticsearch quand PostgreSQL FTS atteint ses limites
  → Chaque base ajoutee = cout operationnel + expertise requise
```

### 2. MongoDB pour les documents quand PostgreSQL JSONB suffit

```
FAUX — "On a des donnees JSON, il faut MongoDB"
  → PostgreSQL JSONB + index GIN = aussi performant pour la plupart des cas
  → Et tu gardes les transactions ACID + les FK

CORRECT — MongoDB uniquement si :
  → Schema tres dynamique qui change constamment
  → Zero relation entre documents
  → Volume massif de documents (> 100M)
```

### 3. Oublier le cout du dual-write

```
FAUX — ecrire dans PostgreSQL ET Elasticsearch en meme temps
  → Si ES est down, l'ecriture PG reussit mais ES echoue → desync

CORRECT — utiliser un outbox pattern ou CDC
  → PostgreSQL est la source de verite
  → Les changements sont propages de maniere fiable vers ES
```
