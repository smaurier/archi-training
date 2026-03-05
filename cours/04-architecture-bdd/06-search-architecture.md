# Cours 32 — Search Architecture

> **Objectif** : Architecturer un moteur de recherche complet — du PostgreSQL full-text search a Elasticsearch, en passant par une couche d'abstraction (SearchProvider), le search semantique/vector, et les patterns front-end (debounce, cache).

---

## Rappel du cours précédent

<details>
<summary>1. Qu'est-ce que le polyglot persistence et quel est son principal inconvenient ?</summary>

C'est l'approche ou chaque sous-système utilise la base de données la plus adaptee (PostgreSQL pour le métier, Redis pour le cache, Elasticsearch pour la recherche). L'inconvenient principal est le **cout operationnel** : chaque base supplementaire nécessité monitoring, backup, expertise et maintenance — une charge non negligeable pour une petite équipe.
</details>

<details>
<summary>2. Quand PostgreSQL est-il suffisant et quand faut-il envisager du NoSQL ?</summary>

PostgreSQL suffit pour 90% des cas : relations complexes, transactions ACID, données < 10M rows, équipe petite. On envisage du NoSQL quand un besoin spécifique l'exige : latence < 1ms (Redis), recherche avancee (Elasticsearch), écriture massive > 100K/s (Cassandra), ou relations = donnée principale (Neo4j).
</details>

---

## Analogie — La bibliothecaire vs le GPS

- **PostgreSQL ILIKE** = chercher un livre en parcourant chaque etagere. Simple, mais lent quand la bibliotheque grandit.
- **PostgreSQL FTS (tsvector)** = la bibliothecaire avec son index alphabetique. Rapide, comprend les synonymes (stemming), sait classer par pertinence. Limitee aux mots exacts.
- **Elasticsearch** = un système de classement professionnel avec fiches thematiques, tolerant aux fautes de frappe, capable de filtrer par auteur/date/genre simultanement.
- **Vector search** = un GPS semantique qui comprend le SENS de ta recherche. Tu cherches "vetement chaud pour l'hiver" et il trouve "doudoune" meme si le mot n'apparait pas.

---

## Théorie

### 1. Les 3 niveaux de recherche

| Niveau | Technologie | Pertinence | Complexite | Cas d'usage |
|---|---|---|---|---|
| **Basique** | `ILIKE '%query%'` | Aucun ranking | Zero | Prototype, < 10K rows |
| **Intermediaire** | PostgreSQL FTS | Stemming, ranking (`ts_rank`) | Faible (natif PG) | 10K-500K rows, équipe petite |
| **Avance** | Elasticsearch | BM25, fuzzy, facettes, suggestions | Elevee (cluster dédié) | > 500K rows, UX riche |
| **Semantique** | Vector search | Comprend le sens, pas les mots | Tres élevée | Recherche "intelligente", RAG |

### 2. PostgreSQL Full-Text Search en detail

```sql
-- Recherche basique avec ranking
SELECT
  id,
  name,
  ts_rank(
    search_vector,
    plainto_tsquery('french', 'chaussure running')
  ) AS rank
FROM products
WHERE search_vector @@ plainto_tsquery('french', 'chaussure running')
ORDER BY rank DESC
LIMIT 20;
```

**Weights** pour le boosting :
- `A` (titre) : poids 1.0
- `B` (description) : poids 0.4
- `C` (categorie) : poids 0.2
- `D` (tags) : poids 0.1

```sql
-- Configuration avec weights
search_vector :=
  setweight(to_tsvector('french', name), 'A') ||
  setweight(to_tsvector('french', description), 'B') ||
  setweight(to_tsvector('french', category_name), 'C');
```

Limites de PostgreSQL FTS :
- Pas de fuzzy search native (typo tolerance)
- Pas de facettes (filtres dynamiques)
- Pas de suggestions (autocomplete avancee)
- Pas de synonymes configurables facilement

### 3. Elasticsearch

```
┌──────────────┐
│  Application │
│    (API)     │
└──────┬───────┘
       │ Sync (event-driven ou CDC)
       ▼
┌──────────────────────────────────────┐
│         Elasticsearch Cluster         │
│                                       │
│  Index: cms_tenant1_site1             │
│  ┌─────────────────────────────────┐ │
│  │ Mapping:                        │ │
│  │   title:    text (boost: 3)     │ │
│  │   body:     text (boost: 1)     │ │
│  │   category: keyword (facet)     │ │
│  │   price:    float (range)       │ │
│  │   status:   keyword (filter)    │ │
│  │   tenant:   keyword (routing)   │ │
│  └─────────────────────────────────┘ │
│                                       │
│  Scoring: BM25 (TF-IDF improved)     │
│  Features: fuzzy, autocomplete,       │
│            facets, highlighting        │
└──────────────────────────────────────┘
```

**Per-tenant indices** : `cms_{tenant}_{site}` — isolation des données au niveau de l'index.

**RBAC au query time** : ajouter un filtre `status: 'published'` pour les utilisateurs anonymes, ou laisser voir les `draft` pour les editeurs.

### 4. Search abstraction layer

L'interface `SearchProvider` permet de swapper l'implémentation sans toucher au reste du code :

```typescript
interface SearchResult<T> {
  items: T[];
  total: number;
  facets?: Record<string, FacetBucket[]>;
  took: number; // Temps de recherche en ms
}

interface FacetBucket {
  key: string;
  count: number;
}

interface SearchQuery {
  text: string;
  filters?: Record<string, string | string[]>;
  facets?: string[];
  page?: number;
  limit?: number;
  sort?: { field: string; order: 'asc' | 'desc' };
}

interface SearchProvider<T> {
  search(query: SearchQuery): Promise<SearchResult<T>>;
  index(id: string, document: T): Promise<void>;
  remove(id: string): Promise<void>;
  reindexAll(): Promise<void>;
}
```

### 5. Vector search et recherche semantique

```
Recherche classique (keyword)          Recherche semantique (vector)
─────────────────────────               ─────────────────────────────
Query: "vetement chaud hiver"           Query: "vetement chaud hiver"
                                                    │
Match: mots exacts                      Embedding: [0.23, -0.87, 0.45, ...]
"vetement" ∩ "chaud" ∩ "hiver"                     │
                                        ANN search (Approximate Nearest Neighbor)
Resultat: "Vetement chaud d'hiver"                  │
Manque: "Doudoune", "Parka"            Resultat: "Doudoune North Face"
                                                  "Parka isolante"
                                                  "Pull en laine merinos"
```

**Reciprocal Rank Fusion (RRF)** : combiner les résultats keyword (BM25) + vector pour le meilleur des deux mondes.

```
Score RRF = 1/(k + rank_bm25) + 1/(k + rank_vector)
avec k = 60 (constante de lissage)
```

### 6. Patterns front-end pour la recherche

| Pattern | Valeur | Pourquoi |
|---|---|---|
| **Debounce** | 300ms | Ne pas envoyer une requête a chaque frappe clavier |
| **Cache Redis** | TTL 5 min | Les memes recherches reviennent souvent |
| **Minimum chars** | 2-3 caracteres | Éviter les recherches trop larges |
| **AbortController** | Cancel previous | Annuler la requête précédente si l'utilisateur tape encore |

---

## Pratique

### PostgreSQL FTS Provider

```typescript
@Injectable()
export class PgFtsProvider implements SearchProvider<Product> {
  constructor(
    @InjectRepository(ProductEntity)
    private readonly repo: Repository<ProductEntity>,
  ) {}

  async search(query: SearchQuery): Promise<SearchResult<Product>> {
    const start = performance.now();
    const tsQuery = `plainto_tsquery('french', $1)`;
    const offset = ((query.page || 1) - 1) * (query.limit || 20);

    const qb = this.repo
      .createQueryBuilder('p')
      .addSelect(`ts_rank(p.search_vector, ${tsQuery})`, 'rank')
      .where(`p.search_vector @@ ${tsQuery}`, [query.text])
      .andWhere('p.status = :status', { status: 'published' });

    // Filtres dynamiques
    if (query.filters?.categoryId) {
      qb.andWhere('p.categoryId = :catId', { catId: query.filters.categoryId });
    }

    const [items, total] = await qb
      .orderBy('rank', 'DESC')
      .skip(offset)
      .take(query.limit || 20)
      .getManyAndCount();

    return {
      items: items.map(this.toDomain),
      total,
      took: Math.round(performance.now() - start),
    };
  }

  async index(id: string, document: Product): Promise<void> {
    // Pas besoin — le trigger PostgreSQL maintient le tsvector
  }

  async remove(id: string): Promise<void> {
    // Pas besoin — suppression dans la table suffit
  }

  async reindexAll(): Promise<void> {
    // Forcer la reconstruction de tous les tsvectors
    await this.repo.query(`
      UPDATE products SET search_vector =
        setweight(to_tsvector('french', COALESCE(name, '')), 'A') ||
        setweight(to_tsvector('french', COALESCE(description, '')), 'B')
    `);
  }
}
```

### Elasticsearch Provider

```typescript
@Injectable()
export class ElasticsearchProvider implements SearchProvider<Product> {
  constructor(
    private readonly elastic: ElasticsearchService,
    private readonly tenantContext: TenantContext,
  ) {}

  private get indexName(): string {
    const { tenantId, siteId } = this.tenantContext.current();
    return `cms_${tenantId}_${siteId}`;
  }

  async search(query: SearchQuery): Promise<SearchResult<Product>> {
    const start = performance.now();

    const body: any = {
      query: {
        bool: {
          must: [
            {
              multi_match: {
                query: query.text,
                fields: ['name^3', 'description', 'category_name^2'],
                fuzziness: 'AUTO', // Typo tolerance
                type: 'best_fields',
              },
            },
          ],
          filter: [
            { term: { status: 'published' } },
          ],
        },
      },
      from: ((query.page || 1) - 1) * (query.limit || 20),
      size: query.limit || 20,
    };

    // Facettes
    if (query.facets?.length) {
      body.aggs = {};
      for (const facet of query.facets) {
        body.aggs[facet] = { terms: { field: facet, size: 20 } };
      }
    }

    // Filtres
    if (query.filters) {
      for (const [key, value] of Object.entries(query.filters)) {
        body.query.bool.filter.push({ term: { [key]: value } });
      }
    }

    const result = await this.elastic.search({
      index: this.indexName,
      body,
    });

    // Transformer les facettes
    const facets: Record<string, FacetBucket[]> = {};
    if (result.aggregations) {
      for (const [key, agg] of Object.entries(result.aggregations)) {
        facets[key] = (agg as any).buckets.map((b: any) => ({
          key: b.key,
          count: b.doc_count,
        }));
      }
    }

    return {
      items: result.hits.hits.map((hit) => hit._source as Product),
      total: (result.hits.total as any).value,
      facets,
      took: Math.round(performance.now() - start),
    };
  }

  async index(id: string, document: Product): Promise<void> {
    await this.elastic.index({
      index: this.indexName,
      id,
      body: document,
    });
  }

  async remove(id: string): Promise<void> {
    await this.elastic.delete({ index: this.indexName, id });
  }

  async reindexAll(): Promise<void> {
    // Bulk indexation de tous les produits
    const products = await this.productRepo.findAll();
    const body = products.flatMap((p) => [
      { index: { _index: this.indexName, _id: p.id } },
      p,
    ]);
    await this.elastic.bulk({ body });
  }
}
```

### Search service avec debounce et cache

```typescript
// Front-end : hook de recherche avec debounce
function useProductSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult<Product> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const debouncedSearch = useMemo(
    () => debounce(async (text: string) => {
      if (text.length < 2) {
        setResults(null);
        return;
      }

      // Annuler la requete precedente
      abortRef.current?.abort();
      abortRef.current = new AbortController();

      const res = await fetch(`/api/search?q=${encodeURIComponent(text)}`, {
        signal: abortRef.current.signal,
      });
      const data = await res.json();
      setResults(data);
    }, 300),
    [],
  );

  useEffect(() => {
    debouncedSearch(query);
    return () => debouncedSearch.cancel();
  }, [query]);

  return { query, setQuery, results };
}
```

---

## Resume

1. **PostgreSQL FTS** (tsvector + GIN) suffit pour 50K-500K produits — zero infra supplementaire, bon ranking
2. **Elasticsearch** pour les besoins avances : fuzzy, facettes, suggestions, boosting — mais cout ops non negligeable
3. **SearchProvider interface** permet de migrer de PG FTS vers Elasticsearch sans toucher au code métier
4. **Vector search** comprend le **sens** (pas les mots) — combine avec BM25 via Reciprocal Rank Fusion
5. **Front-end** : debounce 300ms + AbortController + cache Redis 5min = UX fluide sans surcharger le serveur

---

> **Prochain cours** : [Cours 33 — Component Architecture](../05-architecture-frontend/01-component-architecture.md) — ou comment structurer les composants front-end pour la maintenabilité et la reutilisabilite.

---

> **Lien fil rouge — ShopArch**
>
> - Implémente la recherche full-text produits avec PostgreSQL FTS (tsvector + tsquery)
> - Définis le port `SearchProvider` pour pouvoir migrer vers Elasticsearch plus tard
> - Exercice(s) associé(s) : `exercices/18b-fulltext-search/`, `exercices/20-search-abstraction/`
> - Checkpoint : Module 04, critère 3
