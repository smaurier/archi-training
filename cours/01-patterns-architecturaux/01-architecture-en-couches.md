# Cours 07 — Architecture en couches (Layered Architecture)

**Objectif :** Comprendre comment organiser une application en couches distinctes, connaitre la différence entre couplage strict et relache, et etre capable d'implémenter ce patron avec NestJS.

---

## Rappel du cours précédent

> Module 00 — Fondamentaux. Si tu arrives ici directement, ces questions couvrent les bases indispensables.

**Question 1 — Qu'est-ce que le principe de séparation des preoccupations (Séparation of Concerns) ?**

<details>
<summary>Réponse</summary>

Chaque module, classe ou fonction doit avoir une seule responsabilité bien définie. On séparé ce qui change pour des raisons différentes : la logique métier change quand les règles changent, la couche HTTP change quand l'API change, la couche de persistance change quand la base de données change. Regrouper ces raisons de changer ensemble réduit le couplage.

</details>

**Question 2 — Pourquoi le couplage fort entre modules est-il dangereux ?**

<details>
<summary>Réponse</summary>

Un couplage fort signifie qu'un changement dans un module force des changements en cascade dans d'autres. Cela rend les tests difficiles (on ne peut pas tester un module seul), les refactorisations risquees, et le code difficile a comprendre car il faut lire plusieurs fichiers pour comprendre une seule feature.

</details>

---

## Analogie — L'immeuble a plusieurs etages

Imagine un immeuble de bureaux :

- **Rez-de-chaussee (accueil)** : recoit les visiteurs, vérifié les identités, oriente vers les bons etages
- **1er etage (direction)** : prend les decisions, orchestre les actions
- **2eme etage (métier/expertise)** : les experts qui font le vrai travail
- **Sous-sol (archives/infrastructure)** : stockage, serveurs, ressources

**Regles fondamentales de l'immeuble :**
- Un visiteur entre **toujours** par l'accueil, jamais directement au 2eme etage
- Le sous-sol ne remonte **jamais** au rez-de-chaussee pour accueillir des visiteurs
- Chaque etage a une **fonction unique et connue**

L'architecture en couches suit exactement cette logique.

---

## Théorie

### 1. Les quatre couches fondamentales

```
+------------------------------------------+
|        PRESENTATION LAYER                |
|   (Controllers, Routes, DTOs, Guards)    |
|   Gere : HTTP, WebSocket, CLI            |
+------------------------------------------+
              |  appelle
              v
+------------------------------------------+
|        APPLICATION LAYER                 |
|   (Services, Use Cases, Commands)        |
|   Gere : orchestration, transactions     |
+------------------------------------------+
              |  appelle
              v
+------------------------------------------+
|         DOMAIN LAYER                     |
|   (Entities, Value Objects, Rules)       |
|   Gere : logique metier pure             |
+------------------------------------------+
              |  appelle (via interfaces)
              v
+------------------------------------------+
|      INFRASTRUCTURE LAYER                |
|   (Repositories, ORM, APIs externes)    |
|   Gere : persistance, I/O, messaging    |
+------------------------------------------+
```

**Regle d'or :** Les dépendances ne vont **que vers le bas**. La couche Presentation connait Application, Application connait Domain, Domain définit des interfaces que Infrastructure implements.

---

### 2. Couches strictes vs relachees

| Critère | Strict (Strict Layering) | Relache (Relaxed Layering) |
|---|---|---|
| Définition | Chaque couche ne parle QU'a la couche directement en dessous | Une couche peut "sauter" des couches intermédiaires |
| Couplage | Faible | Modere |
| Nombre de classes | Plus élevé (passes-plats) | Moins élevé |
| Facilite de debug | Excellente (flux clair) | Acceptable |
| Performance | Legerement plus lente | Plus directe |
| Cas d'usage | Domaines complexes, équipes larges | CRUD simples, prototypes |

**Exemple strict :** La couche Presentation ne peut PAS appeler directement le Repository. Elle passe par le Service.

**Exemple relache :** Pour une simple lecture de données de référence (pays, devises), la Presentation peut appeler directement l'Infrastructure via un "query service" sans passer par le Domain.

---

### 3. Avantages et inconvenients

**Avantages :**
- **Testabilite** : chaque couche est testable independamment (mock les couches inferieures)
- **Lisibilite** : on sait ou chercher selon le type de problème
- **Remplacabilite** : changer d'ORM ne touche que l'Infrastructure
- **Onboarding** : les nouveaux développeurs comprennent vite la structure

**Inconvenients :**
- **Verbosité** : beaucoup de classes "passes-plats" pour des features simples
- **Anemic Domain Model** : risque de mettre toute la logique dans les Services et vider le Domain
- **Performance** : chaque couche = un niveau d'indirection supplementaire
- **Over-engineering** : pour un CRUD simple, 4 couches c'est lourd

---

### 4. Anti-patron : le Domain anemique

```typescript
// MAUVAIS : le Domain est juste un sac de donnees
class Order {
  id: string;
  items: OrderItem[];
  status: string;
  // Aucune logique !
}

// La logique finit dans le Service (violation SRP)
class OrderService {
  confirm(order: Order): void {
    if (order.items.length === 0) throw new Error('...');
    if (order.status !== 'draft') throw new Error('...');
    order.status = 'confirmed'; // Le service manipule l'etat interne
  }
}
```

```typescript
// BON : le Domain encapsule sa propre logique
class Order {
  private status: OrderStatus = OrderStatus.DRAFT;
  private items: OrderItem[] = [];

  confirm(): void {
    if (this.items.length === 0) {
      throw new DomainError('Cannot confirm an empty order');
    }
    if (this.status !== OrderStatus.DRAFT) {
      throw new DomainError('Order is not in draft state');
    }
    this.status = OrderStatus.CONFIRMED;
  }

  addItem(item: OrderItem): void {
    if (this.status !== OrderStatus.DRAFT) {
      throw new DomainError('Cannot modify a confirmed order');
    }
    this.items.push(item);
  }
}
```

---

## Pratique — Exemple NestJS complet

### Structure de dossiers

```
src/
  orders/
    presentation/
      orders.controller.ts    # HTTP layer
      create-order.dto.ts     # Input validation
    application/
      orders.service.ts       # Orchestration
      create-order.command.ts # Command object
    domain/
      order.entity.ts         # Logique metier
      order-repository.interface.ts  # Port vers Infrastructure
    infrastructure/
      order.repository.ts     # Implementation TypeORM
      order.orm-entity.ts     # Mapping BDD
```

### Couche Presentation — Controller

```typescript
// src/orders/presentation/orders.controller.ts
import { Controller, Post, Body, Param, Get } from '@nestjs/common';
import { OrdersService } from '../application/orders.service';
import { CreateOrderDto } from './create-order.dto';

@Controller('orders')
export class OrdersController {
  constructor(
    // Injecte le SERVICE (couche Application), jamais le Repository directement
    private readonly ordersService: OrdersService,
  ) {}

  @Post()
  async createOrder(@Body() dto: CreateOrderDto) {
    // Le controller ne connait PAS l'entite Order — il travaille avec des DTOs
    const orderId = await this.ordersService.createOrder(dto);
    return { id: orderId };
  }

  @Post(':id/confirm')
  async confirmOrder(@Param('id') id: string) {
    await this.ordersService.confirmOrder(id);
    return { status: 'confirmed' };
  }
}
```

### Couche Application — Service

```typescript
// src/orders/application/orders.service.ts
import { Injectable } from '@nestjs/common';
import { IOrderRepository } from '../domain/order-repository.interface';
import { Order } from '../domain/order.entity';
import { CreateOrderDto } from '../presentation/create-order.dto';

@Injectable()
export class OrdersService {
  constructor(
    // Injecte l'INTERFACE du Repository, pas l'implementation concrete
    // Le Domain definit le contrat, l'Infrastructure le remplit
    private readonly orderRepository: IOrderRepository,
  ) {}

  async createOrder(dto: CreateOrderDto): Promise<string> {
    // Cree l'entite Domain — logique metier dans l'entite
    const order = Order.create(dto.customerId, dto.items);

    // Persiste via le Repository (abstraction)
    await this.orderRepository.save(order);

    return order.id;
  }

  async confirmOrder(orderId: string): Promise<void> {
    // Recupere depuis la persistance
    const order = await this.orderRepository.findById(orderId);
    if (!order) throw new Error(`Order ${orderId} not found`);

    // Appelle la LOGIQUE METIER sur l'entite Domain
    order.confirm();

    // Persiste les changements
    await this.orderRepository.save(order);
  }
}
```

### Couche Domain — Entité et interface Repository

```typescript
// src/orders/domain/order.entity.ts
import { randomUUID } from 'crypto';

export enum OrderStatus {
  DRAFT = 'draft',
  CONFIRMED = 'confirmed',
  CANCELLED = 'cancelled',
}

export class Order {
  readonly id: string;
  private status: OrderStatus;
  private readonly customerId: string;
  private items: string[];

  // Factory method — controle la creation
  static create(customerId: string, items: string[]): Order {
    const order = new Order();
    (order as any).id = randomUUID();
    order.status = OrderStatus.DRAFT;
    (order as any).customerId = customerId;
    order.items = [...items];
    return order;
  }

  // Logique metier : les regles vivent ICI, pas dans le Service
  confirm(): void {
    if (this.items.length === 0) {
      throw new Error('Cannot confirm an empty order');
    }
    if (this.status !== OrderStatus.DRAFT) {
      throw new Error(`Cannot confirm order in status: ${this.status}`);
    }
    this.status = OrderStatus.CONFIRMED;
  }

  getStatus(): OrderStatus {
    return this.status;
  }
}
```

```typescript
// src/orders/domain/order-repository.interface.ts
import { Order } from './order.entity';

// L'INTERFACE est dans le Domain — le Domain ne depend pas de l'Infrastructure
export interface IOrderRepository {
  findById(id: string): Promise<Order | null>;
  save(order: Order): Promise<void>;
  delete(id: string): Promise<void>;
}
```

### Couche Infrastructure — Repository concret

```typescript
// src/orders/infrastructure/order.repository.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IOrderRepository } from '../domain/order-repository.interface';
import { Order } from '../domain/order.entity';
import { OrderOrmEntity } from './order.orm-entity';

@Injectable()
export class OrderRepository implements IOrderRepository {
  constructor(
    @InjectRepository(OrderOrmEntity)
    private readonly ormRepo: Repository<OrderOrmEntity>,
  ) {}

  async findById(id: string): Promise<Order | null> {
    const ormEntity = await this.ormRepo.findOne({ where: { id } });
    if (!ormEntity) return null;
    // Mapping ORM Entity -> Domain Entity (anticorruption)
    return this.toDomain(ormEntity);
  }

  async save(order: Order): Promise<void> {
    // Mapping Domain Entity -> ORM Entity
    const ormEntity = this.toOrm(order);
    await this.ormRepo.save(ormEntity);
  }

  async delete(id: string): Promise<void> {
    await this.ormRepo.delete(id);
  }

  private toDomain(orm: OrderOrmEntity): Order {
    // Reconstruction de l'entite Domain depuis la BDD
    // Implementation selon le mapping de ton ORM
    return Order.reconstitute(orm.id, orm.customerId, orm.status, orm.items);
  }

  private toOrm(order: Order): OrderOrmEntity {
    const entity = new OrderOrmEntity();
    entity.id = order.id;
    entity.status = order.getStatus();
    return entity;
  }
}
```

---

## Resume

- L'architecture en couches divise le code en **4 zones** : Presentation, Application, Domain, Infrastructure — chacune avec une responsabilité unique.
- La **règle fondamentale** : les dépendances ne vont que vers le bas (Presentation -> Application -> Domain). Le Domain ne connait pas l'Infrastructure.
- Le **Domain** doit contenir la vraie logique métier — si tes entités sont des sacs de données vides, tu as un "Anemic Domain Model".
- L'**interface Repository** est déclarée dans le Domain et implémentée dans l'Infrastructure — c'est le principe d'inversion de dépendance (DIP).
- Le layering **strict** convient aux domaines complexes ; le **relache** est acceptable pour des CRUDs simples, mais il faut le choisir consciemment.


---

> **Lien fil rouge — ShopArch**
>
> - Identifie les couches actuelles de ShopArch (Presentation, Application, Domain, Infrastructure)
> - Repère les violations de dépendances (un controller qui accède directement à la DB ?)
> - Exercice(s) associé(s) : `exercices/05-layered-to-hexagonal/`
> - Checkpoint : Module 01, critère 1

## Prochain cours

[Cours 08 — Architecture Hexagonale (Ports & Adapters)](./02-architecture-hexagonale.md)

> On va voir comment isoler complètement le coeur métier de toute infrastructure, avec des "ports" qui définissent les contrats et des "adapters" qui les implementent — REST, BDD, tests...
