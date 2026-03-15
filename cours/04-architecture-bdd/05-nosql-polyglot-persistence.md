# Cours 31 — NoSQL & Polyglot Persistence

> **Objectif** : Comprendre les familles de bases NoSQL (document, key-value, column-family, graph, time-series), savoir quand les utiliser, et maîtriser le concept de polyglot persistence.

---

## Rappel du cours précédent

<details>
<summary>1. Qu'est-ce que le "read-your-own-writes problem" avec les read replicas ?</summary>

Quand l'application écrit sur le master puis lit immédiatement depuis un replica, le replica peut ne pas encore avoir recu la modification (réplication lag ~100ms). L'utilisateur ne voit pas son propre changement. Solution : pour les opérations sensibles (juste après un write), lire depuis le master.
</details>

<details>
<summary>2. Quelle est la convention de namespace Redis recommandee ?</summary>

`{app}:{feature}:{key}` — par exemple `shop:products:abc-123`, `shop:cart:user:user-456`. Cela permet un rangement logique, un scan par prefix, et une invalidation groupee par tag ou par feature.
</details>

---

## Analogie — La boite a outils

Un menuisier n'utilise pas un marteau pour tout :

- **Tournevis** (Key-Value / Redis) : accès direct à un élément par sa clé. Ultra rapide, zero complexité
- **Classeur a dossiers** (Document / MongoDB) : chaque dossier contient un document structure, pas besoin que tous les dossiers aient la même structure
- **Tableur geant** (Column-family / Cassandra) : des milliards de lignes, distribuees sur des dizaines de serveurs, mais requêtes limitees
- **Carte avec des fils** (Graph / Neo4j) : les relations ENTRE les entités sont aussi importantes que les entités elles-memes
- **Chronometre** (Time-series / TimescaleDB) : un flux continu de mesures dans le temps, avec agregation rapide

Le **polyglot persistence**, c'est choisir le bon outil pour chaque vis — pas un outil universel.

---

## Théorie

### 1. Les 5 familles NoSQL

```
┌────────────────────────────────────────────────────────────┐
│                     NoSQL Landscape                         │
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐ │
│  │  Key-Value   │  │   Document   │  │  Column-Family   │ │
│  │              │  │              │  │                  │ │
│  │  Redis       │  │  MongoDB     │  │  Cassandra       │ │
│  │  Memcached   │  │  CouchDB     │  │  ScyllaDB        │ │
│  │  DynamoDB    │  │  Firestore   │  │  HBase           │ │
│  └──────────────┘  └──────────────┘  └──────────────────┘ │
│                                                             │
│  ┌──────────────┐  ┌──────────────────────────────────────┐│
│  │    Graph     │  │          Time-Series                 ││
│  │              │  │                                      ││
│  │  Neo4j       │  │  TimescaleDB (extension PG)          ││
│  │  ArangoDB    │  │  InfluxDB                            ││
│  │  Amazon      │  │  Prometheus (monitoring)              ││
│  │  Neptune     │  │  ClickHouse                          ││
│  └──────────────┘  └──────────────────────────────────────┘│
└────────────────────────────────────────────────────────────┘
```

### 2. Tableau comparatif détaillé

| Famille | Modèle | Forces | Faiblesses | Quand utiliser |
|---|---|---|---|---|
| **Key-Value** | `key → value` (blob) | Latence <1ms, scaling trivial | Pas de requête sur les valeurs | Cache, sessions, queues |
| **Document** | `key → JSON document` | Schema flexible, requêtes riches | Pas de JOIN, denormalisation | Catalogue, CMS, config |
| **Column-Family** | `row key → colonnes` | Écriture massive, distribution | Requetes limitees, pas d'agregats complexes | IoT, logs, analytics |
| **Graph** | `nodes + edges` | Traversals performants | Scaling horizontal difficile | Social network, recommandations, fraud détection |
| **Time-Series** | `timestamp → mesures` | Agregation temporelle ultra rapide | Pas de transactions complexes | Monitoring, metriques, analytics temps réel |

### 3. Quand NE PAS utiliser NoSQL

| Situation | Pourquoi rester en relationnel |
|---|---|
| Relations complexes (JOIN) | Le SQL est concu pour ça — MongoDB ne sait pas faire de JOIN |
| Transactions ACID multi-tables | PostgreSQL garantit l'atomicite — MongoDB a des transactions limitees |
| Schema stable et bien connu | La normalisation évité la duplication |
| Équipe petite (< 5 devs) | Ajouter une DB = plus de complexité ops |
| Données < 10M rows | PostgreSQL géré ça sans problème |

**Regle d'or** : PostgreSQL est la bonne réponse par defaut. Introduire du NoSQL seulement quand un besoin spécifique le justifie et que PostgreSQL ne le couvre pas bien.

### 4. Polyglot persistence

L'idee : chaque sous-système utilise la base la plus adaptee a son problème.

```
┌──────────────────────────────────────────────────────────┐
│                     ShopArch                              │
│                                                           │
│  ┌─────────────┐  Commandes, utilisateurs, catalogue     │
│  │ PostgreSQL  │  → Transactions ACID, relations, JOINS   │
│  └─────────────┘                                          │
│                                                           │
│  ┌─────────────┐  Sessions, cache, paniers temporaires    │
│  │   Redis     │  → Latence <1ms, TTL, pub/sub            │
│  └─────────────┘                                          │
│                                                           │
│  ┌──────────────┐  Recherche full-text, facettes          │
│  │Elasticsearch │  → BM25, fuzzy, suggestions             │
│  └──────────────┘                                          │
│                                                           │
│  ┌─────────────┐  Metriques, monitoring, analytics        │
│  │ TimescaleDB │  → Agregation temporelle, retention       │
│  └─────────────┘                                          │
│                                                           │
│  ┌─────────────┐  Fichiers, images, documents             │
│  │    S3       │  → Object storage, CDN-friendly           │
│  └─────────────┘                                          │
└──────────────────────────────────────────────────────────┘
```

**Cout du polyglot** : chaque base supplementaire = monitoring, backup, expertise. Une équipe de 4 ne devrait pas gérer 5 bases différentes.

### 5. Decision framework

```
Ai-je besoin de...

  Relations complexes (JOIN, FK) ?
    → OUI → PostgreSQL
    → NON ↓

  Latence < 1ms, acces par cle ?
    → OUI → Redis
    → NON ↓

  Recherche full-text, facettes ?
    → OUI → Elasticsearch / PostgreSQL FTS
    → NON ↓

  Ecriture massive (>100K/s) ?
    → OUI → Cassandra / Kafka
    → NON ↓

  Relations = la donnee principale ?
    → OUI → Neo4j
    → NON ↓

  Metriques temporelles ?
    → OUI → TimescaleDB / InfluxDB
    → NON ↓

  Documents JSON imbriques, schema variable ?
    → OUI → MongoDB
    → NON → PostgreSQL (defaut)
```

---

## Pratique

### Redis pour les sessions et le panier

```typescript
@Injectable()
export class CartRedisRepository {
  private readonly PREFIX = 'shop:cart';
  private readonly TTL = 7 * 24 * 60 * 60; // 7 jours

  constructor(private readonly redis: Redis) {}

  async getCart(userId: string): Promise<Cart | null> {
    const data = await this.redis.get(`${this.PREFIX}:${userId}`);
    return data ? JSON.parse(data) : null;
  }

  async saveCart(userId: string, cart: Cart): Promise<void> {
    await this.redis.set(
      `${this.PREFIX}:${userId}`,
      JSON.stringify(cart),
      'EX', this.TTL,
    );
  }

  async deleteCart(userId: string): Promise<void> {
    await this.redis.del(`${this.PREFIX}:${userId}`);
  }
}
```

### Decision matrix pour ShopArch

```typescript
// Matrice de decision pour notre fil rouge e-commerce
const storeDecisions = {
  'products':       { store: 'PostgreSQL', reason: 'ACID, relations (category FK), index GIN FTS' },
  'orders':         { store: 'PostgreSQL', reason: 'Transactions ACID, FSM, historique' },
  'users':          { store: 'PostgreSQL', reason: 'ACID, auth, RBAC' },
  'cart':           { store: 'Redis',      reason: 'Temporaire, latence <1ms, TTL 7 jours' },
  'sessions':       { store: 'Redis',      reason: 'Ephemere, latence <1ms, TTL 30 min' },
  'search-index':   { store: 'PG FTS',     reason: 'Natif PG (v1), upgrade Elasticsearch (v2)' },
  'product-cache':  { store: 'Redis',      reason: 'Cache-aside, TTL 5 min' },
  'media-files':    { store: 'S3',         reason: 'Object storage, CDN, presigned URLs' },
  'metrics':        { store: 'Prometheus', reason: 'Time-series, scraping, alerting' },
  'logs':           { store: 'Loki',       reason: 'Agregation, correlation ID' },
};
```

### MongoDB document example (pour référence)

```typescript
// Document MongoDB — pas de normalisation, tout est imbrique
// Utile pour un CMS headless ou le schema change souvent
const productDocument = {
  _id: ObjectId('507f1f77bcf86cd799439011'),
  name: 'T-shirt Bio',
  slug: 't-shirt-bio',
  description: { fr: 'Coton bio certifie', en: 'Certified organic cotton' },
  price: { amount: 2999, currency: 'EUR' },
  category: {
    _id: ObjectId('507f1f77bcf86cd799439012'),
    name: 'Vetements',
    // Imbrique ! Pas de JOIN necessaire
  },
  attributes: [
    { key: 'size', values: ['S', 'M', 'L', 'XL'] },
    { key: 'color', values: ['white', 'black', 'navy'] },
    // Schema flexible — chaque produit peut avoir des attributs differents
  ],
  images: [
    { url: 'https://cdn.shop.com/img1.webp', alt: 'T-shirt front' },
    { url: 'https://cdn.shop.com/img2.webp', alt: 'T-shirt back' },
  ],
  stock: 142,
  status: 'published',
  createdAt: ISODate('2024-03-15T10:30:00Z'),
};
// Avantage : une seule requete ramene TOUT le produit
// Inconvenient : si "category.name" change, il faut updater TOUS les produits de cette categorie
```

---

## Résumé

1. **5 familles NoSQL** : Key-Value, Document, Column-Family, Graph, Time-Series — chacune a son cas d'usage
2. **PostgreSQL est le defaut** — ne pas ajouter du NoSQL "au cas où", seulement quand un besoin spécifique le justifie
3. **Polyglot persistence** = chaque problème utilise le store le plus adapte (PG + Redis + S3 + Elasticsearch)
4. **Cout du polyglot** : chaque base supplementaire = monitoring, backup, expertise — une équipe de 4 ne peut pas gérer 5 bases
5. **Redis pour les données ephemeres** (sessions, panier, cache), **PostgreSQL pour les données métier** (produits, commandes, utilisateurs)

---

> **Prochain cours** : [Cours 32 — Search Architecture](./06-search-architecture.md) — ou comment architecturer un moteur de recherche performant.

---

> **Lien fil rouge — ShopArch**
>
> - Identifie ou ShopArch bénéficierait de polyglot persistence (Redis pour le cache, ES pour la recherche)
> - Documente la stratégie de persistance par Bounded Context
> - Exercice(s) associé(s) : `exercices/19-polyglot-persistence/`
> - Checkpoint : Module 04, critère 3
