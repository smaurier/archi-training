# Cours 11 — Microservices

**Objectif :** Comprendre quand et comment decomposer un système en microservices, maîtriser les principes de séparation (domaine vs technique), connaitre les anti-patterns critiques, et disposer d'un cadre de decision clair.

---

## Rappel du cours précédent

> Cours 10 — Monolithe Modulaire & API-First.

**Question 1 — Pourquoi un monolithe modulaire est-il souvent préférable aux microservices pour une équipe de moins de 15 développeurs ?**

<details>
<summary>Réponse</summary>

Le monolithe modulaire évité l'overhead operationnel des microservices : pas besoin d'orchestration (Kubernetes), pas de tracing distribue, pas de gestion de N services independants avec N bases de données et N pipelines CI/CD. Les appels inter-modules sont locaux (< 1ms vs 5-50ms sur le réseau), les transactions ACID sont natives, et le refactoring des frontieres de module est beaucoup moins couteux que de deplacer du code entre services. Pour une petite équipe, cet overhead absorbe une part significative de la productivite.

</details>

**Question 2 — Qu'est-ce qu'un barrel file et quel est son role dans le monolithe modulaire ?**

<details>
<summary>Réponse</summary>

Un barrel file (généralement `index.ts`) est le fichier d'entree d'un module qui re-exporte uniquement les classes et interfaces qui constituent l'API publique de ce module. Tout ce qui n'est pas exporte par ce barrel est considere prive. Les autres modules ne peuvent importer que depuis ce fichier — jamais directement dans les sous-dossiers internes. C'est ce qui materialise et fait respecter les frontieres de modules.

</details>

---

## Analogie — La chaine de restaurants

Une seule grande cuisine qui fait tout (pizza, sushi, steak, desserts) = le monolithe. Si le chef de la pizza est malade, toute la cuisine souffre.

Une **chaine de restaurants specialises** = les microservices :
- Restaurant Pizza : sa propre cuisine, son propre stock, son propre personnel
- Restaurant Sushi : idem, totalement autonome
- Restaurant Desserts : idem

```
[Client]
   |
   v
[Serveur (API Gateway)]
   |          |          |
   v          v          v
[Pizza]   [Sushi]   [Desserts]
 stock      stock      stock
 propre     propre     propre
```

**Le client ne va pas dans les cuisines** — il commande via le serveur (API Gateway).

Si le restaurant Pizza brule, les restaurants Sushi et Desserts continuent de servir. Mais coordonner une commande mixte (une pizza ET des sushis) demande maintenant de la communication entre restaurants — c'est la complexité des microservices.

---

## Théorie

### 1. Définition et caractéristiques

Un microservice est un **service autonome** qui :
- Est responsable d'un **domaine métier delimite** (Bounded Context DDD)
- Possede sa **propre base de données** (pas de partage)
- Est **deployable independamment**
- Communique via **API (REST, gRPC) ou messagerie (Kafka, RabbitMQ)**
- Peut etre écrit dans **n'importe quel langage**

---

### 2. Decomposition par domaine vs par couche technique

```
MAUVAIS — Decomposition technique (couches en services) :
+-------------------+   +-------------------+   +-------------------+
|  Service "API"    |   |  Service "Logique" |   |  Service "Data"   |
|  (tous les HTTP)  |   |  (tout le metier)  |   |  (toute la BDD)   |
+-------------------+   +-------------------+   +-------------------+
  Resultat : MONOLITHE DISTRIBUE — tout change ensemble

BON — Decomposition par domaine metier :
+-------------------+   +-------------------+   +-------------------+
|  Service          |   |  Service          |   |  Service          |
|  Commandes        |   |  Catalogue        |   |  Paiement         |
|  [HTTP + Logique  |   |  [HTTP + Logique  |   |  [HTTP + Logique  |
|   + BDD propre]   |   |   + BDD propre]   |   |   + BDD propre]   |
+-------------------+   +-------------------+   +-------------------+
  Resultat : equipes autonomes, deployments independants
```

---

### 3. Le principe "Data per Service"

Chaque service **possédé** ses données. Aucun autre service ne peut les lire directement en base.

```
INTERDIT :
  Service Commandes ---[SQL JOIN]---> Table produits du Service Catalogue

AUTORISE :
  Service Commandes ---[HTTP GET /products/:id]---> Service Catalogue
  Service Commandes ---[Kafka event: ProductUpdated]---> copie locale (Read Model)
```

| Approche | Avantages | Inconvenients |
|---|---|---|
| HTTP synchrone | Simple, cohérent | Couplage temporel, latence |
| Messagerie async | Découplage, résilience | Eventual consistency |
| Read Model local | Performances, autonomie | Données dupliquees |

---

### 4. Service Discovery — Comment les services se trouvent

```
Sans Service Discovery (IPs fixes) :
  Service A connait : http://192.168.1.42:3000 --> fragile

Avec Service Discovery (Consul, Kubernetes DNS) :
  Service A demande au registre : "ou est le Service Catalogue ?"
  Registre repond : http://catalog-service.svc.cluster.local

+-------------------+
|  Service Registry  |
|  (Consul / K8s)   |
|  catalog -> pod-3  |
|  orders  -> pod-7  |
+--------+----------+
         |
   +-----+-----+
   |           |
[Catalog]   [Orders]
```

Dans Kubernetes, la découverte est native via DNS : `http://catalog-service.default.svc.cluster.local`.

---

### 5. API Gateway — Le point d'entree unique

```
                    [Client Web / Mobile]
                            |
               +------------v-----------+
               |      API GATEWAY       |
               |  - Authentification    |
               |  - Rate limiting       |
               |  - Routing             |
               |  - Aggregation         |
               +--+------+-------+------+
                  |      |       |
                  v      v       v
              [Orders][Catalog][Payment]
```

L'API Gateway centralise : auth (Keycloak), rate limiting, logging, routing, et parfois l'agregation de réponses (BFF — Backend For Frontend).

---

### 6. Les anti-patterns a éviter absolument

#### Anti-pattern 1 — Le Monolithe Distribue

```
Symptome : tous les services doivent etre deployes ensemble
           un changement dans Service A force un changement dans B, C, D

Cause : couplage fort malgre la separation physique
        partage de bibliotheques internes avec du code metier
        synchronisation temporelle forte (chaines d'appels sync)
```

#### Anti-pattern 2 — Les Nano-services

```
TROP DECOUPE :
  Service "create-order-item" (30 lignes)
  Service "update-order-status" (25 lignes)
  Service "calculate-order-total" (20 lignes)

Probleme : overhead operationnel enorme pour zero valeur
           3 deployments, 3 bases, 3 pipelines CI/CD
           appels reseau pour des operations triviales
```

#### Anti-pattern 3 — La Base de Données Partagee

```
INTERDIT :
  +----------+     +----------+
  | Service  |     | Service  |
  | Commandes|     | Catalogue|
  +----+-----+     +----+-----+
       |                |
       +-------+--------+
               |
       [BDD PARTAGEE]
         orders | products
Probleme : couplage au schema, pas de deploiement independant
```

#### Anti-pattern 4 — L'Orchestration Centralisee (God Service)

```
ANTI-PATTERN :
  [Order Orchestrator]
       |      |      |      |
       v      v      v      v
  [Stock][Payment][Email][Shipping]
  Tout passe par un seul service qui tout connait
  -> single point of failure, couplage total
```

---

### 7. Cadre de decision — Microservices ou pas ?

```
Q1 : Avez-vous > 20 developpeurs ?           Non -> Monolithe modulaire
                 |
                 Oui
                 |
Q2 : Le domaine est-il stable et bien compris ? Non -> Monolithe modulaire d'abord
                 |
                 Oui
                 |
Q3 : Les domaines ont-ils des besoins de scaling differents ?
                 Non -> Monolithe modulaire avec optimisations
                 |
                 Oui
                 |
Q4 : Etes-vous prets pour la complexite operationnelle ?
     (K8s, tracing, service mesh, saga pattern)
                 Non -> N'y allez pas encore
                 |
                 Oui -> Microservices par Bounded Context
```

---

## Pratique — Patterns de communication TypeScript

### Communication synchrone (HTTP) avec gestion de panne

```typescript
// src/orders/infrastructure/catalog.http-client.ts
import { Injectable, HttpException } from '@nestjs/common';

export interface ProductInfo {
  id: string;
  name: string;
  unitPrice: number;
  stockQuantity: number;
}

@Injectable()
export class CatalogHttpClient {
  private readonly baseUrl: string;
  private readonly timeoutMs = 3000;

  constructor() {
    // Adresse resolue par Service Discovery (K8s DNS ou Consul)
    // En production : http://catalog-service.default.svc.cluster.local
    this.baseUrl = process.env.CATALOG_SERVICE_URL ?? 'http://catalog-service';
  }

  async getProduct(productId: string): Promise<ProductInfo> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(`${this.baseUrl}/products/${productId}`, {
        signal: controller.signal,
        headers: {
          // Propagation du contexte de tracing distribue
          'X-Trace-Id': this.getTraceId(),
          'X-Service-Name': 'orders-service',
        },
      });

      if (!response.ok) {
        throw new HttpException(
          `Catalog service error: ${response.status}`,
          response.status,
        );
      }

      return response.json();
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        throw new HttpException('Catalog service timeout', 503);
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private getTraceId(): string {
    // En production : lire depuis le contexte AsyncLocalStorage
    return `trace-${Date.now()}`;
  }
}
```

### Pattern Circuit Breaker — Résilience

```typescript
// src/shared/circuit-breaker.ts

// Le Circuit Breaker evite de surcharger un service en panne
// avec des appels condamnes a echouer
type ServiceCall<T> = () => Promise<T>;

type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export class CircuitBreaker {
  private state: CircuitState = 'CLOSED';
  private failureCount = 0;
  private lastFailureTime: number | null = null;

  constructor(
    private readonly failureThreshold: number = 5,
    private readonly recoveryTimeMs: number = 10_000,
  ) {}

  async execute<T>(call: ServiceCall<T>): Promise<T> {
    if (this.state === 'OPEN') {
      const elapsed = Date.now() - (this.lastFailureTime ?? 0);
      if (elapsed > this.recoveryTimeMs) {
        // Essai en mode HALF_OPEN : on laisse passer un seul appel
        this.state = 'HALF_OPEN';
      } else {
        throw new Error('Circuit OPEN — service indisponible, appel bloque');
      }
    }

    try {
      const result = await call();
      // Succes : reinitialise le compteur
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.failureCount = 0;
    this.state = 'CLOSED';
  }

  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    if (this.failureCount >= this.failureThreshold) {
      // Trop d'echecs -> on ouvre le circuit, plus d'appels pendant recoveryTimeMs
      this.state = 'OPEN';
      console.warn(`Circuit breaker OPEN after ${this.failureCount} failures`);
    }
  }

  getState(): CircuitState { return this.state; }
}
```

### Communication asynchrone — Saga pattern (Choreography)

```typescript
// src/orders/domain/events/order-placed.event.ts
export interface OrderPlacedEvent {
  eventType: 'ORDER_PLACED';
  orderId: string;
  customerId: string;
  items: Array<{ productId: string; quantity: number; unitPrice: number }>;
  totalAmount: number;
  occurredAt: string; // ISO 8601
}

// src/inventory/application/reserve-stock.handler.ts
// Le service Inventory s'abonne a ORDER_PLACED via Kafka
// Il ne connait PAS le service Orders directement

export class ReserveStockHandler {
  constructor(private readonly inventoryRepo: IInventoryRepository) {}

  // Kafka consumer appellera cette methode pour chaque message ORDER_PLACED
  async handle(event: OrderPlacedEvent): Promise<void> {
    for (const item of event.items) {
      try {
        await this.inventoryRepo.reserveStock(item.productId, item.quantity);
        // Publie STOCK_RESERVED -> le service Paiement peut s'y abonner
        await this.publishEvent({
          eventType: 'STOCK_RESERVED',
          orderId: event.orderId,
          productId: item.productId,
          quantity: item.quantity,
        });
      } catch (error) {
        // Publie STOCK_RESERVATION_FAILED -> le service Orders annule la commande
        await this.publishEvent({
          eventType: 'STOCK_RESERVATION_FAILED',
          orderId: event.orderId,
          productId: item.productId,
          reason: (error as Error).message,
        });
      }
    }
  }

  private async publishEvent(event: Record<string, unknown>): Promise<void> {
    // Kafka producer — implementation omise
    console.log('Publishing event:', event);
  }
}

// Interface necessaire pour le handler (a implementer dans l'infrastructure)
interface IInventoryRepository {
  reserveStock(productId: string, quantity: number): Promise<void>;
}
```

### Test d'un service isole — mock du client HTTP

```typescript
// src/orders/use-cases/create-order.use-case.spec.ts

import { CreateOrderUseCase } from './create-order.use-case';

// Mock du client HTTP vers le service Catalog
class MockCatalogClient {
  async getProduct(productId: string) {
    const catalog: Record<string, { id: string; name: string; unitPrice: number; stockQuantity: number }> = {
      'prod-A': { id: 'prod-A', name: 'Widget', unitPrice: 25, stockQuantity: 100 },
    };
    const product = catalog[productId];
    if (!product) throw new Error(`Product ${productId} not found`);
    return product;
  }
}

class MockOrderRepo {
  orders: any[] = [];
  async save(order: any) { this.orders.push(order); }
  async findById() { return null; }
}

class MockEventPublisher {
  events: any[] = [];
  async publish(event: any) { this.events.push(event); }
}

describe('CreateOrderUseCase (microservice)', () => {
  it('cree une commande avec les prix recuperes du service Catalog', async () => {
    const repo = new MockOrderRepo();
    const eventPublisher = new MockEventPublisher();
    const useCase = new CreateOrderUseCase(
      repo as any,
      new MockCatalogClient() as any,
      eventPublisher as any,
    );

    const result = await useCase.execute({
      customerId: 'cust-1',
      items: [{ productId: 'prod-A', quantity: 4 }],
    });

    expect(result.orderId).toBeDefined();
    // Le total est calcule avec le prix recupere du service Catalog
    expect(repo.orders[0].getTotalAmount()).toBe(100); // 4 * 25
    // L'evenement ORDER_PLACED est publie pour la saga
    expect(eventPublisher.events[0].eventType).toBe('ORDER_PLACED');
  });
});
```

---

## Resume

- Les microservices se decoupent selon les **domaines métier** (Bounded Contexts), pas selon les couches techniques — chaque service a sa propre base de données, son propre déploiement et son propre cycle de vie.
- Le principe **"Data per Service"** est absolu : aucun accès direct en base entre services. La communication passe par HTTP synchrone ou messagerie asynchrone (Kafka, RabbitMQ).
- Les trois anti-patterns fatals sont le **monolithe distribue** (services couples déployés ensemble), les **nano-services** (overhead sans valeur) et la **base partagee** (couplage de schema).
- Le **Circuit Breaker** protégé le système global en bloquant les appels vers un service en panne, evitant les cascades d'echecs.
- Commencer par les microservices est souvent une erreur : le cadre de decision recommande de partir d'un monolithe modulaire et de n'extraire des services que quand les frontieres de domaine sont claires et stables.


---

> **Lien fil rouge — ShopArch**
>
> - Évalue si ShopArch a besoin de microservices maintenant ou si le monolithe modulaire suffit
> - Identifie quel module serait le premier candidat à l'extraction (Payment ? Search ?)
> - Exercice(s) associé(s) : `exercices/07-decomposer-monolithe/`, `exercices/07b-quand-ne-pas-decomposer/`
> - Checkpoint : Module 01, critère 1

## Prochain cours

[Cours 12 — Vertical Slice Architecture](./06-vertical-slice.md)

> On va découvrir une approche radicalement différente : organiser le code par feature plutot que par couche technique. Chaque "tranche verticale" contient tout ce qu'il faut pour une fonctionnalité — de l'API a la BDD — favorisant l'autonomie des équipes.
