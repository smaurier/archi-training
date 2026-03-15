# Cours 45 — GraphQL & gRPC

> **Objectif** : Comprendre GraphQL (schema, resolvers, N+1 avec DataLoader, subscriptions, persisted queries, sécurité depth/cost), gRPC (Protocol Buffers, streaming, code génération), et savoir quand choisir REST vs GraphQL vs gRPC.

---

## Rappel du cours précédent

<details>
<summary>1. Quelle est la différence entre la pagination offset et cursor, et quand utiliser chacune ?</summary>

**Offset** (`?page=3&limit=20`) est simple mais fragile : si des éléments sont inseres entre deux pages, on voit des doublons, et la performance degrade lineairement avec l'offset (la BDD scanne offset+limit lignes). **Cursor** (`?after=2026-01-15T10:30:00Z&limit=20`) est stable (pas de doublons) et performant en O(limit) constant. Utiliser offset pour les tables admin/back-office (besoin de "page 7"), cursor pour les API publiques et le scroll infini.
</details>

<details>
<summary>2. Que signifie le header Vary et pourquoi ne jamais mettre `Vary: Cookie` sur un CDN ?</summary>

Le header `Vary` indique aux caches intermédiaires (CDN, proxies) quels headers de requête influencent la réponse. Par exemple, `Vary: Accept-Language` signifie qu'il y à une version cachee par langue. `Vary: Cookie` signifie que chaque valeur de cookie produit une réponse différente — or chaque utilisateur à un cookie unique, donc le CDN ne peut jamais servir une réponse cachee à un autre utilisateur. Le taux de cache hit tombe a 0%.
</details>

---

## Analogie — Le courrier postal, la liste de courses et le talkie-walkie

Trois facons de communiquer avec un fournisseur :

- **REST = courrier postal** : tu envoies une lettre avec une demandé précisé ("envoyez-moi le catalogue produits page 3"). Le fournisseur repond avec exactement ce que la lettre demandé, dans un format standardise. Simple, fiable, mais tu ne peux demander qu'une chose par lettre (un endpoint = une ressource). Si tu veux 5 informations différentes, tu envoies 5 lettres.
- **GraphQL = liste de courses** : tu envoies UNE seule lettre avec une liste précisé : "je veux le nom et le prix du produit 42, les 3 derniers avis, et l'adresse de l'entrepot le plus proche". Le fournisseur repond en un seul envoi, avec exactement ce que tu as demandé — ni plus, ni moins. Puissant, mais le fournisseur doit lire et interpréter ta liste (cout CPU).
- **gRPC = talkie-walkie** : communication instantanee, en continu, binaire. Tu appuies sur le bouton, tu parles, l'autre repond immédiatement. Aucune fioriture — juste des données brutes, ultra-rapides. Ideal entre collegues (services internes), incomprehensible pour un passant (pas lisible par un humain).

---

## Théorie

### 1. GraphQL — schema-first

Le schema définit le contrat entre client et serveur :

```graphql
# Schema GraphQL
type Article {
  id: ID!
  title: String!
  slug: String!
  status: ArticleStatus!
  author: User!            # Relation → resolution a la demande
  tags: [Tag!]!
  comments(first: Int = 10): CommentConnection!
  publishedAt: DateTime
  createdAt: DateTime!
}

type User {
  id: ID!
  name: String!
  email: String!
  articles(first: Int = 10): ArticleConnection!
}

enum ArticleStatus {
  DRAFT
  PUBLISHED
  ARCHIVED
}

type Query {
  article(id: ID!): Article
  articles(
    first: Int = 20
    after: String
    status: ArticleStatus
  ): ArticleConnection!
}

type Mutation {
  createArticle(input: CreateArticleInput!): Article!
  publishArticle(id: ID!): Article!
}

type Subscription {
  articlePublished: Article!
  commentAdded(articleId: ID!): Comment!
}
```

### 2. Le problème N+1 et DataLoader

```
Requete GraphQL :                    Sans DataLoader :
                                     ──────────────────
{                                    SELECT * FROM articles LIMIT 20  (1 requete)
  articles(first: 20) {
    title                            Pour chaque article :
    author {                           SELECT * FROM users WHERE id = ?
      name                             → 20 requetes supplementaires !
    }
  }                                  Total : 21 requetes SQL
}

                                     Avec DataLoader :
                                     ──────────────────
                                     SELECT * FROM articles LIMIT 20  (1 requete)
                                     SELECT * FROM users WHERE id IN (?, ?, ...)
                                     → 1 requete batchee pour TOUS les auteurs
                                     Total : 2 requetes SQL
```

| Concept | Description |
|---|---|
| **N+1** | 1 requête pour la collection + N requêtes pour chaque relation |
| **DataLoader** | Collecte les IDs demandes dans un même tick, puis fait 1 requête batchee |
| **Batching** | Regrouper les appels individuels en un seul appel |
| **Caching** | DataLoader cache aussi par ID dans la même requête (pas cross-request) |

### 3. Persisted queries

Au lieu d'envoyer la requête GraphQL complete (potentiellement longue), on envoie un hash :

```
Normal (POST body = 2KB de query) :
{ "query": "{ articles { title author { name } comments { ... } } }" }

Persisted (POST body = 64 bytes) :
{ "extensions": { "persistedQuery": { "sha256Hash": "abc123...", "version": 1 } } }
```

| Avantage | Description |
|---|---|
| **Taille requête** | Un hash SHA256 au lieu de la requête complete |
| **Sécurité** | Seules les queries enregistrees sont executees — bloque les queries arbitraires |
| **Cache CDN** | Le hash est utilisable comme clef de cache GET |

### 4. Sécurité GraphQL — depth limiting et cost analysis

GraphQL est vulnerable aux requêtes malicieuses :

```graphql
# Requete malicieuse — profondeur infinie
{
  article(id: "1") {
    author {
      articles {
        author {
          articles {
            author {
              articles {   # ... recursion infinie
              }
            }
          }
        }
      }
    }
  }
}
```

| Protection | Mécanisme | Valeur recommandee |
|---|---|---|
| **Depth limiting** | Limiter la profondeur de la requête | Max 7 niveaux |
| **Cost analysis** | Chaque champ à un cout, la requête totale est plafonnee | Max 1000 points |
| **Rate limiting** | Limiter le nombre de requêtes par IP/token | 100/min |
| **Timeout** | Avorter la résolution après un delai | 10s |
| **Persisted queries only** | En production, interdire les queries ad-hoc | Obligatoire en production |

```
Calcul de cout :

  articles(first: 50) {       # 50 × 1 = 50
    title                      # 50 × 0 = 0  (scalaire gratuit)
    author {                   # 50 × 1 = 50
      name                     # 50 × 0 = 0
      articles(first: 10) {   # 50 × 10 × 1 = 500
        title                  # 500 × 0 = 0
      }
    }
  }
  ───────────────────────────────
  Total : 600 points → OK (< 1000)
```

### 5. gRPC — Protocol Buffers et streaming

gRPC utilise Protocol Buffers (protobuf) pour la serialisation binaire et HTTP/2 pour le transport :

```protobuf
// article.proto
syntax = "proto3";

package cms;

service ArticleService {
  // Unary — un appel, une reponse
  rpc GetArticle(GetArticleRequest) returns (Article);

  // Server streaming — un appel, flux de reponses
  rpc ListArticles(ListArticlesRequest) returns (stream Article);

  // Client streaming — flux de requetes, une reponse
  rpc BulkImport(stream ImportArticleRequest) returns (ImportResult);

  // Bidirectional streaming — flux dans les deux sens
  rpc SyncArticles(stream SyncRequest) returns (stream SyncResponse);
}

message Article {
  string id = 1;
  string title = 2;
  string slug = 3;
  ArticleStatus status = 4;
  string author_id = 5;
  int64 created_at_ms = 6;
}

enum ArticleStatus {
  DRAFT = 0;
  PUBLISHED = 1;
  ARCHIVED = 2;
}

message GetArticleRequest {
  string id = 1;
}

message ListArticlesRequest {
  int32 limit = 1;
  string cursor = 2;
}

message ImportResult {
  int32 imported_count = 1;
  int32 error_count = 2;
  repeated string errors = 3;
}
```

| Type de call | Client | Serveur | Cas d'usage |
|---|---|---|---|
| **Unary** | 1 message | 1 message | CRUD classique |
| **Server stream** | 1 message | N messages | Liste longue, logs, events |
| **Client stream** | N messages | 1 message | Upload, bulk import |
| **Bidirectional** | N messages | N messages | Sync, chat, collaboration |

### 6. gRPC vs REST vs GraphQL — quand utiliser quoi

```
                  Performance
                      ^
                      │
              gRPC ●  │
                      │
                      │       ● GraphQL
                      │
              REST ●  │
                      │
                      └────────────────────> Flexibilite client
```

| Critère | REST | GraphQL | gRPC |
|---|---|---|---|
| **Format** | JSON (texte) | JSON (texte) | Protobuf (binaire) |
| **Transport** | HTTP/1.1 ou 2 | HTTP/1.1 ou 2 | HTTP/2 obligatoire |
| **Découverte** | OpenAPI/Swagger | Schema introspection | `.proto` file |
| **Overhead** | Moyen | Moyen | Très faible |
| **Browser support** | Natif | Natif | gRPC-Web (proxy) |
| **Cas ideal** | API publique, CRUD | Front-end avec besoins varies | Inter-services, microservices |
| **Streaming** | SSE / WebSocket (hors bande) | Subscriptions (WebSocket) | Natif (4 types) |
| **Courbe d'apprentissage** | Faible | Moyenne | Elevee |

**Regle de decision :**
- **REST** : API publique, CRUD simple, documentation OpenAPI, compatible partout
- **GraphQL** : front-end avec des ecrans complexes (dashboard), besoin de flexibilité (mobile vs desktop)
- **gRPC** : communication inter-services, performance critique, streaming natif

---

## Pratique

### Resolvers GraphQL avec DataLoader (NestJS)

```typescript
// article.resolver.ts
import { Resolver, Query, Args, ResolveField, Parent, Int } from '@nestjs/graphql';
import * as DataLoader from 'dataloader';

@Resolver(() => ArticleType)
export class ArticleResolver {
  // DataLoader cree par requete (scope request)
  private authorLoader: DataLoader<string, User>;

  constructor(
    private readonly articleService: ArticleService,
    private readonly userService: UserService,
  ) {
    // Batching : collecte tous les authorIds dans le meme tick
    this.authorLoader = new DataLoader<string, User>(
      async (authorIds: readonly string[]) => {
        const users = await this.userService.findByIds([...authorIds]);
        const userMap = new Map(users.map((u) => [u.id, u]));
        return authorIds.map((id) => userMap.get(id)!);
      },
    );
  }

  @Query(() => ArticleConnection)
  async articles(
    @Args('first', { type: () => Int, defaultValue: 20 }) first: number,
    @Args('after', { nullable: true }) after?: string,
    @Args('status', { nullable: true }) status?: string,
  ): Promise<ArticleConnection> {
    const safeFirst = Math.min(first, 24); // Cap serveur
    return this.articleService.findWithCursor(after, safeFirst, status);
  }

  @Query(() => ArticleType, { nullable: true })
  async article(@Args('id') id: string): Promise<Article | null> {
    return this.articleService.findById(id);
  }

  // Resolution du champ author — utilise le DataLoader
  @ResolveField(() => UserType)
  async author(@Parent() article: Article): Promise<User> {
    return this.authorLoader.load(article.authorId);
    // Si 20 articles sont resolus dans le meme tick,
    // DataLoader fait 1 seule requete SQL avec WHERE id IN (...)
  }
}
```

### Depth limiting et cost analysis middleware

```typescript
// graphql-security.plugin.ts
import { ApolloServerPlugin } from '@apollo/server';
import { depthLimit } from 'graphql-depth-limit';
import { createComplexityRule, simpleEstimator, fieldExtensionsEstimator } from 'graphql-query-complexity';

export function createSecurityPlugin(schema: GraphQLSchema): ApolloServerPlugin {
  return {
    async requestDidStart() {
      return {
        async didResolveOperation(context) {
          // Depth limiting — max 7 niveaux
          const depthErrors = depthLimit(7)(context.document);
          if (depthErrors.length > 0) {
            throw new Error(`Query too deep: max depth is 7, got ${depthErrors[0].message}`);
          }

          // Cost analysis — max 1000 points
          const complexity = getComplexity({
            schema,
            query: context.document,
            variables: context.request.variables,
            estimators: [
              fieldExtensionsEstimator(),
              simpleEstimator({ defaultComplexity: 1 }),
            ],
          });

          if (complexity > 1000) {
            throw new Error(
              `Query too complex: cost ${complexity} exceeds maximum 1000`,
            );
          }
        },
      };
    },
  };
}
```

### Client gRPC dans NestJS

```typescript
// grpc-client.module.ts
import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { join } from 'path';

@Module({
  imports: [
    ClientsModule.register([
      {
        name: 'ARTICLE_PACKAGE',
        transport: Transport.GRPC,
        options: {
          package: 'cms',
          protoPath: join(__dirname, './protos/article.proto'),
          url: 'article-service:5000',
          channelOptions: {
            'grpc.keepalive_time_ms': 30_000,
            'grpc.keepalive_timeout_ms': 5_000,
          },
        },
      },
    ]),
  ],
})
export class GrpcClientModule {}

// article-grpc.service.ts
import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { ClientGrpc } from '@nestjs/microservices';
import { Observable, lastValueFrom, toArray } from 'rxjs';

interface ArticleGrpcService {
  getArticle(data: { id: string }): Observable<Article>;
  listArticles(data: { limit: number; cursor: string }): Observable<Article>;
}

@Injectable()
export class ArticleGrpcClient implements OnModuleInit {
  private articleService: ArticleGrpcService;

  constructor(@Inject('ARTICLE_PACKAGE') private client: ClientGrpc) {}

  onModuleInit() {
    this.articleService = this.client.getService<ArticleGrpcService>('ArticleService');
  }

  // Unary call
  async getArticle(id: string): Promise<Article> {
    return lastValueFrom(this.articleService.getArticle({ id }));
  }

  // Server streaming — consommer le flux complet
  async listAllArticles(limit: number, cursor: string): Promise<Article[]> {
    return lastValueFrom(
      this.articleService.listArticles({ limit, cursor }).pipe(toArray()),
    );
  }
}
```

### Subscription GraphQL (WebSocket)

```typescript
// article.resolver.ts — Subscription
import { Resolver, Subscription } from '@nestjs/graphql';
import { PubSub } from 'graphql-subscriptions';

const pubSub = new PubSub(); // En production : RedisPubSub

@Resolver()
export class ArticleSubscriptionResolver {
  @Subscription(() => ArticleType, {
    filter: (payload, variables) =>
      // Filtrer par tenant si necessaire
      !variables.tenantId || payload.articlePublished.tenantId === variables.tenantId,
  })
  articlePublished() {
    return pubSub.asyncIterableIterator('ARTICLE_PUBLISHED');
  }
}

// Dans le service, apres publication :
async publishArticle(id: string): Promise<Article> {
  const article = await this.articleRepo.findById(id);
  article.publish();
  await this.articleRepo.save(article);

  // Notifier les abonnes
  pubSub.publish('ARTICLE_PUBLISHED', { articlePublished: article });
  return article;
}
```

---

## Résumé

1. **GraphQL** permet au client de demander exactement les champs dont il a besoin en une seule requête — ideal pour les dashboards et les applications mobiles
2. **DataLoader** resout le problème N+1 en batchant les resolutions de relations dans un même tick — passer de N+1 requêtes a 2 requêtes
3. **Sécurité GraphQL** obligatoire : depth limiting (max 7), cost analysis (max 1000 points), persisted queries en production, rate limiting par IP/token
4. **gRPC** avec Protocol Buffers offre une serialisation binaire ultra-performante et 4 types de streaming natif — ideal pour la communication inter-services
5. **Choix** : REST pour les API publiques/CRUD, GraphQL pour la flexibilité front-end, gRPC pour la performance inter-services — les trois peuvent coexister dans le même système

---

> **Prochain cours** : [Cours 46 — WebSockets & Real-time](./04-websockets-realtime.md) — ou comment implémenter la communication temps réel avec WebSocket, Socket.IO, SSE, et scaler les connexions avec Redis pub/sub.

---

> **Lien fil rouge — ShopArch**
>
> - Évalue si ShopArch bénéficierait d'un endpoint GraphQL pour le back-office admin
> - Compare les trade-offs REST vs GraphQL pour le dashboard admin (N+1 requêtes, flexibilité)
> - Exercice(s) associé(s) : `exercices/12-api-rest-nestjs/`
> - Checkpoint : Module 06, critère 3
