# Cours 16 — Entités, Value Objects & Agregats

**Objectif :** Distinguer ce qui à une identité (Entité) de ce qui n'en a pas (Value Object), comprendre pourquoi les Agregats sont les garantes de la cohérence métier, et maîtriser les patterns UUID v4, soft delete, optimistic locking et i18n JSON.

---

## Rappel du cours précédent

> Cours 15 — Bounded Contexts & Context Map.

**Question 1 — Qu'est-ce qu'une Anti-Corruption Layer (ACL) et quand l'utiliser ?**

<details>
<summary>Réponse</summary>

Une ACL est une couche de traduction qui isole votre domaine d'un modèle externe (API tierce, legacy, autre contexte). Elle convertit le vocabulaire et la structure de l'exterieur vers votre modèle interne, sans que votre domaine sache quoi que ce soit du système externe. On l'utilise quand le modèle externe est chaotique, instable, ou lorsqu'une refonte de l'existant n'est pas possible. Exemple : recevoir un webhook Stripe et le convertir en `PaymentConfirmed` de votre domaine.

</details>

**Question 2 — Pourquoi un Bounded Context ne doit-il pas partager ses entités avec un autre contexte ?**

<details>
<summary>Réponse</summary>

Partager une entité entre deux contextes créé un couplage fort : un changement de schema dans le contexte A force une modification dans le contexte B. Les deux équipes se bloquent mutuellement. De plus, la même entité prend des formes très différentes selon le contexte (un "Produit" dans le catalogue a des images, des variantes, un SEO ; dans une commande, c'est un snapshot avec le prix au moment de l'achat). La solution : chaque contexte a son propre modèle, et les contextes communiquent par IDs et événements.

</details>

---

## Analogie

**Entité = une personne. Value Object = un billet de banque. Agregat = une famille.**

- **Entité** : Marie Dupont est une personne. Si elle change de nom, de couleur de cheveux, d'adresse, c'est toujours la même personne. Son **identité** (numéro de sécurité sociale) ne change jamais. Deux personnes avec le même prenom ne sont pas la même personne.

- **Value Object** : Un billet de 20 euros n'a pas d'identité propre. Deux billets de 20 euros sont **interchangeables**. Ce qui compte, c'est la valeur, pas le numéro de serie. Si vous dechirez un billet et en collez les morceaux, ce n'est plus un billet valide — les Value Objects sont **immuables**.

- **Agregat** : Une famille est une unite cohérente. Vous ne pouvez pas adopter un enfant (modifier la composition de la famille) sans passer par les parents (la Racine d'Agregat). On ne parle pas directement a l'enfant pour modifier la structure familiale : toutes les modifications passent par une interface controlee.

---

## Théorie

### 1. Entité (Entity)

Une Entité est un objet défini par son **identité**, qui persiste au travers des changements d'état.

**Caractéristiques :**
- Possede un identifiant unique (ID)
- Peut changer d'état au fil du temps
- Deux entités avec le même ID sont la même entité, même si leurs attributs différent
- Cycle de vie : création, modification, (eventuelle) suppression

```
  Article (Entite)
  ┌────────────────────────────────────────────────────┐
  │  id: ArticleId  <── identite stable, ne change pas │
  │  title: "Mon article"  <── peut changer            │
  │  status: Draft  <── peut changer                   │
  │  publishedAt: null  <── peut changer               │
  └────────────────────────────────────────────────────┘

  Comparaison d'entites : article1.id === article2.id
  (PAS : article1.title === article2.title)
```

#### UUID v4 — Prevention des IDOR

L'utilisation d'UUIDs v4 comme identifiants est une decision de sécurité, pas seulement technique.

```
IDOR (Insecure Direct Object Reference) avec des IDs sequentiels :
  GET /articles/42  -> OK, je lis l'article 42
  GET /articles/43  -> Tiens, l'article du client concurrent...
  GET /articles/1   -> Le premier article du systeme, souvent pas protege

AVEC UUID v4 :
  GET /articles/550e8400-e29b-41d4-a716-446655440000  -> OK
  GET /articles/550e8400-e29b-41d4-a716-446655440001  -> 404 (UUID invalide)
  Enumeration impossible : 2^122 possibilites
```

```typescript
// entity/article-id.ts
import { randomUUID } from 'crypto';

export class ArticleId {
  readonly value: string;

  private constructor(value: string) {
    if (!ArticleId.isValid(value)) {
      throw new Error(`Invalid ArticleId: "${value}"`);
    }
    this.value = value;
  }

  static generate(): ArticleId {
    return new ArticleId(randomUUID()); // UUID v4 cryptographiquement sur
  }

  static fromString(value: string): ArticleId {
    return new ArticleId(value);
  }

  private static isValid(value: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value);
  }

  equals(other: ArticleId): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
```

### 2. Value Object (VO)

Un Value Object est un objet défini par ses **attributs**, sans identité propre. Il est **immuable** : toute "modification" créé un nouvel objet.

**Caractéristiques :**
- Pas d'ID
- Immuable (readonly sur tous les champs)
- Comparaison par valeur, pas par référence
- Self-validating (valide ses propres invariants à la construction)
- Souvent riche en logique métier

| | Entité | Value Object |
|---|---|---|
| Identité | Oui (UUID) | Non |
| Mutabilite | Oui (état change) | Non (immuable) |
| Comparaison | Par ID | Par valeur |
| Exemples | Article, Order, User | Money, Email, Address, DateRange |

```typescript
// value-objects/money.ts
export class Money {
  readonly amount: number;   // En centimes pour eviter les floats
  readonly currency: string; // ISO 4217 : 'EUR', 'USD'

  constructor(amount: number, currency: string) {
    if (amount < 0) throw new Error('Money cannot be negative');
    if (!/^[A-Z]{3}$/.test(currency)) throw new Error(`Invalid currency: ${currency}`);
    this.amount = Math.round(amount); // Toujours entier (centimes)
    this.currency = currency;
  }

  add(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(this.amount + other.amount, this.currency);
  }

  multiply(factor: number): Money {
    if (factor < 0) throw new Error('Factor cannot be negative');
    return new Money(Math.round(this.amount * factor), this.currency);
  }

  equals(other: Money): boolean {
    return this.amount === other.amount && this.currency === other.currency;
  }

  format(locale = 'fr-FR'): string {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: this.currency,
      minimumFractionDigits: 2,
    }).format(this.amount / 100);
  }

  private assertSameCurrency(other: Money): void {
    if (this.currency !== other.currency) {
      throw new Error(`Cannot mix currencies: ${this.currency} vs ${other.currency}`);
    }
  }
}

// value-objects/email.ts
export class Email {
  readonly value: string;

  constructor(value: string) {
    const normalized = value.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
      throw new Error(`Invalid email: ${value}`);
    }
    this.value = normalized;
  }

  get domain(): string {
    return this.value.split('@')[1];
  }

  get localPart(): string {
    return this.value.split('@')[0];
  }

  equals(other: Email): boolean {
    return this.value === other.value;
  }
}

// value-objects/multi-lang-field.ts
// Pattern JSON i18n pour CMS multi-langue
export type SupportedLocale = 'fr' | 'en' | 'de' | 'es';

export class MultiLangField {
  private readonly translations: Readonly<Record<SupportedLocale, string>>;

  constructor(translations: Partial<Record<SupportedLocale, string>>) {
    if (!translations.fr && !translations.en) {
      throw new Error('At least one translation (fr or en) is required');
    }
    this.translations = Object.freeze({ ...translations } as Record<SupportedLocale, string>);
  }

  get(locale: SupportedLocale, fallback: SupportedLocale = 'fr'): string {
    return this.translations[locale] ?? this.translations[fallback] ?? '';
  }

  withTranslation(locale: SupportedLocale, value: string): MultiLangField {
    return new MultiLangField({ ...this.translations, [locale]: value });
  }

  toJSON(): Record<SupportedLocale, string> {
    return { ...this.translations };
  }

  // Stockage en BDD : colonne JSONB
  // { "fr": "Mon titre", "en": "My title", "de": "Mein Titel" }
}
```

### 3. Agregat (Aggregate)

Un Agregat est un **groupe d'objets** (entités + value objects) traite comme une unite de cohérence. Il à une **Racine d'Agregat** (Aggregate Root) qui est le seul point d'entree pour les modifications.

**Regles d'or des Agregats :**

```
REGLES AGREGAT
  1. Toute modification passe par la Racine
  2. Les objets externes ne referencent que la Racine (par son ID)
  3. Un Agregat est charge et sauvegarde en entier
  4. Les invariants metier sont garantis a l'interieur de l'Agregat
  5. Un Agregat ne reference pas directement un autre Agregat (seulement son ID)
```

```
AGREGAT : Order (Commande)
                                                     ┌──────────────┐
  ┌─────────────────────────────────────────┐        │   Product    │
  │  Order (Aggregate Root)                  │   ID  │  (Autre AG)  │
  │  ──────────────────────────────────────  │ ────> │              │
  │  id: OrderId                             │       └──────────────┘
  │  customerId: CustomerId (ID only)        │
  │  status: OrderStatus                     │       ┌──────────────┐
  │  shippingAddress: Address (VO)  <────────┤       │   Customer   │
  │                                          │   ID  │  (Autre AG)  │
  │  lines: OrderLine[]  <─────────────────  │ ────> │              │
  │    ├── productId: ProductId (ID only)    │       └──────────────┘
  │    ├── productName: string (snapshot)    │
  │    ├── unitPrice: Money (VO)             │
  │    └── quantity: number                  │
  │                                          │
  │  METHODES METIER (encapsulation)         │
  │  addLine(productId, name, price, qty)    │
  │  removeLine(productId)                   │
  │  confirm()                               │
  │  cancel(reason)                          │
  └─────────────────────────────────────────┘

  INTERDIT : orderLine.unitPrice = new Money(10, 'EUR')  <- modif directe
  CORRECT  : order.updateLineQuantity(productId, newQty) <- via la racine
```

#### Soft Delete

Les entités métier importantes ne se suppriment généralement pas physiquement. Un soft delete preserve l'historique et les références.

```typescript
// Champ standard pour soft delete
interface SoftDeletable {
  deletedAt: Date | null;  // null = actif, Date = desactive
  deletedBy: string | null; // ID de l'admin qui a supprime
}
```

#### Version field — Optimistic Locking

Sans protection, deux utilisateurs editant le même article simultanement peuvent provoquer des pertes de données.

```
SCENARIO SANS OPTIMISTIC LOCKING :
  t=0  : Alice lit article v1 (titre: "Hello")
  t=0  : Bob lit article v1 (titre: "Hello")
  t=5  : Alice sauvegarde -> article v2 (titre: "Hello World")
  t=10 : Bob sauvegarde -> article v2 (titre: "Bonjour") ← ecrase Alice!

AVEC OPTIMISTIC LOCKING :
  t=0  : Alice lit article v1
  t=0  : Bob lit article v1
  t=5  : Alice sauvegarde avec version=1 -> OK, article passe en v2
  t=10 : Bob sauvegarde avec version=1 -> ERREUR : version actuelle=2, conflit detecte
         Bob doit relire l'article et reappliquer ses modifications
```

### 4. L'Agregat Article — Implémentation complete

```typescript
// article/domain/article.ts

import { ArticleId } from './article-id';
import { TenantId } from '../../shared/tenant-id';
import { MultiLangField } from './value-objects/multi-lang-field';
import { ArticlePublished, ArticleArchived, DomainEvent } from './events';

export type ArticleStatus = 'Draft' | 'Scheduled' | 'Published' | 'Archived';

export interface ArticleProps {
  id: ArticleId;
  tenantId: TenantId;
  slug: string;
  title: MultiLangField;
  body: MultiLangField;
  status: ArticleStatus;
  authorId: string;
  tags: string[];
  scheduledAt: Date | null;
  publishedAt: Date | null;
  deletedAt: Date | null;
  deletedBy: string | null;
  version: number; // Optimistic locking
  createdAt: Date;
  updatedAt: Date;
}

export class Article {
  private readonly _id: ArticleId;
  private _title: MultiLangField;
  private _body: MultiLangField;
  private _status: ArticleStatus;
  private _tags: string[];
  private _scheduledAt: Date | null;
  private _publishedAt: Date | null;
  private _deletedAt: Date | null;
  private _deletedBy: string | null;
  private _version: number;
  private _updatedAt: Date;
  private _domainEvents: DomainEvent[] = [];

  // Proprietes immutables
  readonly tenantId: TenantId;
  readonly authorId: string;
  readonly slug: string;
  readonly createdAt: Date;

  private constructor(props: ArticleProps) {
    this._id = props.id;
    this.tenantId = props.tenantId;
    this.slug = props.slug;
    this._title = props.title;
    this._body = props.body;
    this._status = props.status;
    this.authorId = props.authorId;
    this._tags = [...props.tags];
    this._scheduledAt = props.scheduledAt;
    this._publishedAt = props.publishedAt;
    this._deletedAt = props.deletedAt;
    this._deletedBy = props.deletedBy;
    this._version = props.version;
    this.createdAt = props.createdAt;
    this._updatedAt = props.updatedAt;
  }

  // ── Factory : creation d'un nouvel article ─────────────────
  static create(params: {
    tenantId: TenantId;
    slug: string;
    title: MultiLangField;
    body: MultiLangField;
    authorId: string;
  }): Article {
    if (!params.slug.match(/^[a-z0-9-]+$/)) {
      throw new Error(`Invalid slug: "${params.slug}"`);
    }

    const now = new Date();
    return new Article({
      id: ArticleId.generate(),
      tenantId: params.tenantId,
      slug: params.slug,
      title: params.title,
      body: params.body,
      status: 'Draft',
      authorId: params.authorId,
      tags: [],
      scheduledAt: null,
      publishedAt: null,
      deletedAt: null,
      deletedBy: null,
      version: 0,
      createdAt: now,
      updatedAt: now,
    });
  }

  // ── Factory : reconstitution depuis la BDD ─────────────────
  static reconstitute(props: ArticleProps): Article {
    return new Article(props);
  }

  // ── Accesseurs ─────────────────────────────────────────────
  get id(): ArticleId { return this._id; }
  get title(): MultiLangField { return this._title; }
  get body(): MultiLangField { return this._body; }
  get status(): ArticleStatus { return this._status; }
  get tags(): readonly string[] { return this._tags; }
  get version(): number { return this._version; }
  get isDeleted(): boolean { return this._deletedAt !== null; }
  get publishedAt(): Date | null { return this._publishedAt; }

  // ── Logique metier ─────────────────────────────────────────
  updateContent(title: MultiLangField, body: MultiLangField): void {
    if (this._status === 'Published' || this._status === 'Archived') {
      throw new Error(`Cannot edit article in status "${this._status}"`);
    }
    if (this.isDeleted) throw new Error('Cannot edit a deleted article');

    this._title = title;
    this._body = body;
    this._touch();
  }

  addTag(tag: string): void {
    const normalized = tag.toLowerCase().trim();
    if (!this._tags.includes(normalized)) {
      this._tags = [...this._tags, normalized];
      this._touch();
    }
  }

  publish(): void {
    if (this._status !== 'Draft' && this._status !== 'Scheduled') {
      throw new Error(`Cannot publish article in status "${this._status}"`);
    }
    this._status = 'Published';
    this._publishedAt = new Date();
    this._touch();

    this._domainEvents.push(new ArticlePublished(this._id, this.tenantId, this._publishedAt));
  }

  archive(): void {
    if (this._status !== 'Published') {
      throw new Error(`Cannot archive article in status "${this._status}"`);
    }
    this._status = 'Archived';
    this._touch();

    this._domainEvents.push(new ArticleArchived(this._id, this.tenantId, new Date()));
  }

  softDelete(deletedBy: string): void {
    if (this.isDeleted) throw new Error('Article already deleted');
    this._deletedAt = new Date();
    this._deletedBy = deletedBy;
    this._touch();
  }

  // ── Gestion des evenements ─────────────────────────────────
  pullDomainEvents(): DomainEvent[] {
    const events = [...this._domainEvents];
    this._domainEvents = [];
    return events;
  }

  // ── Helpers prives ─────────────────────────────────────────
  private _touch(): void {
    this._updatedAt = new Date();
    this._version += 1;
  }
}
```

---

## Pratique

### Tests unitaires — Domaine pur, zero infrastructure

```typescript
// article/domain/__tests__/article.spec.ts
import { Article } from '../article';
import { ArticleId } from '../article-id';
import { TenantId } from '../../../shared/tenant-id';
import { MultiLangField } from '../value-objects/multi-lang-field';

describe('Article — Aggregate', () => {
  const buildArticle = () =>
    Article.create({
      tenantId: new TenantId('tenant-abc'),
      slug: 'mon-article',
      title: new MultiLangField({ fr: 'Mon titre', en: 'My title' }),
      body: new MultiLangField({ fr: 'Contenu...', en: 'Content...' }),
      authorId: 'author-uuid',
    });

  describe('creation', () => {
    it('should start in Draft status', () => {
      const article = buildArticle();
      expect(article.status).toBe('Draft');
      expect(article.version).toBe(0);
      expect(article.isDeleted).toBe(false);
    });

    it('should reject invalid slug', () => {
      expect(() =>
        Article.create({
          tenantId: new TenantId('tenant-abc'),
          slug: 'Mon Titre Avec Espaces!!',
          title: new MultiLangField({ fr: 'Mon titre' }),
          body: new MultiLangField({ fr: 'Contenu' }),
          authorId: 'author-uuid',
        })
      ).toThrow('Invalid slug');
    });
  });

  describe('publication', () => {
    it('should publish a Draft article and emit ArticlePublished event', () => {
      const article = buildArticle();
      article.publish();

      expect(article.status).toBe('Published');
      expect(article.publishedAt).toBeInstanceOf(Date);
      expect(article.version).toBe(1);

      const events = article.pullDomainEvents();
      expect(events).toHaveLength(1);
      expect(events[0].constructor.name).toBe('ArticlePublished');
    });

    it('should not publish an already Published article', () => {
      const article = buildArticle();
      article.publish();
      expect(() => article.publish()).toThrow('Cannot publish article in status "Published"');
    });
  });

  describe('Money Value Object', () => {
    it('should add two Money values of same currency', () => {
      const price = new Money(1000, 'EUR'); // 10.00 EUR
      const tax = new Money(200, 'EUR');    // 2.00 EUR
      const total = price.add(tax);

      expect(total.amount).toBe(1200);
      expect(total.format()).toBe('12,00 €');
    });

    it('should throw when mixing currencies', () => {
      const eur = new Money(1000, 'EUR');
      const usd = new Money(1000, 'USD');
      expect(() => eur.add(usd)).toThrow('Cannot mix currencies');
    });
  });

  describe('MultiLangField', () => {
    it('should return translation for requested locale', () => {
      const field = new MultiLangField({ fr: 'Bonjour', en: 'Hello' });
      expect(field.get('fr')).toBe('Bonjour');
      expect(field.get('en')).toBe('Hello');
    });

    it('should fallback to fr when locale missing', () => {
      const field = new MultiLangField({ fr: 'Bonjour' });
      expect(field.get('de')).toBe('Bonjour'); // fallback
    });

    it('should be immutable — withTranslation returns new instance', () => {
      const original = new MultiLangField({ fr: 'Bonjour' });
      const updated = original.withTranslation('en', 'Hello');

      expect(original.get('en')).toBe(''); // original inchange
      expect(updated.get('en')).toBe('Hello');
    });
  });
});
```

---

## Résumé

- Une **Entité** est définie par son identité stable (UUID v4) et peut changer d'état au fil du temps ; les UUIDs v4 empechent les attaques IDOR par enumeration.
- Un **Value Object** est défini par sa valeur, est immuable et auto-validant : `Money`, `Email`, `MultiLangField` encapsulent leurs invariants et leur logique métier.
- Un **Agregat** garantit la cohérence métier d'un groupe d'objets : toute modification passe par la Racine, les autres agregats ne sont références que par leur ID.
- Le **soft delete** (`deletedAt`, `deletedBy`) preserves l'historique métier ; le **version field** (+1 à chaque modification) permet le verrouillage optimiste et détecté les conflits d'edition simultanee.
- Le champ **MultiLangField** stocke les traductions en JSONB (`{ "fr": "...", "en": "..." }`) et encapsule la logique de fallback — un seul champ géré l'internationalisation sans tables de traduction séparées.


---

> **Lien fil rouge — ShopArch**
>
> - Classifie chaque concept ShopArch en Entité, Value Object ou Agrégat
> - Implémente les VOs Money et Email avec validation et immutabilité (cf. `src/domain/shared/`)
> - Exercice(s) associé(s) : `exercices/09-modeliser-domaine/`
> - Checkpoint : Module 02, critère 1

## Prochain cours

[Cours 17 — Domain Events, Services & Workflows](./04-domain-events-services.md)
