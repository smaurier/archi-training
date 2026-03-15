# Cours 17 — Domain Events, Services & Workflows

**Objectif :** Comprendre comment les Domain Events capturent les faits métier importants, distinguer Domain Services et Application Services, modéliser des workflows comme des machines a états finis (FSM), et implémenter un audit trail append-only avec invalidation de cache sur transitions.

---

## Rappel du cours précédent

> Cours 16 — Entités, Value Objects & Agregats.

**Question 1 — Pourquoi utilise-t-on des UUID v4 plutot que des IDs sequentiels en base de données ?**

<details>
<summary>Réponse</summary>

Les IDs sequentiels (1, 2, 3...) permettent l'enumeration : un attaquant peut tester `GET /articles/43` après avoir accès a `GET /articles/42`, revelant des ressources auxquelles il n'est pas sense avoir accès (attaque IDOR). Les UUID v4 generent 122 bits d'aleatoire (cryptographiquement sur avec `crypto.randomUUID()`), rendant l'enumeration impossible avec 2^122 possibilités. Ils permettent aussi de générer l'ID côté client sans round-trip en base.

</details>

**Question 2 — Qu'est-ce que l'optimistic locking et pourquoi en a-t-on besoin ?**

<details>
<summary>Réponse</summary>

L'optimistic locking (verrouillage optimiste) détecté les conflits d'edition simultanee sans bloquer les lectures. Chaque entité porte un champ `version` incremente à chaque modification. Lors d'une sauvegarde, on vérifié que la version lue est toujours la version actuelle en base (`WHERE id = ? AND version = ?`). Si une autre transaction a modifie l'entité entre temps, la version ne correspond plus et on leve une erreur de conflit. Cela évité les mises a jour silencieuses qui ecrasent les changements d'un autre utilisateur.

</details>

---

## Analogie

**Domain Event = un titre de journal. Domain Service = un notaire.**

Un titre de journal annonce un fait accompli, irreversible : "L'article a ete publie". Il ne demandé rien, il constate. Il arrive dans votre boite aux lettres, vous en faites ce que vous voulez (l'archiver, prévenir quelqu'un, mettre a jour des statistiques). Le journal ne sait pas ce que vous allez en faire.

Un notaire est un service sans "chez lui" : il n'a pas de dossier propre, mais il effectue des opérations qui impliquent plusieurs parties (vendeur + acheteur) et garantit qu'une règle juridique est respectee (tarif officiel, vérification d'identité). Vous ne lui dites pas comment faire son travail, vous lui donnez les entités concernees.

---

## Théorie

### 1. Domain Events — Faits métier immuables

Un Domain Event represente quelque chose qui s'est passe dans le domaine, exprime au passe, et qui est **immuable** (il ne peut pas etre annule — on compense avec un autre événement).

**Proprietes obligatoires :**
- Nom au passe (`ArticlePublished`, non `PublishArticle`)
- Horodatage (`occurredAt`)
- ID de correlation (`eventId` — UUID v4)
- Données suffisantes pour que les abonnes agissent sans re-requeter

```typescript
// domain/events/domain-event.ts
export abstract class DomainEvent {
  readonly eventId: string;
  readonly occurredAt: Date;

  constructor() {
    this.eventId = crypto.randomUUID();
    this.occurredAt = new Date();
  }
}

// domain/events/article-published.ts
export class ArticlePublished extends DomainEvent {
  constructor(
    readonly articleId: ArticleId,
    readonly tenantId: TenantId,
    readonly publishedAt: Date,
    readonly authorId: string,
    readonly slug: string,
  ) {
    super();
  }
}

// domain/events/article-archived.ts
export class ArticleArchived extends DomainEvent {
  constructor(
    readonly articleId: ArticleId,
    readonly tenantId: TenantId,
    readonly archivedAt: Date,
    readonly archivedBy: string,
  ) {
    super();
  }
}

// domain/events/article-scheduled.ts
export class ArticleScheduled extends DomainEvent {
  constructor(
    readonly articleId: ArticleId,
    readonly tenantId: TenantId,
    readonly scheduledAt: Date,
  ) {
    super();
  }
}
```

### 2. Machine a États Finis (FSM) — Workflow de publication

Un article CMS suit un workflow strict. Modéliser ce workflow comme une FSM rend les transitions explicites, testables et impossibles a contourner.

```
ETATS ET TRANSITIONS — Article CMS

  ┌────────┐  schedule()  ┌───────────┐
  │  DRAFT │ ──────────── │ SCHEDULED │
  │        │              │           │
  │        │ publish()    │           │ publish()
  │        │ ──────────\  │           │ ──────────\
  └────────┘            v └───────────┘            v
     ^              ┌────────────┐             ┌──────────┐
     │  unpublish() │ PUBLISHED  │ archive()   │ ARCHIVED │
     │ ─────────── │            │ ──────────> │          │
     │              └────────────┘             └──────────┘
     │                                              |
     │                           (etat terminal,   |
     │                            pas de retour    |
     │                            possible)        |
     └──────────────────────────────────────────────
       Seule transition retour : unpublish -> Draft

  TRANSITIONS AUTORISEES :
  Draft      -> Scheduled  (schedule)
  Draft      -> Published  (publish)
  Scheduled  -> Published  (publish - heure atteinte)
  Scheduled  -> Draft      (unschedule)
  Published  -> Archived   (archive)
  Published  -> Draft      (unpublish)
  Archived   -> [aucune]   (etat terminal)
```

```typescript
// domain/article-status-machine.ts

export type ArticleStatus = 'Draft' | 'Scheduled' | 'Published' | 'Archived';

interface Transition {
  from: ArticleStatus;
  to: ArticleStatus;
  action: string;
  guard?: (context: TransitionContext) => boolean;
}

interface TransitionContext {
  scheduledAt?: Date;
  now?: Date;
}

const TRANSITIONS: Transition[] = [
  { from: 'Draft',     to: 'Scheduled', action: 'schedule',   guard: ctx => !!ctx.scheduledAt && ctx.scheduledAt > (ctx.now ?? new Date()) },
  { from: 'Draft',     to: 'Published', action: 'publish' },
  { from: 'Scheduled', to: 'Published', action: 'publish',    guard: ctx => !ctx.scheduledAt || ctx.scheduledAt <= (ctx.now ?? new Date()) },
  { from: 'Scheduled', to: 'Draft',     action: 'unschedule' },
  { from: 'Published', to: 'Archived',  action: 'archive' },
  { from: 'Published', to: 'Draft',     action: 'unpublish' },
];

export class ArticleStatusMachine {
  canTransitionTo(
    from: ArticleStatus,
    action: string,
    context: TransitionContext = {},
  ): boolean {
    const transition = TRANSITIONS.find(
      t => t.from === from && t.action === action,
    );
    if (!transition) return false;
    if (transition.guard) return transition.guard(context);
    return true;
  }

  getAvailableActions(status: ArticleStatus): string[] {
    return TRANSITIONS
      .filter(t => t.from === status)
      .map(t => t.action);
  }

  assertCanTransition(
    from: ArticleStatus,
    action: string,
    context: TransitionContext = {},
  ): void {
    if (!this.canTransitionTo(from, action, context)) {
      const allowed = this.getAvailableActions(from);
      throw new InvalidTransitionError(
        `Cannot "${action}" from status "${from}". Allowed actions: [${allowed.join(', ')}]`,
      );
    }
  }
}

export class InvalidTransitionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidTransitionError';
  }
}

// Integration dans l'Agregat Article :
export class Article {
  private static readonly fsm = new ArticleStatusMachine();

  publish(): void {
    Article.fsm.assertCanTransition(this._status, 'publish', { now: new Date(), scheduledAt: this._scheduledAt ?? undefined });

    this._status = 'Published';
    this._publishedAt = new Date();
    this._touch();
    this._domainEvents.push(new ArticlePublished(this._id, this.tenantId, this._publishedAt, this.authorId, this.slug));
  }

  archive(): void {
    Article.fsm.assertCanTransition(this._status, 'archive');
    this._status = 'Archived';
    this._touch();
    this._domainEvents.push(new ArticleArchived(this._id, this.tenantId, new Date(), 'system'));
  }
}
```

### 3. Audit Trail — Append-Only

Un audit trail est une table **en écriture seule** (append-only). Jamais de UPDATE ou DELETE. Chaque changement d'état généré une ligne.

```
TABLE : article_audit_log
┌──────────┬────────────┬────────────┬──────────────┬───────────┬──────────────────────────┐
│ id (UUID)│ article_id │ tenant_id  │ action       │ actor_id  │ occurred_at              │
├──────────┼────────────┼────────────┼──────────────┼───────────┼──────────────────────────┤
│ abc-001  │ art-uuid   │ tenant-01  │ Draft        │ user-1    │ 2026-01-15 09:00:00      │
│ abc-002  │ art-uuid   │ tenant-01  │ Scheduled    │ user-1    │ 2026-01-15 10:30:00      │
│ abc-003  │ art-uuid   │ tenant-01  │ Published    │ system    │ 2026-01-16 08:00:00      │
│ abc-004  │ art-uuid   │ tenant-01  │ Archived     │ user-2    │ 2026-03-01 14:22:00      │
└──────────┴────────────┴────────────┴──────────────┴───────────┴──────────────────────────┘

REGLES :
  - Pas de colonne updatedAt dans cette table (c'est immuable)
  - Indexer sur (article_id, tenant_id) pour reconstruire l'historique
  - Partitionner par occurred_at si volume > 10M lignes
```

```typescript
// application/listeners/audit-trail.listener.ts

export interface AuditEntry {
  id: string;
  aggregateId: string;
  aggregateType: string;
  tenantId: string;
  action: string;
  actorId: string;
  metadata: Record<string, unknown>;
  occurredAt: Date;
}

export class AuditTrailListener {
  constructor(private readonly auditRepository: AuditRepository) {}

  async onArticlePublished(event: ArticlePublished): Promise<void> {
    await this.auditRepository.append({
      id: crypto.randomUUID(),
      aggregateId: event.articleId.value,
      aggregateType: 'Article',
      tenantId: event.tenantId.value,
      action: 'Published',
      actorId: event.authorId,
      metadata: { publishedAt: event.publishedAt.toISOString() },
      occurredAt: event.occurredAt,
    });
  }

  async onArticleArchived(event: ArticleArchived): Promise<void> {
    await this.auditRepository.append({
      id: crypto.randomUUID(),
      aggregateId: event.articleId.value,
      aggregateType: 'Article',
      tenantId: event.tenantId.value,
      action: 'Archived',
      actorId: event.archivedBy,
      metadata: {},
      occurredAt: event.occurredAt,
    });
  }
}
```

### 4. Domain Services vs Application Services

| Aspect | Domain Service | Application Service |
|---|---|---|
| Responsabilite | Logique métier impliquant plusieurs agregats | Orchestration du flux applicatif |
| Dependances | Autres agregats, pas d'infrastructure | Repositories, Domain Services, Event Bus |
| Testabilite | Tests unitaires purs | Tests d'intégration |
| Exemples | `PricingService`, `InventoryChecker` | `PublishArticleUseCase`, `CreateOrderUseCase` |
| État | Stateless | Stateless |

```typescript
// ── Domain Service — logique metier pure ─────────────────────

// domain/services/slug-uniqueness-checker.ts
// Verifier l'unicite d'un slug implique plusieurs agregats (ou une query)
// -> Domain Service car c'est une regle metier (unicite par tenant)
export interface SlugUniquenessChecker {
  isUnique(slug: string, tenantId: TenantId, excludeArticleId?: ArticleId): Promise<boolean>;
}

// domain/services/publishing-policy.ts
// Regle metier : un article ne peut etre publie que si le tenant a
// un abonnement actif et que le quota mensuel n'est pas atteint
export class PublishingPolicy {
  constructor(
    private readonly subscriptionChecker: SubscriptionChecker,
    private readonly quotaChecker: QuotaChecker,
  ) {}

  async canPublish(tenantId: TenantId): Promise<{ allowed: boolean; reason?: string }> {
    const hasActiveSubscription = await this.subscriptionChecker.isActive(tenantId);
    if (!hasActiveSubscription) {
      return { allowed: false, reason: 'No active subscription' };
    }

    const quotaExceeded = await this.quotaChecker.isMonthlyQuotaExceeded(tenantId);
    if (quotaExceeded) {
      return { allowed: false, reason: 'Monthly publication quota exceeded' };
    }

    return { allowed: true };
  }
}

// ── Application Service — orchestration ───────────────────────

// application/use-cases/publish-article.use-case.ts
export interface PublishArticleCommand {
  articleId: string;
  tenantId: string;
  requestedBy: string;
}

export class PublishArticleUseCase {
  constructor(
    private readonly articleRepository: ArticleRepository,
    private readonly publishingPolicy: PublishingPolicy,
    private readonly eventBus: DomainEventBus,
    private readonly cacheInvalidator: CacheInvalidator,
  ) {}

  async execute(command: PublishArticleCommand): Promise<void> {
    // 1. Charger l'agregat
    const tenantId = new TenantId(command.tenantId);
    const articleId = ArticleId.fromString(command.articleId);
    const article = await this.articleRepository.findById(articleId, tenantId);

    if (!article) {
      throw new ArticleNotFoundError(command.articleId);
    }

    // 2. Verifier la politique metier (Domain Service)
    const policy = await this.publishingPolicy.canPublish(tenantId);
    if (!policy.allowed) {
      throw new PublicationForbiddenError(policy.reason!);
    }

    // 3. Executer la transition (via l'Agregat)
    article.publish(); // La FSM valide la transition

    // 4. Persister (version check = optimistic locking)
    await this.articleRepository.save(article);

    // 5. Publier les Domain Events
    const events = article.pullDomainEvents();
    for (const event of events) {
      await this.eventBus.publish(event);
    }

    // 6. Invalider le cache (apres la transaction)
    await this.cacheInvalidator.invalidateArticle(
      command.articleId,
      command.tenantId,
    );
  }
}
```

### 5. Invalidation de cache sur transitions

```typescript
// infrastructure/cache/cache-invalidator.ts

export class RedisCacheInvalidator implements CacheInvalidator {
  constructor(private readonly redis: RedisClient) {}

  async invalidateArticle(articleId: string, tenantId: string): Promise<void> {
    // Invalider toutes les cles liees a cet article
    const patterns = [
      `tenant:${tenantId}:article:${articleId}`,         // detail
      `tenant:${tenantId}:articles:*`,                    // toutes les listes
      `tenant:${tenantId}:sitemap`,                        // sitemap XML
      `tenant:${tenantId}:rss`,                            // flux RSS
    ];

    // UNLINK est non-bloquant (contrairement a DEL)
    await Promise.all(
      patterns.map(pattern =>
        pattern.includes('*')
          ? this.redis.eval(                               // SCAN + UNLINK pour les wildcards
              `local keys = redis.call('KEYS', ARGV[1])
               if #keys > 0 then redis.call('UNLINK', unpack(keys)) end
               return #keys`,
              0, pattern
            )
          : this.redis.unlink(pattern)
      )
    );
  }
}

// Listener qui ecoute les Domain Events et invalide le cache
export class ArticleCacheListener {
  constructor(private readonly cacheInvalidator: CacheInvalidator) {}

  async onArticlePublished(event: ArticlePublished): Promise<void> {
    await this.cacheInvalidator.invalidateArticle(
      event.articleId.value,
      event.tenantId.value,
    );
  }

  async onArticleArchived(event: ArticleArchived): Promise<void> {
    await this.cacheInvalidator.invalidateArticle(
      event.articleId.value,
      event.tenantId.value,
    );
  }
}
```

---

## Pratique

### Tests de la FSM — Tous les cas de transition

```typescript
// domain/__tests__/article-status-machine.spec.ts
import { ArticleStatusMachine } from '../article-status-machine';

describe('ArticleStatusMachine', () => {
  const fsm = new ArticleStatusMachine();
  const futureDate = new Date(Date.now() + 86400000); // demain
  const pastDate = new Date(Date.now() - 86400000);   // hier

  describe('canTransitionTo', () => {
    it('Draft -> Scheduled is allowed when scheduledAt is in the future', () => {
      expect(fsm.canTransitionTo('Draft', 'schedule', { scheduledAt: futureDate })).toBe(true);
    });

    it('Draft -> Scheduled is denied when scheduledAt is in the past', () => {
      expect(fsm.canTransitionTo('Draft', 'schedule', { scheduledAt: pastDate })).toBe(false);
    });

    it('Draft -> Published is always allowed', () => {
      expect(fsm.canTransitionTo('Draft', 'publish')).toBe(true);
    });

    it('Scheduled -> Published is allowed when time has come', () => {
      expect(fsm.canTransitionTo('Scheduled', 'publish', { scheduledAt: pastDate, now: new Date() })).toBe(true);
    });

    it('Archived is a terminal state — no transitions allowed', () => {
      const actions = fsm.getAvailableActions('Archived');
      expect(actions).toHaveLength(0);
    });

    it('Published cannot be scheduled again', () => {
      expect(fsm.canTransitionTo('Published', 'schedule')).toBe(false);
    });
  });

  describe('assertCanTransition', () => {
    it('should throw InvalidTransitionError with helpful message', () => {
      expect(() => fsm.assertCanTransition('Archived', 'publish'))
        .toThrow('Cannot "publish" from status "Archived". Allowed actions: []');
    });
  });
});

// application/__tests__/publish-article.use-case.spec.ts
describe('PublishArticleUseCase', () => {
  it('should publish article, save, emit events and invalidate cache', async () => {
    const article = Article.create({ /* ... */ });
    const mockRepo = { findById: jest.fn().mockResolvedValue(article), save: jest.fn() };
    const mockPolicy = { canPublish: jest.fn().mockResolvedValue({ allowed: true }) };
    const mockEventBus = { publish: jest.fn() };
    const mockCache = { invalidateArticle: jest.fn() };

    const useCase = new PublishArticleUseCase(mockRepo, mockPolicy, mockEventBus, mockCache);
    await useCase.execute({ articleId: article.id.value, tenantId: 'tenant-1', requestedBy: 'user-1' });

    expect(mockRepo.save).toHaveBeenCalledWith(article);
    expect(mockEventBus.publish).toHaveBeenCalledWith(expect.objectContaining({ constructor: { name: 'ArticlePublished' } }));
    expect(mockCache.invalidateArticle).toHaveBeenCalledWith(article.id.value, 'tenant-1');
  });

  it('should throw when publishing policy denies it', async () => {
    const article = Article.create({ /* ... */ });
    const mockRepo = { findById: jest.fn().mockResolvedValue(article) };
    const mockPolicy = { canPublish: jest.fn().mockResolvedValue({ allowed: false, reason: 'Quota exceeded' }) };

    const useCase = new PublishArticleUseCase(mockRepo, mockPolicy, {} as any, {} as any);

    await expect(
      useCase.execute({ articleId: article.id.value, tenantId: 'tenant-1', requestedBy: 'user-1' })
    ).rejects.toThrow('Quota exceeded');
  });
});
```

---

## Résumé

- Un **Domain Event** est un fait métier immutable, nomme au passe (`ArticlePublished`), horodate et auto-identifie ; les abonnes agissent dessus sans que l'emetteur sache ce qu'ils font.
- La **FSM (machine a états finis)** encode les transitions autorisees de façon exhaustive et testable : `canTransitionTo()` et `assertCanTransition()` remplacent les cascades de `if/else` episparses.
- Un **Domain Service** porte de la logique métier qui implique plusieurs agregats ou une règle sans foyer naturel ; un **Application Service** orchestre le flux (charger, valider, exécuter, sauvegarder, publier événements).
- L'**audit trail append-only** enregistre chaque transition d'état sans jamais effacer : il fournit un historique complet et immuable de la vie de chaque entité.
- L'**invalidation de cache** se fait après la persistance, en réponse aux Domain Events, avec `UNLINK` Redis (non-bloquant) sur toutes les clés affectees par la transition.


---

> **Lien fil rouge — ShopArch**
>
> - Définis les domain events de ShopArch : `OrderPlaced`, `PaymentReceived`, `StockUpdated`
> - Implémente un handler qui envoie un email de confirmation quand `OrderPlaced` est émis
> - Exercice(s) associé(s) : `exercices/11-fsm-commande/`
> - Checkpoint : Module 02, critère 3

## Prochain cours

[Cours 18 — Repositories & Specifications](./05-repositories-spécifications.md)
