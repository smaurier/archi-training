# Correction — Exercice 04 : Trade-off analysis

## Étape 1 — Architecture characteristics classees

| -ility | Importance | Justification |
|---|---|---|
| Performance | **1** | Contrainte explicite : < 200ms p95. Non-negociable. |
| Maintenabilite | **1** | Équipe de 4 sans DBA — complexité ops = risque projet |
| Scalabilite | **2** | x10 en 2 ans, mais c'est planifie (pas une urgence) |
| Cout | **2** | Budget modere — Elasticsearch cluster = cout non-negligeable |
| Evolvabilite | **3** | Pas de recherche semantique pour l'instant, mais prevoir |
| Fiabilite | **3** | La recherche peut etre degradee temporairement sans impact critique |

## Étape 2 — Matrice de trade-offs

| Critère | A (ILIKE) | B (FTS PG) | C (Elasticsearch) |
|---|---|---|---|
| Performance 50K | ✓ (~50ms) | ✓✓ (~10ms) | ✓✓ (~5ms) |
| Performance 500K | ✗✗ (~2s full scan) | ✓ (~50ms avec GIN) | ✓✓ (~10ms) |
| Pertinence résultats | ✗ (pas de ranking) | ✓ (ts_rank, stemming) | ✓✓ (BM25, fuzzy, boosting) |
| Complexite implémentation | ✓✓ (1 requête SQL) | ✓ (trigger tsvector, GIN) | ~ (cluster, indexation, sync) |
| Cout operationnel | ✓✓ (zero — déjà en PG) | ✓✓ (zero — déjà en PG) | ✗ (cluster dédié ~100-300€/mois) |
| Courbe apprentissage | ✓✓ (SQL basique) | ✓ (FTS PG à apprendre) | ~ (DSL Elasticsearch, mapping) |
| Evolvabilite | ✗✗ (pas de facettes, pas de fuzzy) | ~ (facettes limitees) | ✓✓ (facettes, suggestions, synonymes, vector) |
| SPOF | ✓✓ (même DB) | ✓✓ (même DB) | ✗ (cluster séparé = point de panne supplementaire) |

## Étape 3 — ADR

```markdown
# ADR-003 : Choix du moteur de recherche produits

## Statut
Accepte

## Contexte
ShopArch doit fournir une recherche produits par nom, description et categorie.
- 50K produits actuellement, objectif 500K en 2 ans
- Equipe de 4 devs back-end, pas de DBA dedie
- Budget infra modere (cloud manage)
- Contrainte de performance : < 200ms p95
- Pas de besoin de recherche semantique a court terme

## Options envisagees

### Option A — PostgreSQL ILIKE
Simple requete `WHERE name ILIKE '%query%'`. Zero complexite ajoutee.
- Avantage : trivial a implementer
- Inconvenient : full table scan a 500K lignes (~2s), pas de ranking de pertinence

### Option B — PostgreSQL Full-Text Search
Colonne `tsvector` maintenue par trigger, index GIN, `plainto_tsquery` + `ts_rank`.
- Avantage : natif PostgreSQL (zero infra supplementaire), bon ranking, performant avec GIN
- Inconvenient : facettes et fuzzy search limites

### Option C — Elasticsearch
Cluster dedie, indexation asynchrone, DSL de recherche avance.
- Avantage : features les plus riches (fuzzy, facettes, suggestions, boosting, vector search)
- Inconvenient : cluster supplementaire (~200€/mois), synchronisation DB→ES, complexite ops

## Decision
**Option B — PostgreSQL Full-Text Search**, avec une architecture qui permet de migrer vers C si necessaire.

### Justification
1. **Performance** : FTS + GIN satisfait le p95 < 200ms jusqu'a 500K produits (mesure estimee ~50ms)
2. **Maintenabilite** : zero infra supplementaire — critique pour une equipe de 4 sans DBA
3. **Cout** : zero cout additionnel (deja dans PostgreSQL)
4. **Risque minimal** : si B ne suffit plus, migration vers C via une interface `SearchProvider`

### Trigger de migration vers C
Migrer vers Elasticsearch SI et SEULEMENT SI :
- Le p95 depasse 150ms (seuil d'alerte a 75% de la cible)
- OU le besoin de facettes/suggestions devient critique (demande product)
- OU le volume depasse 1M produits

## Consequences

### Positives
- Zero cout d'infra supplementaire
- Mise en production rapide (1-2 sprints)
- L'equipe reste sur une stack connue (SQL)

### Negatives
- Facettes de recherche limitees (pas de "filtrer par prix, couleur, taille" natif)
- Typo-tolerance basique (stemming seulement, pas de fuzzy)
- Si migration vers ES necessaire, cout de synchronisation DB→ES

### Risques
- Si la croissance est plus rapide que prevue (>500K avant 2 ans), la migration vers C sera acceleree
- Risque mitige par l'interface `SearchProvider` qui abstrait l'implementation

## Plan d'evolution
1. Implementer derriere une interface `SearchProvider`
2. Monitorer le p95 via SLO Prometheus
3. Quand un trigger est atteint, implementer `ElasticsearchSearchProvider` sans toucher au reste du code
```

## Architecture cible (diagramme)

```
┌─────────────────────────────────────────────────────┐
│                   API (NestJS)                        │
│                                                       │
│  ┌──────────────────────────────────────────────┐    │
│  │          ProductSearchService                 │    │
│  │  constructor(searchProvider: SearchProvider)   │    │
│  └─────────────────┬────────────────────────────┘    │
│                    │ interface                         │
│         ┌──────────┴──────────┐                      │
│         │                     │                       │
│  ┌──────┴───────┐   ┌────────┴──────────┐           │
│  │ PgFtsProvider │   │ ElasticProvider   │           │
│  │  (actuel)     │   │  (futur, si       │           │
│  │              │   │   trigger atteint) │           │
│  └──────┬───────┘   └────────┬──────────┘           │
│         │                     │                       │
└─────────┼─────────────────────┼───────────────────────┘
          │                     │
    ┌─────┴──────┐      ┌──────┴──────────┐
    │ PostgreSQL │      │ Elasticsearch   │
    │ tsvector   │      │ (futur)         │
    │ + GIN      │      │                 │
    └────────────┘      └─────────────────┘
```

## Fitness functions

```typescript
// fitness/search-performance.test.ts
// Execute en CI nightly avec des donnees realistes

test('Search p95 < 200ms sur 100K produits', async () => {
  const times: number[] = [];
  for (let i = 0; i < 100; i++) {
    const start = performance.now();
    await searchProvider.search(randomQuery());
    times.push(performance.now() - start);
  }
  times.sort((a, b) => a - b);
  const p95 = times[Math.floor(times.length * 0.95)];
  expect(p95).toBeLessThan(200);
});

test('Index de recherche < 5GB', async () => {
  const result = await db.query(`
    SELECT pg_total_relation_size('products_search_idx') as size
  `);
  const sizeGB = result.rows[0].size / (1024 * 1024 * 1024);
  expect(sizeGB).toBeLessThan(5);
});
```

## Ce que tu aurais pu oublier

### 1. Ne pas prevoir l'interface d'abstraction

Si tu recommandes B sans `SearchProvider` interface, la migration vers C coutera beaucoup plus cher. L'abstraction ne coute quasi rien a mettre en place (1h de travail) et divise par 10 le cout de migration futur.

### 2. Ignorer le cout operationnel d'Elasticsearch

Un cluster Elasticsearch requiert : monitoring, backup, mise a jour, synchronisation DB→ES, gestion des mappings. Pour une équipe de 4, c'est un poids significatif.

### 3. Surestimer les besoins actuels

"On aura peut-etre besoin de facettes un jour" n'est pas un argument suffisant pour ajouter un cluster ES aujourd'hui. YAGNI — decide au dernier moment responsable.

### 4. Ne pas définir de trigger de migration

"On migrera quand ça sera lent" n'est pas un plan. Un trigger mesurable (p95 > 150ms, volume > 1M) permet une decision objective.
