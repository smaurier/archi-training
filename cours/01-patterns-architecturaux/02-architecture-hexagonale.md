# Cours 08 — Architecture Hexagonale (Ports & Adapters)

**Objectif :** Comprendre comment isoler complètement le coeur métier de toute infrastructure technique, connaître la distinction entre ports primaires et secondaires, et implémenter ce patron avec NestJS.

---

## Rappel du cours précédent

> Cours 07 — Architecture en couches.

**Question 1 — Dans l'architecture en couches, pourquoi l'interface du Repository est-elle déclarée dans le Domain plutot que dans l'Infrastructure ?**

<details>
<summary>Réponse</summary>

Parce que le Domain doit etre independant de l'Infrastructure. Si l'interface vivait dans l'Infrastructure, le Domain en dependrait — inversant la direction autorisee des dépendances. En declarant l'interface dans le Domain, on applique le Dependency Inversion Principle (DIP) : le Domain définit le contrat qu'il attend, et l'Infrastructure s'y conforme. On peut ainsi changer d'ORM sans toucher au Domain.

</details>

**Question 2 — Quelle est la différence entre le layering strict et le layering relache, et quand choisir l'un plutot que l'autre ?**

<details>
<summary>Réponse</summary>

En layering strict, chaque couche ne communique qu'avec la couche directement adjacente (Presentation -> Application -> Domain -> Infrastructure). En layering relache, une couche peut "sauter" des intermédiaires. Le strict convient aux domaines complexes avec des règles métier riches car il force la séparation claire. Le relache est acceptable pour des CRUDs simples ou des lectures de données de référence, ou les intermédiaires ne feraient que relayer sans ajouter de valeur.

</details>

---

## Analogie — Le corps humain

Le coeur, le foie, les poumons ne savent pas si tu es en France ou au Japon. Ils ignorent si tu parles au telephone ou en face a face. Ils fonctionnent selon leurs propres règles biologiques.

Ce sont les **nerfs et les organes sensoriels** (yeux, oreilles, peau) qui font l'interface avec le monde exterieur : ils traduisent la realite externe en signaux que les organes internes comprennent.

```
         MONDE EXTERIEUR
    [Chaud]  [Froid]  [Lumiere]
         |       |       |
     [Nerfs / Recepteurs]  <-- Adapters
         |       |       |
    +----+-------+-------+----+
    |                         |
    |   ORGANES INTERNES      |  <-- Domain / Core
    |   (coeur, foie...)      |
    |   Logique autonome      |
    |                         |
    +----+-------+-------+----+
         |       |       |
     [Nerfs / Effecteurs]  <-- Adapters
         |       |       |
    [Muscles] [Glandes] [...]
         ACTIONS SUR LE MONDE
```

L'architecture hexagonale fonctionne exactement ainsi : le **coeur applicatif** (organes) ignore tout de l'exterieur. Les **adapters** (nerfs) font la traduction dans les deux sens.

---

## Théorie

### 1. La structure hexagonale

L'hexagone est une metaphore visuelle : il n'a pas 4 cotes (haut/bas comme les couches) mais **n faces symetriques**, signifiant que n'importe quel type de client peut se connecter au coeur via un adapter dédié.

```
                    +---------------------------+
    [REST API]----->|  Adapter Primaire REST    |
                    +---------------------------+
                                |
    [CLI]---------->+---------------------------+
                    |  Adapter Primaire CLI     |
                    +---------------------------+
                                |
                    +-----------v---------------+
                    |                           |
                    |   PORT PRIMAIRE (input)   |
                    |   (interface du coeur)    |
                    |                           |
                    |  +---------------------+  |
                    |  |                     |  |
                    |  |   APPLICATION       |  |
                    |  |   CORE              |  |
                    |  |   (Domain + Use     |  |
                    |  |    Cases)           |  |
                    |  |                     |  |
                    |  +---------------------+  |
                    |                           |
                    |   PORT SECONDAIRE (output)|
                    |   (interface vers infra)  |
                    |                           |
                    +-----------+---------------+
                                |
                    +-----------v---------------+
                    |  Adapter Secondaire DB    |
                    +---------------------------+
                                |
                    +-----------v---------------+
                    |  Adapter Secondaire Email |
                    +---------------------------+
```

---

### 2. Ports Primaires vs Ports Secondaires

| Critère | Port Primaire (Driving) | Port Secondaire (Driven) |
|---|---|---|
| Direction | L'exterieur appelle le coeur | Le coeur appelle l'exterieur |
| Qui définit ? | Le coeur (interface d'entree) | Le coeur (interface de sortie) |
| Exemples | `IOrderUseCase`, `IAuthService` | `IOrderRepository`, `IEmailSender` |
| Adapters typiques | REST Controller, CLI, gRPC, Tests | TypeORM, SendGrid, S3, Kafka |
| Dépendance | Adapter dépend du Port | Adapter implementen le Port |

**Regle fondamentale :** Les deux types de ports sont **définis par le coeur**. Jamais par l'infrastructure.

---

### 3. Comparaison avec l'architecture en couches

| Aspect | Architecture en couches | Architecture Hexagonale |
|---|---|---|
| Metaphore | Immeuble vertical | Hexagone symetrique |
| Clients multiples | Difficile (ajouter un Controller) | Naturel (nouvel Adapter) |
| Tests d'isolation | Partiel (mock des couches) | Total (Adapter de test) |
| Couplage infra | Le Domain connait les interfaces | Le Domain ne connait rien d'externe |
| Complexity initiale | Faible | Moderee |
| Convient a | Equipes petites, CRUD | Domaines complexes, multi-clients |

---

### 4. L'Adapter de test : le super-pouvoir de l'hexagonale

Parce que le coeur ne dépend que d'interfaces, on peut brancher un **Adapter en mémoire** pour les tests — aucune base de données, aucun réseau, exécution en millisecondes.

```
          [Tests unitaires]
                 |
    +------------v------------+
    |  Adapter Primaire Test  |  --> appelle directement le Use Case
    +-------------------------+
    |  Adapter Secondaire     |  --> InMemoryOrderRepository
    |  (en memoire)           |
    +-------------------------+
```

---

## Pratique — Implémentation NestJS complete

### Structure de dossiers

```
src/
  orders/
    core/
      ports/
        primary/
          create-order.use-case.ts    # Interface d'entree
        secondary/
          order-repository.port.ts   # Interface de sortie
          email-sender.port.ts       # Interface de sortie
      domain/
        order.entity.ts
      use-cases/
        create-order.use-case.impl.ts
    adapters/
      primary/
        rest/
          orders.controller.ts       # Adapter REST (driving)
      secondary/
        typeorm/
          order.typeorm-repository.ts # Adapter DB (driven)
        sendgrid/
          sendgrid-email.adapter.ts  # Adapter Email (driven)
        in-memory/
          order.in-memory-repository.ts # Adapter Test (driven)
```

### Port Primaire — Interface d'entree du coeur

```typescript
// src/orders/core/ports/primary/create-order.use-case.ts

export interface CreateOrderCommand {
  customerId: string;
  items: Array<{ productId: string; quantity: number; unitPrice: number }>;
}

export interface CreateOrderResult {
  orderId: string;
  totalAmount: number;
}

// Le coeur expose CE contrat aux clients exterieurs
// Tout ce qui veut creer une commande doit passer par la
export interface ICreateOrderUseCase {
  execute(command: CreateOrderCommand): Promise<CreateOrderResult>;
}
```

### Ports Secondaires — Interfaces de sortie du coeur

```typescript
// src/orders/core/ports/secondary/order-repository.port.ts

import { Order } from '../../domain/order.entity';

// Le coeur DEFINIT ce qu'il attend de la persistance
// Il ne sait pas si c'est PostgreSQL, MongoDB ou Redis
export interface IOrderRepository {
  save(order: Order): Promise<void>;
  findById(id: string): Promise<Order | null>;
  findByCustomer(customerId: string): Promise<Order[]>;
}
```

```typescript
// src/orders/core/ports/secondary/email-sender.port.ts

// Le coeur DEFINIT ce qu'il attend de l'email
// Il ne sait pas si c'est SendGrid, SES ou un mock
export interface IEmailSender {
  sendOrderConfirmation(params: {
    to: string;
    orderId: string;
    totalAmount: number;
  }): Promise<void>;
}
```

### Domain — Entité métier

```typescript
// src/orders/core/domain/order.entity.ts
import { randomUUID } from 'crypto';

export class Order {
  readonly id: string;
  private readonly customerId: string;
  private readonly items: OrderItem[];
  private status: 'draft' | 'confirmed';
  readonly totalAmount: number;

  private constructor(params: {
    id: string;
    customerId: string;
    items: OrderItem[];
    status: 'draft' | 'confirmed';
  }) {
    this.id = params.id;
    this.customerId = params.customerId;
    this.items = params.items;
    this.status = params.status;
    // Calcul metier dans l'entite — pas dans un Service utilitaire externe
    this.totalAmount = items.reduce(
      (sum, item) => sum + item.quantity * item.unitPrice,
      0
    );
  }

  // Factory : seule facon de creer une commande valide
  static create(customerId: string, items: OrderItem[]): Order {
    if (items.length === 0) {
      throw new Error('An order must contain at least one item');
    }
    return new Order({
      id: randomUUID(),
      customerId,
      items,
      status: 'draft',
    });
  }

  // Reconstitution depuis la persistance
  static reconstitute(params: {
    id: string;
    customerId: string;
    items: OrderItem[];
    status: 'draft' | 'confirmed';
  }): Order {
    return new Order(params);
  }

  confirm(): void {
    if (this.status !== 'draft') {
      throw new Error(`Cannot confirm order with status: ${this.status}`);
    }
    this.status = 'confirmed';
  }

  getStatus() { return this.status; }
  getCustomerId() { return this.customerId; }
}

export interface OrderItem {
  productId: string;
  quantity: number;
  unitPrice: number;
}
```

### Use Case — Implémentation du coeur

```typescript
// src/orders/core/use-cases/create-order.use-case.impl.ts
import { Injectable, Inject } from '@nestjs/common';
import {
  ICreateOrderUseCase,
  CreateOrderCommand,
  CreateOrderResult,
} from '../ports/primary/create-order.use-case';
import { IOrderRepository } from '../ports/secondary/order-repository.port';
import { IEmailSender } from '../ports/secondary/email-sender.port';
import { Order } from '../domain/order.entity';

// Tokens d'injection — evite les dependances aux classes concretes
export const ORDER_REPOSITORY = 'ORDER_REPOSITORY';
export const EMAIL_SENDER = 'EMAIL_SENDER';

@Injectable()
export class CreateOrderUseCase implements ICreateOrderUseCase {
  constructor(
    // Injecte les PORTS (interfaces), jamais les adapters concrets
    // Le coeur est ainsi completement decoupled de l'infrastructure
    @Inject(ORDER_REPOSITORY) private readonly orderRepo: IOrderRepository,
    @Inject(EMAIL_SENDER) private readonly emailSender: IEmailSender,
  ) {}

  async execute(command: CreateOrderCommand): Promise<CreateOrderResult> {
    // 1. Cree l'entite via la factory (logique de validation dans l'entite)
    const order = Order.create(command.customerId, command.items);

    // 2. Persiste via le port secondaire (peu importe l'adapter branche)
    await this.orderRepo.save(order);

    // 3. Envoie la confirmation via le port email
    await this.emailSender.sendOrderConfirmation({
      to: `${command.customerId}@example.com`, // simplifie
      orderId: order.id,
      totalAmount: order.totalAmount,
    });

    return { orderId: order.id, totalAmount: order.totalAmount };
  }
}
```

### Adapter Primaire — REST Controller

```typescript
// src/orders/adapters/primary/rest/orders.controller.ts
import { Controller, Post, Body, Inject } from '@nestjs/common';
import { ICreateOrderUseCase } from '../../../core/ports/primary/create-order.use-case';

// Token pour l'injection du Use Case
export const CREATE_ORDER_USE_CASE = 'CREATE_ORDER_USE_CASE';

class CreateOrderDto {
  customerId: string;
  items: Array<{ productId: string; quantity: number; unitPrice: number }>;
}

@Controller('orders')
export class OrdersController {
  constructor(
    // L'adapter REST depend du PORT PRIMAIRE, pas de l'implementation
    // Si demain on remplace le Use Case, le controller ne change pas
    @Inject(CREATE_ORDER_USE_CASE)
    private readonly createOrder: ICreateOrderUseCase,
  ) {}

  @Post()
  async create(@Body() dto: CreateOrderDto) {
    // Traduit HTTP -> Commande du coeur
    const result = await this.createOrder.execute({
      customerId: dto.customerId,
      items: dto.items,
    });
    // Traduit le resultat du coeur -> reponse HTTP
    return { id: result.orderId, total: result.totalAmount };
  }
}
```

### Adapter Secondaire — Repository en mémoire (pour les tests)

```typescript
// src/orders/adapters/secondary/in-memory/order.in-memory-repository.ts
import { IOrderRepository } from '../../../core/ports/secondary/order-repository.port';
import { Order } from '../../../core/domain/order.entity';

// Cet adapter permet de tester le Use Case SANS base de donnees
// Execution : < 1ms vs ~50ms avec une vraie BDD
export class InMemoryOrderRepository implements IOrderRepository {
  // Stockage interne — accessible dans les tests pour les assertions
  private readonly store = new Map<string, Order>();

  async save(order: Order): Promise<void> {
    this.store.set(order.id, order);
  }

  async findById(id: string): Promise<Order | null> {
    return this.store.get(id) ?? null;
  }

  async findByCustomer(customerId: string): Promise<Order[]> {
    return [...this.store.values()].filter(
      (o) => o.getCustomerId() === customerId
    );
  }

  // Helper de test — pas dans l'interface, uniquement pour les assertions
  getAll(): Order[] {
    return [...this.store.values()];
  }

  clear(): void {
    this.store.clear();
  }
}
```

### Test d'intégration du coeur — zero infrastructure

```typescript
// src/orders/core/use-cases/create-order.use-case.spec.ts
import { CreateOrderUseCase } from './create-order.use-case.impl';
import { InMemoryOrderRepository } from '../../adapters/secondary/in-memory/order.in-memory-repository';

// Adapter email de test — enregistre les appels pour assertion
class FakeEmailSender {
  sentEmails: Array<{ to: string; orderId: string }> = [];

  async sendOrderConfirmation(params: { to: string; orderId: string; totalAmount: number }) {
    this.sentEmails.push({ to: params.to, orderId: params.orderId });
  }
}

describe('CreateOrderUseCase', () => {
  let useCase: CreateOrderUseCase;
  let orderRepo: InMemoryOrderRepository;
  let emailSender: FakeEmailSender;

  beforeEach(() => {
    orderRepo = new InMemoryOrderRepository();
    emailSender = new FakeEmailSender();
    // Branche les adapters de test — aucun NestJS, aucune BDD, aucun reseau
    useCase = new CreateOrderUseCase(orderRepo, emailSender);
  });

  it('cree une commande et envoie un email de confirmation', async () => {
    const result = await useCase.execute({
      customerId: 'cust-123',
      items: [{ productId: 'prod-A', quantity: 2, unitPrice: 50 }],
    });

    // La commande a ete persistee
    expect(orderRepo.getAll()).toHaveLength(1);
    // Le total est correct (logique du Domain)
    expect(result.totalAmount).toBe(100);
    // L'email a ete envoye
    expect(emailSender.sentEmails).toHaveLength(1);
    expect(emailSender.sentEmails[0].orderId).toBe(result.orderId);
  });

  it('refuse une commande sans article', async () => {
    await expect(
      useCase.execute({ customerId: 'cust-123', items: [] })
    ).rejects.toThrow('at least one item');
  });
});
```

---

## Résumé

- L'architecture hexagonale isole le **coeur applicatif** (Domain + Use Cases) de toute infrastructure — il ne connait que des interfaces (Ports).
- Les **Ports Primaires** sont les interfaces d'entree que le coeur expose aux clients (REST, CLI, gRPC) ; les **Ports Secondaires** sont les interfaces de sortie que le coeur exige de l'infrastructure (BDD, email, cache).
- Les **Adapters** implementent ces ports : un adapter REST traduit HTTP vers le coeur, un adapter TypeORM traduit le coeur vers PostgreSQL.
- L'**Adapter de test en mémoire** est le super-pouvoir du patron : tester le coeur complet sans aucune infrastructure, en millisecondes.
- Contrairement au layering, l'hexagonale est **symetrique** — n'importe quel client peut se connecter via un nouvel adapter, sans modifier le coeur.


---

> **Lien fil rouge — ShopArch**
>
> - Refactore le module Catalog en hexagonal : ports dans `domain/`, adapters dans `infra/`
> - Vérifie que `ProductService` n'importe rien de `infra/`
> - Exercice(s) associé(s) : `exercices/05-layered-to-hexagonal/`
> - Checkpoint : Module 01, critère 1-2

## Prochain cours

[Cours 09 — Clean Architecture](./03-clean-architecture.md)

> On va découvrir les cercles concentriques de Robert Martin (Uncle Bob), la Dependency Rule absolue, et comment la Clean Architecture etend les idees de l'hexagonale en ajoutant des distinctions plus fines entre Use Cases, Entities et Frameworks.
