# 05 — Injection de dépendances et inversion de controle

## Objectif

A la fin de ce cours, tu sauras **expliquer et implémenter l'injection de dépendances (DI)** et l'inversion de controle (IoC), distinguer les scopes de vie (singleton, request, transient), reconnaitre l'anti-pattern Service Locator, et comprendre pourquoi DI est la condition nécessaire pour les tests unitaires.

---

## Rappel du cours précédent

Teste ta mémoire avant de continuer.

**Question 1 — Que signifie "Fail Fast" et pourquoi est-ce préférable au "Fail Late" ?**

<details>
<summary>Réponse</summary>

**Fail Fast** : valider toutes les preconditions en debut de fonction (guard clauses) et lever une exception immédiate et explicite si quelque chose est invalide.

**Fail Late** (le problème) : continuer avec des données potentiellement incorrectes jusqu'a ce que le code plante dans un endroit inattendu, souvent apres avoir effectue des opérations partielles (écritures en base, envois d'emails) qui ne peuvent pas etre annulees.

Fail Fast est préférable car l'erreur est claire, localisee, et aucune opération de "damage control" n'a eu lieu.
</details>

**Question 2 — Quelle est la différence entre DRY et YAGNI ? Donne un exemple de situation ou appliquer DRY trop tot est un problème.**

<details>
<summary>Réponse</summary>

- **DRY** : ne duplique pas la connaissance métier. Concerne ce qui **existe** dans le code.
- **YAGNI** : n'implémenté pas quelque chose que tu n'as pas besoin maintenant. Concerne ce qui n'existe **pas encore**.

Exemple de DRY premature : deux boucles qui ressemblent a un tri sont abstracted dans une fonction générique `sortAnything<T>`, alors qu'elles trient des types différents pour des raisons différentes. Quand l'une doit changer, l'abstraction devient un obstacle. La règle : attendre trois occurrences similaires representant vraiment la meme connaissance avant d'abstraire.
</details>

---

## Analogie — La prise electrique vs l'appareil soude au mur

Imagine deux cuisines :

**Cuisine A — soudee** : le grille-pain est cable directement dans le mur. Impossible de le remplacer par un modèle plus recent sans des travaux d'electricite. Si le grille-pain tombe en panne, toute la cuisine est immobilisee le temps de la reparation.

**Cuisine B — avec prises** : chaque appareil se branche sur une prise standard. Pour remplacer le grille-pain, tu le debranches et tu branches le nouveau en 5 secondes. Pour tester la prise, tu peux brancher un testeur de circuit sans acheter un grille-pain.

L'injection de dépendances, c'est la **cuisine B** appliquee au code :
- La **prise** = l'interface (le contrat)
- L'**appareil** = l'implémentation (la classe concrete)
- Le **branchement** = l'injection (effectuee par le conteneur IoC)
- Le **testeur de circuit** = le mock/stub utilise dans les tests

```
SANS DI (soude)         AVEC DI (prise)
────────────────────    ────────────────────────────────────────
ArticleService          ArticleService
  ┌──────────────┐        ┌──────────────┐
  │ constructor()│        │ constructor( │
  │  {           │        │   repo:      │
  │   this.db =  │        │   ArticleRepo│ ← interface
  │   new Postgres│       │ ) {}         │
  │  }           │        └──────┬───────┘
  └──────────────┘               │ injecte
                          ┌──────┴──────┐
                          ▼             ▼
                     PostgresRepo   InMemoryRepo
                     (production)   (tests)
```

---

## Théorie

### Qu'est-ce que l'inversion de controle (IoC) ?

Normalement, un objet **controle** la création de ses dépendances :
```
class A {
  constructor() {
    this.b = new B(); // A controle la creation de B
  }
}
```

Avec IoC, **le controle est inverse** : c'est un agent externe (le conteneur IoC, ou le code appelant) qui cree et fournit les dépendances :
```
class A {
  constructor(private b: B) {} // Quelqu'un d'autre controle la creation de B
}
```

IoC est le **principe**. DI (Dependency Injection) est la **technique** pour l'implémenter.

---

### Les trois types d'injection

```
┌─────────────────────────────────────────────────────────────────────┐
│           TYPES D'INJECTION — du plus recommande au moins           │
├──────────────────────────┬──────────────────────────────────────────┤
│  Constructor injection   │  Dependances passees au constructeur     │
│  (RECOMMANDE)            │  → Dependances visibles et obligatoires  │
│                          │  → Objet toujours dans un etat valide    │
│                          │  → Testabilite maximale                  │
├──────────────────────────┼──────────────────────────────────────────┤
│  Property injection      │  Dependances assignees apres creation    │
│  (eviter)                │  → Objet potentiellement invalide        │
│                          │  → Dependances cachees                   │
│                          │  → Testabilite reduite                   │
├──────────────────────────┼──────────────────────────────────────────┤
│  Method injection        │  Dependance passee en parametre          │
│  (cas specifiques)       │  → Utile quand la dep change a chaque    │
│                          │    appel (pas une dependance de service)  │
└──────────────────────────┴──────────────────────────────────────────┘
```

---

### Les scopes de vie

Le scope définit **combien de temps** une instance d'un service vit.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         SCOPES DE VIE                                   │
├─────────────────┬──────────────────────────┬────────────────────────────┤
│   SCOPE         │   DUREE DE VIE           │   CAS D'USAGE              │
├─────────────────┼──────────────────────────┼────────────────────────────┤
│  Singleton      │  Tout le cycle de        │  Services stateless        │
│                 │  l'application           │  (config, logger,          │
│                 │                          │   pool de connexions)      │
├─────────────────┼──────────────────────────┼────────────────────────────┤
│  Request        │  Une requete HTTP        │  Services avec etat par    │
│  (Scoped)       │                          │  requete (user context,    │
│                 │                          │  transaction DB)           │
├─────────────────┼──────────────────────────┼────────────────────────────┤
│  Transient      │  Nouvelle instance a     │  Services legers avec      │
│                 │  chaque injection        │  etat mutable, non         │
│                 │                          │  thread-safe               │
└─────────────────┴──────────────────────────┴────────────────────────────┘
```

**Attention aux incompatibilites de scope** :

```
DANGER — Captive dependency :

┌──────────────────────────────────────┐
│  ServiceA (Singleton)                │  Vie: toute l'application
│                                      │
│  constructor(serviceB: ServiceB) {}  │
│  → ServiceB est capture dans le      │
│    singleton pour toute la vie de A  │
└──────────────────────────────────────┘
          │ injecte
          ▼
┌──────────────────────────────────────┐
│  ServiceB (Request-scoped)           │  Vie: une requete
│  → Devrait etre cree par requete     │
│    mais est bloque dans le singleton │
└──────────────────────────────────────┘

Resultat : ServiceB devient de facto un Singleton — les donnees
de la requete de l'utilisateur A sont partagees avec l'utilisateur B.
```

---

### Injection par token (injection symbolique)

Dans les conteneurs IoC avances (NestJS, Angular), on peut injecter des valeurs ou des configurations qui ne sont pas des classes, en utilisant des **tokens symboliques**.

```
// Sans token : on ne peut injecter que des classes
class DatabaseConfig { host = 'localhost'; }

// Avec token : on peut injecter n'importe quoi
const DATABASE_CONFIG_TOKEN = Symbol('DATABASE_CONFIG');
const MAX_RETRY_TOKEN = 'MAX_RETRY';  // string token
const DB_CONFIG_TOKEN = 'DB_CONFIG';  // string token (pattern NestJS courant)
```

---

### NestJS providers — le système DI en pratique

NestJS embarque un conteneur IoC. Voici ses formes principales :

```
MODULE
  ├── providers: [...]     ← ce qui peut etre injecte
  ├── imports:   [...]     ← modules dont on consomme les exports
  └── exports:   [...]     ← ce qu'on expose aux autres modules

FORMES DE PROVIDER :
┌─────────────────────────────────────────────────────────────────┐
│ // Forme courte (la plus frequente)                             │
│ providers: [ArticleService]                                     │
│                                                                 │
│ // Forme explicite avec useClass                                │
│ providers: [{ provide: ArticleService, useClass: ArticleService }]│
│                                                                 │
│ // Substitution — tres utile pour les tests                     │
│ providers: [{ provide: ArticleRepository, useClass: InMemoryRepo}]│
│                                                                 │
│ // Valeur statique                                              │
│ providers: [{ provide: 'MAX_RETRIES', useValue: 3 }]           │
│                                                                 │
│ // Factory — construction dynamique                             │
│ providers: [{                                                   │
│   provide: 'DB_CONNECTION',                                     │
│   useFactory: (config: ConfigService) => createConnection(config)│
│   inject: [ConfigService]                                       │
│ }]                                                              │
└─────────────────────────────────────────────────────────────────┘
```

---

### Anti-pattern : Service Locator

Le Service Locator est l'opposee de l'injection par constructeur : au lieu de recevoir ses dépendances, un objet va les **chercher** lui-meme dans un registre global.

```
Service Locator — l'anti-pattern :
┌──────────────────────────────────────────────────────────┐
│  class ArticleService {                                  │
│    private repo: ArticleRepository;                     │
│                                                          │
│    doSomething() {                                       │
│      // Va chercher sa dependance au moment de l'usage  │
│      this.repo = ServiceLocator.get('ArticleRepository');│
│      //           ↑                                      │
│      //  Dependance cachee — invisible de l'exterieur   │
│      this.repo.save(...);                               │
│    }                                                     │
│  }                                                       │
└──────────────────────────────────────────────────────────┘

Pourquoi c'est mauvais :
  ✗ Dependances invisibles — on ne voit pas ce dont la classe a besoin
  ✗ Tests difficiles — il faut configurer le registre global avant chaque test
  ✗ Couplage au registre — la classe depend du ServiceLocator lui-meme
  ✗ Erreurs au runtime — si le service n'est pas enregistre, crash a l'usage
  ✗ Violation DIP — on depend d'une implementation concrete (ServiceLocator)

Injection par constructeur — la solution :
┌──────────────────────────────────────────────────────────┐
│  class ArticleService {                                  │
│    constructor(                                          │
│      private readonly repo: ArticleRepository  // visible│
│    ) {}                                                  │
│                                                          │
│    doSomething() {                                       │
│      this.repo.save(...);  // dependance declaree        │
│    }                                                     │
│  }                                                       │
└──────────────────────────────────────────────────────────┘
  ✓ Dependances visibles — le constructeur est un "contrat"
  ✓ Tests triviaux — passer un mock au constructeur, c'est tout
  ✓ Pas de couplage global — aucune dependance au registre
  ✓ Erreurs a la compilation — TypeScript verifie les types
```

---

### Pourquoi DI rend les tests possibles

Sans DI, tester un service qui utilise une base de données nécessité... une base de données. Avec DI, tu injectes un repository en mémoire — les tests s'executent en millisecondes, sans infra.

```
Tests avec DI — la difference en pratique :

SANS DI :                          AVEC DI :
──────────────────────────────     ──────────────────────────────
Besoin d'une vraie DB              Pas de DB
Besoin du reseau                   Pas de reseau
Tests lents (secondes)             Tests rapides (millisecondes)
Tests fragiles (DB change)         Tests deterministes
Setup complexe                     Setup : new Service(new Mock())
Nettoyage apres test               Pas de nettoyage
Tests paralleles difficiles        Tests paralleles faciles
```

---

## Pratique

```typescript
// ============================================================
// BASE : interface + implementations
// ============================================================

interface ArticleRepository {
  findById(id: string): Promise<Article | null>;
  findAll(): Promise<Article[]>;
  save(article: Article): Promise<Article>;
  delete(id: string): Promise<void>;
}

interface Article {
  id: string;
  title: string;
  content: string;
  status: 'draft' | 'published' | 'archived';
  tenantId: string;
}

// ============================================================
// CONSTRUCTOR INJECTION — le pattern recommande
// ============================================================

// Le service declare ses dependances dans le constructeur
// → visible, obligatoire, testable
class ArticleService {
  constructor(
    private readonly articleRepo: ArticleRepository,
    private readonly eventBus: EventBus,
    private readonly logger: Logger,
  ) {}

  async publish(id: string, userId: string): Promise<Article> {
    // Fail Fast
    if (!id) throw new Error('ID requis');
    if (!userId) throw new Error('UserId requis');

    const article = await this.articleRepo.findById(id);
    if (!article) throw new Error(`Article ${id} introuvable`);
    if (article.status !== 'draft') throw new Error(`Status invalide : ${article.status}`);

    const published: Article = { ...article, status: 'published' };
    const saved = await this.articleRepo.save(published);

    // Les dependances sont injectees — on peut les mocker individuellement
    this.eventBus.emit('article.published', { articleId: id, userId });
    this.logger.info(`Article ${id} publie par ${userId}`);

    return saved;
  }
}

// ============================================================
// IMPLEMENTATIONS CONCRETE ET IN-MEMORY (pour les tests)
// ============================================================

// Implem production : parlerait a une vraie base de donnees
class PostgresArticleRepository implements ArticleRepository {
  // Normalement injecte une connexion DB — simplifie ici
  async findById(id: string): Promise<Article | null> {
    console.log(`[Postgres] SELECT * FROM articles WHERE id = '${id}'`);
    return null; // simplifie
  }
  async findAll(): Promise<Article[]> { return []; }
  async save(article: Article): Promise<Article> { return article; }
  async delete(id: string): Promise<void> { console.log(`[Postgres] DELETE ${id}`); }
}

// Implem test : totalement en memoire, zero infrastructure
class InMemoryArticleRepository implements ArticleRepository {
  private store = new Map<string, Article>();

  // Methode utilitaire pour preparer l'etat dans les tests
  seed(articles: Article[]): void {
    articles.forEach(a => this.store.set(a.id, a));
  }

  async findById(id: string): Promise<Article | null> {
    return this.store.get(id) ?? null;
  }
  async findAll(): Promise<Article[]> {
    return Array.from(this.store.values());
  }
  async save(article: Article): Promise<Article> {
    this.store.set(article.id, article);
    return article;
  }
  async delete(id: string): Promise<void> {
    this.store.delete(id);
  }
}

// ============================================================
// STUBS — Mocks simples pour les tests
// ============================================================

interface EventBus {
  emit(event: string, data: unknown): void;
}

interface Logger {
  info(message: string): void;
  error(message: string): void;
}

class NoOpEventBus implements EventBus {
  emittedEvents: Array<{ event: string; data: unknown }> = [];
  emit(event: string, data: unknown): void {
    // Enregistre les evenements pour les assertions dans les tests
    this.emittedEvents.push({ event, data });
  }
}

class NoOpLogger implements Logger {
  info(message: string): void { /* noop en test */ }
  error(message: string): void { /* noop en test */ }
}

// ============================================================
// TESTS — Avec DI, pas de base de donnees requise
// ============================================================

async function runTests(): Promise<void> {
  console.log('=== Test 1 : Publier un article valide ===');

  const repo = new InMemoryArticleRepository();
  const bus  = new NoOpEventBus();
  const log  = new NoOpLogger();

  // Preparer l'etat initial
  repo.seed([{
    id: 'art-001',
    title: 'Test Article',
    content: 'Contenu de test sur plus de 100 caracteres pour etre valide dans notre systeme CMS.',
    status: 'draft',
    tenantId: 'tenant-1',
  }]);

  // Creer le service avec des dependances en memoire — zero infra
  const service = new ArticleService(repo, bus, log);

  // Executer
  const result = await service.publish('art-001', 'user-42');

  // Assertions
  console.assert(result.status === 'published', 'Status devrait etre published');
  console.assert(bus.emittedEvents.length === 1, 'Un evenement devrait etre emis');
  console.assert(bus.emittedEvents[0].event === 'article.published', 'Bon evenement');
  console.log('✓ Test 1 passe');

  console.log('=== Test 2 : Publier un article inexistant ===');

  try {
    await service.publish('art-inexistant', 'user-42');
    console.error('✗ Aurait du lever une exception');
  } catch (e) {
    console.assert((e as Error).message.includes('introuvable'));
    console.log('✓ Test 2 passe');
  }

  console.log('=== Test 3 : Publier un article deja publie ===');

  const repo2 = new InMemoryArticleRepository();
  repo2.seed([{
    id: 'art-002',
    title: 'Article publie',
    content: 'Contenu deja en ligne',
    status: 'published',  // deja publie
    tenantId: 'tenant-1',
  }]);

  const service2 = new ArticleService(repo2, new NoOpEventBus(), new NoOpLogger());

  try {
    await service2.publish('art-002', 'user-42');
    console.error('✗ Aurait du lever une exception');
  } catch (e) {
    console.assert((e as Error).message.includes('Status invalide'));
    console.log('✓ Test 3 passe');
  }
}

// ============================================================
// SCOPES — Simulation de singleton vs transient
// ============================================================

// Singleton : une seule instance pour toute l'application
class ConfigService {
  private static instance: ConfigService | null = null;
  private config: Record<string, string>;

  private constructor() {
    // Charge la configuration une seule fois
    this.config = { DATABASE_URL: 'postgres://localhost/db', MAX_RETRIES: '3' };
    console.log('[ConfigService] Configuration chargee (une fois)');
  }

  // Pattern Singleton correct (mais preferer l'injection par constructeur + conteneur IoC)
  static getInstance(): ConfigService {
    if (!ConfigService.instance) {
      ConfigService.instance = new ConfigService();
    }
    return ConfigService.instance;
  }

  get(key: string): string {
    return this.config[key] ?? '';
  }
}

// Transient : nouvelle instance a chaque injection
class RequestContext {
  readonly requestId: string;
  readonly startedAt: Date;
  private metadata: Map<string, unknown> = new Map();

  constructor() {
    // Chaque requete a son propre contexte — ne DOIT PAS etre singleton
    this.requestId = `req-${Math.random().toString(36).slice(2)}`;
    this.startedAt = new Date();
  }

  set(key: string, value: unknown): void { this.metadata.set(key, value); }
  get(key: string): unknown { return this.metadata.get(key); }
}

// ============================================================
// ANTI-PATTERN : Service Locator — ce qu'il ne faut PAS faire
// ============================================================

class ServiceLocator {
  private static registry = new Map<string, unknown>();

  static register(token: string, instance: unknown): void {
    this.registry.set(token, instance);
  }

  static get<T>(token: string): T {
    const service = this.registry.get(token);
    if (!service) throw new Error(`Service non trouve : ${token}`);
    return service as T;
  }
}

// Anti-pattern : dependances cachees, tests difficiles
class ArticleServiceBad {
  publish(id: string): void {
    // Les dependances ne sont PAS visibles dans la signature de la classe
    // Pour tester, je dois configurer le ServiceLocator global
    const repo = ServiceLocator.get<ArticleRepository>('ArticleRepository');
    const bus  = ServiceLocator.get<EventBus>('EventBus');

    // ... logique
    bus.emit('article.published', { id });
  }
}

// Test avec Service Locator — douloureux
function testBadService(): void {
  // Dois configurer un registre global avant chaque test
  const mockRepo = new InMemoryArticleRepository();
  const mockBus  = new NoOpEventBus();

  ServiceLocator.register('ArticleRepository', mockRepo);
  ServiceLocator.register('EventBus', mockBus);

  const service = new ArticleServiceBad();
  service.publish('art-001');

  // Dois nettoyer apres — sinon les autres tests sont affectes
  // (pas de mecanisme standard pour ca)
}

// Contraste : test avec DI — trivial
function testGoodService(): void {
  // Aucune configuration globale, aucun nettoyage
  const service = new ArticleService(
    new InMemoryArticleRepository(),
    new NoOpEventBus(),
    new NoOpLogger(),
  );
  // service.publish('art-001', 'user-42');
}

// ============================================================
// NESTJS — Annotation @Injectable() et systeme de modules
// ============================================================

// Note : ce code illustre le pattern NestJS — il necessite @nestjs/common

/*
import { Injectable, Inject, Module } from '@nestjs/common';

// Token pour injection de valeur scalaire
const MAX_RETRIES = 'MAX_RETRIES';

@Injectable()
class ArticleRepositoryImpl implements ArticleRepository {
  async findById(id: string) { ... }
  async findAll() { ... }
  async save(article: Article) { ... }
  async delete(id: string) { ... }
}

@Injectable()
class ArticleServiceNest {
  constructor(
    // Injection par type (classe) — le plus courant
    private readonly repo: ArticleRepositoryImpl,

    // Injection par token — pour les valeurs scalaires ou interfaces
    @Inject(MAX_RETRIES) private readonly maxRetries: number,
  ) {}
}

@Module({
  providers: [
    ArticleServiceNest,

    // Forme explicite : permet de substituer l'implementation
    { provide: ArticleRepositoryImpl, useClass: ArticleRepositoryImpl },

    // Valeur scalaire
    { provide: MAX_RETRIES, useValue: 3 },

    // Factory : construction asynchrone, dependances injectees
    {
      provide: 'DB_CONNECTION',
      useFactory: async (config: ConfigService) => {
        const conn = await createConnection(config.get('DATABASE_URL'));
        return conn;
      },
      inject: [ConfigService],
    },
  ],
  exports: [ArticleServiceNest],
})
class ArticleModule {}
*/

// Lancer les tests pour valider
runTests().catch(console.error);
```

---

## Resume

- **IoC** (inversion de controle) est le principe : ce n'est pas la classe qui cree ses dépendances, c'est un agent externe qui les fournit. **DI** (injection de dépendances) est la technique pour l'implémenter, et l'**injection par constructeur** est la forme la plus claire et la plus testable.
- Les **trois scopes** ont des usages precis : **Singleton** pour les services stateless (config, logger) ; **Request-scoped** pour les services avec état par requête (contexte utilisateur, transaction) ; **Transient** pour les services légers avec état mutable. Mixer les scopes (singleton injectant un request-scoped) cree des "captive dependencies" dangereuses.
- Le **Service Locator** est l'anti-pattern de DI : il cache les dépendances, rend les tests complexes, et couple le code a un registre global. L'injection par constructeur expose toutes les dépendances explicitement — c'est le contrat de la classe.
- **NestJS** implémenté DI via des decorateurs (`@Injectable`, `@Inject`) et des modules qui decrivent les providers (useClass, useValue, useFactory). La forme `useClass` permet de substituer une implémentation par une autre sans modifier le code client.
- DI est la **condition nécessaire** des tests unitaires : avec une interface et l'injection par constructeur, tester n'importe quel service s'effectue en instanciant la classe avec des implémentations en mémoire — aucune base de données, aucun réseau, aucune infrastructure requise.


---

> **Lien fil rouge — ShopArch**
>
> - Définis les ports (interfaces) pour `OrderRepository` et `PaymentGateway`
> - Le `OrderService` ne doit dépendre que des interfaces, jamais des implémentations concrètes
> - Exercice(s) associé(s) : `exercices/03-injection-dependances/`
> - Checkpoint : Module 01, critère 2

## Prochain cours

[06 — Raisonner en architecte](./06-raisonner-en-architecte.md)

> Dans le dernier cours de ce module, nous verrons comment penser comme un architecte : caractéristiques d'architecture (-ilities), analyse de trade-offs, matrice impact/effort, fitness functions, et comment documenter les decisions avec les ADR. C'est la synthese de tout ce que nous avons vu dans le module 00.
