---
titre: Design patterns essentiels
cours: 13-architecture
notions: [pattern comme réponse à un problème, Factory, Strategy, Observer, Adapter, Decorator, Repository, Singleton et ses dangers, over-engineering]
outcomes:
  - sait nommer le problème qu'un pattern résout avant de le choisir
  - sait appliquer Factory, Strategy, Observer, Adapter, Decorator, Repository sur un cas réel
  - sait pourquoi Singleton est un anti-pattern déguisé et par quoi le remplacer
  - sait reconnaître quand un pattern est de l'over-engineering et l'éviter
prerequis:
  - "notions du module 00 (posture architecturale, couplage, cohésion)"
  - "principes SOLID du module 01 (OCP, DIP, ISP)"
next: 03-clean-code-code-smells-refactoring
libs: []
tribuzen: conception du domaine TribuZen — notifications multi-canal, calcul de rappels, accès aux données (NotificationFactory, ReminderStrategy, TribuRepository)
last-reviewed: 2026-07
---

# Design patterns essentiels

> **Outcomes — tu sauras FAIRE :** nommer le problème qu'un pattern résout avant de coder, choisir entre Factory / Strategy / Observer / Adapter / Decorator / Repository selon le problème réel, justifier pourquoi tu n'utilises PAS Singleton, et repérer l'over-engineering.
> **Difficulté :** :star::star::star:
>
> **Portée :** ce module couvre les **design patterns de conception objet** (GoF) les plus utiles au quotidien — ceux qui structurent une classe ou un petit groupe de classes. Les **patterns architecturaux** (couches, hexagonal, clean architecture) sont les modules **05 à 08**. Les **patterns distribués** (CQRS, Event Sourcing, Saga) sont le module **18**. La règle centrale ici : **un pattern est une réponse à un problème, pas un but à atteindre.**

## 1. Cas concret d'abord

Tu arrives sur TribuZen (l'app d'organisation de tribus/familles). Le module « rappels » doit **prévenir un membre** qu'un événement approche. Un collègue a écrit ça :

```ts
// reminder.service.ts — AVANT
class ReminderService {
  async notify(member: Member, event: TribuEvent, canal: string) {
    if (canal === 'email') {
      const html = `<p>Rappel : ${event.title}</p>`
      await sendgrid.send({ to: member.email, html })      // dépend direct de SendGrid
    } else if (canal === 'sms') {
      await twilio.messages.create({ to: member.phone, body: `Rappel : ${event.title}` })
    } else if (canal === 'push') {
      await fcm.send({ token: member.pushToken, notification: { title: event.title } })
    }
    // demain : ajouter WhatsApp → on rouvre CE fichier, on rajoute un else if...
  }
}
```

**Trois douleurs concrètes, chacune a un pattern comme réponse :**

1. Chaque nouveau canal **rouvre** `notify()` → violation d'OCP. Le problème « créer le bon objet selon une donnée d'exécution » = **Factory**.
2. Le code métier **dépend directement** de `sendgrid`, `twilio`, `fcm` — trois API aux signatures incompatibles. Le problème « faire tenir une API tierce dans MON interface » = **Adapter**.
3. Quand un rappel part, il faudrait aussi **logger**, **incrémenter un compteur**, **rafraîchir un cache**, sans que `notify()` connaisse tout ça. Le problème « réagir à un événement sans couplage » = **Observer**.

Tu ne vas pas « appliquer des patterns pour faire joli ». Tu vas **nommer chaque problème**, puis prendre le pattern qui y répond. C'est tout l'objet du module.

---

## 2. Théorie complète, concise

### 2.0 Le réflexe : problème d'abord, pattern ensuite

Un design pattern est une **solution nommée à un problème récurrent**. Le catalogue « Gang of Four » (GoF) en décrit 23. Tu n'as pas à les connaître tous par cœur : tu dois savoir **reconnaître le problème** et **piocher la bonne fiche**.

La question n'est jamais « quel pattern je mets ici ? » mais « **quel problème j'ai ?** ». Si tu ne sais pas nommer le problème en une phrase, tu n'as pas besoin de pattern — tu as besoin d'un `if`.

| Ton problème (en une phrase) | Le pattern qui répond |
|---|---|
| « Je dois créer un objet dont le type exact dépend d'une donnée d'exécution » | **Factory** |
| « J'ai plusieurs façons de faire le même calcul, interchangeables » | **Strategy** |
| « Quand X change, N choses doivent réagir sans que X les connaisse » | **Observer** |
| « Une API tierce ne rentre pas dans mon interface » | **Adapter** |
| « Je veux empiler des comportements optionnels sans exploser en sous-classes » | **Decorator** |
| « Je veux isoler mon domaine de la façon dont les données sont stockées » | **Repository** |
| « Je veux une seule instance globale » | **Singleton** — presque toujours à éviter (§2.7) |

> **Précision de vocabulaire (à connaître, sans pédantisme) :** tout ce tableau n'est pas du « GoF » au sens strict. Le **Repository** ne fait pas partie des 23 patterns du Gang of Four : il vient de Fowler (*PoEAA*) et d'Evans (*DDD*). Une factory à `switch` sur une clé (comme au §2.1) est un **Simple Factory** — un idiome courant, distinct du *Factory Method* GoF (qui délègue la création à une sous-classe via une méthode surchargée). Et un EventBus indexé par des topics en `string` (§2.3) relève du **Publish/Subscribe** (émetteur et abonnés découplés par un canal), pas de l'*Observer* GoF strict où le **sujet tient lui-même la liste** de ses observateurs. Les noms comptent moins que le problème résolu, mais autant les employer juste.

### 2.1 Factory — créer selon un type connu à l'exécution

**Problème** : le type d'objet à instancier n'est connu qu'au runtime (venu d'une requête, d'une config, de la BDD), ou la construction est assez complexe pour mériter d'être centralisée.

**Réponse** : une fonction/classe qui prend une clé et retourne la bonne implémentation d'une interface commune. Le client ne connaît que l'interface (DIP), et ajouter un type ne rouvre pas les autres (OCP).

```ts
interface Notifier {
  send(to: Member, message: string): Promise<void>
}

function createNotifier(canal: Canal): Notifier {
  switch (canal) {
    case 'email': return new EmailNotifier()
    case 'sms':   return new SmsNotifier()
    case 'push':  return new PushNotifier()
    // ajouter 'whatsapp' ICI, sans toucher aux autres notifiers
  }
}
```

**Quand NE PAS l'utiliser** : un seul type d'objet, ou `new MaClasse()` suffit. Une factory pour un unique produit est de la cérémonie inutile.

### 2.2 Strategy — algorithmes interchangeables

**Problème** : plusieurs variantes d'un même calcul (tri, tarif, rappel), choisies à l'exécution, et tu veux éviter un `if/else` géant qui grossit à chaque variante.

**Réponse** : encapsuler chaque variante derrière une interface commune, injecter la variante dans le contexte. On échange l'algorithme sans toucher au contexte.

```ts
interface ReminderStrategy {
  computeSendAt(event: TribuEvent): Date   // quand envoyer le rappel ?
}

class DayBeforeStrategy implements ReminderStrategy {
  computeSendAt(e: TribuEvent) { return subDays(e.startsAt, 1) }
}
class TwoHoursBeforeStrategy implements ReminderStrategy {
  computeSendAt(e: TribuEvent) { return subHours(e.startsAt, 2) }
}

class ReminderScheduler {
  constructor(private strategy: ReminderStrategy) {}  // injectée, pas codée en dur
  schedule(event: TribuEvent) {
    return this.strategy.computeSendAt(event)
  }
}
```

**Factory vs Strategy** : Factory répond à « **quel objet créer** ? », Strategy à « **quel comportement exécuter** ? ». Elles se combinent souvent (une factory choisit la strategy).

**Quand NE PAS l'utiliser** : deux branches figées qui ne bougeront jamais. Un `if` lisible bat une hiérarchie de classes.

### 2.3 Observer — réagir sans couplage

**Problème** : quand l'état d'un objet change, plusieurs autres doivent réagir, mais l'objet source **ne doit pas les connaître** (sinon il faudrait le rouvrir à chaque nouvel abonné).

**Réponse** : la source publie un événement ; les intéressés s'abonnent. Découplage total émetteur → récepteurs.

```ts
type Handler<T> = (payload: T) => void

class EventBus {
  private handlers = new Map<string, Handler<unknown>[]>()

  on<T>(event: string, handler: Handler<T>): () => void {
    const list = this.handlers.get(event) ?? []
    list.push(handler as Handler<unknown>)
    this.handlers.set(event, list)
    return () => this.handlers.set(event, list.filter(h => h !== handler)) // unsubscribe
  }

  emit<T>(event: string, payload: T): void {
    (this.handlers.get(event) ?? []).forEach(h => h(payload))
  }
}

// La source émet, sans savoir qui écoute
bus.emit('reminder.sent', { memberId, eventId })
// Les abonnés réagissent indépendamment : log, métrique, cache — 0 ligne dans la source
```

**Attention** : Observer synchrone en mémoire ≠ **messaging distribué** (Kafka, RabbitMQ, event-driven inter-services). Ça, c'est le module **17**. Ici on reste dans un seul process.

### 2.4 Adapter — faire rentrer l'incompatible

**Problème** : une API tierce (SDK, service legacy) a une signature qui ne colle pas à l'interface dont ton code a besoin, et tu ne peux pas la modifier.

**Réponse** : une classe qui **implémente ton interface** et **traduit** les appels vers l'API tierce. Ton domaine ne dépend que de ton interface.

```ts
// Mon interface (celle que mon domaine veut)
interface EmailNotifier {
  send(to: Member, message: string): Promise<void>
}

// L'adaptateur traduit vers SendGrid, sans que le domaine connaisse SendGrid
class SendGridAdapter implements EmailNotifier {
  constructor(private client: SendGridClient) {}
  async send(to: Member, message: string): Promise<void> {
    await this.client.sendEmail({                 // API tierce, signature imposée
      recipient: to.email,
      htmlContent: `<p>${message}</p>`,
      fromAddress: 'hello@tribuzen.app',
    })
  }
}
```

Changer de fournisseur (Mailgun, SES) = écrire un nouvel adaptateur, **zéro** modification du domaine. C'est l'idée qui prépare l'architecture hexagonale (module 06) : l'adaptateur est un **port branché sur un service externe**.

### 2.5 Decorator — empiler des comportements

**Problème** : ajouter des responsabilités optionnelles à un objet (retry, cache, log, chiffrement) **à la carte**, sans créer une classe par combinaison (`NotifierAvecRetryEtCache`, `NotifierAvecCacheSeul`…).

**Réponse** : un décorateur implémente la même interface que l'objet, le **contient**, et ajoute son comportement autour. On compose les couches.

```ts
class RetryNotifier implements Notifier {
  constructor(private inner: Notifier, private max = 3) {}
  async send(to: Member, message: string): Promise<void> {
    for (let i = 0; i < this.max; i++) {
      try { return await this.inner.send(to, message) }   // délègue au décoré
      catch (e) { if (i === this.max - 1) throw e }
    }
  }
}

// Composition : chaque couche enveloppe la précédente
const notifier = new RetryNotifier(new LoggingNotifier(new EmailNotifier()))
```

Même interface partout → le client ne voit qu'un `Notifier`. C'est le pattern derrière les **intercepteurs** NestJS et les **middlewares** Express.

### 2.6 Repository — isoler le domaine du stockage

**Problème** : ta logique métier ne doit pas dépendre de *comment* les données sont stockées (Prisma, SQL brut, API REST). Sinon changer d'ORM oblige à réécrire le domaine.

**Réponse** : une interface `Repository` exprimée **dans le vocabulaire du domaine** (`findActiveMembers`, `save`), implémentée par une classe technique. Le domaine dépend de l'interface (DIP).

```ts
// Interface — vit dans le domaine, parle métier
interface TribuRepository {
  findById(id: TribuId): Promise<Tribu | null>
  save(tribu: Tribu): Promise<void>
}

// Implémentation — vit dans l'infra, parle Prisma
class PrismaTribuRepository implements TribuRepository {
  constructor(private prisma: PrismaClient) {}
  async findById(id: TribuId) {
    const row = await this.prisma.tribu.findUnique({ where: { id } })
    return row ? toDomain(row) : null    // mappe la ligne SQL vers l'entité domaine
  }
  async save(tribu: Tribu) { /* upsert Prisma */ }
}
```

Bonus : en test, un `InMemoryTribuRepository` remplace Prisma sans base de données. Le Repository est un **pilier du DDD tactique** (module 10) — ici on pose juste la brique.

### 2.7 Singleton — et pourquoi tu ne devrais (presque) jamais l'écrire

**Problème visé** : garantir qu'une seule instance existe (config, connexion, logger).

**Le piège** : le Singleton classique (instance statique privée + `getInstance()`) résout ce problème en créant **trois problèmes pires** :

- **Dépendance globale cachée** : n'importe quel code peut appeler `Logger.getInstance()`. La dépendance n'apparaît pas dans les paramètres → couplage invisible, violation de DIP.
- **Tests fragiles** : l'état statique **persiste entre les tests** (un test pollue le suivant). Impossible d'injecter un double.
- **Concurrence** : en environnement concurrent, l'initialisation paresseuse est piégeuse.

```ts
// ❌ Singleton codé en dur — anti-pattern déguisé
class Config {
  private static instance: Config
  static getInstance() { return Config.instance ??= new Config() }
}
// N'importe où : Config.getInstance() → dépendance globale invisible, intestable

// ✅ La vraie réponse : une seule instance, mais INJECTÉE (module 04, DI)
// Le conteneur DI garantit l'unicité (scope singleton) ; le code reçoit la dépendance
class ReminderScheduler {
  constructor(private config: Config) {}   // explicite, mockable, découplé
}
```

**Retiens** : « une seule instance » est un besoin légitime ; le **pattern Singleton** est la mauvaise façon d'y répondre. La bonne façon = **l'injection de dépendances** avec un scope singleton géré par le conteneur (module 04). Cas où le Singleton natif reste tolérable : constante immuable chargée au démarrage, sans état mutable.

### 2.8 Le danger transversal : l'over-engineering

Un pattern mal choisi est **pire** que pas de pattern : il ajoute de l'indirection, des fichiers, de la charge mentale, sans résoudre de problème réel. Signaux d'alarme :

- Tu appliques un pattern « parce que c'est propre », pas parce qu'une douleur existe.
- Une seule implémentation d'une interface, et aucune seconde en vue → l'abstraction est spéculative (viole YAGNI).
- Il faut trois classes pour ce qu'un `if` de deux lignes faisait bien.

Règle : **introduis un pattern quand le problème qu'il résout est déjà là**, pas par anticipation.

---

## 3. Worked examples

### Exemple 1 — Refactorer le `ReminderService` du §1

On reprend la douleur initiale et on applique **trois** patterns, chacun sur son problème nommé.

```ts
// 1) ADAPTER — chaque API tierce rentre dans l'interface Notifier
interface Notifier { send(to: Member, message: string): Promise<void> }

class EmailNotifier implements Notifier { /* traduit vers SendGrid */ }
class SmsNotifier   implements Notifier { /* traduit vers Twilio   */ }
class PushNotifier  implements Notifier { /* traduit vers FCM      */ }

// 2) FACTORY — créer le bon notifier selon une donnée d'exécution (le canal)
function createNotifier(canal: Canal): Notifier {
  switch (canal) {
    case 'email': return new EmailNotifier()
    case 'sms':   return new SmsNotifier()
    case 'push':  return new PushNotifier()
  }
}

// 3) OBSERVER — la source émet, les effets de bord s'abonnent
class ReminderService {
  constructor(private bus: EventBus) {}

  async notify(member: Member, event: TribuEvent, canal: Canal): Promise<void> {
    const notifier = createNotifier(canal)                    // Factory
    await notifier.send(member, `Rappel : ${event.title}`)    // Adapter
    this.bus.emit('reminder.sent', { memberId: member.id, eventId: event.id }) // Observer
  }
}

// Ailleurs, découplé : log, métrique, cache — la source ne les connaît pas
bus.on('reminder.sent', p => logger.info('reminder sent', p))
bus.on('reminder.sent', () => metrics.increment('reminders'))
```

Ajouter WhatsApp = **une** ligne dans `createNotifier` + un `WhatsAppNotifier`. `notify()` ne change plus jamais. Ajouter une métrique = **un** `bus.on(...)`, zéro modification de `notify()`. Voilà OCP en action, via deux patterns bien choisis.

### Exemple 2 — Choisir : Strategy ou pas ?

TribuZen doit calculer **quand** envoyer un rappel. Deux scénarios, deux décisions opposées.

**Scénario A — deux cas figés pour toujours :**

```ts
// Un booléen, deux issues, jamais d'évolution prévue → PAS de pattern
function computeSendAt(event: TribuEvent): Date {
  return event.allDay ? subDays(event.startsAt, 1) : subHours(event.startsAt, 2)
}
```

Introduire Strategy ici serait de l'over-engineering (§2.8) : trois classes pour un ternaire.

**Scénario B — les règles se multiplient et deviennent configurables par tribu :**

```ts
// Chaque tribu choisit sa règle, on en ajoute régulièrement → Strategy justifié
interface ReminderStrategy { computeSendAt(e: TribuEvent): Date }

const STRATEGIES: Record<TribuPref, ReminderStrategy> = {
  dayBefore:     new DayBeforeStrategy(),
  twoHours:      new TwoHoursBeforeStrategy(),
  morningOf:     new MorningOfStrategy(),
}

class ReminderScheduler {
  schedule(event: TribuEvent, pref: TribuPref): Date {
    return STRATEGIES[pref].computeSendAt(event)   // + une factory implicite via le Record
  }
}
```

**La leçon** : le *même* besoin donne deux réponses différentes selon que le problème « ça va se multiplier » est **réel** ou **imaginé**. Le pattern suit le problème, jamais l'inverse.

---

## 4. Pièges & misconceptions

### PIÈGE #1 — « Je connais Factory, je vais en mettre partout »

Le pattern n'est pas un trophée. Une factory pour un seul produit, une Strategy pour un `if` figé, un Repository pour une app qui ne changera jamais d'ORM : c'est de l'over-engineering. **Le déclencheur est la douleur, pas le catalogue.**

### PIÈGE #2 — Confondre Factory et Strategy

- **Factory** décide **quel objet créer** et le retourne. Son job s'arrête à la construction.
- **Strategy** encapsule **un comportement** qu'on exécute ensuite, potentiellement changé à chaud.

Elles collaborent (une factory choisit une strategy) mais répondent à deux questions distinctes : *créer* vs *exécuter*.

### PIÈGE #3 — Confondre Adapter et Decorator

Les deux enveloppent un objet, mais :

- **Adapter** change l'**interface** (traduit A vers B) — même comportement, signature différente.
- **Decorator** garde la **même interface** et ajoute du **comportement** (retry, log) autour.

Adapter fait *rentrer* ; Decorator *enrichit*.

### PIÈGE #4 — Croire que Observer = messaging distribué

L'Observer de ce module est **synchrone, en mémoire, dans un seul process**. Un bus de messages inter-services (Kafka, RabbitMQ, outbox) apporte durabilité, retry, ordre, back-pressure — problèmes d'un tout autre niveau, traités au module **17**. Ne confonds pas un `EventEmitter` local avec une architecture event-driven.

### PIÈGE #5 — Le Singleton « pratique »

`getInstance()` est séduisant : accessible partout, pas de câblage. C'est précisément le problème — la dépendance devient **invisible** et **intestable**. Dès que tu écris `Truc.getInstance()`, demande-toi pourquoi ce n'est pas un paramètre injecté. La réponse « c'est plus simple » est un signal d'alarme, pas une justification.

### PIÈGE #6 — Repository qui fuit l'ORM

Un Repository dont l'interface expose `findWhere(prismaFilter)` ou retourne des types Prisma **ne protège rien** : le domaine dépend toujours de l'ORM. L'interface doit parler **métier** (`findActiveMembers()`) et retourner des **entités domaine**, pas des lignes de base.

---

## 5. Ancrage TribuZen

Les patterns de ce module structurent trois zones réelles de TribuZen :

**Notifications multi-canal** — `NotificationFactory` (Factory) crée le bon `Notifier` selon la préférence du membre ; chaque `Notifier` est un `Adapter` vers SendGrid / Twilio / FCM ; un `EventBus` (Observer) déclenche log, métrique et mise à jour du cache quand un rappel part ; un `RetryNotifier` (Decorator) fiabilise l'envoi. Quatre patterns, quatre problèmes distincts, un seul flux.

**Calcul des rappels** — `ReminderStrategy` (Strategy) rend la règle « quand notifier » configurable par tribu, sans `if/else` qui gonfle.

**Accès aux données** — `TribuRepository` (Repository) isole le domaine de Prisma ; un `InMemoryTribuRepository` sert aux tests. C'est la brique qui prépare l'hexagonal (module 06) et le DDD tactique (module 10).

**Ce qu'on NE fait PAS** — pas de Singleton pour la config ni le logger : ils sont **injectés** via le conteneur DI de NestJS (module 04), scope singleton géré par le framework.

Fichiers cibles dans `smaurier/tribuzen` :
```
tribuzen/
  src/
    domain/
      tribu/
        tribu.repository.ts          ← interface Repository (métier)
    infra/
      persistence/
        prisma-tribu.repository.ts   ← implémentation Prisma (Adapter du stockage)
      notifications/
        notification.factory.ts      ← Factory
        sendgrid.adapter.ts          ← Adapter
        retry.notifier.ts            ← Decorator
    reminders/
      reminder.strategy.ts           ← Strategy
      reminder.service.ts            ← orchestre Factory + Adapter + Observer
```

---

## 6. Points clés

1. **Problème d'abord.** Si tu ne nommes pas le problème en une phrase, tu n'as pas besoin d'un pattern — tu as besoin d'un `if`.
2. **Factory** : créer le bon objet selon une donnée d'exécution, derrière une interface commune (OCP + DIP).
3. **Strategy** : rendre un comportement interchangeable à l'exécution — quand les variantes se multiplient réellement.
4. **Observer** : réagir à un changement d'état sans que la source connaisse ses abonnés (synchrone, en mémoire ≠ messaging distribué).
5. **Adapter** : faire rentrer une API tierce dans ton interface (change la signature, pas le comportement).
6. **Decorator** : empiler des comportements optionnels sans explosion de sous-classes (même interface, comportement enrichi).
7. **Repository** : isoler le domaine du stockage via une interface qui parle métier et retourne des entités domaine.
8. **Singleton** : le besoin « une seule instance » est légitime, le pattern est la mauvaise réponse → préfère l'injection de dépendances (module 04).
9. **Over-engineering** : un pattern introduit sans douleur réelle coûte plus qu'il ne rapporte. Le pattern suit le problème, jamais l'inverse.

---

## 7. Seeds Anki

```
Quelle est la première question à se poser avant de choisir un design pattern ?|Quel problème j'ai (en une phrase) ? — pas quel pattern je mets. Sans problème nommé, un if suffit ; le pattern est une réponse à un problème, pas un but.
Quel pattern répond au problème créer le bon objet selon une donnée connue à l'exécution ?|Factory — retourne une implémentation d'une interface commune selon une clé ; ajouter un type ne rouvre pas les autres (OCP), le client ne connaît que l'interface (DIP).
Différence entre Factory et Strategy ?|Factory décide QUEL objet créer et le retourne (job = construction). Strategy encapsule UN comportement qu'on exécute ensuite, changeable à chaud. Créer vs exécuter — elles se combinent souvent.
Différence entre Adapter et Decorator ?|Adapter change l'INTERFACE (traduit A vers B, même comportement, signature différente). Decorator garde la MÊME interface et ajoute du COMPORTEMENT (retry, log) autour. Adapter fait rentrer, Decorator enrichit.
Pourquoi le pattern Singleton est-il considéré comme un anti-pattern déguisé ?|Il crée une dépendance globale cachée (invisible dans les paramètres, viole DIP), rend les tests fragiles (état statique persistant entre tests) et pose des problèmes de concurrence. La bonne réponse au besoin une seule instance = injection de dépendances avec scope singleton.
À quoi sert le pattern Repository et quel piège le rend inutile ?|Isoler le domaine de la façon dont les données sont stockées via une interface qui parle métier. Piège : si l'interface expose des filtres/types de l'ORM ou retourne des lignes brutes, le domaine dépend toujours de l'ORM — l'abstraction ne protège rien.
Observer en mémoire vs messaging distribué : quelle différence ?|Observer (ce module) est synchrone, en mémoire, dans un seul process. Un bus de messages inter-services (Kafka/RabbitMQ/outbox) apporte durabilité, retry, ordre, back-pressure — autre niveau, module 17. Ne pas confondre un EventEmitter local avec l'event-driven.
Comment reconnaître qu'un pattern est de l'over-engineering ?|Il est introduit sans douleur réelle : une seule implémentation d'une interface sans seconde en vue (viole YAGNI), une Strategy pour un if figé, une factory pour un seul produit. Le pattern doit suivre un problème déjà présent, pas anticipé.
```

---

## Pont vers le lab

> Lab associé : `labs/lab-02-design-patterns-essentiels/README.md`. Trois problèmes TribuZen bruts : pour chacun, choisir le bon pattern (ou aucun), justifier, esquisser l'interface. Évalué par grille + coach, pas de test-runner.
