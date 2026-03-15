# 03 — Les design patterns essentiels

## Objectif

A la fin de ce cours, tu sauras **identifier et appliquer les design patterns les plus utiles** en développement back-end et front-end, expliquer le problème que chaque pattern resout, et reconnaitre quand un pattern serait de l'over-engineering.

---

## Rappel du cours précédent

Teste ta mémoire avant de continuer.

**Question 1 — Que signifie le principe "Open/Closed" et quelle analogie du monde réel l'illustre ?**

<details>
<summary>Réponse</summary>

Le principe Open/Closed dit qu'une classe doit etre **ouverte a l'extension** (on peut lui ajouter des comportements) mais **fermee à la modification** (le code existant ne change pas). L'analogie est la **prise electrique** : tu n'ouvres pas la prise pour y ajouter un trou quand tu as un nouvel appareil, tu branches une multiprise (extension) sans modifier l'existant.
</details>

**Question 2 — Quelle est la différence entre SRP et ISP ? Donne un exemple de violation pour chacun.**

<details>
<summary>Réponse</summary>

- **SRP** (Single Responsibility) : une **classe** ne doit avoir qu'une seule raison de changer. Violation : une classe `ArticleService` qui fait fetch + formatage HTML + envoi d'email.
- **ISP** (Interface Segregation) : un **client** ne doit pas etre force d'implémenter des méthodes qu'il n'utilise pas. Violation : une interface `ContentManager` qui expose `manageUsers()` et `exportStatistics()` alors que le Redacteur n'en a pas besoin.

SRP parle de la classe elle-même. ISP parle du contrat expose aux clients de la classe.
</details>

---

## Analogie — Le catalogue IKEA

Un design pattern, c'est comme une fiche IKEA : ce n'est pas le meuble, c'est le **plan de construction** qui a déjà fonctionne des milliers de fois pour résoudre un problème connu. Tu ne reinventes pas la roue — tu choisis la bonne fiche dans le catalogue.

Les 23 patterns du "Gang of Four" (GoF) sont ce catalogue. Dans ce cours, on se concentre sur les **12 patterns les plus utiles en pratique**, regroupes en 3 familles :

```
FAMILLES DE DESIGN PATTERNS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 CREATIONAL          STRUCTURAL            BEHAVIORAL
 (comment creer)     (comment assembler)   (comment communiquer)
 ─────────────────   ───────────────────   ───────────────────────
 Factory             Adapter               Observer
 Builder             Facade                Strategy
 Singleton           Proxy                 State Machine
                     Decorator             Command
```

---

## Théorie

### PATTERNS CREATIONNELS

---

#### Factory — La chaine de production

**Problème résolu** : tu dois créer des objets dont le type exact n'est connu qu'a l'exécution, ou tu veux centraliser la logique de construction.

**Quand NE PAS utiliser** : quand tu as un seul type d'objet a créer — c'est de la sur-ingenierie.

```
          ┌──────────────────────────────────┐
          │         NotificationFactory      │
          │                                  │
          │  + create(type): Notification    │
          └──────────────────┬───────────────┘
                             │ cree selon le type
              ┌──────────────┼──────────────┐
              ▼              ▼              ▼
   ┌────────────────┐ ┌───────────┐ ┌──────────────┐
   │ EmailNotif     │ │ SMSNotif  │ │ PushNotif    │
   │ + send()       │ │ + send()  │ │ + send()     │
   └────────────────┘ └───────────┘ └──────────────┘
```

---

#### Builder — Le configurateur de pizza

**Problème résolu** : construire un objet complexe étape par étape, en evitant les constructeurs avec 10 paramètres.

**Quand NE PAS utiliser** : quand l'objet a moins de 4-5 propriétés. Un simple objet literal TypeScript suffit.

```
// Constructeur telescopique — le probleme
new QueryBuilder(table, null, null, 'name', 'ASC', 10, null)
//                                                        ^
//                       Qu'est-ce que ce null ? Illisible.

// Builder — la solution
new QueryBuilder()
  .from('articles')
  .where('status', 'published')
  .orderBy('name', 'ASC')
  .limit(10)
  .build()
```

---

#### Singleton — L'instance unique (et ses abus)

**Problème résolu** : garantir qu'une seule instance d'une classe existe (connexion à une base de données, configuration globale, logger).

**Avertissement** : le Singleton est souvent un anti-pattern deguise. Il créé des **dépendances globales cachees** et rend les tests très difficiles. Prefere l'injection de dépendances (cours 05) dans la grande majorite des cas.

```
Problemes du Singleton :
┌────────────────────────────────────────────────────────┐
│  - Couplage global : tout le code peut l'utiliser      │
│  - Tests difficiles : l'etat persiste entre les tests  │
│  - Concurrence : risques en environnement multi-thread │
│  - Violation DIP : les clients dependent d'une impl.   │
└────────────────────────────────────────────────────────┘

Usages legitimes :
┌────────────────────────────────────────────────────────┐
│  - Pool de connexions de base de donnees               │
│  - Configuration immuable chargee au demarrage         │
│  - Registry ou cache applicatif (avec prudence)        │
└────────────────────────────────────────────────────────┘
```

---

### PATTERNS STRUCTURELS

---

#### Adapter — La prise de voyage

**Problème résolu** : faire fonctionner ensemble deux interfaces incompatibles, sans modifier l'une ni l'autre.

Analogie : quand tu pars aux USA avec un appareil europeen, tu utilises un **adaptateur de prise**. Il ne change pas ton appareil ni la prise murale — il fait le pont entre les deux.

```
Interface attendue           Interface existante
par ton code                 (API tierce, legacy)
┌──────────────────┐         ┌──────────────────────┐
│  EmailSender     │         │  SendGridAPI         │
│                  │         │                      │
│ + send(to, body) │         │ + sendEmail({        │
└──────────────────┘         │     recipient,       │
          ▲                  │     htmlContent      │
          │                  │   })                 │
  ┌───────────────┐          └──────────────────────┘
  │ SendGridAdapter│◄─────────────────────────────────
  │               │
  │ + send(to, b) │  adapte l'interface EmailSender
  │   → sendEmail │  vers l'API SendGrid
  └───────────────┘
```

---

#### Facade — Le tableau de bord

**Problème résolu** : simplifier une interface complexe (sous-système avec de nombreuses classes) en exposant une interface unifiee et simple.

Analogie : le **tableau de bord d'une voiture**. Tu ne gérés pas directement l'injection, la boite de vitesses et le système de freinage. Tu as un volant et une pedale d'accelerateur — une **facade** sur la complexité.

```
         CLIENT
           │
           ▼
┌──────────────────────┐
│    ArticleFacade     │   ← interface simple
│                      │
│ + publish(articleId) │
└──────────────────────┘
           │
    ┌──────┼──────────┬──────────┐
    ▼      ▼          ▼          ▼
┌───────┐ ┌────────┐ ┌────────┐ ┌──────────┐
│Valida-│ │SEO     │ │Notif   │ │Cache     │
│tion   │ │Service │ │Service │ │Invalidat.│
└───────┘ └────────┘ └────────┘ └──────────┘
```

---

#### Proxy — Le gardien

**Problème résolu** : controler l'accès à un objet (autorisation, cache, logging) sans modifier l'objet lui-même.

```
CLIENT ──► PROXY ──► OBJET REEL
             │
             ├── Verifie les droits d'acces
             ├── Journalise les appels
             ├── Met en cache les resultats
             └── Effectue du lazy-loading
```

---

#### Decorator — Le personnage RPG avec équipements

**Problème résolu** : ajouter des comportements à un objet dynamiquement, sans modifier la classe ni créer une explosion de sous-classes.

Analogie : dans un jeu de role, ton personnage de base peut etre **équipe** d'une armure, d'une epee, d'un chapeau. Chaque équipement ajoute des stats. Tu n'as pas une classe `GuerrieurAvecArmureEtEpee` — tu composes.

```
┌───────────────┐
│ BasicText     │  "bonjour"
└───────────────┘
        │ decore par
        ▼
┌───────────────┐
│ BoldDecorator │  "<b>bonjour</b>"
└───────────────┘
        │ decore par
        ▼
┌───────────────┐
│ ItalicDecorat.│  "<i><b>bonjour</b></i>"
└───────────────┘
```

---

### PATTERNS COMPORTEMENTAUX

---

#### Observer — Le système d'abonnement

**Problème résolu** : notifier automatiquement plusieurs objets quand l'état d'un objet change, sans couplage direct.

Analogie : un **service de newsletter**. Les abonnes ne savent pas quand le prochain article sera publie — ils s'abonnent et recoivent la notification automatiquement. L'auteur ne connait pas ses abonnes individuellement.

```
┌─────────────────────────────────────────┐
│              EventEmitter               │
│                                         │
│  subscribers: Map<event, Observer[]>    │
│                                         │
│  + subscribe(event, observer)           │
│  + unsubscribe(event, observer)         │
│  + emit(event, data)  ──► notifie tous  │
└─────────────────────────────────────────┘
         │ notifie
         ├──────────────────────────────┐
         ▼                              ▼
┌─────────────────┐           ┌──────────────────┐
│ EmailNotifier   │           │ SlackNotifier    │
│                 │           │                  │
│ + onEvent(data) │           │ + onEvent(data)  │
└─────────────────┘           └──────────────────┘
```

---

#### Strategy — Le GPS avec plusieurs itineraires

**Problème résolu** : définir une famille d'algorithmes, les encapsuler, et les rendre interchangeables a l'exécution.

Analogie : un **GPS** qui te propose "le plus rapide", "le plus court" ou "éviter les peages". L'algorithme de calcul change — la destination reste la même.

```
┌──────────────────────────────────┐
│          SortingContext          │
│                                  │
│  strategy: SortStrategy          │
│  + setStrategy(strategy)         │
│  + sort(data) ──► strategy.sort  │
└──────────────────────────────────┘
              │
    ┌─────────┼─────────┐
    ▼         ▼         ▼
┌────────┐ ┌────────┐ ┌────────┐
│QuickSort│ │MergeSort│ │BubbleS.│
└────────┘ └────────┘ └────────┘
```

---

#### State Machine — Le cycle de vie editorial

**Problème résolu** : gérer des objets qui changent de comportement en fonction de leur état, evitant les if/else imbriques.

Cas concret : le cycle de vie d'un article dans un CMS.

```
                    ┌──────────────────────────────────────┐
                    ▼                                      │
┌──────────┐  publish  ┌──────────────┐  archive  ┌────────────────┐
│  Draft   │ ─────────►│  Published   │ ─────────►│   Archived     │
│          │           │              │           │                │
│ Brouillon│           │ En ligne     │           │ Depublie       │
└──────────┘           └──────────────┘           └────────────────┘
     │                        │                          │
     │ reject                 │ unpublish                │ restore
     ▼                        ▼                          ▼
┌──────────┐           ┌──────────────┐           ┌────────────────┐
│ Rejected │           │    Draft     │           │    Draft       │
└──────────┘           └──────────────┘           └────────────────┘

Transitions valides :
Draft ──────► Published    (action: publish)
Draft ──────► Rejected     (action: reject)
Published ──► Draft        (action: unpublish)
Published ──► Archived     (action: archive)
Archived ──► Draft         (action: restore)

Transitions INVALIDES (lever une exception) :
Draft ──────► Archived     (impossible)
Rejected ──► Archived      (impossible)
```

---

#### Command — La telecommande universelle

**Problème résolu** : encapsuler une action comme un objet, permettant de la mettre en file, annuler (undo), rejouer, ou logger.

Analogie : une **telecommande universelle**. Chaque bouton est une commande encapsulee (eteindre la TV, monter le volume). Tu peux programmer des sequences, annuler la dernière action.

---

## Pratique

```typescript
// ============================================================
// FACTORY — Creation d'exporteurs selon le format
// ============================================================

interface ReportExporter {
  export(data: Record<string, unknown>[]): string;
}

class CsvReportExporter implements ReportExporter {
  export(data: Record<string, unknown>[]): string {
    if (data.length === 0) return '';
    const headers = Object.keys(data[0]).join(',');
    const rows = data.map(row => Object.values(row).join(','));
    return [headers, ...rows].join('\n');
  }
}

class JsonReportExporter implements ReportExporter {
  export(data: Record<string, unknown>[]): string {
    return JSON.stringify(data, null, 2);
  }
}

// Factory : centralise la logique de construction
// Le client ne connait pas les classes concretes
class ReportExporterFactory {
  static create(format: 'csv' | 'json'): ReportExporter {
    switch (format) {
      case 'csv':  return new CsvReportExporter();
      case 'json': return new JsonReportExporter();
      // Ajouter 'xml' ici sans modifier les classes existantes (OCP)
    }
  }
}

// Utilisation : le format vient de la requete HTTP, inconnu a la compilation
const format = 'csv' as 'csv' | 'json';
const exporter = ReportExporterFactory.create(format);
console.log(exporter.export([{ id: 1, title: 'Test' }]));

// ============================================================
// BUILDER — Construction de requetes complexes
// ============================================================

interface QueryConfig {
  table: string;
  conditions: string[];
  orderBy?: { field: string; direction: 'ASC' | 'DESC' };
  limit?: number;
  offset?: number;
}

class QueryBuilder {
  private config: Partial<QueryConfig> = { conditions: [] };

  from(table: string): this {
    this.config.table = table;
    return this; // retourner this permet le chaining fluent
  }

  where(field: string, value: unknown): this {
    this.config.conditions!.push(`${field} = '${value}'`);
    return this;
  }

  orderBy(field: string, direction: 'ASC' | 'DESC' = 'ASC'): this {
    this.config.orderBy = { field, direction };
    return this;
  }

  limit(n: number): this {
    this.config.limit = n;
    return this;
  }

  offset(n: number): this {
    this.config.offset = n;
    return this;
  }

  build(): string {
    if (!this.config.table) throw new Error('Table requise');

    let query = `SELECT * FROM ${this.config.table}`;

    if (this.config.conditions!.length > 0) {
      query += ` WHERE ${this.config.conditions!.join(' AND ')}`;
    }
    if (this.config.orderBy) {
      query += ` ORDER BY ${this.config.orderBy.field} ${this.config.orderBy.direction}`;
    }
    if (this.config.limit !== undefined) {
      query += ` LIMIT ${this.config.limit}`;
    }
    if (this.config.offset !== undefined) {
      query += ` OFFSET ${this.config.offset}`;
    }

    return query;
  }
}

// Lisible, pas ambigu, extensible facilement
const query = new QueryBuilder()
  .from('articles')
  .where('status', 'published')
  .where('tenant_id', 'acme-corp')
  .orderBy('created_at', 'DESC')
  .limit(20)
  .offset(40)
  .build();

// SELECT * FROM articles WHERE status = 'published' AND tenant_id = 'acme-corp'
// ORDER BY created_at DESC LIMIT 20 OFFSET 40

// ============================================================
// STATE MACHINE — Cycle de vie editorial d'un article
// ============================================================

type ArticleStatus = 'draft' | 'published' | 'archived' | 'rejected';

// Definit quelles transitions sont autorisees depuis chaque etat
const VALID_TRANSITIONS: Record<ArticleStatus, ArticleStatus[]> = {
  draft:     ['published', 'rejected'],
  published: ['draft', 'archived'],
  archived:  ['draft'],
  rejected:  [],              // etat terminal — aucune transition possible
};

class ArticleStateMachine {
  private status: ArticleStatus;

  constructor(initialStatus: ArticleStatus = 'draft') {
    this.status = initialStatus;
  }

  // Methode generique de transition — toute la logique de validation est ici
  transition(nextStatus: ArticleStatus): void {
    const allowed = VALID_TRANSITIONS[this.status];

    if (!allowed.includes(nextStatus)) {
      // Fail Fast : on leve une exception claire plutot que de silencieusement ignorer
      throw new Error(
        `Transition invalide : ${this.status} → ${nextStatus}. ` +
        `Transitions autorisees : [${allowed.join(', ')}]`
      );
    }

    const previous = this.status;
    this.status = nextStatus;
    console.log(`[StateMachine] ${previous} → ${nextStatus}`);
  }

  // Methodes semantiques — lisibles par le code metier
  publish(): void  { this.transition('published'); }
  unpublish(): void { this.transition('draft'); }
  archive(): void  { this.transition('archived'); }
  reject(): void   { this.transition('rejected'); }
  restore(): void  { this.transition('draft'); }

  getStatus(): ArticleStatus { return this.status; }
}

// Utilisation
const article = new ArticleStateMachine('draft');
article.publish();              // draft → published
article.archive();              // published → archived
article.restore();              // archived → draft

try {
  article.archive();            // draft → archived — INTERDIT
} catch (e) {
  console.error(e);             // Transition invalide : draft → archived. ...
}

// ============================================================
// OBSERVER — Systeme d'evenements pour publication d'article
// ============================================================

type EventHandler<T> = (data: T) => void;

class EventBus {
  // Map d'evenement → tableau de gestionnaires
  private handlers = new Map<string, EventHandler<unknown>[]>();

  subscribe<T>(event: string, handler: EventHandler<T>): () => void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, []);
    }
    this.handlers.get(event)!.push(handler as EventHandler<unknown>);

    // Retourne une fonction d'abonnement — pattern "unsubscribe"
    return () => {
      const list = this.handlers.get(event) ?? [];
      this.handlers.set(event, list.filter(h => h !== handler));
    };
  }

  emit<T>(event: string, data: T): void {
    const list = this.handlers.get(event) ?? [];
    // Chaque abonne est notifie independamment
    list.forEach(handler => handler(data));
  }
}

interface ArticlePublishedEvent {
  articleId: string;
  title: string;
  publishedAt: Date;
}

const bus = new EventBus();

// Plusieurs abonnes independants — decouplage total
const unsubEmail = bus.subscribe<ArticlePublishedEvent>('article.published', (event) => {
  console.log(`[Email] Notif envoyee pour : ${event.title}`);
});

const unsubCache = bus.subscribe<ArticlePublishedEvent>('article.published', (event) => {
  console.log(`[Cache] Invalidation pour article ${event.articleId}`);
});

bus.subscribe<ArticlePublishedEvent>('article.published', (event) => {
  console.log(`[SEO] Sitemap mis a jour — ${event.title}`);
});

// Emission : les 3 abonnes sont notifies automatiquement
bus.emit<ArticlePublishedEvent>('article.published', {
  articleId: 'abc-123',
  title: 'Architecture SOLID expliquee',
  publishedAt: new Date(),
});

// Desabonnement si necessaire
unsubEmail();

// ============================================================
// STRATEGY — Algorithme de tri interchangeable
// ============================================================

interface SortStrategy<T> {
  sort(data: T[]): T[];
}

class AlphabeticalSort implements SortStrategy<string> {
  sort(data: string[]): string[] {
    // Ne pas muter l'original — retourner une copie
    return [...data].sort((a, b) => a.localeCompare(b));
  }
}

class LengthSort implements SortStrategy<string> {
  sort(data: string[]): string[] {
    return [...data].sort((a, b) => a.length - b.length);
  }
}

class ReversedSort implements SortStrategy<string> {
  sort(data: string[]): string[] {
    return [...data].reverse();
  }
}

class TagCloud {
  constructor(private sortStrategy: SortStrategy<string>) {}

  // La strategie peut etre changee a l'execution
  setStrategy(strategy: SortStrategy<string>): void {
    this.sortStrategy = strategy;
  }

  render(tags: string[]): string[] {
    return this.sortStrategy.sort(tags);
  }
}

const cloud = new TagCloud(new AlphabeticalSort());
const tags = ['typescript', 'architecture', 'solid', 'patterns', 'di'];

console.log(cloud.render(tags));  // ['architecture', 'di', 'patterns', 'solid', 'typescript']

cloud.setStrategy(new LengthSort());
console.log(cloud.render(tags));  // ['di', 'solid', 'patterns', 'solid', 'typescript', 'architecture']

// ============================================================
// ADAPTER — Integrer une API tierce sans modifier son interface
// ============================================================

// Interface attendue par notre application
interface NotificationSender {
  send(to: string, subject: string, body: string): Promise<void>;
}

// API tierce — interface differente, non modifiable
class SendGridClient {
  async sendEmail(params: {
    recipient: string;
    emailSubject: string;
    htmlContent: string;
    fromAddress: string;
  }): Promise<{ success: boolean }> {
    console.log(`[SendGrid] Envoi a ${params.recipient}`);
    return { success: true };
  }
}

// Adapter : fait le pont entre notre interface et SendGrid
// Notre application utilise NotificationSender — elle ne connait pas SendGrid
class SendGridAdapter implements NotificationSender {
  constructor(private readonly client: SendGridClient) {}

  async send(to: string, subject: string, body: string): Promise<void> {
    // Traduit notre interface vers celle de SendGrid
    await this.client.sendEmail({
      recipient: to,
      emailSubject: subject,
      htmlContent: `<p>${body}</p>`,
      fromAddress: 'noreply@givexpert.com',
    });
  }
}

// Notre code metier ne depend que de l'interface — pas de SendGrid
async function sendWelcomeEmail(sender: NotificationSender, userEmail: string): Promise<void> {
  await sender.send(userEmail, 'Bienvenue !', 'Merci de vous etre inscrit.');
}

// Wiring en dehors du code metier
const sendGridClient = new SendGridClient();
const adapter = new SendGridAdapter(sendGridClient);
sendWelcomeEmail(adapter, 'user@example.com');
// Si on change de provider (Mailgun, SES...) : on cree un nouveau Adapter, rien d'autre ne change.
```

---

## Résumé

- Les **patterns creationnels** (Factory, Builder, Singleton) resolvent "comment créer des objets" : Factory centralise la création selon un type, Builder construit des objets complexes étape par étape, Singleton garantit une instance unique (mais attention aux abus).
- Les **patterns structurels** (Adapter, Facade, Proxy, Decorator) resolvent "comment assembler des composants" : Adapter fait le pont entre deux interfaces incompatibles, Facade simplifie un sous-système complexe, Proxy controle l'accès, Decorator ajoute des comportements dynamiquement.
- Les **patterns comportementaux** (Observer, Strategy, State Machine, Command) resolvent "comment les objets communiquent et changent" : Observer découplé emetteurs et recepteurs, Strategy rend les algorithmes interchangeables, State Machine géré les cycles de vie complexes avec des transitions explicites.
- La **State Machine editoriale** (Draft → Published → Archived) est un pattern central dans les CMS : elle remplace des chaines de if/else fragiles par des transitions valides et verifiees.
- Un pattern mal choisi est pire que pas de pattern du tout : utilise Factory quand le type est inconnu à la compilation, Observer quand il y a plusieurs consommateurs a découpler, Strategy quand l'algorithme change selon le contexte — mais pas juste pour montrer que tu connais les patterns.


---

> **Lien fil rouge — ShopArch**
>
> - Identifie quel pattern utiliser pour la création de notifications ShopArch (Factory)
> - Applique Strategy au calcul de prix (normal, promo, wholesale)
> - Exercice(s) associé(s) : `exercices/02-identifier-patterns/`
> - Checkpoint : Module 00, critère 3

## Prochain cours

[04 — Principes de clean code](./04-principes-clean-code.md)

> Dans le prochain cours, nous verrons les principes qui guident l'écriture d'un code lisible, maintenable et évolutif : DRY, KISS, YAGNI, SoC, Loi de Demeter, Composition vs Héritage, Fail Fast. Mais aussi quand ces principes ne s'appliquent PAS et comment reconnaitre les code smells courants.
