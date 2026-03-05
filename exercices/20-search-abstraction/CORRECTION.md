# Correction — Exercice 20 : Search abstraction layer

## PostgresSearchProvider

```typescript
@Injectable()
export class PostgresSearchProvider implements SearchProvider {
  constructor(private readonly dataSource: DataSource) {}

  async search(index: string, query: SearchQuery): Promise<SearchResult<unknown>> {
    const start = Date.now();
    const config = query.locale === 'en' ? 'english' : 'french';

    let sql = `
      SELECT *, ts_rank(search_vector, plainto_tsquery($1, $2)) AS rank
      FROM ${index}
      WHERE search_vector @@ plainto_tsquery($1, $2)
        AND status = 'active'
    `;
    const params: unknown[] = [config, query.text];
    let paramIdx = 3;

    // Filters
    if (query.filters) {
      for (const [key, value] of Object.entries(query.filters)) {
        sql += ` AND ${key} = $${paramIdx}`;
        params.push(value);
        paramIdx++;
      }
    }

    // Count total
    const countResult = await this.dataSource.query(
      `SELECT COUNT(*) FROM (${sql}) sub`, params,
    );
    const total = parseInt(countResult[0].count);

    // Sort + pagination
    sql += ` ORDER BY rank DESC LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`;
    params.push(query.limit ?? 20, query.offset ?? 0);

    const items = await this.dataSource.query(sql, params);

    return { items, total, took: Date.now() - start };
  }

  async index(index: string, id: string, doc: Record<string, unknown>): Promise<void> {
    // PostgreSQL FTS se met a jour via trigger — rien a faire ici
  }

  async delete(index: string, id: string): Promise<void> {
    await this.dataSource.query(
      `UPDATE ${index} SET status = 'deleted' WHERE id = $1`, [id],
    );
  }
}
```

## ElasticsearchSearchProvider

```typescript
@Injectable()
export class ElasticsearchSearchProvider implements SearchProvider {
  constructor(private readonly esClient: Client) {}

  async search(index: string, query: SearchQuery): Promise<SearchResult<unknown>> {
    const start = Date.now();

    const must: unknown[] = [
      {
        multi_match: {
          query: query.text,
          fields: ['name^3', 'description'],
          type: 'best_fields',
        },
      },
    ];

    if (query.filters) {
      for (const [key, value] of Object.entries(query.filters)) {
        must.push({ term: { [key]: value } });
      }
    }

    const result = await this.esClient.search({
      index,
      body: {
        query: { bool: { must } },
        from: query.offset ?? 0,
        size: query.limit ?? 20,
        sort: query.sort
          ? [{ [query.sort.field]: query.sort.order }]
          : ['_score'],
      },
    });

    return {
      items: result.hits.hits.map((h) => ({ id: h._id, ...h._source })),
      total: (result.hits.total as { value: number }).value,
      took: Date.now() - start,
    };
  }

  async index(index: string, id: string, doc: Record<string, unknown>): Promise<void> {
    await this.esClient.index({ index, id, body: doc });
  }

  async delete(index: string, id: string): Promise<void> {
    await this.esClient.delete({ index, id });
  }
}
```

## Factory module

```typescript
@Module({
  providers: [
    {
      provide: 'SEARCH_PROVIDER',
      useFactory: (config: ConfigService, ds: DataSource, es?: Client) => {
        const provider = config.get('SEARCH_PROVIDER', 'postgres');
        if (provider === 'elasticsearch') {
          return new ElasticsearchSearchProvider(es);
        }
        return new PostgresSearchProvider(ds);
      },
      inject: [ConfigService, DataSource],
    },
  ],
  exports: ['SEARCH_PROVIDER'],
})
export class SearchModule {}
```

## Usage dans le controller

```typescript
@Controller('api/search')
export class SearchController {
  constructor(
    @Inject('SEARCH_PROVIDER') private readonly search: SearchProvider,
  ) {}

  @Get('products')
  async searchProducts(@Query('q') q: string, @Query('locale') locale: string = 'fr') {
    return this.search.search('products', { text: q, locale, limit: 20 });
  }
}
```

## Ce que tu aurais pu oublier

### 1. Coupler le controller a Elasticsearch

```typescript
// FAUX — import direct du client ES
import { Client } from '@elastic/elasticsearch';
const result = await esClient.search({ ... });

// CORRECT — interface injectee
constructor(@Inject('SEARCH_PROVIDER') private search: SearchProvider) {}
```

### 2. Formats de retour différents entre providers

```
FAUX — PostgreSQL retourne des rows, ES retourne des hits
  → Le controller doit gerer les deux formats

CORRECT — les deux providers retournent SearchResult<T>
  → Le controller ne sait pas quel provider est utilise
```

### 3. Oublier l'indexation pour ES

```
FAUX — PostgreSQL se met a jour via trigger, mais ES a besoin d'un appel explicite
  → Si on change de provider, les donnees ne sont pas indexees

CORRECT — appeler search.index() a chaque creation/update
  → Pour PG, c'est un no-op (trigger gere)
  → Pour ES, c'est un appel d'indexation
```
