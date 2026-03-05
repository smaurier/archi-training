# Cours 19 — API Design REST

**Objectif :** Maîtriser les conventions REST, implémenter le verrouillage optimiste via ETag/If-Match, structurer la serialisation avec des groupes (entity:read, entity:write), formater les erreurs selon RFC 7807, concevoir un flux d'upload via presigned URL S3, et configurer la pagination serveur avec un cap raisonnable.

---

## Rappel du cours précédent

> Cours 18 — Repositories & Specifications.

**Question 1 — Quelle est la différence entre le Repository pattern et le DAO pattern ?**

<details>
<summary>Réponse</summary>

Le Repository travaille au niveau de l'Agregat métier : son interface est définie dans le domaine avec des méthodes orientees métier (`findPublishedByTenant`). Il ne connait pas la base de données. Le DAO (Data Access Object) est oriente infrastructure : ses méthodes refletent les opérations SQL (`findByColumn`, `insert`, `update`). Le DAO connait les colonnes et les tables. Le Repository offre une meilleure testabilité (on peut le remplacer par un InMemory) et respecte la Dependency Rule (les dépendances pointent vers l'interieur).

</details>

**Question 2 — Comment le Spécification pattern resout-il l'explosion combinatoire des méthodes de recherche ?**

<details>
<summary>Réponse</summary>

Au lieu de créer une méthode par combinaison de critères (`findByStatusAndTag`, `findByStatusAndAuthor`, `findByStatusAndTagAndAuthor`...), le Spécification pattern encapsule chaque critère dans un objet independant (`PublishedSpec`, `HasTagSpec`, `AuthoredBySpec`). Ces spécifications sont composables via `and()`, `or()`, `not()`. On passe la spécification composee au Repository qui l'applique au query builder. Le nombre de classes croit lineairement avec les critères, pas exponentiellement.

</details>

---

## Analogie

**Le menu du restaurant (l'API) vs la cuisine (l'implémentation).**

Dans un restaurant, le menu est le contrat entre le client et le chef. Le client ne dit pas "faites-moi griller un filet de boeuf a 56 degres pendant 12 minutes" — il commande "entrecote, cuisson a point". Le menu définit ce qui est disponible, comment le commander (numéro de plat), et ce qu'on recevra en retour. Le client n'a pas besoin de connaitre la cuisine, les fournisseurs ou le nombre de casseroles.

L'API REST est ce menu : elle expose des ressources (plats) via des URL stables, des verbes HTTP (commander, modifier, annuler), et des codes de réponse (plat servi, rupture de stock, commande invalide). La cuisine derriere peut changer — nouveau four, nouveau chef, nouvelle recette — sans que le menu change. Le client (front-end) ne subit aucune modification.

---

## Théorie

### 1. Conventions REST — Verbes, Noms, Codes

L'API REST utilise les verbes HTTP pour les actions et les noms (au pluriel) pour les ressources.

| Verbe | URL | Action | Code succes | Corps réponse |
|---|---|---|---|---|
| GET | `/articles` | Lister | 200 | Collection paginee |
| GET | `/articles/:id` | Detail | 200 | Ressource unique |
| POST | `/articles` | Créer | 201 + Location header | Ressource créée |
| PUT | `/articles/:id` | Remplacer | 200 | Ressource mise a jour |
| PATCH | `/articles/:id` | Modifier partiellement | 200 | Ressource mise a jour |
| DELETE | `/articles/:id` | Supprimer | 204 | Vide |

**Regles fondamentales :**
- Les URL sont des **noms au pluriel** : `/articles`, pas `/article` ni `/getArticles`
- Les relations s'imbriquent : `/articles/:id/comments` (les commentaires d'un article)
- Pas d'imbrication au-dela de 2 niveaux : `/tenants/:id/articles/:id/comments/:id/replies` est trop profond
- Les actions non-CRUD utilisent un sous-ressource : `POST /articles/:id/publish`

### 2. ETag & Optimistic Locking (If-Match / 412)

L'ETag est un hash ou un numéro de version represantant l'état actuel d'une ressource. Il permet le verrouillage optimiste sans bloquer les lectures.

```
FLUX ETAG — EDITION CONCURRENTE

  Alice                   Serveur                    Bob
    │                        │                        │
    │  GET /articles/42      │                        │
    │ ──────────────────>    │                        │
    │  200 OK                │                        │
    │  ETag: "v3"            │                        │
    │ <──────────────────    │                        │
    │                        │   GET /articles/42     │
    │                        │ <─────────────────── │
    │                        │   200 OK               │
    │                        │   ETag: "v3"           │
    │                        │ ──────────────────>    │
    │                        │                        │
    │                        │   PUT /articles/42     │
    │                        │   If-Match: "v3"       │
    │                        │ <─────────────────── │
    │                        │   200 OK               │
    │                        │   ETag: "v4"           │
    │                        │ ──────────────────>    │
    │                        │                        │
    │  PUT /articles/42      │                        │
    │  If-Match: "v3"        │                        │
    │ ──────────────────>    │                        │
    │  412 Precondition      │                        │
    │  Failed                │                        │
    │ <──────────────────    │                        │
    │                        │                        │
    │  (Alice doit recharger │                        │
    │   et reessayer)        │                        │
```

### 3. Serialization Groups

Les groupes de serialisation controlent quels champs sont exposes en lecture vs en écriture. Cela évité d'exposer des données internes et de permettre l'écriture sur des champs calcules.

| Groupe | Direction | Champs exposes |
|---|---|---|
| `article:read` | GET (réponse) | id, title, slug, status, author, publishedAt, createdAt |
| `article:write` | POST/PUT (requête) | title, slug, body, tags, categoryId |
| `article:admin` | GET admin seulement | + tenantId, deletedAt, version |

### 4. RFC 7807 — Problem Details for HTTP APIs

Au lieu de renvoyer des formats d'erreur varies et ad-hoc, RFC 7807 définit un format standard.

```json
{
  "type": "https://api.example.com/problems/validation-error",
  "title": "Validation Error",
  "status": 422,
  "detail": "The request body contains invalid fields.",
  "instance": "/articles/550e8400-e29b-41d4-a716-446655440000",
  "violations": [
    { "field": "title.fr", "message": "Must not be empty" },
    { "field": "slug", "message": "Already exists for this tenant" }
  ]
}
```

| Champ | Obligatoire | Description |
|---|---|---|
| `type` | Oui | URI identifiant le type de problème |
| `title` | Oui | Resume lisible par un humain |
| `status` | Oui | Code HTTP |
| `detail` | Non | Explication spécifique a cette occurrence |
| `instance` | Non | URI de la ressource concernee |

### 5. Presigned URL — Upload direct vers S3

Le serveur ne recoit jamais le fichier. Le client uploade directement vers S3 via une URL pre-signee.

```
FLUX PRESIGNED URL

  Client                   API                       S3
    │                        │                        │
    │  POST /media/upload    │                        │
    │  { filename, mime,     │                        │
    │    size }              │                        │
    │ ──────────────────>    │                        │
    │                        │  generatePresignedUrl  │
    │                        │ ──────────────────>    │
    │                        │  url + fields          │
    │                        │ <──────────────────    │
    │  200 { uploadUrl,      │                        │
    │    mediaId, fields }   │                        │
    │ <──────────────────    │                        │
    │                        │                        │
    │  PUT uploadUrl         │                        │
    │  (binary data)         │                        │
    │ ──────────────────────────────────────────>     │
    │  200 OK                │                        │
    │ <──────────────────────────────────────────     │
    │                        │                        │
    │  POST /media/:id/confirm                        │
    │ ──────────────────>    │                        │
    │                        │  headObject (verify)   │
    │                        │ ──────────────────>    │
    │  200 { media }         │                        │
    │ <──────────────────    │                        │
```

**Avantages :** le serveur API n'est jamais surcharge par le transfer binaire, le client uploade directement vers le stockage avec un débit optimal, et le serveur valide apres confirmation.

### 6. Pagination serveur

La pagination est obligatoire sur toutes les collections. Le cap est entre 20 et 24 items par page pour éviter les abus.

```
GET /articles?page=2&limit=20

Response:
{
  "items": [...],
  "meta": {
    "page": 2,
    "limit": 20,
    "total": 157,
    "totalPages": 8
  }
}

REGLES :
  - limit maximal = 24 (ignore si > 24, remplace par 24)
  - limit par defaut = 20
  - page commence a 1 (pas 0)
  - Si page > totalPages, renvoyer items: [] (pas d'erreur)
```

---

## Pratique

### Controller NestJS avec ETag et serialisation

```typescript
// presentation/controllers/article.controller.ts
import {
  Controller, Get, Put, Post, Param, Body, Headers,
  Res, HttpCode, HttpStatus, Query, ParseUUIDPipe,
} from '@nestjs/common';
import { Response } from 'express';

@Controller('articles')
export class ArticleController {
  constructor(
    private readonly getArticle: GetArticleUseCase,
    private readonly updateArticle: UpdateArticleUseCase,
    private readonly listArticles: ListArticlesUseCase,
  ) {}

  // ── GET avec ETag ─────────────────────────────────────────
  @Get(':id')
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Headers('if-none-match') ifNoneMatch: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    const article = await this.getArticle.execute({ id });

    // ETag basee sur la version de l'entite
    const etag = `"v${article.version}"`;

    // Si le client a deja cette version, 304 Not Modified
    if (ifNoneMatch === etag) {
      res.status(HttpStatus.NOT_MODIFIED).end();
      return;
    }

    res
      .set('ETag', etag)
      .set('Cache-Control', 'private, must-revalidate')
      .json(ArticleReadDto.fromDomain(article)); // Groupe article:read
  }

  // ── PUT avec If-Match (optimistic locking) ────────────────
  @Put(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Headers('if-match') ifMatch: string | undefined,
    @Body() dto: UpdateArticleDto,              // Groupe article:write
    @Res() res: Response,
  ): Promise<void> {
    // If-Match est OBLIGATOIRE pour les PUT/PATCH
    if (!ifMatch) {
      res.status(HttpStatus.PRECONDITION_REQUIRED).json({
        type: 'https://api.example.com/problems/missing-if-match',
        title: 'Missing If-Match Header',
        status: 428,
        detail: 'PUT requests require an If-Match header with the current ETag.',
      });
      return;
    }

    // Extraire la version du ETag : "v3" -> 3
    const expectedVersion = parseInt(ifMatch.replace(/"/g, '').replace('v', ''), 10);

    try {
      const updated = await this.updateArticle.execute({
        id,
        ...dto,
        expectedVersion,
      });

      const newEtag = `"v${updated.version}"`;
      res
        .set('ETag', newEtag)
        .json(ArticleReadDto.fromDomain(updated));
    } catch (error) {
      if (error instanceof OptimisticLockError) {
        // 412 Precondition Failed — la ressource a change entre temps
        res.status(HttpStatus.PRECONDITION_FAILED).json({
          type: 'https://api.example.com/problems/optimistic-lock',
          title: 'Precondition Failed',
          status: 412,
          detail: 'The resource has been modified by another user. Please reload and retry.',
          instance: `/articles/${id}`,
        });
        return;
      }
      throw error; // Laisser le filtre d'exception global gerer
    }
  }

  // ── GET collection avec pagination ────────────────────────
  @Get()
  async list(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
    @Query('status') status?: string,
  ) {
    // Cap a 24 items maximum — le client ne peut pas demander plus
    const safedLimit = Math.min(Math.max(limit, 1), 24);

    return this.listArticles.execute({
      page: Math.max(page, 1),
      limit: safedLimit,
      status,
    });
  }
}
```

### DTO avec groupes de serialisation

```typescript
// presentation/dto/article-read.dto.ts
// Ce DTO ne contient QUE les champs du groupe article:read
// Il est construit depuis le domaine — le domaine ne connait pas le DTO

export class ArticleReadDto {
  readonly id: string;
  readonly title: Record<string, string>;
  readonly slug: string;
  readonly status: string;
  readonly authorId: string;
  readonly tags: string[];
  readonly publishedAt: string | null;
  readonly createdAt: string;

  // Pas de tenantId, pas de version, pas de deletedAt
  // -> ces champs sont dans article:admin, pas article:read

  static fromDomain(article: Article): ArticleReadDto {
    return {
      id: article.id.value,
      title: article.title.toJSON(),
      slug: article.slug,
      status: article.status,
      authorId: article.authorId,
      tags: [...article.tags],
      publishedAt: article.publishedAt?.toISOString() ?? null,
      createdAt: article.createdAt.toISOString(),
    };
  }
}

// presentation/dto/update-article.dto.ts
// Ce DTO ne contient QUE les champs du groupe article:write
// Le client ne peut PAS ecrire id, status, version, createdAt, publishedAt

import { IsOptional, IsString, IsArray, ValidateNested } from 'class-validator';

export class UpdateArticleDto {
  @IsOptional()
  @ValidateNested()
  title?: Record<string, string>;

  @IsOptional()
  @IsString()
  slug?: string;

  @IsOptional()
  body?: Record<string, string>;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsString()
  categoryId?: string;
}
```

### Endpoint presigned URL

```typescript
// presentation/controllers/media.controller.ts

@Controller('media')
export class MediaController {
  constructor(
    private readonly requestUpload: RequestUploadUseCase,
    private readonly confirmUpload: ConfirmUploadUseCase,
  ) {}

  // Etape 1 : le client demande une URL presignee
  @Post('upload')
  @HttpCode(HttpStatus.OK)
  async requestPresignedUrl(
    @Body() dto: RequestUploadDto,
    @Headers('x-tenant-id') tenantId: string,
  ) {
    // Validation : mime autorise, taille < 10MB
    const result = await this.requestUpload.execute({
      filename: dto.filename,
      mimeType: dto.mimeType,
      fileSize: dto.fileSize,
      tenantId,
    });

    // Retourner l'URL S3 presignee + le mediaId cree en BDD
    return {
      mediaId: result.mediaId,
      uploadUrl: result.presignedUrl,
      expiresIn: 300, // 5 minutes
    };
  }

  // Etape 2 : le client confirme que l'upload est termine
  @Post(':id/confirm')
  async confirmMedia(
    @Param('id', ParseUUIDPipe) id: string,
    @Headers('x-tenant-id') tenantId: string,
  ) {
    // Le serveur verifie que le fichier existe bien sur S3 (headObject)
    // puis met a jour le statut du media en BDD
    const media = await this.confirmUpload.execute({
      mediaId: id,
      tenantId,
    });

    return MediaReadDto.fromDomain(media);
  }
}
```

### Filtre d'exception RFC 7807

```typescript
// presentation/filters/problem-details.filter.ts
import { ExceptionFilter, Catch, ArgumentsHost, HttpException } from '@nestjs/common';

@Catch()
export class ProblemDetailsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();

    // Determiner le status et le message selon le type d'erreur
    const { status, body } = this.buildProblemDetails(exception, request.url);

    response
      .status(status)
      .header('Content-Type', 'application/problem+json')
      .json(body);
  }

  private buildProblemDetails(exception: unknown, path: string) {
    if (exception instanceof HttpException) {
      return {
        status: exception.getStatus(),
        body: {
          type: `https://api.example.com/problems/http-${exception.getStatus()}`,
          title: exception.message,
          status: exception.getStatus(),
          instance: path,
        },
      };
    }

    if (exception instanceof ValidationError) {
      return {
        status: 422,
        body: {
          type: 'https://api.example.com/problems/validation-error',
          title: 'Validation Error',
          status: 422,
          detail: 'The request body contains invalid fields.',
          instance: path,
          violations: exception.violations, // [{field, message}]
        },
      };
    }

    // Erreur non prevue — ne jamais exposer les details internes
    return {
      status: 500,
      body: {
        type: 'https://api.example.com/problems/internal-error',
        title: 'Internal Server Error',
        status: 500,
        instance: path,
      },
    };
  }
}
```

---

## Resume

- **REST utilise les verbes HTTP** (GET, POST, PUT, PATCH, DELETE) sur des **noms au pluriel** (`/articles`), avec des codes de réponse semantiques (201 Created, 204 No Content, 412 Precondition Failed).
- **ETag + If-Match** implementent le verrouillage optimiste côté HTTP : le serveur renvoie un ETag, le client le renvoie dans `If-Match` lors de la modification, et le serveur repond 412 si la ressource a change.
- Les **groupes de serialisation** (`entity:read`, `entity:write`, `entity:admin`) controlent quels champs sont exposes en lecture, en écriture et en admin, via des DTO separes qui ne connaissent pas le domaine.
- **RFC 7807** normalise le format d'erreur HTTP avec `type`, `title`, `status`, `detail`, `instance` et des extensions comme `violations` pour les erreurs de validation.
- Le **presigned URL** decharge le serveur API de tout transfert binaire : le client uploade directement vers S3, puis confirme — le serveur ne fait que générer l'URL et valider l'existence du fichier.


---

> **Lien fil rouge — ShopArch**
>
> - Conçois l'API REST ShopArch : endpoints CRUD Catalog avec pagination cursor-based
> - Rédige le fichier `openapi.yaml` pour les endpoints Catalog
> - Exercice(s) associé(s) : `exercices/12-api-rest-nestjs/`
> - Checkpoint : Module 03, critère 1

## Prochain cours

[Cours 20 — Middleware & Pipeline](./02-middleware-pipeline.md)
