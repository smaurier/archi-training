# Correction — Exercice 33 : CQRS catalogue + commandes

## Commands et Queries type-safe

```typescript
// commands.ts
interface Command<T extends string = string> {
  readonly type: T;
}

class CreateProduct implements Command<'CreateProduct'> {
  readonly type = 'CreateProduct';
  constructor(
    public readonly name: string,
    public readonly description: string,
    public readonly price: number,
    public readonly categoryId: string,
    public readonly tenantId: string,
  ) {}
}

class UpdatePrice implements Command<'UpdatePrice'> {
  readonly type = 'UpdatePrice';
  constructor(
    public readonly productId: string,
    public readonly newPrice: number,
    public readonly reason: string,
  ) {}
}

class UpdateStock implements Command<'UpdateStock'> {
  readonly type = 'UpdateStock';
  constructor(
    public readonly productId: string,
    public readonly delta: number, // +10 ou -1
  ) {}
}

// queries.ts
interface Query<T extends string = string, R = unknown> {
  readonly type: T;
  readonly _resultType?: R; // phantom type pour le typage
}

class GetProduct implements Query<'GetProduct', ProductReadModel> {
  readonly type = 'GetProduct';
  constructor(public readonly productId: string) {}
}

class SearchProducts implements Query<'SearchProducts', PaginatedResult<ProductReadModel>> {
  readonly type = 'SearchProducts';
  constructor(
    public readonly term: string,
    public readonly categoryId?: string,
    public readonly cursor?: string,
    public readonly limit?: number,
  ) {}
}
```

## Write model (normalise)

```typescript
// product.write-model.ts
@Entity('products')
export class ProductWriteModel {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column('text')
  description: string;

  @Column('decimal', { precision: 10, scale: 2 })
  price: number;

  @ManyToOne(() => Category)
  category: Category;

  @Column({ default: 0 })
  stockQuantity: number;

  @Column({ default: false })
  published: boolean;

  @VersionColumn()
  version: number;

  @Column()
  tenantId: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
```

## Read model (denormalise)

```typescript
// product.read-model.ts
@Entity('products_read')
export class ProductReadModel {
  @PrimaryColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column('text')
  description: string;

  @Column('decimal')
  price: number;

  @Column()
  categoryName: string; // pre-joint

  @Column()
  categorySlug: string; // pre-joint

  @Column()
  stockQuantity: number;

  @Column()
  inStock: boolean; // pre-calcule

  @Column('float', { default: 0 })
  averageRating: number; // pre-calcule

  @Column({ default: 0 })
  reviewCount: number; // pre-calcule

  @Column()
  published: boolean;

  @Column()
  tenantId: string;

  @Column('tsvector', { nullable: true })
  searchVector: string; // pre-calcule pour full-text

  @Column()
  updatedAt: Date;
}
```

## Command Bus

```typescript
// command-bus.ts
type CommandHandler<C extends Command> = (command: C) => Promise<string | void>;

@Injectable()
export class CommandBus {
  private handlers = new Map<string, CommandHandler<any>>();
  private middlewares: CommandMiddleware[] = [];

  register<C extends Command>(commandType: string, handler: CommandHandler<C>) {
    if (this.handlers.has(commandType)) {
      throw new Error(`Handler already registered for ${commandType}`);
    }
    this.handlers.set(commandType, handler);
  }

  use(middleware: CommandMiddleware) {
    this.middlewares.push(middleware);
  }

  async dispatch(command: Command): Promise<string | void> {
    const handler = this.handlers.get(command.type);
    if (!handler) throw new Error(`No handler for ${command.type}`);

    // Execute middlewares
    let index = 0;
    const next = async (): Promise<void> => {
      if (index < this.middlewares.length) {
        await this.middlewares[index++].execute(command, next);
      }
    };
    await next();

    return handler(command);
  }
}

// Middleware de logging
class LoggingMiddleware implements CommandMiddleware {
  async execute(command: Command, next: () => Promise<void>) {
    const start = performance.now();
    console.log(`[CMD] ${command.type} started`);
    await next();
    console.log(`[CMD] ${command.type} completed in ${(performance.now() - start).toFixed(1)}ms`);
  }
}
```

## Command Handlers avec domain events

```typescript
// create-product.handler.ts
@Injectable()
export class CreateProductHandler {
  constructor(
    private readonly repo: Repository<ProductWriteModel>,
    private readonly eventBus: EventBus,
  ) {}

  async handle(command: CreateProduct): Promise<string> {
    const product = this.repo.create({
      name: command.name,
      description: command.description,
      price: command.price,
      category: { id: command.categoryId },
      tenantId: command.tenantId,
    });

    const saved = await this.repo.save(product);

    // Emettre le domain event (sera consomme par la projection)
    await this.eventBus.publish(new ProductCreated({
      productId: saved.id,
      name: saved.name,
      description: saved.description,
      price: saved.price,
      categoryId: command.categoryId,
      tenantId: saved.tenantId,
      occurredAt: new Date(),
    }));

    return saved.id; // seule donnee retournee par une Command
  }
}
```

## Projection (event → read model)

```typescript
// product-projection.service.ts
@Injectable()
export class ProductProjection {
  constructor(
    private readonly readRepo: Repository<ProductReadModel>,
    private readonly categoryRepo: Repository<Category>,
  ) {}

  @OnEvent('ProductCreated')
  async onProductCreated(event: ProductCreated) {
    const category = await this.categoryRepo.findOne({ where: { id: event.data.categoryId } });

    await this.readRepo.save({
      id: event.data.productId,
      name: event.data.name,
      description: event.data.description,
      price: event.data.price,
      categoryName: category?.name ?? '',
      categorySlug: category?.slug ?? '',
      stockQuantity: 0,
      inStock: false,
      averageRating: 0,
      reviewCount: 0,
      published: false,
      tenantId: event.data.tenantId,
      updatedAt: event.data.occurredAt,
    });
  }

  @OnEvent('PriceUpdated')
  async onPriceUpdated(event: PriceUpdated) {
    await this.readRepo.update(event.data.productId, {
      price: event.data.newPrice,
      updatedAt: event.data.occurredAt,
    });
  }

  @OnEvent('StockUpdated')
  async onStockUpdated(event: StockUpdated) {
    const product = await this.readRepo.findOne({ where: { id: event.data.productId } });
    if (!product) return;

    const newQuantity = product.stockQuantity + event.data.delta;
    await this.readRepo.update(event.data.productId, {
      stockQuantity: newQuantity,
      inStock: newQuantity > 0,
      updatedAt: event.data.occurredAt,
    });
  }
}
```

## Query Handler

```typescript
// search-products.handler.ts
@Injectable()
export class SearchProductsHandler {
  constructor(private readonly readRepo: Repository<ProductReadModel>) {}

  async handle(query: SearchProducts): Promise<PaginatedResult<ProductReadModel>> {
    const qb = this.readRepo
      .createQueryBuilder('p')
      .where('p.published = true');

    if (query.term) {
      qb.andWhere('p.searchVector @@ plainto_tsquery(:term)', { term: query.term });
    }

    if (query.categoryId) {
      qb.andWhere('p.categorySlug = :cat', { cat: query.categoryId });
    }

    // Cursor pagination sur le read model
    if (query.cursor) {
      const decoded = decodeCursor(query.cursor);
      qb.andWhere('p.id > :cursorId', { cursorId: decoded.id });
    }

    const limit = Math.min(query.limit ?? 20, 100);
    const items = await qb.orderBy('p.id', 'ASC').take(limit + 1).getMany();
    const hasNext = items.length > limit;
    if (hasNext) items.pop();

    return { items, hasNext, nextCursor: hasNext ? encodeCursor({ id: items.at(-1)!.id }) : null };
  }
}
```

## Alternatives et compromis

### CQRS complet vs CQRS léger vs pas de CQRS

| Critère | Pas de CQRS (CRUD simple) | CQRS léger (read/write repos) | CQRS complet (event-driven projections) |
|---|---|---|---|
| Complexite | Minimale | Moderee | Elevee |
| Eventual consistency | Non (strong) | Non (strong) | Oui (delai de projection) |
| Performance lecture | Limitee (JOINs) | Bonne (vues optimisees) | Excellente (denormalise) |
| Performance écriture | Bonne | Bonne | Excellente (pas de JOINs) |
| Quand l'utiliser | < 100 req/s, modèle simple | 100-1000 req/s, lectures >> écritures | > 1000 req/s, modèle complexe |

**Verdict pour ShopArch** : CQRS léger pour le catalogue (read model = vue SQL materialisee), CQRS complet uniquement pour les commandes (volume élevé, modèle complexe).

### Projection synchrone vs asynchrone

| Critère | Synchrone (même transaction) | Asynchrone (event bus) |
|---|---|---|
| Cohérence | Forte (immédiate) | Eventuelle (delai) |
| Latence d'écriture | Plus lente (update 2 tables) | Rapide (1 table + publish event) |
| Résilience | Si la projection échoué, l'écriture échoué aussi | L'écriture reussit même si la projection est en retard |
| Complexite | Simple | Nécessité event bus + replay |

**Verdict pour ShopArch** : commencer en synchrone (plus simple), migrer vers asynchrone quand la latence d'écriture devient un problème (> 50ms).

### Event sourcing vs state-based

| Critère | State-based (entités classiques) | Event sourcing |
|---|---|---|
| Complexite | Standard | Elevee |
| Historique | Perdu (sauf audit log manuel) | Complet (replay possible) |
| Storage | Compact | Croissant (tous les events) |
| Debug | Difficile (quel etait l'état avant ?) | Facile (replay jusqu'à un point) |
| Quand l'utiliser | 90% des cas | Audit strict, finance, undo/redo |

**Verdict pour ShopArch** : state-based + CQRS est suffisant. Event sourcing uniquement si un besoin d'audit strict emerge (ex: conformite financiere).

## Ce que tu aurais pu oublier

### 1. Command qui retourne l'entité complete
```
FAUX — createProduct retourne tout le produit avec ses relations
CORRECT — une Command retourne void ou l'ID uniquement
         Si le client a besoin des details, il fait une Query ensuite
```

### 2. Query qui modifie l'état
```
FAUX — GetProduct incremente un compteur de vues
CORRECT — les Queries sont pures, sans effet de bord
         Le tracking se fait via un event separe (ProductViewed)
```

### 3. Projection synchrone
```
FAUX — mettre a jour le read model dans le meme transaction que le write model
CORRECT — projection asynchrone via events
         Le read model peut etre en retard de quelques ms (eventual consistency)
```

### 4. Un seul modèle pour read et write
```
FAUX — meme entite Product pour les lectures et ecritures
CORRECT — deux modeles distincts : write model normalise, read model denormalise
         Le read model a les donnees pre-jointes et pre-calculees
```
