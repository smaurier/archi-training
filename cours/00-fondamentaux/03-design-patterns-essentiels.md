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

Les 23 patterns du "Gang of Four" (GoF) sont ce catalogue. Ce cours couvre les **23 patterns**, regroupes en 3 familles :

```
FAMILLES DE DESIGN PATTERNS — 23 au total
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 CREATIONAL (5)       STRUCTURAL (7)        BEHAVIORAL (11)
 (comment creer)      (comment assembler)   (comment communiquer)
 ──────────────────   ────────────────────  ───────────────────────
 Factory              Adapter               Chain of Responsibility
 Abstract Factory     Bridge                Command
 Builder              Composite             Iterator
 Prototype            Decorator             Mediator
 Singleton            Facade                Memento
                      Flyweight             Observer
                      Proxy                 State Machine
                                            Strategy
                                            Template Method
                                            Visitor
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

### PATTERNS CREATIONNELS (suite)

---

#### Abstract Factory — La boutique de style coherent

**Problème résolu** : créer des **familles** d'objets compatibles entre eux sans dépendre de leurs classes concrètes. Garantit que les objets créés ensemble "vont ensemble".

Différence clé avec Factory : Factory crée **un** type d'objet. Abstract Factory crée **une famille** d'objets liés qui doivent être compatibles.

**Quand NE PAS utiliser** : si tu n'as qu'une seule famille. Factory simple suffit.

```
          <<interface>>
          UIFactory
          + createButton()
          + createCheckbox()
                 │
    ┌────────────┴────────────┐
    ▼                         ▼
DarkThemeFactory          LightThemeFactory
createButton()  → DarkBtn  createButton()  → LightBtn
createCheckbox()→ DarkCb   createCheckbox()→ LightCb

Le client ne connait que UIFactory.
Changer de theme = changer de factory. Rien d'autre.
```

---

#### Prototype — La photocopieuse

**Problème résolu** : créer de nouveaux objets en **clonant** des existants, quand la construction from scratch est coûteuse ou complexe.

Analogie : une **photocopieuse**. Tu copies un document existant puis tu annotes ta copie — sans toucher l'original.

**Quand NE PAS utiliser** : si `new MonObjet(params)` est rapide et simple.

```
interface Cloneable {
  clone(): this   ← retourne une copie profonde
}

// Usage
const base = new ServerConfig({ timeout: 5000 })
const prod = base.clone()
prod.timeout = 30000   // modifie la copie, pas l'original
```

**Piège** : en JS, `{ ...obj }` est une copie **superficielle**. Les tableaux et objets imbriqués sont partagés. Pour une copie profonde, cloner chaque niveau manuellement ou utiliser `structuredClone()`.

---

### PATTERNS STRUCTURELS (suite)

---

#### Bridge — Le pont abstraction/implémentation

**Problème résolu** : séparer une **abstraction** de son **implémentation** pour que les deux axes évoluent indépendamment.

Analogie : une **télécommande** (abstraction) et une **TV** (implémentation). Tu peux créer de nouvelles télécommandes (AdvancedRemote) et de nouvelles TVs (Samsung, Sony) sans que l'une dépende de l'autre.

Différence avec Adapter : **Bridge** est conçu dès le départ. **Adapter** répare une incompatibilité existante.

**Quand NE PAS utiliser** : si un seul axe évolue. Complexité inutile sinon.

```
Abstraction (Remote)           Implémentation (Device)
  └── impl: Device ────────────►  SamsungTV
                                   SonyTV

BasicRemote    utilise Device.turnOn/Off/setVolume
AdvancedRemote ajoute mute(), rewind()

Ajouter WebGLRenderer → ne touche pas les formes
Ajouter Triangle       → ne touche pas les renderers
```

---

#### Composite — Le système de fichiers

**Problème résolu** : traiter les objets **individuels** et les **compositions** de manière uniforme via une seule interface.

Analogie : un **système de fichiers**. Fichier et Dossier répondent aux mêmes opérations (`getSize()`, `delete()`). Un Dossier peut contenir des Fichiers ET d'autres Dossiers. Tu recurses sans distinguer les deux.

```
<<interface>>
Component
+ getName(): string
+ getSize(): number
+ display(indent): void

File implements Component      Folder implements Component
+ getSize() → sa taille        + getSize() → somme enfants
+ display() → son nom          + display() → nom + recurse
                                + add(component)
                                + children: Component[]

Règle : Folder.getSize() appelle getSize() sur chaque enfant.
Peu importe que l'enfant soit File ou Folder — même interface.
```

---

#### Flyweight — Le partage de glyphes

**Problème résolu** : partager l'état **commun** entre de nombreux objets similaires pour réduire la mémoire.

Analogie : dans un éditeur de texte, tu ne crées pas un objet "lettre A" pour chaque 'A' dans le document. Un **glyphe partagé** représente 'A', chaque occurrence stocke seulement sa position.

**État intrinsèque** (partagé, immuable) : couleur, forme, texture, police  
**État extrinsèque** (unique par instance) : position x/y, contexte

**Quand NE PAS utiliser** : si ton app ne manipule pas des milliers d'objets similaires. Optimisation prématurée sinon.

```
FlyweightFactory
  cache: Map<clé, Flyweight>
  + get(clé): Flyweight  ← retourne du cache ou crée

TreeType (Flyweight — partagé entre N arbres)
  name, color, texture   ← état intrinsèque

Tree (contexte unique par arbre)
  x, y                   ← état extrinsèque
  type: TreeType         ← référence partagée, pas une copie
```

---

### PATTERNS COMPORTEMENTAUX (suite)

---

#### Iterator — Le curseur de collection

**Problème résolu** : parcourir une collection sans exposer sa structure interne.

Analogie : une **télécommande pour zapper**. Tu ne sais pas comment les chaînes sont stockées — tu appuies sur "suivant".

En JavaScript, ce pattern est **natif** via `Symbol.iterator` et les generators (`function*`). `for...of` et les méthodes Array en sont des implémentations.

**Quand implémenter manuellement** : structures non-linéaires (arbres, graphes) ou itérations paresseuses (pagination, flux infini).

```
<<interface>>
Iterator<T>
+ hasNext(): boolean
+ next(): T

TreeIterator implements Iterator<Node>
  → parcourt un arbre en profondeur, noeud par noeud
  → le client utilise hasNext/next sans connaître la structure

// JS natif
class MyCollection {
  [Symbol.iterator]() { /* retourne un Iterator */ }
}
for (const item of myCollection) { ... } // fonctionne
```

---

#### Chain of Responsibility — L'escalade support

**Problème résolu** : passer une requête le long d'une chaîne de handlers jusqu'à ce que l'un la traite.

Analogie : le **support client**. Niveau 1 → Niveau 2 → Manager. Chaque niveau traite ou escalade. L'expéditeur ne sait pas qui va finalement répondre.

Cas courant en web : **middleware HTTP**. Auth → RateLimit → Validation → Handler.

**Quand NE PAS utiliser** : si tu sais d'avance quel handler doit traiter — appelle-le directement.

```
Handler (abstrait)
  next: Handler | null
  + setNext(handler): this    ← chainable : a.setNext(b).setNext(c)
  + handle(request): Response

AuthHandler → RateLimitHandler → ValidationHandler → BusinessHandler
    │               │                   │                  │
    └ 401 si        └ 429 si            └ 400 si           └ traite
      pas de token    trop de reqs        body invalide       et répond
```

---

#### Mediator — Le contrôle aérien

**Problème résolu** : réduire le couplage entre objets en les faisant communiquer **via un médiateur central** plutôt que directement entre eux.

Analogie : la **tour de contrôle aérien**. Les avions ne se parlent pas directement — tout passe par la tour. Sans elle, chaque avion devrait connaître tous les autres.

Différence avec Facade : **Facade** simplifie un sous-système (unidirectionnel, tu appelles la facade). **Mediator** coordonne des **pairs** qui se notifient mutuellement.

```
SANS Mediator (chaos)           AVEC Mediator (ordre)
UserA ←→ UserB                  UserA → ChatRoom → UserB
UserA ←→ UserC                  UserC → ChatRoom → UserA
UserB ←→ UserC
N objets = N×(N-1) liens        N objets = N liens
```

---

#### Memento — La sauvegarde de partie

**Problème résolu** : capturer et restaurer l'état interne d'un objet **sans violer l'encapsulation**.

Analogie : la **sauvegarde de jeu vidéo**. Tu sauvegardes, continues, charges si ça tourne mal. Le "save file" ne contient pas de logique — juste l'état.

Trois rôles :
- **Originator** : l'objet dont on sauvegarde l'état (l'éditeur)
- **Memento** : le snapshot opaque (seul l'Originator peut lire son contenu)
- **Caretaker** : gère la pile de sauvegardes (historique undo/redo)

```
TextEditor (Originator)
  + save(): Memento          ← crée un snapshot
  + restore(m: Memento)      ← restaure depuis snapshot

Memento
  private state: string      ← opaque — le Caretaker ne lit pas ceci

History (Caretaker)
  stack: Memento[]
  + push(m) / pop(): Memento
```

---

#### Template Method — Le squelette d'algorithme

**Problème résolu** : définir le **squelette** d'un algorithme dans une classe de base, laisser les sous-classes redéfinir certaines étapes sans changer la structure globale.

Analogie : une **recette de cuisine**. La structure est toujours "préparer → cuire → servir". Les ingrédients et techniques varient. Tu ne peux pas changer l'ordre.

Différence avec Strategy : **Template Method** utilise l'héritage. **Strategy** utilise la composition (injection d'objet). En JS moderne, préfère Strategy — mais Template Method reste valide quand les étapes communes sont substantielles.

```
DataMiner (classe de base)
  + mine(path): Report          ← méthode template — ne pas surcharger
  # openData(raw): string       ← abstract : obligatoire
  # extractData(str): string[]  ← abstract : obligatoire
  # parseData(rows): Record[]   ← peut avoir défaut
  # analyzeData(records): Report← abstract : obligatoire

CsvDataMiner extends DataMiner  → ouvre CSV, parse virgules
JsonDataMiner extends DataMiner → ouvre JSON, parse objets
```

---

#### Visitor — L'inspecteur qui visite

**Problème résolu** : ajouter de nouvelles **opérations** à des objets sans modifier leurs classes.

Analogie : un **inspecteur fiscal**. Il visite différents types d'entreprises (SARL, SAS, auto-entrepreneur) et applique un traitement spécifique à chacune. Tu peux changer les règles fiscales sans modifier le statut juridique des entreprises.

**Double dispatch** : `element.accept(visitor)` appelle `visitor.visitElement(this)`. Le bon code s'exécute selon les deux types.

**Quand utiliser** : structure d'objets stable + opérations qui changent souvent (AST, export multi-formats).

```
<<interface>>
Visitor
+ visitCircle(c: Circle): string
+ visitSquare(s: Square): string

AreaCalculator implements Visitor  ← opération 1
PriceEstimator  implements Visitor  ← opération 2
XmlExporter     implements Visitor  ← opération 3

<<interface>>
Shape
+ accept(v: Visitor): string

Circle + accept(v) → v.visitCircle(this)   ← double dispatch
Square + accept(v) → v.visitSquare(this)

Ajouter SvgExporter → crée un Visitor. Zéro modification sur les Shapes.
```

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

## Pratique — Les 11 patterns complementaires

```typescript
// ============================================================
// ABSTRACT FACTORY — Famille de composants UI par theme
// ============================================================

interface Button   { render(): string; onClick(): void; }
interface Checkbox { render(): string; toggle(): void; }

class DarkButton implements Button {
  render(): string { return '<button class="dark">Click</button>'; }
  onClick(): void  { console.log('[Dark] Button clicked'); }
}
class DarkCheckbox implements Checkbox {
  private checked = false;
  render(): string { return `<input type="checkbox" class="dark" ${this.checked ? 'checked' : ''} />`; }
  toggle(): void   { this.checked = !this.checked; }
}
class LightButton implements Button {
  render(): string { return '<button class="light">Click</button>'; }
  onClick(): void  { console.log('[Light] Button clicked'); }
}
class LightCheckbox implements Checkbox {
  private checked = false;
  render(): string { return `<input type="checkbox" class="light" ${this.checked ? 'checked' : ''} />`; }
  toggle(): void   { this.checked = !this.checked; }
}

// Factory abstraite — contrat pour créer une famille compatible
interface UIFactory {
  createButton(): Button;
  createCheckbox(): Checkbox;
}

class DarkThemeFactory implements UIFactory {
  createButton(): Button     { return new DarkButton(); }
  createCheckbox(): Checkbox { return new DarkCheckbox(); }
}
class LightThemeFactory implements UIFactory {
  createButton(): Button     { return new LightButton(); }
  createCheckbox(): Checkbox { return new LightCheckbox(); }
}

// Code client — ne connait que UIFactory, jamais les classes concretes
function buildLoginForm(factory: UIFactory): void {
  const btn = factory.createButton();
  const cb  = factory.createCheckbox();
  console.log(btn.render());
  console.log(cb.render());
}

const theme = 'dark' as 'dark' | 'light';
const factory: UIFactory = theme === 'dark' ? new DarkThemeFactory() : new LightThemeFactory();
buildLoginForm(factory);
// Changer de theme = changer de factory. Rien d'autre ne change.

// ============================================================
// PROTOTYPE — Clonage de configuration d'environnement
// ============================================================

interface Cloneable<T> {
  clone(): T;
}

class ServerConfig implements Cloneable<ServerConfig> {
  constructor(
    public host: string,
    public port: number,
    public timeout: number,
    public features: string[],
  ) {}

  clone(): ServerConfig {
    // Copie profonde : spread sur le tableau pour nouvelle reference
    return new ServerConfig(this.host, this.port, this.timeout, [...this.features]);
  }

  toString(): string {
    return `${this.host}:${this.port} (timeout:${this.timeout}ms, features:[${this.features}])`;
  }
}

const baseConfig    = new ServerConfig('localhost', 3000, 5000, ['auth', 'logging']);
const prodConfig    = baseConfig.clone();
prodConfig.host     = 'api.production.com';
prodConfig.port     = 443;
prodConfig.timeout  = 30000;
prodConfig.features.push('caching', 'metrics'); // modifie la copie, pas l'original

const stagingConfig = baseConfig.clone();
stagingConfig.host  = 'api.staging.com';
stagingConfig.features.push('debug');

console.log('Base:   ', baseConfig.toString());    // features: [auth, logging]
console.log('Prod:   ', prodConfig.toString());    // features: [auth, logging, caching, metrics]
console.log('Staging:', stagingConfig.toString()); // features: [auth, logging, debug]

// ============================================================
// BRIDGE — Renderer × Shape (deux axes independants)
// ============================================================

interface Renderer {
  renderCircle(x: number, y: number, radius: number): string;
  renderSquare(x: number, y: number, side: number): string;
}

class VectorRenderer implements Renderer {
  renderCircle(x: number, y: number, r: number): string {
    return `<circle cx="${x}" cy="${y}" r="${r}" /> (SVG)`;
  }
  renderSquare(x: number, y: number, s: number): string {
    return `<rect x="${x}" y="${y}" width="${s}" height="${s}" /> (SVG)`;
  }
}

class RasterRenderer implements Renderer {
  renderCircle(x: number, y: number, r: number): string {
    return `Circle at (${x},${y}) r=${r} (raster pixels)`;
  }
  renderSquare(x: number, y: number, s: number): string {
    return `Square at (${x},${y}) s=${s} (raster pixels)`;
  }
}

// L'abstraction tient une reference vers l'implementation — c'est le "pont"
abstract class Shape {
  constructor(protected renderer: Renderer) {}
  abstract draw(): string;
}

class Circle extends Shape {
  constructor(renderer: Renderer, private x: number, private y: number, private r: number) {
    super(renderer);
  }
  draw(): string { return this.renderer.renderCircle(this.x, this.y, this.r); }
}

class Square extends Shape {
  constructor(renderer: Renderer, private x: number, private y: number, private s: number) {
    super(renderer);
  }
  draw(): string { return this.renderer.renderSquare(this.x, this.y, this.s); }
}

// 4 combinaisons possibles, 0 explosion de classes
console.log(new Circle(new VectorRenderer(), 50, 50, 25).draw());
console.log(new Square(new RasterRenderer(), 10, 10, 40).draw());

// ============================================================
// COMPOSITE — Arborescence de menus
// ============================================================

interface MenuComponent {
  getName(): string;
  getPrice(): number;
  display(indent?: number): void;
}

// Feuille — pas d'enfants
class MenuItem implements MenuComponent {
  constructor(private name: string, private price: number) {}
  getName(): string   { return this.name; }
  getPrice(): number  { return this.price; }
  display(indent = 0): void {
    console.log(' '.repeat(indent) + `- ${this.name}: ${this.price}€`);
  }
}

// Composite — contient des MenuComponent (feuilles ET d'autres groupes)
class MenuGroup implements MenuComponent {
  private children: MenuComponent[] = [];
  constructor(private name: string) {}
  getName(): string   { return this.name; }
  getPrice(): number  { return this.children.reduce((s, c) => s + c.getPrice(), 0); }
  add(c: MenuComponent): void { this.children.push(c); }
  display(indent = 0): void {
    console.log(' '.repeat(indent) + `+ ${this.name} (total: ${this.getPrice()}€)`);
    this.children.forEach(child => child.display(indent + 2));
  }
}

const menu    = new MenuGroup('Menu complet');
const starters = new MenuGroup('Entrees');
starters.add(new MenuItem('Soupe', 5));
starters.add(new MenuItem('Salade', 7));
const mains = new MenuGroup('Plats');
mains.add(new MenuItem('Steak', 18));
const vegan = new MenuGroup('Options vegan');
vegan.add(new MenuItem('Tofu', 14));
mains.add(vegan);         // groupe dans groupe — recursion illimitee
menu.add(starters);
menu.add(mains);
menu.add(new MenuItem('Cafe', 3));
menu.display();

// ============================================================
// FLYWEIGHT — Foret avec des milliers d'arbres
// ============================================================

// Etat intrinseque — partage, immuable
class TreeType {
  constructor(
    public readonly name: string,
    public readonly color: string,
    public readonly texture: string,
  ) {}
  draw(x: number, y: number): void {
    console.log(`[${this.name}] (${x},${y}) color:${this.color}`);
  }
}

class TreeTypeFactory {
  private static cache = new Map<string, TreeType>();

  static get(name: string, color: string, texture: string): TreeType {
    const key = `${name}_${color}_${texture}`;
    if (!this.cache.has(key)) {
      this.cache.set(key, new TreeType(name, color, texture));
    }
    return this.cache.get(key)!;
  }

  static getCacheSize(): number { return this.cache.size; }
}

// Etat extrinsèque — unique par arbre (position)
class Tree {
  constructor(
    private x: number,
    private y: number,
    private type: TreeType, // reference partagee, pas une copie
  ) {}
  draw(): void { this.type.draw(this.x, this.y); }
}

class Forest {
  private trees: Tree[] = [];
  plant(x: number, y: number, name: string, color: string, texture: string): void {
    const type = TreeTypeFactory.get(name, color, texture);
    this.trees.push(new Tree(x, y, type));
  }
  draw(): void { this.trees.forEach(t => t.draw()); }
}

const forest = new Forest();
for (let i = 0; i < 5; i++) forest.plant(i * 10, i * 5, 'Oak',  'green',      'bark.png');
for (let i = 0; i < 3; i++) forest.plant(i * 15, i * 8, 'Pine', 'dark-green', 'pine.png');
console.log(`TreeTypes en cache: ${TreeTypeFactory.getCacheSize()}`); // 2, pas 8

// ============================================================
// ITERATOR — Parcours d'un arbre binaire de recherche
// ============================================================

class BSTNode<T> {
  left: BSTNode<T> | null = null;
  right: BSTNode<T> | null = null;
  constructor(public value: T) {}
}

class BinarySearchTree<T> {
  private root: BSTNode<T> | null = null;

  insert(value: T): void {
    const node = new BSTNode(value);
    if (!this.root) { this.root = node; return; }
    let cur = this.root;
    while (true) {
      if (value < cur.value) {
        if (!cur.left)  { cur.left = node; break; } else cur = cur.left;
      } else {
        if (!cur.right) { cur.right = node; break; } else cur = cur.right;
      }
    }
  }

  // Symbol.iterator : le client utilise for...of sans savoir que c'est un arbre
  [Symbol.iterator](): Iterator<T> {
    const stack: BSTNode<T>[] = [];
    let cur: BSTNode<T> | null = this.root;
    return {
      next(): IteratorResult<T> {
        // In-order (gauche → racine → droite) = résultat trié pour un BST
        while (cur || stack.length > 0) {
          while (cur) { stack.push(cur); cur = cur.left; }
          cur = stack.pop()!;
          const value = cur.value;
          cur = cur.right;
          return { value, done: false };
        }
        return { value: undefined as unknown as T, done: true };
      }
    };
  }
}

const bst = new BinarySearchTree<number>();
[5, 3, 8, 1, 4, 7, 9].forEach(n => bst.insert(n));
console.log([...bst]); // [1, 3, 4, 5, 7, 8, 9] — trié

// ============================================================
// CHAIN OF RESPONSIBILITY — Pipeline de validation HTTP
// ============================================================

interface HttpRequest { headers: Record<string, string>; body: Record<string, unknown>; }
interface HttpResponse { status: number; body: string; }

abstract class Middleware {
  private next: Middleware | null = null;

  setNext(m: Middleware): Middleware { this.next = m; return m; }

  handle(req: HttpRequest): HttpResponse {
    const result = this.process(req);
    if (result) return result;
    return this.next ? this.next.handle(req) : { status: 500, body: 'Pas de handler final' };
  }

  protected abstract process(req: HttpRequest): HttpResponse | null;
}

class AuthMiddleware extends Middleware {
  protected process(req: HttpRequest): HttpResponse | null {
    if (!req.headers['authorization']) return { status: 401, body: 'Non autorise' };
    return null;
  }
}

class RateLimitMiddleware extends Middleware {
  private counts = new Map<string, number>();
  protected process(req: HttpRequest): HttpResponse | null {
    const token = req.headers['authorization'] || 'anon';
    const count = (this.counts.get(token) || 0) + 1;
    this.counts.set(token, count);
    if (count > 100) return { status: 429, body: 'Trop de requetes' };
    return null;
  }
}

class ValidationMiddleware extends Middleware {
  protected process(req: HttpRequest): HttpResponse | null {
    if (!req.body || Object.keys(req.body).length === 0) return { status: 400, body: 'Body requis' };
    return null;
  }
}

class BusinessHandler extends Middleware {
  protected process(req: HttpRequest): HttpResponse | null {
    return { status: 200, body: 'Traite avec succes' };
  }
}

const auth = new AuthMiddleware();
auth.setNext(new RateLimitMiddleware()).setNext(new ValidationMiddleware()).setNext(new BusinessHandler());

console.log(auth.handle({ headers: { authorization: 'Bearer token' }, body: { action: 'go' } }));
console.log(auth.handle({ headers: {}, body: {} })); // 401

// ============================================================
// MEDIATOR — Salle de chat
// ============================================================

interface ChatMediator {
  sendMessage(message: string, from: ChatUser): void;
  addUser(user: ChatUser): void;
}

class ChatRoom implements ChatMediator {
  private users: ChatUser[] = [];
  addUser(u: ChatUser): void { this.users.push(u); }
  sendMessage(msg: string, from: ChatUser): void {
    this.users.filter(u => u !== from).forEach(u => u.receive(msg, from.name));
  }
}

class ChatUser {
  constructor(public readonly name: string, private mediator: ChatMediator) {
    mediator.addUser(this);
  }
  send(message: string): void    { this.mediator.sendMessage(message, this); }
  receive(msg: string, from: string): void {
    console.log(`${this.name} reçoit de ${from}: "${msg}"`);
  }
}

const room  = new ChatRoom();
const alice = new ChatUser('Alice', room);
const bob   = new ChatUser('Bob', room);
const carol = new ChatUser('Carol', room);
alice.send('Bonjour !');
// Alice et Bob ne se connaissent pas directement — tout passe par ChatRoom

// ============================================================
// MEMENTO — Undo/Redo d'un editeur de texte
// ============================================================

class EditorMemento {
  constructor(
    private readonly content: string,
    private readonly cursorPos: number,
  ) {}
  getContent(): string   { return this.content; }
  getCursorPos(): number { return this.cursorPos; }
}

class TextEditor {
  private content   = '';
  private cursorPos = 0;

  type(text: string): void {
    this.content   = this.content.slice(0, this.cursorPos) + text + this.content.slice(this.cursorPos);
    this.cursorPos += text.length;
  }

  delete(chars: number): void {
    this.content   = this.content.slice(0, this.cursorPos - chars) + this.content.slice(this.cursorPos);
    this.cursorPos = Math.max(0, this.cursorPos - chars);
  }

  save(): EditorMemento             { return new EditorMemento(this.content, this.cursorPos); }
  restore(m: EditorMemento): void   { this.content = m.getContent(); this.cursorPos = m.getCursorPos(); }
  getState(): string                { return `"${this.content}" (cursor:${this.cursorPos})`; }
}

class EditorHistory {
  private undoStack: EditorMemento[] = [];
  private redoStack: EditorMemento[] = [];

  save(e: TextEditor): void  { this.undoStack.push(e.save()); this.redoStack = []; }
  undo(e: TextEditor): void  {
    if (!this.undoStack.length) return;
    this.redoStack.push(e.save());
    e.restore(this.undoStack.pop()!);
  }
  redo(e: TextEditor): void  {
    if (!this.redoStack.length) return;
    this.undoStack.push(e.save());
    e.restore(this.redoStack.pop()!);
  }
}

const editor  = new TextEditor();
const history = new EditorHistory();

history.save(editor);
editor.type('Bonjour');
history.save(editor);
editor.type(' le monde');
history.save(editor);
editor.delete(6);
console.log(editor.getState()); // "Bonjour le"

history.undo(editor);
console.log(editor.getState()); // "Bonjour le monde"
history.undo(editor);
console.log(editor.getState()); // "Bonjour"
history.redo(editor);
console.log(editor.getState()); // "Bonjour le monde"

// ============================================================
// TEMPLATE METHOD — Pipeline d'extraction de donnees
// ============================================================

interface ParsedRecord { [key: string]: string | number; }

abstract class DataMiner {
  // Methode template — squelette fixe, ne pas surcharger
  mine(rawData: string): ParsedRecord[] {
    const opened   = this.openData(rawData);
    const rows     = this.extractData(opened);
    const records  = this.parseData(rows);
    const analyzed = this.analyzeData(records);
    this.closeData();
    return analyzed;
  }

  protected closeData(): void { console.log('[DataMiner] Ressources liberees'); }

  protected abstract openData(raw: string): string;
  protected abstract extractData(data: string): string[];
  protected abstract parseData(rows: string[]): ParsedRecord[];
  protected abstract analyzeData(records: ParsedRecord[]): ParsedRecord[];
}

class CsvDataMiner extends DataMiner {
  protected openData(raw: string): string       { console.log('[CSV] Ouverture'); return raw; }
  protected extractData(data: string): string[] { return data.trim().split('\n'); }
  protected parseData(rows: string[]): ParsedRecord[] {
    const headers = rows[0].split(',');
    return rows.slice(1).map(row => {
      const vals = row.split(',');
      return Object.fromEntries(headers.map((h, i) => [h.trim(), vals[i]?.trim() ?? '']));
    });
  }
  protected analyzeData(records: ParsedRecord[]): ParsedRecord[] {
    console.log(`[CSV] ${records.length} enregistrements`);
    return records;
  }
}

class JsonDataMiner extends DataMiner {
  protected openData(raw: string): string          { console.log('[JSON] Ouverture'); return raw; }
  protected extractData(data: string): string[]    {
    const parsed = JSON.parse(data);
    return (Array.isArray(parsed) ? parsed : [parsed]).map((r: unknown) => JSON.stringify(r));
  }
  protected parseData(rows: string[]): ParsedRecord[] { return rows.map(r => JSON.parse(r)); }
  protected analyzeData(records: ParsedRecord[]): ParsedRecord[] {
    console.log(`[JSON] ${records.length} enregistrements`);
    return records;
  }
}

console.log(new CsvDataMiner().mine('name,age\nAlice,30\nBob,25'));
console.log(new JsonDataMiner().mine('[{"name":"Alice","age":30},{"name":"Bob","age":25}]'));

// ============================================================
// VISITOR — Export multi-formats d'un document
// ============================================================

interface DocumentVisitor {
  visitHeading(node: HeadingNode): string;
  visitParagraph(node: ParagraphNode): string;
  visitCodeBlock(node: CodeBlockNode): string;
}

interface DocumentNode {
  accept(visitor: DocumentVisitor): string;
}

class HeadingNode implements DocumentNode {
  constructor(public readonly text: string, public readonly level: 1 | 2 | 3) {}
  accept(v: DocumentVisitor): string { return v.visitHeading(this); }
}

class ParagraphNode implements DocumentNode {
  constructor(public readonly text: string) {}
  accept(v: DocumentVisitor): string { return v.visitParagraph(this); }
}

class CodeBlockNode implements DocumentNode {
  constructor(public readonly code: string, public readonly language: string) {}
  accept(v: DocumentVisitor): string { return v.visitCodeBlock(this); }
}

class HtmlExporter implements DocumentVisitor {
  visitHeading(n: HeadingNode): string   { return `<h${n.level}>${n.text}</h${n.level}>`; }
  visitParagraph(n: ParagraphNode): string { return `<p>${n.text}</p>`; }
  visitCodeBlock(n: CodeBlockNode): string { return `<pre><code class="${n.language}">${n.code}</code></pre>`; }
}

class MarkdownExporter implements DocumentVisitor {
  visitHeading(n: HeadingNode): string     { return `${'#'.repeat(n.level)} ${n.text}`; }
  visitParagraph(n: ParagraphNode): string { return n.text; }
  visitCodeBlock(n: CodeBlockNode): string { return `\`\`\`${n.language}\n${n.code}\n\`\`\``; }
}

const doc: DocumentNode[] = [
  new HeadingNode('Design Patterns', 1),
  new ParagraphNode('Les patterns sont des solutions reutilisables.'),
  new CodeBlockNode('const x = new Factory().create();', 'typescript'),
];

function exportDoc(nodes: DocumentNode[], visitor: DocumentVisitor): string {
  return nodes.map(n => n.accept(visitor)).join('\n');
}

console.log(exportDoc(doc, new HtmlExporter()));
console.log(exportDoc(doc, new MarkdownExporter()));
// Ajouter PlainTextExporter → zero modification sur HeadingNode, ParagraphNode, CodeBlockNode
```

---

## Résumé

**5 patterns creationnels** — comment créer :
- **Factory** : centralise la création selon un type connu à l'exécution
- **Abstract Factory** : crée des familles d'objets compatibles garantissant la cohérence
- **Builder** : construit des objets complexes étape par étape via chaînage fluent
- **Prototype** : clone des objets existants pour éviter une construction coûteuse
- **Singleton** : instance unique — à éviter au profit de l'injection de dépendances

**7 patterns structurels** — comment assembler :
- **Adapter** : pont entre deux interfaces incompatibles
- **Bridge** : sépare abstraction et implémentation pour deux axes d'évolution indépendants
- **Composite** : traite feuilles et compositions uniformément (structures récursives)
- **Decorator** : ajoute des comportements dynamiquement sans héritage
- **Facade** : interface simple sur un sous-système complexe
- **Flyweight** : partage l'état commun pour économiser la mémoire sur de nombreux objets
- **Proxy** : contrôle l'accès à un objet (lazy loading, cache, sécurité)

**11 patterns comportementaux** — comment communiquer :
- **Chain of Responsibility** : chaîne de handlers jusqu'à ce que l'un traite
- **Command** : encapsule une action comme objet (undo, queue, log)
- **Iterator** : parcours de collection sans exposer la structure interne
- **Mediator** : réduit le couplage entre objets via un coordinateur central
- **Memento** : capture et restaure l'état sans violer l'encapsulation (undo/redo)
- **Observer** : notifie des abonnés quand l'état change (découplage émetteur/récepteur)
- **State** : change le comportement selon l'état — remplace les if/else imbriqués
- **Strategy** : rend les algorithmes interchangeables à l'exécution
- **Template Method** : squelette d'algorithme dans la classe de base, étapes dans les sous-classes
- **Visitor** : ajoute des opérations à des objets sans modifier leurs classes (double dispatch)

**Règle universelle** : un pattern mal choisi est pire que pas de pattern. Utilise-les quand le problème qu'ils résolvent est réel dans ton code — pas pour les montrer.


---

> **Lien fil rouge — ShopArch**
>
> - Identifie quel pattern utiliser pour la création de notifications ShopArch (Factory)
> - Applique Strategy au calcul de prix (normal, promo, wholesale)
> - Exercice(s) associé(s) : `exercices/02-identifier-patterns/`
> - Checkpoint : Module 00, critère 3

## Ressources pour approfondir

### Les 23 patterns GoF en JavaScript

Ce cours couvre les 12 patterns les plus utiles en pratique. Pour explorer les 11 restants (Abstract Factory, Prototype, Bridge, Composite, Flyweight, Iterator, Chain of Responsibility, Mediator, Memento, Template Method, Visitor) :

- **[refactoring.guru/fr/design-patterns/catalog](https://refactoring.guru/fr/design-patterns/catalog)** — Catalogue complet des 23 patterns GoF en français, avec exemples TypeScript. Le meilleur référentiel théorique : chaque fiche décrit le problème, la solution, le diagramme UML et les cas d'usage. Commence par les patterns que tu ne connais pas encore.

- **[patterns.dev](https://patterns.dev)** — Design patterns en JavaScript moderne (ES6+), rendering patterns (SSR, SSG, Islands) et performance patterns. Plus pragmatique que refactoring.guru, orienté web et React. Complémentaire : refactoring.guru pour la théorie, patterns.dev pour la mise en pratique JS.

> **Conseil** : pour chaque pattern de ce cours, lis la fiche correspondante sur refactoring.guru après la pratique. Tu verras les variantes et les pièges que l'on n'a pas abordés ici.

---

## Prochain cours

[04 — Principes de clean code](./04-principes-clean-code.md)

> Dans le prochain cours, nous verrons les principes qui guident l'écriture d'un code lisible, maintenable et évolutif : DRY, KISS, YAGNI, SoC, Loi de Demeter, Composition vs Héritage, Fail Fast. Mais aussi quand ces principes ne s'appliquent PAS et comment reconnaitre les code smells courants.
