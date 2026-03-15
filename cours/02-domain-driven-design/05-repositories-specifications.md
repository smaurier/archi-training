# Cours 18 — Repositories & Specifications

**Objectif :** Comprendre le Repository pattern comme abstraction d'accès aux Agregats, le distinguer du DAO et de l'Active Record, implémenter le Spécification pattern pour composer des critères de recherche, et garantir la testabilité du domaine.

---

## Rappel du cours précédent

> Cours 17 — Domain Events, Services & Workflows.

**Question 1 — Quelle est la différence entre un Domain Service et un Application Service ?**

<details>
<summary>Réponse</summary>

Un Domain Service porte de la logique métier pure qui implique plusieurs agregats ou une règle sans foyer naturel dans un seul agregat (ex : `PublishingPolicy`, `PricingService`). Il ne dépend pas de l'infrastructure. Un Application Service orchestre le flux applicatif : il charge les agregats via les Repositories, invoque les Domain Services, déclenché les transitions sur les agregats, sauvegarde, puis publie les Domain Events. Il dépend de l'infrastructure (Repositories, EventBus, Cache) mais ne contient pas de logique métier.

</details>

**Question 2 — Expliquez le principe du pattern FSM (machine a états finis) applique à un workflow de publication.**

<details>
<summary>Réponse</summary>

Une FSM définit explicitement tous les états possibles (Draft, Scheduled, Published, Archived) et toutes les transitions autorisees (qui sont les seuls chemins entre états). Pour chaque action, on vérifié d'abord `canTransitionTo(currentStatus, action)` avant d'exécuter le changement d'état. Cela remplace les cascades de `if/else` episparses dans le code et rend les règles de transition exhaustives, centralisees, et testables unitairement. Les transitions refusees levent une erreur explicite avec un message utile.

</details>

---

## Analogie

**Le bibliothecaire.**

Dans une grande bibliotheque, vous ne deamboulez pas dans les reserves pour chercher vous-même un livre parmi des milliers. Vous allez voir le bibliothecaire et lui dites : "Je cherche un roman policier paru après 2020, disponible en rayon, de préférence en français." Le bibliothecaire connait l'organisation des reserves, les systèmes de stockage, les index. Vous, vous recevez juste le livre.

Le **Repository** est ce bibliothecaire : il connait la base de données, les jointures, les index, le cache. Votre domaine ne sait pas si les articles sont dans PostgreSQL, MongoDB ou un fichier JSON. Il demandé : "Donne-moi les articles publies du tenant X" — le Repository s'occupe du reste.

Le **Spécification pattern** est la fiche de recherche que vous remplissez : chaque critère est une spécification independante, et vous les combinez avec `AND`, `OR`, `NOT`. Le bibliothecaire applique ces critères sans que vous ayez besoin de savoir comment les livres sont catalogues.

---

## Théorie

### 1. Repository vs DAO vs Active Record

Ces trois patterns repondent tous à la question "comment accéder aux données", mais avec des philosophies différentes.

| Aspect | Repository | DAO | Active Record |
|---|---|---|---|
| Unite gérée | Agregat complet | Table/vue SQL | Ligne de table |
| Interface | Orientee domaine (`findPublishedByTenant`) | Orientee CRUD SQL (`findByColumn`) | Méthodes sur l'objet lui-même (`article.save()`) |
| Couplage | Faible (interface dans le domaine) | Moyen (l'app connait les colonnes) | Fort (modèle = table) |
| Testabilite | Excellente (mock de l'interface) | Moyenne | Difficile (BDD requise) |
| Utilise avec | DDD | Scripts simples, legacy | Ruby on Rails, Eloquent |
| Exemple | `ArticleRepository` | `ArticleDAO` | `Article.findAll()` |

```
COMPARAISON ARCHITECTURALE

  ACTIVE RECORD                   REPOSITORY
  ─────────────                   ──────────
  Domain Object                   Domain Object
       │                               │
       │ knows DB                      │ has no DB knowledge
       │                               │
       v                               v
  ┌─────────┐                    ┌─────────────────┐
  │  MySQL  │                    │  <<interface>>  │
  │  Table  │                    │  ArticleRepo    │
  └─────────┘                    └────────┬────────┘
                                          │
                            ┌─────────────┴──────────────┐
                            │                            │
                     ┌──────────────┐           ┌─────────────────┐
                     │  TypeORM     │           │  InMemory       │
                     │  Impl (prod) │           │  Impl (tests)   │
                     └──────────────┘           └─────────────────┘
```

### 2. Interface Repository dans le Domaine

L'interface est définie dans le domaine — jamais dans l'infrastructure. Cela respecte la Dependency Rule (les dépendances pointent vers l'interieur).

```typescript
// domain/repositories/article-repository.interface.ts
// DANS LE DOMAINE — pas de TypeORM, pas de SQL ici

export interface ArticleRepository {
  // Lecture
  findById(id: ArticleId, tenantId: TenantId): Promise<Article | null>;
  findBySlug(slug: string, tenantId: TenantId): Promise<Article | null>;
  findAll(tenantId: TenantId, options?: ArticleQueryOptions): Promise<PaginatedResult<Article>>;
  findBySpecification(spec: ArticleSpecification, tenantId: TenantId): Promise<Article[]>;
  exists(id: ArticleId, tenantId: TenantId): Promise<boolean>;

  // Ecriture
  save(article: Article): Promise<void>;       // insert ou update selon si l'entite existe
  delete(id: ArticleId, tenantId: TenantId): Promise<void>; // soft delete dans l'impl

  // Comptage (pour la pagination et les quotas)
  countPublished(tenantId: TenantId): Promise<number>;
}

export interface ArticleQueryOptions {
  status?: ArticleStatus;
  authorId?: string;
  tags?: string[];
  page?: number;
  limit?: number;
  orderBy?: 'createdAt' | 'publishedAt' | 'title';
  orderDir?: 'ASC' | 'DESC';
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
```

### 3. Implémentation TypeORM

```typescript
// infrastructure/repositories/typeorm-article.repository.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { ArticleEntity } from '../entities/article.entity';
import { ArticleMapper } from '../mappers/article.mapper';

@Injectable()
export class TypeOrmArticleRepository implements ArticleRepository {
  constructor(
    @InjectRepository(ArticleEntity)
    private readonly orm: Repository<ArticleEntity>,
    private readonly mapper: ArticleMapper,
  ) {}

  async findById(id: ArticleId, tenantId: TenantId): Promise<Article | null> {
    const entity = await this.orm.findOne({
      where: {
        id: id.value,
        tenantId: tenantId.value,
        deletedAt: null,           // Soft delete : on exclut les supprimes
      },
    });
    return entity ? this.mapper.toDomain(entity) : null;
  }

  async findAll(
    tenantId: TenantId,
    options: ArticleQueryOptions = {},
  ): Promise<PaginatedResult<Article>> {
    const { page = 1, limit = 20, status, orderBy = 'createdAt', orderDir = 'DESC' } = options;

    const qb = this.orm.createQueryBuilder('article')
      .where('article.tenantId = :tenantId', { tenantId: tenantId.value })
      .andWhere('article.deletedAt IS NULL');

    if (status) {
      qb.andWhere('article.status = :status', { status });
    }

    if (options.tags?.length) {
      // JSONB containment query (PostgreSQL)
      qb.andWhere('article.tags @> :tags::jsonb', {
        tags: JSON.stringify(options.tags),
      });
    }

    qb.orderBy(`article.${orderBy}`, orderDir)
      .skip((page - 1) * limit)
      .take(limit);

    const [entities, total] = await qb.getManyAndCount();

    return {
      items: entities.map(e => this.mapper.toDomain(e)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async save(article: Article): Promise<void> {
    const entity = this.mapper.toEntity(article);

    // Optimistic locking : TypeORM verifie la version automatiquement
    // si @VersionColumn() est configure sur l'entity TypeORM
    // En cas de conflit : OptimisticLockVersionMismatchError est leve
    await this.orm.save(entity);
  }

  async countPublished(tenantId: TenantId): Promise<number> {
    return this.orm.count({
      where: { tenantId: tenantId.value, status: 'Published', deletedAt: null },
    });
  }

  async findBySpecification(
    spec: ArticleSpecification,
    tenantId: TenantId,
  ): Promise<Article[]> {
    const qb = this.orm.createQueryBuilder('article')
      .where('article.tenantId = :tenantId', { tenantId: tenantId.value })
      .andWhere('article.deletedAt IS NULL');

    // Laisser la specification enrichir le query builder
    spec.applyToQuery(qb);

    const entities = await qb.getMany();
    return entities.map(e => this.mapper.toDomain(e));
  }
}
```

### 4. Mapper — traduction Domaine <-> Infrastructure

```typescript
// infrastructure/mappers/article.mapper.ts
// Le Mapper traduit entre le modele de domaine et l'entite TypeORM.
// C'est lui qui connait les deux formats. Ni le domaine ni TypeORM ne se connaissent.

@Injectable()
export class ArticleMapper {
  toDomain(entity: ArticleEntity): Article {
    return Article.reconstitute({
      id: ArticleId.fromString(entity.id),
      tenantId: new TenantId(entity.tenantId),
      slug: entity.slug,
      title: new MultiLangField(entity.title as Record<SupportedLocale, string>),
      body: new MultiLangField(entity.body as Record<SupportedLocale, string>),
      status: entity.status as ArticleStatus,
      authorId: entity.authorId,
      tags: entity.tags ?? [],
      scheduledAt: entity.scheduledAt,
      publishedAt: entity.publishedAt,
      deletedAt: entity.deletedAt,
      deletedBy: entity.deletedBy,
      version: entity.version,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    });
  }

  toEntity(article: Article): ArticleEntity {
    const entity = new ArticleEntity();
    entity.id = article.id.value;
    entity.tenantId = article.tenantId.value;
    entity.slug = article.slug;
    entity.title = article.title.toJSON();
    entity.body = article.body.toJSON();
    entity.status = article.status;
    entity.authorId = article.authorId;
    entity.tags = [...article.tags];
    entity.version = article.version;
    entity.createdAt = article.createdAt;
    // updatedAt géré par TypeORM (@UpdateDateColumn)
    return entity;
  }
}
```

### 5. Spécification Pattern

Le Spécification pattern encapsule un critère de filtre dans un objet reutable et composable.

```
SANS SPECIFICATION
  findPublishedByTenantAndTagAndDateRange(tenantId, tag, from, to)
  findPublishedByTenantAndAuthor(tenantId, authorId)
  findPublishedByTenantAndTagAndAuthor(tenantId, tag, authorId)
  findScheduledByTenant(tenantId)
  ... explosion combinatoire

AVEC SPECIFICATION
  PublishedSpec.and(HasTagSpec('ddd')).and(AuthoredBySpec('uuid'))
  PublishedSpec.and(ScheduledBeforeSpec(date))
  PublishedSpec.or(ScheduledSpec)
```

```typescript
// domain/specifications/article-specification.ts
import { SelectQueryBuilder } from 'typeorm';

export abstract class ArticleSpecification {
  abstract applyToQuery(qb: SelectQueryBuilder<any>): void;

  and(other: ArticleSpecification): ArticleSpecification {
    return new AndSpecification(this, other);
  }

  or(other: ArticleSpecification): ArticleSpecification {
    return new OrSpecification(this, other);
  }

  not(): ArticleSpecification {
    return new NotSpecification(this);
  }
}

// Specification composite AND
class AndSpecification extends ArticleSpecification {
  constructor(
    private readonly left: ArticleSpecification,
    private readonly right: ArticleSpecification,
  ) { super(); }

  applyToQuery(qb: SelectQueryBuilder<any>): void {
    this.left.applyToQuery(qb);
    this.right.applyToQuery(qb);
  }
}

// Specification composite OR (via sous-requetes)
class OrSpecification extends ArticleSpecification {
  constructor(
    private readonly left: ArticleSpecification,
    private readonly right: ArticleSpecification,
  ) { super(); }

  applyToQuery(qb: SelectQueryBuilder<any>): void {
    // Implementation OR necessiterait des brackets TypeORM
    // Simplifie ici pour la lisibilite
    this.left.applyToQuery(qb);
  }
}

class NotSpecification extends ArticleSpecification {
  constructor(private readonly inner: ArticleSpecification) { super(); }
  applyToQuery(qb: SelectQueryBuilder<any>): void {
    // NOT logic
  }
}

// ── Specifications concretes ──────────────────────────────────

export class PublishedArticleSpec extends ArticleSpecification {
  applyToQuery(qb: SelectQueryBuilder<any>): void {
    qb.andWhere('article.status = :status', { status: 'Published' });
  }
}

export class HasTagSpec extends ArticleSpecification {
  constructor(private readonly tag: string) { super(); }

  applyToQuery(qb: SelectQueryBuilder<any>): void {
    qb.andWhere(`article.tags @> :tag::jsonb`, {
      tag: JSON.stringify([this.tag.toLowerCase()]),
    });
  }
}

export class AuthoredBySpec extends ArticleSpecification {
  constructor(private readonly authorId: string) { super(); }

  applyToQuery(qb: SelectQueryBuilder<any>): void {
    qb.andWhere('article.authorId = :authorId', { authorId: this.authorId });
  }
}

export class PublishedAfterSpec extends ArticleSpecification {
  constructor(private readonly date: Date) { super(); }

  applyToQuery(qb: SelectQueryBuilder<any>): void {
    qb.andWhere('article.publishedAt >= :date', { date: this.date });
  }
}

export class PublishedBeforeSpec extends ArticleSpecification {
  constructor(private readonly date: Date) { super(); }

  applyToQuery(qb: SelectQueryBuilder<any>): void {
    qb.andWhere('article.publishedAt < :date', { date: this.date });
  }
}

// ── Usage — composition de specifications ───────────────────

// Trouver les articles DDD publies en 2025 par un auteur specifique
const spec = new PublishedArticleSpec()
  .and(new HasTagSpec('ddd'))
  .and(new AuthoredBySpec('author-uuid'))
  .and(new PublishedAfterSpec(new Date('2025-01-01')))
  .and(new PublishedBeforeSpec(new Date('2026-01-01')));

const articles = await articleRepository.findBySpecification(spec, tenantId);
```

### 6. InMemory Repository — Tests ultra-rapides

```typescript
// test/repositories/in-memory-article.repository.ts

export class InMemoryArticleRepository implements ArticleRepository {
  private store = new Map<string, Article>();

  private key(id: ArticleId, tenantId: TenantId): string {
    return `${tenantId.value}:${id.value}`;
  }

  async findById(id: ArticleId, tenantId: TenantId): Promise<Article | null> {
    return this.store.get(this.key(id, tenantId)) ?? null;
  }

  async findBySlug(slug: string, tenantId: TenantId): Promise<Article | null> {
    return Array.from(this.store.values()).find(
      a => a.slug === slug && a.tenantId.equals(tenantId) && !a.isDeleted
    ) ?? null;
  }

  async findAll(tenantId: TenantId, options: ArticleQueryOptions = {}): Promise<PaginatedResult<Article>> {
    let items = Array.from(this.store.values()).filter(
      a => a.tenantId.equals(tenantId) && !a.isDeleted
    );
    if (options.status) items = items.filter(a => a.status === options.status);

    const page = options.page ?? 1;
    const limit = options.limit ?? 20;
    const start = (page - 1) * limit;

    return {
      items: items.slice(start, start + limit),
      total: items.length,
      page,
      limit,
      totalPages: Math.ceil(items.length / limit),
    };
  }

  async save(article: Article): Promise<void> {
    this.store.set(this.key(article.id, article.tenantId), article);
  }

  async delete(id: ArticleId, tenantId: TenantId): Promise<void> {
    this.store.delete(this.key(id, tenantId));
  }

  async exists(id: ArticleId, tenantId: TenantId): Promise<boolean> {
    return this.store.has(this.key(id, tenantId));
  }

  async countPublished(tenantId: TenantId): Promise<number> {
    return Array.from(this.store.values()).filter(
      a => a.tenantId.equals(tenantId) && a.status === 'Published' && !a.isDeleted
    ).length;
  }

  async findBySpecification(spec: ArticleSpecification, tenantId: TenantId): Promise<Article[]> {
    // Pour l'InMemory, on filtre en memoire (sans QueryBuilder)
    // Les Specifications devraient aussi avoir une methode isSatisfiedBy(article)
    // pour les tests en memoire — voir exercise ci-dessous
    return Array.from(this.store.values()).filter(
      a => a.tenantId.equals(tenantId) && !a.isDeleted
    );
  }

  // Helper de test
  seed(article: Article): void {
    this.store.set(this.key(article.id, article.tenantId), article);
  }

  clear(): void {
    this.store.clear();
  }
}
```

---

## Pratique

### Tests d'intégration — Application Service avec InMemory Repo

```typescript
// application/__tests__/publish-article.integration.spec.ts

describe('PublishArticleUseCase — Integration avec InMemory', () => {
  let articleRepo: InMemoryArticleRepository;
  let eventBus: EventBusInMemory;
  let cacheInvalidator: jest.Mocked<CacheInvalidator>;
  let publishingPolicy: jest.Mocked<PublishingPolicy>;
  let useCase: PublishArticleUseCase;

  beforeEach(() => {
    articleRepo = new InMemoryArticleRepository();
    eventBus = new EventBusInMemory();
    cacheInvalidator = { invalidateArticle: jest.fn().mockResolvedValue(undefined) };
    publishingPolicy = { canPublish: jest.fn().mockResolvedValue({ allowed: true }) };

    useCase = new PublishArticleUseCase(
      articleRepo,
      publishingPolicy,
      eventBus,
      cacheInvalidator,
    );
  });

  it('should persist Published status and emit domain event', async () => {
    // Arrange
    const tenantId = new TenantId('tenant-test');
    const article = Article.create({
      tenantId,
      slug: 'mon-article',
      title: new MultiLangField({ fr: 'Mon titre' }),
      body: new MultiLangField({ fr: 'Contenu' }),
      authorId: 'author-1',
    });
    articleRepo.seed(article);

    // Act
    await useCase.execute({
      articleId: article.id.value,
      tenantId: tenantId.value,
      requestedBy: 'author-1',
    });

    // Assert — etat persiste
    const saved = await articleRepo.findById(article.id, tenantId);
    expect(saved!.status).toBe('Published');
    expect(saved!.version).toBe(1);

    // Assert — evenement emis
    const emittedEvents = eventBus.getPublishedEvents();
    expect(emittedEvents).toHaveLength(1);
    expect(emittedEvents[0]).toBeInstanceOf(ArticlePublished);

    // Assert — cache invalide
    expect(cacheInvalidator.invalidateArticle).toHaveBeenCalledOnce();
  });

  it('should not publish if article does not exist', async () => {
    await expect(
      useCase.execute({
        articleId: crypto.randomUUID(),
        tenantId: 'tenant-test',
        requestedBy: 'user-1',
      })
    ).rejects.toThrow(ArticleNotFoundError);
  });
});
```

---

## Résumé

- Le **Repository** abstrait l'accès aux Agregats derriere une interface définie dans le domaine ; l'infrastructure (TypeORM, Prisma, InMemory) implémenté cette interface sans que le domaine en sache quoi que ce soit.
- Contrairement au **DAO** (oriente SQL/colonnes) et a l'**Active Record** (la ligne sait se sauvegarder elle-même), le Repository pense en termes d'Agregats métier et respecte la règle de dépendance.
- Le **Mapper** traduit entre le modèle de domaine et l'entité de persistence : ni le domaine ni TypeORM ne se connaissent mutuellement — le Mapper est le seul traducteur.
- Le **Spécification pattern** transforme chaque critère de recherche en objet composable (`and`, `or`, `not`), eliminant l'explosion combinatoire des méthodes `findByXAndYAndZ` et rendant les critères réutilisables.
- L'**InMemory Repository** est le tresor de la testabilité : zero BDD, zero réseau, tests qui s'executent en millisecondes — il permet de tester les Application Services de façon isolee et deterministeite.


---

> **Lien fil rouge — ShopArch**
>
> - Définis l'interface `ProductRepository` (port) avec les méthodes CRUD + findByCategory
> - Implémente une spécification `ProductInStockSpec` pour filtrer les produits disponibles
> - Exercice(s) associé(s) : `exercices/09-modeliser-domaine/`
> - Checkpoint : Module 02, critère 1

## Prochain cours

[Cours 19 — REST & API Design (Module 03 — Architecture Backend)](../03-architecture-backend/01-rest-api-design.md)

---

<!-- parcours-recommande -->

::: tip Parcours recommandé
1. **Exercice** : [09-modeliser-domaine](../../exercices/09-modeliser-domaine/ENONCE)
2. **Exercice** : [10-bounded-contexts-pratique](../../exercices/10-bounded-contexts-pratique/ENONCE)
3. **Renforcement** : [10b-context-map](../../exercices/10b-context-map/ENONCE)
4. **Exercice** : [11-fsm-commande](../../exercices/11-fsm-commande/ENONCE)
:::
