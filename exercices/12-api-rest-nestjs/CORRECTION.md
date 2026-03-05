# Correction — Exercice 12 : API REST NestJS

## Résultat attendu

Une API REST NestJS complete avec ETag, pagination cursor, et erreurs RFC 7807.

## DTOs

```typescript
// dto/create-product.dto.ts
import { IsString, IsNumber, Min, IsNotEmpty, IsUUID } from 'class-validator';

export class CreateProductDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  description: string = '';

  @IsNumber()
  @Min(0.01)
  price: number;

  @IsUUID()
  categoryId: string;

  @IsNumber()
  @Min(0)
  stock: number = 0;
}

// dto/update-product.dto.ts
import { PartialType } from '@nestjs/mapped-types';

export class UpdateProductDto extends PartialType(CreateProductDto) {}
```

## Controller

```typescript
@Controller('api/products')
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  @Get()
  async list(
    @Query('after') after?: string,
    @Query('limit') limit?: number,
  ) {
    const safeLimit = Math.min(limit ?? 20, 20); // Cap serveur
    const result = await this.productService.findAll(after, safeLimit);

    return {
      data: result.items,
      meta: {
        hasMore: result.hasMore,
        cursor: result.items.at(-1)?.id ?? null,
      },
    };
  }

  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @Headers('if-none-match') ifNoneMatch?: string,
    @Res({ passthrough: true }) res?: Response,
  ) {
    const product = await this.productService.findById(id);
    if (!product) throw new NotFoundException('Product not found');

    const etag = `"v${product.version}"`;

    // 304 Not Modified si ETag correspond
    if (ifNoneMatch === etag) {
      res.status(304);
      return;
    }

    res.set('ETag', etag);
    return product;
  }

  @Post()
  @HttpCode(201)
  async create(
    @Body() dto: CreateProductDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const product = await this.productService.create(dto);
    res.set('Location', `/api/products/${product.id}`);
    return product;
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
    @Headers('if-match') ifMatch: string,
  ) {
    if (!ifMatch) {
      throw new PreconditionRequiredException('If-Match header is required');
    }

    const expectedVersion = this.parseEtag(ifMatch);
    const product = await this.productService.findById(id);

    if (!product) throw new NotFoundException('Product not found');

    if (product.version !== expectedVersion) {
      throw new PreconditionFailedException(
        'Resource has been modified. Refresh and retry.',
      );
    }

    return this.productService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@Param('id') id: string) {
    await this.productService.softDelete(id);
  }

  private parseEtag(etag: string): number {
    const match = etag.match(/^"v(\d+)"$/);
    if (!match) throw new BadRequestException('Invalid ETag format');
    return parseInt(match[1], 10);
  }
}
```

## Service

```typescript
@Injectable()
export class ProductService {
  constructor(
    @InjectRepository(ProductEntity)
    private readonly repo: Repository<ProductEntity>,
  ) {}

  async findAll(after?: string, limit: number = 20) {
    const qb = this.repo
      .createQueryBuilder('p')
      .where('p.status != :deleted', { deleted: 'deleted' })
      .orderBy('p.createdAt', 'DESC')
      .take(limit + 1); // +1 pour detecter hasMore

    if (after) {
      const cursor = await this.repo.findOneBy({ id: after });
      if (cursor) {
        qb.andWhere('p.createdAt < :cursorDate', { cursorDate: cursor.createdAt });
      }
    }

    const items = await qb.getMany();
    const hasMore = items.length > limit;
    if (hasMore) items.pop(); // Retirer le +1

    return { items, hasMore };
  }

  async findById(id: string): Promise<ProductEntity | null> {
    return this.repo.findOne({
      where: { id, status: Not('deleted') },
    });
  }

  async create(dto: CreateProductDto): Promise<ProductEntity> {
    const product = this.repo.create({
      ...dto,
      id: crypto.randomUUID(),
      version: 1,
      status: 'active',
    });
    return this.repo.save(product);
  }

  async update(id: string, dto: UpdateProductDto): Promise<ProductEntity> {
    await this.repo.update(id, {
      ...dto,
      version: () => 'version + 1', // Increment atomique
      updatedAt: new Date(),
    });
    return this.findById(id);
  }

  async softDelete(id: string): Promise<void> {
    await this.repo.update(id, { status: 'deleted', updatedAt: new Date() });
  }
}
```

## Error filter RFC 7807

```typescript
@Catch(HttpException)
export class Rfc7807Filter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const status = exception.getStatus();

    response.status(status).json({
      type: `https://httpstatuses.com/${status}`,
      title: exception.message,
      status,
      detail: exception.getResponse()['message'] ?? exception.message,
    });
  }
}
```

## Alternatives et arbitrages

> En architecture, ta valeur n'est pas de connaître UNE solution,
> mais de savoir POURQUOI tu choisis celle-ci plutôt qu'une autre.

### Option A : REST (solution présentée)
**Quand la choisir :** API publique, écosystème mature (caching HTTP, CDN, documentation OpenAPI), clients variés (web, mobile, tiers), CRUD dominant.
**Limites :** Over-fetching / under-fetching (le client reçoit trop ou pas assez de données), N+1 requêtes pour les vues complexes, pas de contrat de type fort côté client.

### Option B : GraphQL
**Quand la choisir :** Clients avec des besoins de données très différents (mobile léger vs desktop riche), relations complexes à traverser, équipe frontend qui veut contrôler les données récupérées.
**Limites :** Complexité serveur (resolvers, N+1 DataLoader), pas de caching HTTP natif, surface d'attaque plus large (queries arbitraires), tooling de monitoring moins mature.

### Option C : gRPC
**Quand la choisir :** Communication inter-services haute performance, contrats stricts (Protobuf), streaming bidirectionnel, services internes uniquement.
**Limites :** Pas utilisable directement depuis un navigateur (nécessite gRPC-Web), Protobuf non human-readable, tooling moins accessible que REST.

### Matrice de décision
| Critère | REST | GraphQL | gRPC |
|---|---|---|---|
| Caching HTTP | Natif | Complexe | Non |
| Flexibilité client | Faible | Excellente | Faible |
| Performance | Bonne | Variable | Excellente |
| Documentation | OpenAPI | Schema introspection | Proto files |
| Courbe d'apprentissage | Faible | Moyenne | Moyenne |

### Pour ShopArch, on choisit...
REST pour l'API publique (catalogue, panier, commandes) car c'est le standard le mieux supporté par les CDN et le caching HTTP. On pourrait ajouter un endpoint GraphQL pour le back-office admin qui a des besoins de données complexes (dashboard avec jointures produits/commandes/stats). gRPC serait pertinent uniquement si on décompose en microservices pour la communication interne.

---

## Ce que tu aurais pu oublier

### 1. Pagination offset au lieu de cursor

```typescript
// FAUX — offset pagination (lent sur gros datasets, skip problem)
GET /api/products?page=50&limit=20
// → OFFSET 1000 LIMIT 20 = lent

// CORRECT — cursor pagination
GET /api/products?after=uuid-last-item&limit=20
// → WHERE created_at < cursor ORDER BY created_at DESC LIMIT 20
```

### 2. ETag sans version dans l'entité

```typescript
// FAUX — ETag base sur un hash du body (recalcule a chaque requete)
const etag = md5(JSON.stringify(product));

// CORRECT — version dans l'entite (increment a chaque update)
const etag = `"v${product.version}"`;
```

### 3. Pas de cap serveur sur la pagination

```typescript
// FAUX — le client peut demander limit=10000
const limit = parseInt(req.query.limit); // 10000 items !

// CORRECT — cap serveur
const safeLimit = Math.min(limit ?? 20, 20); // Maximum 20
```

### 4. Hard delete au lieu de soft delete

```typescript
// FAUX — suppression physique
await this.repo.delete(id); // Donnees perdues !

// CORRECT — soft delete via status
await this.repo.update(id, { status: 'deleted' });
// Les donnees restent pour audit/restore
```

### 5. Oublier le Location header sur POST

```typescript
// FAUX — POST retourne 200 sans Location
return product;

// CORRECT — POST retourne 201 + Location
res.status(201).set('Location', `/api/products/${product.id}`);
return product;
```
