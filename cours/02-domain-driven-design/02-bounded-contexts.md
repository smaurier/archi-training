# Cours 15 — Bounded Contexts & Context Map

**Objectif :** Comprendre comment delimiter les modèles métier en contextes independants, cartographier leurs relations, et éviter le piege du modèle unique global qui rend tout rigide.

---

## Rappel du cours précédent

> Cours 14 — Introduction au DDD.

**Question 1 — Quelle est la différence entre DDD Stratégique et DDD Tactique ?**

<details>
<summary>Réponse</summary>

Le DDD Stratégique repond a "quoi construire" : il définit les Bounded Contexts (frontieres des modèles), la Context Map (relations entre contextes), et classe les sous-domaines en Core / Supporting / Generic. Le DDD Tactique repond a "comment le modéliser" : il fournit les briques de construction (Entités, Value Objects, Agregats, Domain Events, Repositories). Sans stratégique, le tactique est applique au mauvais endroit et ne resout rien.

</details>

**Question 2 — Pourquoi "user" est-il un terme dangereux dans un grand système ?**

<details>
<summary>Réponse</summary>

"User" est polysemique : selon le contexte, il peut designer un visiteur anonyme, un client ayant passe commande, un administrateur, un vendeur partenaire, un support agent... Regrouper tous ces roles dans une seule entité `User` avec des dizaines de champs optionnels conduit a un modèle impossible a maintenir. Le Langage Ubiquitaire impose de donner a chaque concept un nom precis dans son contexte : `Customer`, `Administrator`, `Vendor`, `SupportAgent`.

</details>

---

## Analogie

**Les pays avec leurs frontieres.**

La France et l'Allemagne ont toutes les deux un concept de "carte d'identité". Mais la carte d'identité francaise et le Personalausweis allemand sont des documents tres différents : formats, champs, validite, usages. Si vous essayez de créer une "carte d'identité universelle europeenne" qui satisfait les deux pays, vous obtenez un document si complexe qu'il ne satisfait parfaitement aucun des deux.

La solution : chaque pays garde son propre document, et on définit une **interface de traduction** aux frontieres (accords de reconnaissance mutuelle).

Un **Bounded Context**, c'est un pays : il a son propre modèle, son propre vocabulaire, ses propres règles. La **Context Map**, c'est la carte des traites entre pays : qui fournit quoi a qui, et comment les données traversent les frontieres.

---

## Théorie

### 1. Qu'est-ce qu'un Bounded Context ?

Un Bounded Context est une **frontiere explicite** a l'interieur de laquelle un modèle de domaine a un sens precis et cohérent. En dehors de cette frontiere, le meme terme peut avoir un sens différent.

```
EXEMPLE E-COMMERCE : LE MOT "PRODUIT"

  Contexte Catalogue              Contexte Commande
  ┌──────────────────────┐        ┌──────────────────────┐
  │  Product             │        │  OrderLine           │
  │  ─────────────────── │        │  ─────────────────── │
  │  id: ProductId       │        │  productId: string   │
  │  name: MultiLangName │        │  productName: string │ <- snapshot au moment
  │  description: Html   │        │  unitPrice: Money    │    de la commande
  │  images: Image[]     │        │  quantity: number    │
  │  seoSlug: string     │        │  taxRate: Percentage │
  │  categories: Cat[]   │        │                      │
  │  variants: Variant[] │        │  // PAS de lien live │
  │  stock: StockLevel   │        │  // vers le catalogue│
  └──────────────────────┘        └──────────────────────┘

  Meme "produit", deux modeles completement differents.
  La commande capture un snapshot : si le prix change demain,
  les anciennes commandes ne sont pas affectees.
```

**Pourquoi ne pas partager une seule entité `Product` ?**

Si `Order` référence directement l'entité `Product` du catalogue :
- Un changement de schema du catalogue casse les commandes
- Vous ne pouvez pas supprimer un produit sans vérifier toutes les commandes
- Les performances souffrent (jointures partout)
- Les deux équipes se bloquent mutuellement

### 2. Identifier les Bounded Contexts

Signaux qui indiquent une frontiere de contexte :

```
SIGNAUX DE FRONTIERE
  1. Le meme mot a des definitions differentes selon l'interlocuteur
  2. Une equipe differente est responsable de cette partie
  3. Le rythme de changement est different (catalogue change rarement, panier change souvent)
  4. Les modeles de donnees sont structurellement differents
  5. Les exigences de disponibilite / consistance sont differentes
```

**Exemple — Plateforme e-commerce complete :**

```
┌─────────────────────────────────────────────────────────────────┐
│                    E-COMMERCE PLATFORM                          │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │   CATALOG    │  │   ORDERING   │  │    INVENTORY         │  │
│  │              │  │              │  │                      │  │
│  │ Product      │  │ Order        │  │ StockItem            │  │
│  │ Category     │  │ OrderLine    │  │ Warehouse            │  │
│  │ Variant      │  │ Customer     │  │ Reservation          │  │
│  │ Price        │  │ ShippingAddr │  │ Restock              │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │   PAYMENT    │  │   SHIPPING   │  │    NOTIFICATION      │  │
│  │              │  │              │  │                      │  │
│  │ Transaction  │  │ Shipment     │  │ EmailTemplate        │  │
│  │ Refund       │  │ Carrier      │  │ Recipient            │  │
│  │ Invoice      │  │ TrackingEvt  │  │ Channel              │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### 3. Context Map — Cartographier les relations

La Context Map documente comment les contextes interagissent. Six types de relations :

#### 3.1 Shared Kernel (Noyau partage)

Deux contextes partagent une portion du modèle. Changement = coordination des deux équipes.

```
  Catalog <──── shared ────> Ordering
              ProductId
              (type partagé)

  A utiliser avec parcimonie. Convient quand :
  - Les equipes sont en fait la meme equipe
  - Le concept partage est tres stable (rarement change)
```

```typescript
// shared-kernel/product-id.ts — partage entre Catalog et Ordering
export class ProductId {
  constructor(readonly value: string) {
    if (!value.match(/^[0-9a-f-]{36}$/)) {
      throw new Error(`Invalid ProductId: ${value}`);
    }
  }

  equals(other: ProductId): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
```

#### 3.2 Anti-Corruption Layer (ACL — Couche anti-corruption)

Le contexte aval traduit le modèle du contexte amont dans son propre langage. Protection contre les changements externes.

```
  Legacy System ──────────────> ACL ──────────────> Our Context
  (modele chaotique)          (traducteur)          (modele propre)

  Ex: Recevoir un evenement Stripe et le traduire
  en concept metier propre (Transaction au lieu de PaymentIntent)
```

```typescript
// payment/infrastructure/stripe-acl.ts
interface StripePaymentIntentEvent {
  id: string;
  type: 'payment_intent.succeeded' | 'payment_intent.payment_failed';
  data: {
    object: {
      id: string;
      amount: number;
      currency: string;
      metadata: { orderId?: string };
    };
  };
}

// Notre modele interne — ne depend pas de Stripe
interface PaymentConfirmed {
  transactionId: TransactionId;
  orderId: OrderId;
  amount: Money;
  confirmedAt: Date;
}

// L'ACL traduit Stripe -> notre domaine
class StripeAntiCorruptionLayer {
  translatePaymentSuccess(event: StripePaymentIntentEvent): PaymentConfirmed {
    const obj = event.data.object;
    return {
      transactionId: new TransactionId(obj.id),
      orderId: new OrderId(obj.metadata.orderId!),
      amount: new Money(obj.amount / 100, obj.currency.toUpperCase()),
      confirmedAt: new Date(),
    };
  }
}
```

#### 3.3 Customer/Supplier (Client/Fournisseur)

Le contexte amont (Supplier) fournit des données, le contexte aval (Customer) les consomme. Le Customer peut negocier les contrats d'API.

```
  Ordering (Customer)  <────────  Catalog (Supplier)
                        "Je veux
                         ProductId + name + price"
                        Le Catalog s'engage a fournir ces champs
```

#### 3.4 Conformist (Conformiste)

Le contexte aval adopte le modèle du contexte amont tel quel, sans negociation possible (ex : API externe imposee).

```
  Our Shipping Context ──────follows──────> Carrier Public API
                             (DHL, Colissimo)
                             On s'adapte a leur modele, pas l'inverse.
```

#### 3.5 Open Host Service (Service Hote Ouvert)

Un contexte expose une API bien documentee pour etre consomme par plusieurs autres contextes.

```
  Notification Context ──── API REST bien documentee ────>
                        ──── API REST bien documentee ────>  Ordering
                        ──── API REST bien documentee ────>  Payment
                             (protocole stable, versione)
```

#### 3.6 Published Language (Langage publie)

Extension de l'Open Host : le format d'echange est un standard public (JSON Schema, Avro, Protobuf).

```
  Tous les contextes communiquent via des evenements Avro schemas
  enregistres dans un Schema Registry :
  order.created.v2.avsc, payment.confirmed.v1.avsc...
```

### 4. Context Map complete — E-commerce

```
                    ┌──────────────────────────────────────────────────┐
                    │           CONTEXT MAP — ShopArch                  │
                    └──────────────────────────────────────────────────┘

   ┌──────────┐  OHS/PL   ┌──────────┐  Customer/   ┌──────────────┐
   │ CATALOG  │ ────────> │ ORDERING │  Supplier     │  PAYMENT     │
   │          │           │          │ ──────────>   │              │
   └──────────┘           └────┬─────┘               └──────┬───────┘
         ^                     │                            │
         │ Conformist           │ OHS                        │ OHS
         │                     v                            v
   ┌──────────┐           ┌──────────┐               ┌──────────────┐
   │SEARCH    │           │INVENTORY │               │NOTIFICATION  │
   │(Elastic) │           │          │               │              │
   └──────────┘           └──────────┘               └──────────────┘
         ^
         │ ACL (traduit
         │ Elastic -> notre modele)
   ┌──────────┐
   │ EXTERNAL │
   │ ELASTIC  │
   └──────────┘

  LEGENDE:
  OHS    = Open Host Service (API publique)
  PL     = Published Language (format schema)
  ACL    = Anti-Corruption Layer
  C/S    = Customer / Supplier
```

### 5. Bounded Contexts et microservices

Attention a l'erreur fréquente : **Bounded Context != Microservice**.

| Aspect | Bounded Context | Microservice |
|---|---|---|
| Nature | Frontiere logique (conceptuelle) | Frontiere physique (déploiement) |
| Granularite | Module métier | Unite deployable independamment |
| 1 BC = 1 service ? | Non — 1 BC peut etre plusieurs services, ou plusieurs BC dans 1 service | Dépendance de l'infrastructure |
| Recommandation | Toujours delimiter les BC d'abord | N'extraire en microservice que si nécessité prouvee |

**Regle pratique :** Commencez par un **monolithe bien module** (1 BC = 1 module NestJS), puis extrayez en microservice si nécessaire. Ne faites pas l'inverse.

---

## Pratique

### Exemple complet — CMS Multi-tenant

```typescript
// =====================================================
// BOUNDED CONTEXT 1 : Content Management
// =====================================================
// Modele : Article dans le contexte editorial
namespace ContentManagement {
  interface Article {
    id: ArticleId;
    tenantId: TenantId;
    slug: string;
    title: MultiLangField;
    body: MultiLangField;
    status: ArticleStatus; // Draft | Scheduled | Published | Archived
    author: AuthorRef;     // Reference, pas l'entite complete
    tags: TagRef[];
    publishedAt?: Date;
  }

  // Le contexte connait ses propres regles
  type ArticleStatus = 'Draft' | 'Scheduled' | 'Published' | 'Archived';

  interface AuthorRef {
    authorId: string;      // Juste un ID — pas de User importe du contexte Auth
    displayName: string;   // Snapshot du nom au moment de la publication
  }
}

// =====================================================
// BOUNDED CONTEXT 2 : Identity & Access
// =====================================================
// "Author" dans ce contexte s'appelle "User" avec un role
namespace IdentityAccess {
  interface User {
    id: UserId;
    tenantId: TenantId;
    email: Email;
    passwordHash: string;
    role: UserRole;
    isActive: boolean;
  }

  type UserRole = 'SUPER_ADMIN' | 'TENANT_ADMIN' | 'EDITOR' | 'AUTHOR' | 'VIEWER';
}

// =====================================================
// ACL : Identity -> Content Management
// =====================================================
// Quand le contexte Content a besoin d'infos sur un auteur,
// il passe par une ACL qui traduit User -> AuthorRef
class IdentityToContentACL {
  constructor(private readonly userRepository: UserRepository) {}

  async resolveAuthor(userId: string, tenantId: string): Promise<ContentManagement.AuthorRef> {
    const user = await this.userRepository.findById(userId, tenantId);

    if (!user || !user.isActive) {
      throw new AuthorNotFoundError(userId);
    }

    // Traduction : User (contexte Identity) -> AuthorRef (contexte Content)
    return {
      authorId: user.id.value,
      displayName: user.email.localPart, // ou un champ "displayName" si present
    };
  }
}

// =====================================================
// BOUNDED CONTEXT 3 : Analytics
// =====================================================
// "Article" dans ce contexte n'est qu'une serie de metriques
namespace Analytics {
  interface ArticleMetrics {
    articleId: string;       // Juste l'ID — pas le contenu
    tenantId: string;
    pageViews: number;
    uniqueVisitors: number;
    avgReadTimeSeconds: number;
    bounceRate: number;
    // Aucun champ editorial (titre, body, statut...)
  }

  // L'evenement qui fait le lien entre les contextes
  interface ArticlePublishedEvent {
    eventId: string;
    occurredAt: Date;
    articleId: string;
    tenantId: string;
    // Analytics cree ses propres metriques a partir de cet evenement
  }
}

// =====================================================
// Context Map — Communication par evenements
// =====================================================
// ContentManagement emet des evenements
// Analytics les consomme sans connaitre Content

class ContentDomainEventPublisher {
  async publishArticlePublished(article: ContentManagement.Article): Promise<void> {
    const event: Analytics.ArticlePublishedEvent = {
      eventId: crypto.randomUUID(),
      occurredAt: new Date(),
      articleId: article.id.value,
      tenantId: article.tenantId.value,
    };
    // Publie sur un bus d'evenements (Redis pub/sub, RabbitMQ...)
    await this.eventBus.publish('content.article.published', event);
  }
}
```

### Test de frontiere — valider votre Context Map

```typescript
// Un test simple pour verifier que les contextes ne se "voient" pas directement
// (verification d'architecture — peut etre fait avec jest-architecture ou eslint-plugin-boundaries)

describe('Bounded Context Isolation', () => {
  it('should not import Content entities from Analytics module', () => {
    // Verifier que analytics/ n'importe rien de content/
    const analyticsFiles = glob.sync('src/analytics/**/*.ts');
    const forbiddenImport = /from ['"].*\/content\//;

    analyticsFiles.forEach(file => {
      const content = fs.readFileSync(file, 'utf-8');
      expect(content).not.toMatch(forbiddenImport);
    });
  });

  it('should only communicate via events or ACL', () => {
    // Les seuls points de contact autorises sont :
    // - src/shared/events/*.ts (evenements partages)
    // - src/*/infrastructure/acl/*.ts (couches de traduction)
    expect(true).toBe(true); // placeholder — voir eslint-plugin-boundaries
  });
});
```

---

## Resume

- Un **Bounded Context** est une frontiere explicite ou un modèle métier a un sens cohérent ; le meme mot peut avoir des définitions différentes dans deux contextes différents.
- La **Context Map** cartographie les six types de relations : Shared Kernel, ACL, Customer/Supplier, Conformist, Open Host Service, Published Language — chaque type implique un niveau de couplage et de coordination différent.
- **Bounded Context != Microservice** : commencer par un monolithe bien module (1 BC = 1 module), et n'extraire en service independant que si le besoin est prouve.
- L'**Anti-Corruption Layer** protégé votre domaine des modèles chaotiques externes : Stripe, DHL, un legacy ne doivent pas polluer votre vocabulaire interne.
- Les contextes **ne partagent pas d'entités** : ils communiquent par événements ou API, echangeant uniquement les IDs et les snapshots de données nécessaires.


---

> **Lien fil rouge — ShopArch**
>
> - Dessine la Context Map de ShopArch avec les 5 contexts et leurs relations
> - Identifie les Shared Kernels (Money, UUID) et les ACL (Payment, User)
> - Exercice(s) associé(s) : `exercices/10-bounded-contexts-pratique/`, `exercices/10b-context-map/`
> - Checkpoint : Module 02, critère 1-2

## Prochain cours

[Cours 16 — Entités, Value Objects & Agregats](./03-entités-vo-agregats.md)
