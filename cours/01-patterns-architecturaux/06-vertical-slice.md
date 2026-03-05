# Cours 12 — Vertical Slice Architecture

**Objectif :** Comprendre l'organisation du code par feature plutot que par couche technique, maîtriser le contraste entre tranches horizontales et verticales, appliquer un CQRS-lite par slice, et reconnaitre les gains en autonomie d'équipe.

---

## Rappel du cours précédent

> Cours 11 — Microservices.

**Question 1 — Qu'est-ce que l'anti-pattern "monolithe distribue" et pourquoi est-il pire qu'un vrai monolithe ?**

<details>
<summary>Réponse</summary>

Le monolithe distribue est un système ou le code est physiquement decouped en plusieurs services, mais ou ces services restent fortement couples : ils doivent etre déployés ensemble car un changement dans l'un force des changements dans les autres, ils partagent peut-etre une base de données, ou ils s'appellent en chaine synchrone. C'est pire qu'un vrai monolithe car on subit toute la complexité operationnelle des microservices (K8s, tracing, N pipelines CI/CD) sans en avoir les benefices (déploiement independant, autonomie). Un bon monolithe modulaire est plus simple a operer et souvent plus performant.

</details>

**Question 2 — Pourquoi le principe "Data per Service" est-il non-negociable dans les microservices ?**

<details>
<summary>Réponse</summary>

Parce que le partage de base de données cree un couplage au schema : si un service modifie une table (renomme une colonne, change un type), tous les services qui lisent cette table doivent etre mis a jour et déployés en meme temps — detruisant l'independance de déploiement. De plus, les transactions ACID inter-services sont impossibles sur plusieurs bases, et le schema devient un contrat implicite que personne ne peut modifier sans coordination globale. L'isolation des données est ce qui rend possible le déploiement veritablement independant.

</details>

---

## Analogie — La pizza

Imagine que tu commandes une pizza. Tu reçois une pizza entiere — **chaque part (slice) contient tout** : la pate, la sauce, le fromage, la garniture. Tu peux prendre une part et avoir une experience complete.

Maintenant compare avec un buffet organise en couches :
- Un bol de pate (couche 1)
- Un bol de sauce (couche 2)
- Un bol de fromage (couche 3)
- Un bol de garniture (couche 4)

Pour avoir ton repas complet, tu dois passer par **tous les bols**. Si le bol de sauce est vide, tout le monde attend. Si tu veux changer la sauce, tu touches au bol que tout le monde utilise.

```
ARCHITECTURE HORIZONTALE (couches) :
+=========================================+
|  COUCHE CONTROLLERS  (tous les features)|
+=========================================+
|  COUCHE SERVICES     (tous les features)|
+=========================================+
|  COUCHE REPOSITORIES (tous les features)|
+=========================================+
  Un changement dans une feature touche toutes les couches

ARCHITECTURE VERTICALE (slices) :
+----------+ +----------+ +----------+
| FEATURE  | | FEATURE  | | FEATURE  |
| Creer    | | Lister   | | Annuler  |
| Commande | | Commandes| | Commande |
|          | |          | |          |
| Handler  | | Handler  | | Handler  |
| Validator| | Query    | | Handler  |
| Repo     | | Repo     | | Repo     |
+----------+ +----------+ +----------+
  Chaque feature est complete et independante
```

---

## Théorie

### 1. Définition — Slice = une fonctionnalité complete

Une "vertical slice" est une découpé du code par **cas d'utilisation**, ou chaque dossier/module contient :
- La requête (DTO d'entree)
- Le gestionnaire (handler)
- La validation
- La logique métier spécifique a ce cas
- L'accès aux données (query ou command)
- Le DTO de sortie

Le principe vient de Jimmy Bogard (auteur de MediatR) : **"Features, not layers"**.

---

### 2. Couches horizontales vs Tranches verticales

| Aspect | Architecture en couches | Vertical Slice |
|---|---|---|
| Organisation | Par type technique (Controller, Service, Repo) | Par feature (CreateOrder, ListOrders) |
| Changement d'une feature | Touche N fichiers dans N dossiers | Touche 1 dossier |
| Partage de code | Fort (la meme couche sert tout) | Faible (partage conscient uniquement) |
| Autonomie d'équipe | Faible (équipes par couche se bloquent) | Forte (équipes par feature) |
| Cohérence interne | Facile a voir (meme couche = meme style) | Variable (chaque slice peut varier) |
| Onboarding | Style uniforme mais feature dispersee | Feature groupee mais styles potentiellement mixtes |
| Tests | Multi-niveaux (unit + intégration) | Feature-centric (test de bout en bout la slice) |

---

### 3. CQRS-lite par slice — Lire et Écrire differemment

Le CQRS complet (Event Sourcing + projections) est souvent excessif. Le CQRS-lite par slice consiste a :
- Les **Commands** (écriture) passent par le Domain, les Entities, les règles métier
- Les **Queries** (lecture) peuvent aller directement en base avec du SQL optimise ou un ORM simplifie

```
COMMAND Slice (ecriture) :
  HTTP POST /orders
      |
  CreateOrderCommand (DTO)
      |
  CreateOrderHandler
      |  utilise le Domain (Order entity, regles metier)
      |
  OrderRepository.save()

QUERY Slice (lecture) :
  HTTP GET /orders?customerId=X
      |
  ListOrdersQuery (DTO)
      |
  ListOrdersHandler
      |  SQL direct ou ORM simplifie — pas de Domain entity
      |  retourne un DTO plat optimise pour l'affichage
      |
  Response JSON
```

Pourquoi ? Les lectures n'ont généralement pas besoin du Domain riche — elles lisent pour afficher. Passer par les Entities + mapping + reconstitution n'ajoute que de la latence.

---

### 4. Structure de dossiers par slice

```
src/
  features/
    orders/
      create-order/
        create-order.command.ts         # DTO entree
        create-order.handler.ts         # Logique (Command)
        create-order.validator.ts       # Validation specifique
        create-order.handler.spec.ts    # Test de la slice
      list-orders/
        list-orders.query.ts            # DTO entree
        list-orders.handler.ts          # SQL direct (Query)
        list-orders.dto.ts              # DTO sortie
        list-orders.handler.spec.ts
      cancel-order/
        cancel-order.command.ts
        cancel-order.handler.ts         # Logique d'annulation
        cancel-order.handler.spec.ts
    catalog/
      create-product/
        ...
      update-product-price/
        ...
  shared/
    domain/
      order.entity.ts                   # Partage conscient et justifie
    infrastructure/
      order.typeorm-repository.ts
```

---

### 5. Quand partager entre slices ?

Le partage n'est pas interdit — il doit etre **conscient et justifie**.

```
Partage ACCEPTABLE :
  - Entites Domain (Order, Product) — la logique metier est coherente
  - Value Objects (Money, Address) — regle partagee par definition
  - Repositories (interface uniquement) — contrat stable
  - Utilitaires generiques (UUID generator, pagination)

Partage A EVITER :
  - Services "generiques" qui font trop de choses
  - Mappers "universels" qui couplent toutes les slices
  - Classes de base abstraites qui forcent un style commun
    (anti-pattern : BaseHandler<T> que tout herite)
```

---

### 6. Autonomie d'équipe par slice

```
Equipe A : feature CreateOrder
  -> owner du dossier features/orders/create-order/
  -> deploie cette slice independamment
  -> decide de la structure interne (pas de couches imposees)

Equipe B : feature ListOrders
  -> owner du dossier features/orders/list-orders/
  -> peut utiliser du SQL brut car la lecture le justifie
  -> pas impactee par le changement d'Equipe A

Fusion (merge) : chaque equipe touche son dossier -> conflits rares
```

C'est le principe de Conway's Law inverse : si l'architecture reflété l'organisation des équipes, la coordination diminue.

---

## Pratique — Vertical Slice avec NestJS + MediatR-style

### Pattern Mediator — Dispatcher de handlers

```typescript
// src/shared/mediator/mediator.ts

// Le Mediator decouple l'emetteur (Controller) du recepteur (Handler)
// Chaque slice enregistre son Handler — le Controller ne les connait pas

type Constructor<T> = new (...args: any[]) => T;

export interface IRequest<TResponse> {
  readonly _responseType?: TResponse; // phantom type pour le typage
}

export interface IHandler<TRequest extends IRequest<TResponse>, TResponse> {
  handle(request: TRequest): Promise<TResponse>;
}

@Injectable()
export class Mediator {
  private readonly handlers = new Map<string, IHandler<any, any>>();

  register<TRequest extends IRequest<TResponse>, TResponse>(
    requestType: Constructor<TRequest>,
    handler: IHandler<TRequest, TResponse>,
  ): void {
    this.handlers.set(requestType.name, handler);
  }

  async send<TResponse>(request: IRequest<TResponse>): Promise<TResponse> {
    const handlerName = request.constructor.name;
    const handler = this.handlers.get(handlerName);
    if (!handler) {
      throw new Error(`No handler registered for ${handlerName}`);
    }
    return handler.handle(request);
  }
}

// Necessite import Injectable de NestJS
import { Injectable } from '@nestjs/common';
```

### Slice CreateOrder — Command + Handler

```typescript
// src/features/orders/create-order/create-order.command.ts
import { IRequest } from '../../../shared/mediator/mediator';

// La Command est un DTO immuable — pas de logique
export class CreateOrderCommand implements IRequest<CreateOrderResult> {
  constructor(
    readonly customerId: string,
    readonly items: Array<{ productId: string; quantity: number; unitPrice: number }>,
  ) {}
}

export interface CreateOrderResult {
  orderId: string;
  totalAmount: number;
  status: 'draft';
}
```

```typescript
// src/features/orders/create-order/create-order.handler.ts
import { Injectable } from '@nestjs/common';
import { IHandler } from '../../../shared/mediator/mediator';
import { CreateOrderCommand, CreateOrderResult } from './create-order.command';
import { Order } from '../../../shared/domain/order.entity';
import { IOrderRepository } from '../../../shared/domain/order-repository.interface';

@Injectable()
export class CreateOrderHandler
  implements IHandler<CreateOrderCommand, CreateOrderResult>
{
  constructor(
    // Ce handler utilise le Domain partage — c'est un partage justifie
    private readonly orderRepo: IOrderRepository,
  ) {}

  async handle(command: CreateOrderCommand): Promise<CreateOrderResult> {
    // 1. La logique metier vit dans l'Entity Domain
    const order = Order.create(command.customerId, command.items);

    // 2. Persistance via le port
    await this.orderRepo.save(order);

    // 3. Retourne le DTO de sortie de cette slice
    return {
      orderId: order.getId(),
      totalAmount: order.getTotalAmount(),
      status: 'draft',
    };
  }
}
```

### Slice ListOrders — Query avec SQL direct

```typescript
// src/features/orders/list-orders/list-orders.query.ts
import { IRequest } from '../../../shared/mediator/mediator';

export class ListOrdersQuery implements IRequest<ListOrdersResult[]> {
  constructor(
    readonly customerId: string,
    readonly page: number = 1,
    readonly limit: number = 20,
  ) {}
}

// DTO de lecture — plat et optimise pour l'affichage (pas d'Entity Domain)
export interface ListOrdersResult {
  orderId: string;
  status: string;
  totalAmount: number;
  itemCount: number;
  createdAt: string;
}
```

```typescript
// src/features/orders/list-orders/list-orders.handler.ts
import { Injectable, Inject } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { IHandler } from '../../../shared/mediator/mediator';
import { ListOrdersQuery, ListOrdersResult } from './list-orders.query';

// Cette slice n'utilise PAS l'Entity Order — elle lit directement en SQL
// Justification : une liste d'affichage n'a pas besoin des regles metier
// Elle doit etre rapide et retourner exactement le shape necessaire au front
@Injectable()
export class ListOrdersHandler
  implements IHandler<ListOrdersQuery, ListOrdersResult[]>
{
  constructor(
    @Inject('DATA_SOURCE') private readonly dataSource: DataSource,
  ) {}

  async handle(query: ListOrdersQuery): Promise<ListOrdersResult[]> {
    const offset = (query.page - 1) * query.limit;

    // SQL direct : une seule requete optimisee, pas de mapping Domain
    const rows = await this.dataSource.query(
      `
      SELECT
        o.id          AS "orderId",
        o.status      AS "status",
        o.total_amount AS "totalAmount",
        COUNT(oi.id)  AS "itemCount",
        o.created_at  AS "createdAt"
      FROM orders o
      LEFT JOIN order_items oi ON oi.order_id = o.id
      WHERE o.customer_id = $1
      GROUP BY o.id
      ORDER BY o.created_at DESC
      LIMIT $2 OFFSET $3
      `,
      [query.customerId, query.limit, offset],
    );

    // Le typage de retour correspond exactement a ce dont le front a besoin
    return rows.map((row: any) => ({
      orderId: row.orderId,
      status: row.status,
      totalAmount: Number(row.totalAmount),
      itemCount: Number(row.itemCount),
      createdAt: row.createdAt,
    }));
  }
}
```

### Controller — Delegue tout au Mediator

```typescript
// src/features/orders/orders.controller.ts
import { Controller, Post, Get, Body, Query, Param } from '@nestjs/common';
import { Mediator } from '../../shared/mediator/mediator';
import { CreateOrderCommand } from './create-order/create-order.command';
import { ListOrdersQuery } from './list-orders/list-orders.query';

// Le Controller ne contient AUCUNE logique — il traduit HTTP en Commande/Query
// et delegue au Mediator qui route vers le bon Handler
@Controller('orders')
export class OrdersController {
  constructor(private readonly mediator: Mediator) {}

  @Post()
  async create(@Body() body: { customerId: string; items: any[] }) {
    // Cree la Command et l'envoie au Mediator
    // Le Controller ne sait PAS quel Handler va la traiter
    return this.mediator.send(
      new CreateOrderCommand(body.customerId, body.items)
    );
  }

  @Get()
  async list(
    @Query('customerId') customerId: string,
    @Query('page') page = '1',
  ) {
    return this.mediator.send(
      new ListOrdersQuery(customerId, Number(page))
    );
  }
}
```

### Test d'une slice — isolation totale

```typescript
// src/features/orders/create-order/create-order.handler.spec.ts
import { CreateOrderHandler } from './create-order.handler';
import { CreateOrderCommand } from './create-order.command';
import { Order } from '../../../shared/domain/order.entity';

// Stub du Repository — la slice est testee en isolation complete
class StubOrderRepository {
  private orders: Order[] = [];

  async save(order: Order): Promise<void> {
    this.orders.push(order);
  }

  async findById(id: string): Promise<Order | null> {
    return this.orders.find((o) => o.getId() === id) ?? null;
  }

  getAll(): Order[] { return this.orders; }
}

describe('CreateOrderHandler', () => {
  let handler: CreateOrderHandler;
  let repo: StubOrderRepository;

  beforeEach(() => {
    repo = new StubOrderRepository();
    // Aucun NestJS, aucun framework — instanciation directe
    handler = new CreateOrderHandler(repo as any);
  });

  it('cree une commande avec le total correct', async () => {
    const command = new CreateOrderCommand('cust-1', [
      { productId: 'prod-A', quantity: 3, unitPrice: 20 },
      { productId: 'prod-B', quantity: 1, unitPrice: 50 },
    ]);

    const result = await handler.handle(command);

    expect(result.status).toBe('draft');
    expect(result.totalAmount).toBe(110); // 3*20 + 1*50
    expect(result.orderId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );
    expect(repo.getAll()).toHaveLength(1);
  });

  it('rejette une commande sans articles', async () => {
    const command = new CreateOrderCommand('cust-1', []);
    await expect(handler.handle(command)).rejects.toThrow('at least one item');
  });
});
```

---

## Resume

- La **Vertical Slice Architecture** organise le code par feature (CreateOrder, ListOrders) plutot que par couche technique (Controllers, Services, Repositories) — chaque slice est autonome et contient tout ce dont elle a besoin.
- Le changement d'une feature ne touche qu'**un seul dossier**, reduisant les conflits de merge et favorisant l'autonomie des équipes.
- Le **CQRS-lite par slice** permet aux Commands (écriture) de passer par le Domain riche, tandis que les Queries (lecture) peuvent utiliser du SQL direct — chaque slice choisit la stratégie adaptee a son besoin.
- Le **pattern Mediator** découplé le Controller des Handlers : le Controller ne connait pas les Handlers, il envoie juste une Command ou une Query. Cela facilite l'ajout de nouveaux comportements (logging, validation, retry) via des decorateurs.
- Le partage de code entre slices doit etre **conscient et justifie** : le Domain partage (Entities, Value Objects) et les utilitaires génériques sont legitimes ; les "services universels" qui font trop de choses sont un retour deguise vers le layering horizontal.


---

> **Lien fil rouge — ShopArch**
>
> - Implémente un vertical slice complet pour "Ajouter un produit au panier"
> - Chaque slice traverse toutes les couches : Controller → Service → Repository
> - Exercice(s) associé(s) : `exercices/06-vertical-slice-module/`
> - Checkpoint : Module 01, critère 1

## Prochain cours

[Cours 13 — 12-Factor App & Idempotence](./07-twelve-factor-idempotency.md)

> On va etudier les 12 facteurs qui rendent une application cloud-native, et le principe crucial d'idempotence — pourquoi appuyer deux fois sur "Payer" ne doit jamais debiter deux fois, et comment implémenter des cles d'idempotence et des retries surs.
