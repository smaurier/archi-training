# Correction — Exercice 02 : Identifier les design patterns

## Partie A — Réponses

| Extrait | Pattern | Pourquoi ce choix | Risque / Limite |
|---|---|---|---|
| 1 | **Singleton** | Une seule instance de Logger partagee dans toute l'app | État global, difficile a mocker en test, couplage implicite |
| 2 | **Adapter** | Traduit l'API Stripe (centimes, statuts spécifiques) vers notre interface commune `PaymentGateway` | Aucun risque majeur — c'est l'usage ideal de l'Adapter |
| 3 | **Builder** | Construction pas a pas d'un objet complexe (Order) avec validation au `build()` | Verbeux pour des objets simples — si Order n'a que 2 champs, un constructeur suffit |
| 4 | **Observer** (Event Bus / Pub-Sub) | Découplage total entre emetteur et recepteur d'événements | Sans typage fort, les erreurs sont silencieuses (`emit('ordr_created')` — typo non détectée) |
| 5 | **Strategy** | Algorithme de calcul interchangeable a runtime (standard vs express) | Le `setStrategy()` mutable peut créer des bugs — préférer l'injection au constructeur |

## Partie B — Solution

### Architecture choisie

```
OrderConfirmed (event)
      │
      ▼
  EventBus (Observer)
      │
      ├──▶ NotificationDispatcher
      │         │
      │         ├──▶ EmailChannel (Strategy)
      │         ├──▶ SmsChannel (Strategy)
      │         └──▶ PushChannel (Strategy)
      │
      └──▶ (futurs listeners...)
```

**Patterns utilises :**
- **Observer** : découpler l'emission d'events de leur traitement
- **Strategy** : rendre les canaux de notification interchangeables et combinables

### Code

```typescript
// --- Types ---

interface NotificationPayload {
  to: string;
  subject: string;
  body: string;
}

// --- Strategy : canaux de notification ---

// L'interface du canal — chaque implementation sait envoyer via un medium
interface NotificationChannel {
  readonly name: string;
  send(payload: NotificationPayload): Promise<void>;
}

class EmailChannel implements NotificationChannel {
  readonly name = 'email';

  async send(payload: NotificationPayload): Promise<void> {
    // En vrai : appel SendGrid API
    console.log(`[EMAIL] To: ${payload.to} — ${payload.subject}`);
  }
}

class SmsChannel implements NotificationChannel {
  readonly name = 'sms';

  async send(payload: NotificationPayload): Promise<void> {
    // En vrai : appel Twilio API
    console.log(`[SMS] To: ${payload.to} — ${payload.body.slice(0, 160)}`);
  }
}

class PushChannel implements NotificationChannel {
  readonly name = 'push';

  async send(payload: NotificationPayload): Promise<void> {
    // En vrai : appel Firebase Cloud Messaging
    console.log(`[PUSH] To: ${payload.to} — ${payload.subject}`);
  }
}

// --- Observer : event bus type ---

type EventHandler<T = unknown> = (data: T) => void | Promise<void>;

class TypedEventBus {
  private handlers = new Map<string, EventHandler[]>();

  on<T>(event: string, handler: EventHandler<T>): void {
    const list = this.handlers.get(event) || [];
    list.push(handler as EventHandler);
    this.handlers.set(event, list);
  }

  async emit<T>(event: string, data: T): Promise<void> {
    const list = this.handlers.get(event) || [];
    // Toutes les notifications en parallele — non-bloquant
    await Promise.allSettled(list.map(handler => handler(data)));
  }
}

// --- Dispatcher : orchestre les canaux selon l'event ---

interface NotificationRule {
  event: string;
  channels: string[]; // noms des canaux a utiliser
  buildPayload: (data: unknown) => NotificationPayload;
}

class NotificationDispatcher {
  private channels = new Map<string, NotificationChannel>();

  constructor(
    private readonly bus: TypedEventBus,
    channels: NotificationChannel[],
    rules: NotificationRule[],
  ) {
    // Enregistre les canaux par nom
    for (const channel of channels) {
      this.channels.set(channel.name, channel);
    }

    // Enregistre les regles comme listeners
    for (const rule of rules) {
      this.bus.on(rule.event, async (data: unknown) => {
        const payload = rule.buildPayload(data);
        // Envoie sur tous les canaux configures pour cette regle
        const sends = rule.channels
          .map(name => this.channels.get(name))
          .filter(Boolean)
          .map(channel => channel!.send(payload));
        await Promise.allSettled(sends);
      });
    }
  }
}

// --- Usage ---

const bus = new TypedEventBus();

const dispatcher = new NotificationDispatcher(
  bus,
  [new EmailChannel(), new SmsChannel(), new PushChannel()],
  [
    {
      event: 'order.confirmed',
      channels: ['email', 'push'], // Email + Push pour une commande
      buildPayload: (data: any) => ({
        to: data.customerEmail,
        subject: 'Commande confirmee',
        body: `Votre commande #${data.orderId} est confirmee.`,
      }),
    },
    {
      event: 'delivery.delayed',
      channels: ['email', 'sms'], // Email + SMS pour un retard
      buildPayload: (data: any) => ({
        to: data.customerEmail,
        subject: 'Retard de livraison',
        body: `Votre livraison #${data.deliveryId} a du retard.`,
      }),
    },
  ],
);

// Emettre un event — le dispatcher gere tout
await bus.emit('order.confirmed', {
  orderId: 'ORD-001',
  customerEmail: 'alice@mail.com',
});
```

### Pourquoi NE PAS utiliser Singleton ici

```typescript
// MAUVAIS — Singleton pour le NotificationDispatcher
class NotificationDispatcher {
  private static instance: NotificationDispatcher;
  static getInstance(): NotificationDispatcher {
    if (!this.instance) this.instance = new NotificationDispatcher();
    return this.instance;
  }
}

// Problemes :
// 1. Impossible de tester avec des mocks (instance globale partagee)
// 2. Impossible d'avoir 2 configurations differentes (ex: tests vs prod)
// 3. Etat global = couplage implicite entre tous les modules qui l'utilisent
// 4. Ordre d'initialisation non garanti dans les tests
```

## Alternatives et arbitrages

> En architecture, ta valeur n'est pas de connaître UNE solution,
> mais de savoir POURQUOI tu choisis celle-ci plutôt qu'une autre.

### Matrice décisionnelle — quand utiliser chaque pattern

| Pattern | Quand l'utiliser | Quand l'éviter | Signal d'alerte |
|---|---|---|---|
| **Singleton** | Config read-only, logger global | Dès qu'il y à un état mutable partagé | "Je ne peux pas tester en parallèle" |
| **Factory** | Création complexe, plusieurs variantes d'un même type | Objet simple créable avec `new` | "Mon Factory ne fait que `new X()`" |
| **Builder** | Objet avec beaucoup de paramètres optionnels (>4) | Objet simple avec 2-3 params | "Mon Builder n'a que 2 méthodes" |
| **Observer** | Découplage émetteur/récepteur, notifications multi-listeners | Un seul listener connu à l'avance | "Je dois connaître l'ordre des listeners" |
| **Strategy** | Algorithme interchangeable (tri, pricing, validation) | Un seul algorithme possible | "Je n'ai qu'une seule Strategy" |

### Pièges courants par pattern

| Pattern | Piège | Solution |
|---|---|---|
| Singleton | État mutable partagé entre tests | Préférer l'injection de dépendances |
| Factory | Factory God qui crée tout | Une factory par famille de produits |
| Observer | Memory leaks (listeners non détachés) | `removeListener` dans le cleanup |
| Strategy | If/else pour choisir la strategy | Registry ou injection |

### Pour ShopArch, on utilise...
- **Factory** pour créer les différents types de notifications (email, SMS, push)
- **Strategy** pour le calcul de prix (prix normal, promo, wholesale)
- **Observer** pour les domain events (OrderPlaced → déclenche email + stock update)
- **Builder** pour construire les requêtes de recherche complexes (filtres, tri, pagination)

---

## Ce que tu aurais pu oublier

### 1. Ne pas rendre les notifications asynchrones

```typescript
// FAUX — bloque le traitement si l'envoi echoue
await emailChannel.send(payload);
await smsChannel.send(payload);

// CORRECT — envoi en parallele, un echec n'arrete pas les autres
await Promise.allSettled([
  emailChannel.send(payload),
  smsChannel.send(payload),
]);
```

### 2. Hardcoder les canaux par event

```typescript
// FAUX — ajouter WhatsApp = modifier cette fonction
if (event === 'order.confirmed') {
  await emailChannel.send(payload);
  await pushChannel.send(payload);
}

// CORRECT — configuration declarative
{ event: 'order.confirmed', channels: ['email', 'push', 'whatsapp'] }
```

### 3. Oublier le typage sur l'EventBus

```typescript
// FAUX — pas de typage, erreurs silencieuses
bus.emit('ordr_confirmed', data); // Typo non detectee

// MIEUX — utiliser un enum ou des constantes typees
const EVENTS = {
  ORDER_CONFIRMED: 'order.confirmed',
  DELIVERY_DELAYED: 'delivery.delayed',
} as const;
bus.emit(EVENTS.ORDER_CONFIRMED, data);
```

### 4. Confondre Observer et Strategy

L'Observer découplé "quand" (l'event) du "quoi" (le handler).
La Strategy découplé "comment" (l'algorithme) du "qui l'utilise" (le contexte).
Ici, les DEUX sont nécessaires : Observer pour les events, Strategy pour les canaux.
