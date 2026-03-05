# Correction — Exercice 07 : Decomposer un monolithe

## Résultat attendu

Une architecture microservices avec 5 services bien decoupes, des communications claires (sync pour le critique, async pour le reste), et un ordre de migration pragmatique.

## Graphe de dépendances

```
             ┌──────────┐
     ┌──────>│ Catalog   │<──────┐
     │       │ (stock)   │       │
     │       └──────────┘       │
     │                           │
┌────┴────┐                ┌────┴────┐
│  Cart   │<──────────────>│  Order  │
└─────────┘                └────┬────┘
                                │
              ┌─────────────────┼─────────────────┐
              │                 │                  │
         ┌────▼────┐      ┌────▼────┐       ┌────▼────┐
         │ Payment │      │  User   │       │Notific. │
         └─────────┘      └─────────┘       └─────────┘
                                                  │
                                            ┌─────▼─────┐
                                            │ Analytics │
                                            └───────────┘
```

## Service boundaries proposees

| Service | Modules inclus | Justification |
|---|---|---|
| **Catalog Service** | catalog, search | Meme domaine, forte cohesion, lecture intensive |
| **Cart Service** | cart | Ephemere, cycle de vie différent, session-bound |
| **Order Service** | order | Workflow complexe (FSM), audit trail, coeur métier |
| **Payment Service** | payment, refund | Reglementaire, isolation de sécurité, PCI-DSS |
| **User Service** | user, address, préférences | Identité, RGPD, cycle de vie utilisateur |
| **Notification Service** | email, SMS, push | Asynchrone pur, peut etre rate limite independamment |
| **Analytics Service** | analytics | Fire-and-forget, pas de couplage métier |

## Architecture cible

```
                    ┌──────────────┐
                    │ API Gateway  │
                    │ (routing,    │
                    │  auth, rate  │
                    │  limiting)   │
                    └──────┬───────┘
                           │
          ┌────────────────┼────────────────────┐
          │                │                    │
   ┌──────▼──────┐  ┌─────▼──────┐  ┌─────────▼──────┐
   │   Catalog   │  │   Order    │  │     User       │
   │   Service   │  │   Service  │  │    Service     │
   │  ┌────────┐ │  │  ┌───────┐ │  │  ┌──────────┐ │
   │  │Postgres│ │  │  │Postgre│ │  │  │ Postgres │ │
   │  └────────┘ │  │  └───────┘ │  │  └──────────┘ │
   └─────────────┘  └─────┬──────┘  └───────────────┘
                          │
            ┌─────────────┼─────────────┐
            │ (sync)      │ (async)     │ (async)
     ┌──────▼──────┐  ┌──▼────────┐  ┌─▼───────────┐
     │   Payment   │  │ Notific.  │  │  Analytics  │
     │   Service   │  │  Service  │  │   Service   │
     │  ┌────────┐ │  └───────────┘  │  ┌────────┐ │
     │  │Postgres│ │                 │  │ClickHs.│ │
     │  └────────┘ │                 │  └────────┘ │
     └─────────────┘                 └─────────────┘

Legende :
  ─── sync (HTTP/gRPC)
  ─── async (Message Queue : RabbitMQ/Kafka)
```

## Communications

```typescript
// Order Service — version microservices
@Injectable()
export class OrderService {
  constructor(
    private readonly catalogClient: CatalogServiceClient,  // HTTP sync
    private readonly paymentClient: PaymentServiceClient,   // HTTP sync
    private readonly userClient: UserServiceClient,         // HTTP sync
    private readonly eventBus: EventBus,                    // Async
  ) {}

  async createOrder(userId: string, cartId: string): Promise<Order> {
    // Sync — on a BESOIN du resultat immediatement
    const user = await this.userClient.findById(userId);
    const cart = await this.catalogClient.getCartItems(cartId);

    // Sync — critique pour la coherence
    await this.catalogClient.reserveStock(cart.items);

    const order = await this.orderRepo.save({
      userId,
      items: cart.items,
      total: cart.total,
    });

    // Sync — le paiement DOIT reussir pour confirmer la commande
    const payment = await this.paymentClient.charge(order.id, order.total);

    // Async — pas besoin d'attendre, fire-and-forget
    await this.eventBus.publish('order.created', {
      orderId: order.id,
      userId: user.id,
      email: user.email,
      items: order.items,
      total: order.total,
    });

    // Le Notification Service ecoute 'order.created' → envoie l'email
    // L'Analytics Service ecoute 'order.created' → track l'event

    return order;
  }
}
```

## Ordre de migration

```
1. Notification Service (le plus decouple, fire-and-forget, zero impact si down)
2. Analytics Service (idem, aucun couplage metier)
3. Catalog Service (lectures intensives, pas d'ecriture critique)
4. User Service (identite, stable, peu de changements)
5. Payment Service (critique, regulatoire — migrer en dernier, tester le plus)
6. Order Service (orchestrateur — migrer quand tous les autres sont prets)
```

## Ce que tu aurais pu oublier

### 1. Créer 1 service par module (nano-services)

```
FAUX — 7 services pour une equipe de 5 devs
  → Overhead operationnel enorme
  → Chaque service = deploy, monitoring, DB, CI/CD

CORRECT — Regrouper par domaine
  → 5 services pour commencer
  → Decomposer davantage SI l'equipe grandit
```

### 2. Garder une base de données partagee

```
FAUX — Tous les services lisent la meme base PostgreSQL
  → Couplage schema : changer une table casse N services
  → Impossible de scaler independamment

CORRECT — Data per service
  → Chaque service a sa propre DB
  → Communication par API ou events
```

### 3. Tout rendre synchrone

```
FAUX — OrderService appelle NotificationService en HTTP sync
  → Si le service notification est down, la commande echoue
  → Latence cumulee : 5 appels sync = 5x le temps

CORRECT — Async pour le non-critique
  → Publish event 'order.created'
  → Notification et Analytics ecoutent en async
  → La commande n'echoue pas si la notif echoue
```

### 4. Oublier le distributed monolith

```
FAUX — 5 services qui s'appellent tous en sync en chaine
  → C'est un monolithe distribue : le pire des deux mondes
  → Latence reseau + complexite operationnelle + couplage

CORRECT — Minimiser les appels sync entre services
  → Choreographie (events) plutot qu'orchestration quand possible
  → Chaque service doit pouvoir fonctionner en mode degrade
```

### 5. Migrer tout d'un coup (Big Bang)

```
FAUX — On arrete tout et on redeploy 5 services en meme temps
  → Risque maximum, impossible de debugger

CORRECT — Strangler Fig
  → Extraire un service a la fois
  → Le monolithe continue a fonctionner pendant la migration
  → Proxy devant pour router vers l'ancien ou le nouveau
```
