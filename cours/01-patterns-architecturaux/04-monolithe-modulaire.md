# Cours 10 — Monolithe Modulaire & API-First

**Objectif :** Comprendre pourquoi un monolithe modulaire peut etre le bon choix, maîtriser la séparation par modules a frontieres claires, et connaitre les principes API-First, headless, Contract-First et stateless.

---

## Rappel du cours précédent

> Cours 09 — Clean Architecture.

**Question 1 — Quelle est la différence fondamentale entre une Entity (cercle 1) et un Use Case (cercle 2) dans la Clean Architecture ?**

<details>
<summary>Réponse</summary>

Une Entity contient des règles métier qui appartiennent a l'entreprise entiere, independamment de cette application. Ex : "une facture impayee depuis 90 jours passe en contentieux" — cette règle existerait meme sans ce logiciel. Un Use Case contient des règles spécifiques a cette application : "lorsqu'un utilisateur clique sur Confirmer commande, orchestrer la vérification du stock, le paiement, et l'envoi de l'email". Cette logique n'existe que parce qu'il y a cette application.

</details>

**Question 2 — Pourquoi la Clean Architecture introduit-elle des Presenters et des Output Boundaries plutot que de laisser le Use Case retourner directement un résultat au Controller ?**

<details>
<summary>Réponse</summary>

Pour que le Use Case (cercle 2) reste independant du format de sortie (cercle 3). Si le Use Case retourne directement un objet JSON, il connait implicitement le format HTTP — ce qui viole la Dependency Rule. Avec un Output Boundary (interface), le Use Case appelle une abstraction ; le Presenter (qui implémenté cette interface) traduit en JSON, HTML, ou n'importe quel format. Le Use Case peut ainsi etre réutilisé par un Controller REST ET par un Controller CLI sans modification.

</details>

---

## Analogie — L'immeuble d'appartements

Un immeuble d'appartements est un seul batiment (un seul deployable), mais chaque appartement est **independant** :

- Appartement 1A (module Facturation) : sa propre cuisine, sa propre serrure, ses propres cles
- Appartement 2B (module Catalogue) : il ne rentre pas dans l'appartement 1A sans permission
- Appartement 3C (module Utilisateurs) : sa propre logique interne

**L'immeuble partage** : le chauffage central, l'ascenseur, l'adresse postale — comme un monolithe partage un processus, une base de données, et un déploiement.

**Mais chaque appartement a des frontieres claires** : tu ne traverses pas les murs. Si tu veux quelque chose chez le voisin, tu sonnes a la porte (API interne). C'est ca, le monolithe modulaire.

A l'oppose : un seul grand loft sans murs = le "Big Ball of Mud" — tout le monde s'y croise, rien n'est prive.

```
+============================================================+
|                   MONOLITHE                                |
|  (un seul deploiement, un seul processus)                  |
|                                                            |
|  +------------------+  +------------------+               |
|  |  MODULE           |  |  MODULE           |              |
|  |  Facturation      |  |  Catalogue        |              |
|  |  [Domain]         |  |  [Domain]         |              |
|  |  [Use Cases]      |  |  [Use Cases]      |              |
|  |  [Infrastructure] |  |  [Infrastructure] |              |
|  +--------+---------+  +--------+---------+               |
|           |                     |                          |
|           +-------API-----------+  <-- contrat explicite   |
|                                                            |
|  +------------------+  +------------------+               |
|  |  MODULE           |  |  MODULE           |              |
|  |  Commandes        |  |  Utilisateurs     |              |
|  +------------------+  +------------------+               |
|                                                            |
+============================================================+
             |
         [1 base de donnees, schemas separes par module]
```

---

## Théorie

### 1. Le monolithe modulaire — définition

Un monolithe modulaire est un système ou :
- Tout est **déployé ensemble** (un seul artefact)
- Mais le code est **organise en modules autonomes** avec des frontieres respectees
- Les modules ne partagent pas leurs classes internes — ils communiquent par API publique

Il combine la **simplicite operationnelle** du monolithe et la **lisibilite** des microservices.

---

### 2. Frontieres de modules — Ce qui est autorise et interdit

```typescript
// INTERDIT — le module Commandes importe directement une classe interne
// du module Catalogue (violation de la frontiere)
import { CatalogProductRepository } from '../catalog/infrastructure/catalog-product.repository';

// AUTORISE — le module Commandes appelle l'API publique du module Catalogue
import { CatalogService } from '../catalog/catalog.service'; // Facade publique
// ou via un evenement interne
import { EventBus } from '../shared/event-bus';
```

**Regle :** chaque module expose un **barrel file** (`index.ts`) qui constitue son API publique. Tout ce qui n'est pas dans ce barrel est prive.

```
modules/
  catalog/
    index.ts          <-- API publique du module (les seules classes exportables)
    catalog.module.ts
    domain/           <-- prive
    use-cases/        <-- prive
    infrastructure/   <-- prive
  orders/
    index.ts          <-- ne peut importer que via catalog/index.ts
    ...
```

---

### 3. Quand le monolithe est le BON choix

| Critère | Monolithe Modulaire | Microservices |
|---|---|---|
| Taille d'équipe | < 15 développeurs | > 20 développeurs, équipes séparées |
| Maturite du domaine | Domaine encore en exploration | Domaine bien etabli et stable |
| Latence inter-modules | < 1ms (appel local) | 5-50ms (réseau) |
| Transactions | ACID nativement | Saga pattern requis (complexe) |
| Déploiement | Simple, un seul artefact | Complexe, orchestration (K8s) |
| Debug | Stack trace complete | Tracing distribue requis |
| Refactoring de frontieres | Facile (refactor interne) | Tres couteux (changement de service) |
| Overhead operationnel | Faible | Eleve (N services, N bases, N configs) |

**Conseil de Martin Fowler :** "Don't start with microservices. Start with a monolith designed with module boundaries that mirror potential service boundaries."

---

### 4. API-First — Designer le contrat avant le code

L'approche API-First signifie que tu **définis l'interface (le contrat OpenAPI)** avant d'écrire une seule ligne d'implémentation.

```
Approche classique :
  Code -> (parfois) Documentation

Approche API-First :
  Contrat OpenAPI -> Validation -> Code serveur + Code client (genere)
```

**Avantages :**
- Les équipes front et back peuvent travailler en parallele (mock server)
- Le contrat est la loi — pas d'ambiguite
- La génération de types TypeScript est automatique
- Les tests de contrat (Pact, Dredd) verifient la conformite

---

### 5. Contract-First — La spec comme source de vérité

```yaml
# openapi.yaml — ecrit AVANT le code
paths:
  /orders:
    post:
      operationId: createOrder
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/CreateOrderRequest'
      responses:
        '201':
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/OrderResponse'
```

De ce fichier, on généré :
- Les types TypeScript (front + back)
- Les stubs de serveur (pour les tests front)
- La documentation Mintlify / Swagger
- Les tests de contrat

---

### 6. Architecture Headless — Separer le cerveau du visage

```
               +---------------------------+
               |   FRONT-OFFICE (Next.js)  |
               |   (la tete, visible)      |
               +-------------+-------------+
                             |  HTTP / GraphQL
                             |
               +-------------v-------------+
               |   API (Symfony / NestJS)  |
               |   (le cerveau, headless)  |
               +---------------------------+
                             |
               +-------------v-------------+
               |   BACK-OFFICE (React)     |
               |   (autre tete, admin)     |
               +---------------------------+
```

L'API ne sait pas si elle repond a un navigateur, une app mobile, ou un partenaire B2B. Elle expose des endpoints — n'importe quelle "tete" peut s'y connecter.

**Benefices :**
- Changement de frontend sans toucher au backend
- Multi-canal natif (web + mobile + API publique)
- Tests backend independants du rendu

---

### 7. Conteneurs Stateless — Pourquoi ne rien stocker en mémoire

```
Instance 1                Instance 2
+-----------+             +-----------+
| Session   |             |           |
| user=bob  |             |           |
+-----------+             +-----------+
      ^                         ^
      |                         |
   Requete 1              Requete 2 (Bob)
                    --> ERREUR : l'etat est sur l'instance 1 !
```

Un conteneur stateless ne stocke **aucun état** entre les requêtes. L'état vit en dehors : Redis (sessions), PostgreSQL (persistance), S3 (fichiers).

---

## Pratique — Monolithe Modulaire NestJS

### Structure de dossiers

```
src/
  modules/
    catalog/
      index.ts              <-- API publique du module
      catalog.module.ts
      domain/
        product.entity.ts
      use-cases/
        get-product.use-case.ts
      infrastructure/
        product.typeorm-repository.ts
    orders/
      index.ts
      orders.module.ts
      domain/
        order.entity.ts
      use-cases/
        create-order.use-case.ts   <-- utilise catalog via son index.ts
      infrastructure/
        order.typeorm-repository.ts
  shared/
    event-bus.ts            <-- communication async entre modules
    domain-event.ts
```

### Barrel file — API publique du module Catalog

```typescript
// src/modules/catalog/index.ts

// Seules ces exports sont accessibles aux autres modules
// Tout ce qui n'est pas ici est PRIVE au module
export { CatalogModule } from './catalog.module';
export { GetProductUseCase } from './use-cases/get-product.use-case';
export type { ProductSummary } from './domain/product.entity';

// PAS d'export de ProductRepository, ProductOrmEntity, etc.
// Les details d'implementation restent prives
```

### Domain Product — Module Catalog

```typescript
// src/modules/catalog/domain/product.entity.ts

export interface ProductSummary {
  id: string;
  name: string;
  unitPrice: number;
  stockQuantity: number;
}

export class Product {
  private constructor(
    private readonly id: string,
    private readonly name: string,
    private unitPrice: number,
    private stockQuantity: number,
  ) {}

  static create(params: {
    id: string;
    name: string;
    unitPrice: number;
    stockQuantity: number;
  }): Product {
    if (params.unitPrice <= 0) throw new Error('Unit price must be positive');
    if (params.stockQuantity < 0) throw new Error('Stock cannot be negative');
    return new Product(params.id, params.name, params.unitPrice, params.stockQuantity);
  }

  // Regle metier : reservation du stock
  reserveStock(quantity: number): void {
    if (quantity > this.stockQuantity) {
      throw new Error(`Insufficient stock for product ${this.id}`);
    }
    this.stockQuantity -= quantity;
  }

  // Expose uniquement ce qui est necessaire aux autres modules
  toSummary(): ProductSummary {
    return {
      id: this.id,
      name: this.name,
      unitPrice: this.unitPrice,
      stockQuantity: this.stockQuantity,
    };
  }

  getId() { return this.id; }
}
```

### Communication inter-modules — Event Bus interne

```typescript
// src/shared/domain-event.ts

export interface DomainEvent {
  readonly eventType: string;
  readonly occurredAt: Date;
  readonly payload: Record<string, unknown>;
}

export class OrderCreatedEvent implements DomainEvent {
  readonly eventType = 'ORDER_CREATED';
  readonly occurredAt = new Date();

  constructor(
    readonly payload: {
      orderId: string;
      customerId: string;
      items: Array<{ productId: string; quantity: number }>;
    },
  ) {}
}
```

```typescript
// src/shared/event-bus.ts
import { Injectable } from '@nestjs/common';

type EventHandler<T extends { payload: unknown }> = (event: T) => Promise<void>;

@Injectable()
export class EventBus {
  private readonly handlers = new Map<string, EventHandler<any>[]>();

  // Les modules s'abonnent aux evenements des autres modules
  // sans importer leurs classes internes — couplage par le message
  subscribe<T extends { eventType: string; payload: unknown }>(
    eventType: string,
    handler: EventHandler<T>,
  ): void {
    const existing = this.handlers.get(eventType) ?? [];
    this.handlers.set(eventType, [...existing, handler]);
  }

  async publish<T extends { eventType: string; payload: unknown }>(
    event: T,
  ): Promise<void> {
    const handlers = this.handlers.get(event.eventType) ?? [];
    // Execute tous les handlers en parallele (ajuster selon les besoins)
    await Promise.all(handlers.map((h) => h(event)));
  }
}
```

### Use Case Orders — consomme le module Catalog via son API publique

```typescript
// src/modules/orders/use-cases/create-order.use-case.ts
import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';

// Import UNIQUEMENT depuis l'index du module Catalog (API publique)
// JAMAIS : import { ProductRepository } from '../catalog/infrastructure/...'
import { GetProductUseCase } from '../../catalog';

import { EventBus } from '../../../shared/event-bus';
import { OrderCreatedEvent } from '../../../shared/domain-event';
import { IOrderRepository } from '../domain/order-repository.interface';
import { Order } from '../domain/order.entity';

export interface CreateOrderCommand {
  customerId: string;
  items: Array<{ productId: string; quantity: number }>;
}

@Injectable()
export class CreateOrderUseCase {
  constructor(
    private readonly orderRepo: IOrderRepository,
    // Utilise la facade publique du module Catalog — pas ses internals
    private readonly getProduct: GetProductUseCase,
    private readonly eventBus: EventBus,
  ) {}

  async execute(command: CreateOrderCommand): Promise<{ orderId: string }> {
    // 1. Recupere les produits via l'API du module Catalog
    const productSummaries = await Promise.all(
      command.items.map((item) => this.getProduct.execute({ productId: item.productId }))
    );

    // 2. Calcule le total (logique applicative)
    const itemsWithPrice = command.items.map((item, index) => ({
      ...item,
      unitPrice: productSummaries[index].unitPrice,
    }));

    // 3. Cree l'entite Domain
    const order = Order.create(command.customerId, itemsWithPrice);

    // 4. Persiste
    await this.orderRepo.save(order);

    // 5. Publie un evenement — le module Catalog peut s'y abonner
    // pour reserver le stock sans que Orders ne depende de Catalog en ecriture
    await this.eventBus.publish(new OrderCreatedEvent({
      orderId: order.getId(),
      customerId: command.customerId,
      items: command.items,
    }));

    return { orderId: order.getId() };
  }
}
```

### Test de frontiere — vérifier que les imports sont corrects

```typescript
// src/modules/orders/use-cases/create-order.use-case.spec.ts
// Ce test verifie que le module Orders respecte ses frontieres

import { CreateOrderUseCase } from './create-order.use-case';
import { GetProductUseCase } from '../../catalog'; // via l'index — correct

// IMPORTANT : si ce test importe quelque chose en dehors de catalog/index.ts
// c'est une violation de frontiere — le test lui-meme sert de garde-fou

class StubGetProduct {
  async execute({ productId }: { productId: string }) {
    return { id: productId, name: 'Product', unitPrice: 100, stockQuantity: 10 };
  }
}

class StubOrderRepo {
  saved: any[] = [];
  async save(order: any) { this.saved.push(order); }
  async findById() { return null; }
}

class StubEventBus {
  published: any[] = [];
  async publish(event: any) { this.published.push(event); }
  subscribe() {}
}

describe('CreateOrderUseCase', () => {
  it('cree une commande et publie un evenement ORDER_CREATED', async () => {
    const repo = new StubOrderRepo();
    const eventBus = new StubEventBus();
    const useCase = new CreateOrderUseCase(
      repo as any,
      new StubGetProduct() as any,
      eventBus as any,
    );

    const result = await useCase.execute({
      customerId: 'cust-1',
      items: [{ productId: 'prod-A', quantity: 2 }],
    });

    expect(result.orderId).toBeDefined();
    expect(repo.saved).toHaveLength(1);
    expect(eventBus.published[0].eventType).toBe('ORDER_CREATED');
  });
});
```

---

## Resume

- Un **monolithe modulaire** est un seul deployable dont le code interne est organise en modules autonomes avec des frontieres strictes — combinant la simplicite operationnelle du monolithe et la clarte des microservices.
- Chaque module expose une **API publique via un barrel file** (`index.ts`) ; tout le reste est prive. Les imports directs dans les internals d'un autre module sont des violations de frontiere.
- L'**approche API-First** consiste a écrire le contrat OpenAPI avant le code, permettant aux équipes front et back de travailler en parallele et de générer types, mocks et tests automatiquement.
- L'**architecture headless** séparé l'API (le cerveau) des interfaces utilisateur (les tetes) : une API peut servir un front web, une app mobile et des partenaires B2B sans modification.
- Les **conteneurs stateless** n'stockent aucun état en mémoire entre les requêtes — l'état vit en dehors (Redis, PostgreSQL), rendant le scaling horizontal trivial.


---

> **Lien fil rouge — ShopArch**
>
> - Structure ShopArch en monolithe modulaire : un module par Bounded Context
> - Définis les interfaces publiques de chaque module (ce qu'il expose vs ce qu'il cache)
> - Exercice(s) associé(s) : `exercices/07-decomposer-monolithe/`
> - Checkpoint : Module 01, critère 1

## Prochain cours

[Cours 11 — Microservices](./05-microservices.md)

> On va explorer quand et comment decomposer un système en microservices : decomposition par domaine métier, données par service, découverte de services, et surtout les anti-patterns a éviter (monolithe distribue, nano-services, base de données partagee).
