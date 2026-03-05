# 02 — Les principes SOLID

## Objectif

A la fin de ce cours, tu sauras **expliquer et appliquer les 5 principes SOLID**, identifier les violations courantes dans du code existant, et reconnaître les situations où appliquer SOLID serait de l'over-engineering.

---

## Rappel du cours précédent

Avant de continuer, teste ta mémoire. Essaie de répondre sans regarder.

**Question 1 — Quelle est la différence entre architecture et design ?**

<details>
<summary>Réponse</summary>

L'**architecture** regroupe les decisions structurantes difficiles a changer (choix de base de données, découpage en services, protocole d'authentification) qui impactent plusieurs équipes sur un horizon long. Le **design** regroupe les decisions locales, faciles a refactorer, qui concernent un fichier ou un développeur (nommage, structure d'une classe, algorithme).

La ligne est floue et dépend du contexte : ce qui est "design" dans une grande entreprise peut etre "architecture" dans une startup.
</details>

**Question 2 — Quelles sont les 4 dimensions de l'architecture logicielle ?**

<details>
<summary>Réponse</summary>

1. **Structure** — comment les composants sont organises (couches, microservices, monolithe)
2. **Communication** — comment les composants echangent des données (REST, events, in-process)
3. **Decisions** — pourquoi ces choix ont ete faits, documentes dans des ADR
4. **Vision** — ou va le système dans 2 a 5 ans (scalabilité, migration, évolution technologique)
</details>

---

## Analogie — La boite a outils vs le couteau suisse

Imagine deux artisans :

- **L'artisan amateur** part en deplacement avec un couteau suisse. Il a un tournevis, une lime, des ciseaux, et meme un cure-dents — tout dans un seul outil. Mais quand il doit vraiment visser quelque chose, le tournevis est trop court. Quand il doit couper du bois, les ciseaux ne sont pas adaptes. Et si la lime casse, il doit jeter tout l'outil.

- **L'artisan professionnel** a une caisse avec des outils specialises : un tournevis electrique, une scie circulaire, une ponceuse. Chaque outil fait une seule chose, mais il la fait parfaitement. Si la ponceuse tombe en panne, les autres outils continuent de fonctionner.

Les principes SOLID, c'est la philosophie de l'artisan professionnel appliquee au code : **chaque classe fait une chose, elle la fait bien, et elle peut etre remplacee ou etendue sans tout casser**.

---

## Théorie

SOLID est un acronyme introduit par Robert C. Martin (Uncle Bob). Ce ne sont pas des règles absolues, mais des **guides pour écrire du code maintenable et extensible**.

```
S — Single Responsibility Principle  (SRP)
O — Open/Closed Principle            (OCP)
L — Liskov Substitution Principle    (LSP)
I — Interface Segregation Principle  (ISP)
D — Dependency Inversion Principle   (DIP)
```

---

### S — Single Responsibility Principle

**"Une classe ne doit avoir qu'une seule raison de changer."**

Analogie : un **couteau suisse vs des outils specialises**. Si ta classe fait trop de choses, modifier l'une d'elles risque de casser les autres.

```
Violation SRP :
┌─────────────────────────────────────────┐
│           ArticleService                │
│                                         │
│  + fetchArticle()    ← logique metier   │
│  + formatAsHtml()    ← logique rendu    │
│  + saveToDatabase()  ← logique stockage │
│  + sendEmailAlert()  ← logique notif    │
│                                         │
│  Raisons de changer : 4                 │
└─────────────────────────────────────────┘

Respect SRP :
┌────────────────┐  ┌──────────────────┐  ┌─────────────────┐
│ ArticleService │  │  ArticleRenderer │  │ ArticleNotifier │
│                │  │                  │  │                 │
│ + fetchArticle │  │ + formatAsHtml() │  │ + sendAlert()   │
│ + save()       │  │                  │  │                 │
│                │  │                  │  │                 │
│ Raison : 1     │  │ Raison : 1       │  │ Raison : 1      │
└────────────────┘  └──────────────────┘  └─────────────────┘
```

---

### O — Open/Closed Principle

**"Une classe doit etre ouverte a l'extension, fermee a la modification."**

Analogie : une **prise electrique**. Tu n'ouvres pas la prise pour y ajouter un troisieme trou quand tu as un nouvel appareil. Tu branches une multiprise (extension) sans modifier l'existant.

```
Violation OCP — chaque nouveau type necessite de modifier la classe :
┌──────────────────────────────────────────────┐
│              ExportService                   │
│                                              │
│  export(data, format: string) {              │
│    if (format === 'csv')  { ... }  ← touche │
│    if (format === 'json') { ... }  ← touche │
│    if (format === 'xml')  { ... }  ← ajoute │
│  }                                           │
└──────────────────────────────────────────────┘

Respect OCP — extension sans modification :
┌─────────────────┐
│  <<interface>>  │
│   Exporter      │◄────────────────────────────────┐
│                 │                                  │
│ + export(data)  │                                  │
└─────────────────┘                                  │
        ▲              ▲              ▲              ▲
┌───────────┐   ┌───────────┐  ┌──────────┐  ┌──────────┐
│CsvExporter│   │JsonExport.│  │XmlExport.│  │ (futur)  │
└───────────┘   └───────────┘  └──────────┘  └──────────┘
```

---

### L — Liskov Substitution Principle

**"Un sous-type doit pouvoir remplacer son type parent sans alterer le comportement du programme."**

Analogie : un **remplacant sur le terrain**. Si le remplacant entre en jeu, l'équipe doit fonctionner de la meme facon. Si le remplacant change les règles du jeu (il refuse de tirer des penaltys, il joue avec les mains), ce n'est pas un vrai remplacant.

```
Violation LSP — la sous-classe casse le contrat :

class Rectangle {
  setWidth(w)  { this.width = w; }
  setHeight(h) { this.height = h; }
  area()       { return this.width * this.height; }
}

class Square extends Rectangle {
  setWidth(w)  { this.width = w; this.height = w; }  // ← casse le contrat !
  setHeight(h) { this.width = h; this.height = h; }  // ← casse le contrat !
}

// Ce code echoue si on substitue Square a Rectangle :
function resizeAndCompute(rect: Rectangle) {
  rect.setWidth(5);
  rect.setHeight(10);
  // Attendu : 50 — avec Square on obtient : 100 → comportement inattendu
}
```

---

### I — Interface Segregation Principle

**"Un client ne doit pas etre force d'implémenter des interfaces qu'il n'utilise pas."**

Analogie : un **menu de restaurant**. Tu ne forces pas le client vegan a commander depuis un menu qui n'a que de la viande. Tu proposes des menus segmentes : menu du jour, menu vegetarien, menu enfant. Chaque client ne voit que ce qui le concerne.

```
Violation ISP — interface trop large :
┌──────────────────────────────────────────┐
│         ContentManagerInterface          │
│                                          │
│  + createArticle()                       │
│  + publishArticle()                      │
│  + deleteArticle()                       │
│  + manageUsers()       ← pas pertinent   │
│  + exportStatistics()  ← pas pertinent   │
│  + configureSEO()      ← parfois         │
└──────────────────────────────────────────┘

Respect ISP — interfaces segreguees :
┌─────────────────┐   ┌──────────────────┐   ┌─────────────────┐
│ ArticleManager  │   │  UserManager     │   │  AnalyticsViewer│
│                 │   │                  │   │                 │
│ + create()      │   │ + manageUsers()  │   │ + exportStats() │
│ + publish()     │   │                  │   │                 │
│ + delete()      │   │                  │   │                 │
└─────────────────┘   └──────────────────┘   └─────────────────┘
```

---

### D — Dependency Inversion Principle

**"Les modules de haut niveau ne doivent pas dépendre des modules de bas niveau. Les deux doivent dépendre d'abstractions."**

Analogie : la **norme de prise electrique**. Ton aspirateur ne dépend pas d'un constructeur spécifique d'electricite. Il dépend d'une **abstraction standard** (la norme de prise) qui peut etre implémentee par n'importe quel fournisseur d'electricite.

```
Violation DIP :
┌─────────────────────────────┐
│       ArticleService        │  (module haut niveau)
│                             │
│  constructor() {            │
│    this.db = new PostgreSQL │  ← depend directement
│  }                          │     d'une implementation
└─────────────────────────────┘
             │
             ▼
┌─────────────────────────────┐
│       PostgreSQL            │  (module bas niveau)
└─────────────────────────────┘

Respect DIP :
┌─────────────────────────────┐
│       ArticleService        │  depend d'une abstraction
│                             │
│  constructor(               │
│    db: DatabaseInterface    │  ← depend de l'interface
│  ) {}                       │
└─────────────────────────────┘
             │
             ▼
┌─────────────────────────────┐
│    <<interface>>            │
│    DatabaseInterface        │  ← abstraction partagee
│    + find(), + save()       │
└─────────────────────────────┘
        ▲           ▲
┌───────────┐  ┌──────────┐
│ PostgreSQL│  │  InMemory│  implementations interchangeables
└───────────┘  └──────────┘
```

---

### Quand SOLID est de l'over-engineering

SOLID est un guide, pas une loi absolue. Il devient contre-productif dans ces situations :

| Situation | Raison de ne pas appliquer SOLID |
|---|---|
| Prototype / MVP | La flexibilité n'est pas encore la priorité |
| Code qui ne changera jamais | L'abstraction ajoute de la complexité sans valeur |
| 3 lignes de logique triviale | Créer une interface pour 3 lignes = sur-ingenierie |
| Script one-shot | Optimiser pour la maintenabilité n'a pas de sens |
| Performance critique | Les abstractions ont un cout (indirection) |

> Regle pratique : applique SOLID quand tu penses que le code **va changer**, que **plusieurs personnes** vont le lire, ou qu'il sera **teste unitairement**. Sinon, KISS (Keep It Simple, Stupid) prime.

---

## Pratique

```typescript
// ============================================================
// S — Single Responsibility Principle
// ============================================================

// AVANT : une classe fait trop de choses
class ArticleBefore {
  title: string;
  content: string;

  // Responsabilite 1 : logique metier
  validate(): boolean {
    return this.title.length > 0 && this.content.length > 100;
  }

  // Responsabilite 2 : rendu — ne devrait pas etre ici
  toHtml(): string {
    return `<h1>${this.title}</h1><p>${this.content}</p>`;
  }

  // Responsabilite 3 : persistance — ne devrait pas etre ici
  async save(): Promise<void> {
    await fetch('/api/articles', { method: 'POST', body: JSON.stringify(this) });
  }
}

// APRES : chaque classe a une seule responsabilite
class Article {
  constructor(public title: string, public content: string) {}

  // Seule responsabilite : representer un article et le valider
  validate(): boolean {
    return this.title.length > 0 && this.content.length > 100;
  }
}

class ArticleRenderer {
  // Seule responsabilite : rendu HTML
  toHtml(article: Article): string {
    return `<h1>${article.title}</h1><p>${article.content}</p>`;
  }
}

class ArticleRepository {
  // Seule responsabilite : persistance
  async save(article: Article): Promise<void> {
    await fetch('/api/articles', { method: 'POST', body: JSON.stringify(article) });
  }
}

// ============================================================
// O — Open/Closed Principle
// ============================================================

// AVANT : ajouter un format necessite modifier la classe existante
class ExportServiceBefore {
  export(data: unknown[], format: string): string {
    if (format === 'csv') {
      // logique CSV...
      return data.map(row => Object.values(row as object).join(',')).join('\n');
    }
    if (format === 'json') {
      return JSON.stringify(data, null, 2);
    }
    // Ajouter XML ? Il faut modifier cette classe — violation OCP
    throw new Error(`Format inconnu : ${format}`);
  }
}

// APRES : extension sans modification de la classe de base
interface Exporter {
  export(data: unknown[]): string;
}

class CsvExporter implements Exporter {
  export(data: unknown[]): string {
    // On peut ajouter CsvExporter sans toucher a JsonExporter ou ExportService
    return data.map(row => Object.values(row as object).join(',')).join('\n');
  }
}

class JsonExporter implements Exporter {
  export(data: unknown[]): string {
    return JSON.stringify(data, null, 2);
  }
}

// Nouveau format ? On cree une nouvelle classe, on ne touche a rien d'existant.
class XmlExporter implements Exporter {
  export(data: unknown[]): string {
    const rows = data.map(row =>
      `  <row>${Object.entries(row as object).map(([k, v]) => `<${k}>${v}</${k}>`).join('')}</row>`
    ).join('\n');
    return `<rows>\n${rows}\n</rows>`;
  }
}

class ExportService {
  // Depend d'une abstraction, pas d'une implementation concrete (aussi DIP)
  constructor(private readonly exporter: Exporter) {}

  run(data: unknown[]): string {
    return this.exporter.export(data);
  }
}

// Utilisation :
const csvService = new ExportService(new CsvExporter());
const xmlService = new ExportService(new XmlExporter());

// ============================================================
// L — Liskov Substitution Principle
// ============================================================

// Solution correcte : ne pas heriter quand le comportement diverge
// Utiliser la composition plutot que l'heritage

interface Shape {
  area(): number;
}

class Rectangle implements Shape {
  constructor(private width: number, private height: number) {}
  area(): number { return this.width * this.height; }
}

class Square implements Shape {
  // Square n'herite PAS de Rectangle — il implementent la meme interface
  // sans violer les contrats de l'autre
  constructor(private side: number) {}
  area(): number { return this.side * this.side; }
}

function printArea(shape: Shape): void {
  // Cette fonction fonctionne avec n'importe quel Shape — LSP respecte
  console.log(`Aire : ${shape.area()}`);
}

printArea(new Rectangle(5, 10)); // 50
printArea(new Square(5));        // 25

// ============================================================
// I — Interface Segregation Principle
// ============================================================

// AVANT : interface trop large, force des implementations vides
interface ContentManagerBefore {
  createArticle(title: string): void;
  publishArticle(id: string): void;
  manageUsers(): void;      // le redacteur n'a pas besoin de ca
  exportStatistics(): void; // le redacteur n'a pas besoin de ca
}

// APRES : interfaces segreguees
interface ArticleEditor {
  createArticle(title: string): void;
  publishArticle(id: string): void;
}

interface UserManager {
  manageUsers(): void;
}

interface AnalyticsViewer {
  exportStatistics(): void;
}

// Un redacteur n'implemente que ce dont il a besoin
class Editor implements ArticleEditor {
  createArticle(title: string): void { /* ... */ }
  publishArticle(id: string): void { /* ... */ }
  // Pas force d'implementer manageUsers() ou exportStatistics()
}

// Un admin peut implemente plusieurs interfaces via composition
class Admin implements ArticleEditor, UserManager, AnalyticsViewer {
  createArticle(title: string): void { /* ... */ }
  publishArticle(id: string): void { /* ... */ }
  manageUsers(): void { /* ... */ }
  exportStatistics(): void { /* ... */ }
}

// ============================================================
// D — Dependency Inversion Principle
// ============================================================

// AVANT : le service de haut niveau depend directement d'une implementation
class ArticleServiceBefore {
  // Dependance directe sur une implementation concrete
  private db = new Map<string, Article>(); // imagine que c'est une vraie DB

  async findById(id: string): Promise<Article | null> {
    return this.db.get(id) ?? null;
  }
}

// APRES : le service depend d'une abstraction
interface ArticleRepository {
  findById(id: string): Promise<Article | null>;
  save(article: Article): Promise<void>;
}

// Implementation pour la production
class PostgresArticleRepository implements ArticleRepository {
  async findById(id: string): Promise<Article | null> {
    // Vraie requete SQL ici
    return null; // simplifie
  }
  async save(article: Article): Promise<void> {
    // Vraie insertion SQL ici
  }
}

// Implementation pour les tests — aucune base de donnees requise
class InMemoryArticleRepository implements ArticleRepository {
  private store = new Map<string, Article>();

  async findById(id: string): Promise<Article | null> {
    return this.store.get(id) ?? null;
  }
  async save(article: Article): Promise<void> {
    this.store.set(article.title, article); // simplifie
  }
}

class ArticleService {
  // Depend de l'abstraction — peut recevoir Postgres OU InMemory
  constructor(private readonly repo: ArticleRepository) {}

  async getArticle(id: string): Promise<Article | null> {
    return this.repo.findById(id);
  }
}

// En production :
const prodService = new ArticleService(new PostgresArticleRepository());

// En test — pas de base de donnees, rapide et deterministe :
const testRepo = new InMemoryArticleRepository();
const testService = new ArticleService(testRepo);
```

---

## Resume

- **SRP** (outil specialise) : une classe = une raison de changer. Si tu dois modifier une classe pour deux raisons différentes, elle fait trop de choses.
- **OCP** (prise electrique) : etends le comportement par de nouvelles classes plutot qu'en modifiant l'existant. Protege le code valide contre les regressions.
- **LSP** (remplacant qui respecte les règles) : une sous-classe doit se comporter exactement comme sa classe parente du point de vue du code client. Prefere les interfaces a l'héritage quand les comportements divergent.
- **ISP** (menu segmente) : ne force pas une classe a implémenter des méthodes inutiles. Une petite interface focalisee vaut mieux qu'une grande interface générique.
- **DIP** (norme de prise) : dépend d'abstractions (interfaces), jamais d'implémentations concretes. C'est ce qui rend le code testable et interchangeable.


---

> **Lien fil rouge — ShopArch**
>
> - Vérifie que chaque entité du domaine ShopArch respecte SRP (une seule raison de changer)
> - Applique OCP au calcul de prix : ajouter une promo ne doit pas modifier `Money`
> - Exercice(s) associé(s) : `exercices/01-refactoring-solid/`
> - Checkpoint : Module 00, critère 1

## Prochain cours

[03 — Les design patterns essentiels](./03-design-patterns-essentiels.md)

> Dans le prochain cours, nous verrons les patterns de conception les plus utiles en pratique : Creational (Factory, Builder, Singleton), Structural (Adapter, Facade, Proxy, Decorator) et Behavioral (Observer, Strategy, State Machine, Command). Chaque pattern sera presente avec le problème qu'il resout, un diagramme ASCII et du code TypeScript reel.
