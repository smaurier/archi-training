# Exercice 06 — Patterns Comportementaux (Débutant)

> 🟢 **Difficulté** : Débutant | **Temps estimé** : 5h | **Ère** : 1 — Les Fondations
>
> **Prérequis** : cours `03-design-patterns-essentiels.md` — section Comportementaux

## Objectif

Implémenter les 11 patterns comportementaux sur des scénarios simples. Chaque partie est indépendante.

---

## Partie 1 — Chain of Responsibility (25 min)

### Scénario : Escalade de tickets support

Un ticket support arrive. Niveau 1 tente de résoudre. Si le problème est trop complexe, il escalade au Niveau 2, puis au Manager.

### Instructions

1. Crée la classe `SupportTicket` :
   ```typescript
   class SupportTicket {
     constructor(
       public readonly description: string,
       public readonly priority: 'low' | 'medium' | 'high' | 'critical',
     ) {}
   }
   ```

2. Crée la classe abstraite `SupportHandler` :
   - Propriété `private next: SupportHandler | null = null`
   - Méthode `setNext(handler): this` (retourne `this` pour le chaînage)
   - Méthode `handle(ticket): void` — appelle `process()` ou délègue au suivant
   - Méthode abstraite `protected process(ticket): boolean` — retourne `true` si traité

3. Crée 3 handlers :
   - `Level1Support` : traite `low` et `medium`
   - `Level2Support` : traite `high`
   - `ManagerSupport` : traite `critical` (et tout ce qui lui parvient)

4. Chaîne-les et teste avec des tickets de différentes priorités.

**Question** : Que se passe-t-il si aucun handler ne peut traiter la requête ?

---

## Partie 2 — Command (30 min)

### Scénario : Éditeur de texte avec Undo

Un éditeur de texte simple avec des commandes qui peuvent être annulées (undo).

### Instructions

1. Interface `Command` :
   ```typescript
   interface Command {
     execute(): void;
     undo(): void;
   }
   ```

2. Classe `TextDocument` (le "receiver") :
   ```typescript
   class TextDocument {
     private content = '';
     getContent(): string { return this.content; }
     append(text: string): void { this.content += text; }
     deleteLast(chars: number): void { this.content = this.content.slice(0, -chars); }
   }
   ```

3. Crée `AppendCommand` qui implémente `Command` :
   - `execute()` appelle `doc.append(text)`
   - `undo()` appelle `doc.deleteLast(text.length)`

4. Crée `CommandHistory` :
   - `execute(cmd: Command)` : exécute et empile
   - `undo()` : dépile et annule

5. Teste : ajoute "Bonjour", ajoute " monde", undo, undo.

**Question** : Comment étendre ce système pour ajouter une commande `DeleteCommand` ?

---

## Partie 3 — Iterator (25 min)

### Scénario : Itérateur de plage de nombres

Un objet `Range(start, end, step)` qui peut s'itérer avec `for...of`.

### Instructions

1. Crée la classe `Range` :
   ```typescript
   class Range {
     constructor(
       private start: number,
       private end: number,
       private step: number = 1,
     ) {}
   }
   ```

2. Implémente `[Symbol.iterator]()` pour retourner un `Iterator<number>` qui produit les nombres de `start` à `end` (exclu) par pas de `step`.

3. Teste :
   ```typescript
   for (const n of new Range(1, 10))       console.log(n); // 1 2 3 ... 9
   for (const n of new Range(0, 20, 5))    console.log(n); // 0 5 10 15
   console.log([...new Range(1, 6)]);       // [1, 2, 3, 4, 5]
   ```

4. Bonus : Crée un `generator` équivalent avec `function*`.

**Question** : Quelle est la différence entre `Iterator` et `Iterable` en TypeScript ?

---

## Partie 4 — Mediator (30 min)

### Scénario : Salle d'enchères

Des acheteurs enchérissent. Quand un acheteur fait une offre, le médiateur (la salle) avertit tous les autres — sans qu'ils se connaissent directement.

### Instructions

1. Interface `AuctionMediator` :
   ```typescript
   interface AuctionMediator {
     registerBidder(bidder: Bidder): void;
     placeBid(amount: number, from: Bidder): void;
   }
   ```

2. Classe `Bidder` :
   - Constructeur : `name`, `mediator: AuctionMediator`
   - `bid(amount: number)` : appelle `mediator.placeBid(amount, this)`
   - `notifyBid(amount: number, from: string)` : affiche qu'un autre a enchéri

3. Classe `AuctionRoom implements AuctionMediator` :
   - Garde la liste des `Bidder` enregistrés
   - `placeBid()` : enregistre l'offre la plus haute, notifie tous SAUF l'auteur

4. Teste avec 3 acheteurs qui enchérissent à tour de rôle.

**Question** : Combien de liens directs existeraient entre 5 acheteurs sans Mediator ?

---

## Partie 5 — Memento (25 min)

### Scénario : Calculatrice avec historique

Une calculatrice peut annuler sa dernière opération.

### Instructions

1. Crée `CalculatorMemento` :
   ```typescript
   class CalculatorMemento {
     constructor(private readonly value: number) {}
     getValue(): number { return this.value; }
   }
   ```

2. Crée `Calculator` (Originator) :
   - Propriété privée `value = 0`
   - Méthodes : `add(n)`, `multiply(n)`, `getResult(): number`
   - `save(): CalculatorMemento` — snapshot de l'état
   - `restore(m: CalculatorMemento)` — restaure

3. Crée `CalculatorHistory` (Caretaker) :
   - `save(calc)` : appelle `calc.save()` et empile
   - `undo(calc)` : dépile et appelle `calc.restore()`

4. Teste : 5 + 3, sauvegarde, × 4, sauvegarde, undo, undo.

---

## Partie 6 — Observer (25 min)

### Scénario : Prix d'actions en temps réel

Une action boursière notifie automatiquement ses abonnés quand son prix change.

### Instructions

1. Interface `StockObserver` :
   ```typescript
   interface StockObserver {
     onPriceChange(symbol: string, price: number): void;
   }
   ```

2. Crée `Stock` :
   - `name`, `price` privés
   - `subscribe(observer)`, `unsubscribe(observer)`
   - `setPrice(price)` : change le prix, notifie tous les abonnés

3. Crée 2 observers :
   - `PriceLogger` : affiche `[LOG] <symbol>: <price>€`
   - `PriceAlert` : affiche une alerte si le prix dépasse un seuil configuré

4. Teste : abonne les deux, change le prix 3 fois, désabonne le Logger, change encore.

---

## Partie 7 — State (30 min)

### Scénario : Feu de circulation

Un feu passe par les états RED → GREEN → YELLOW → RED. Chaque état sait vers quel état passer ensuite.

### Instructions

1. Interface `TrafficLightState` :
   ```typescript
   interface TrafficLightState {
     getColor(): string;
     next(light: TrafficLight): void;
   }
   ```

2. Crée `TrafficLight` :
   - `private state: TrafficLightState`
   - `setState(state)`, `getColor(): string`, `next(): void` (délègue à `state.next(this)`)

3. Crée 3 états : `RedState`, `GreenState`, `YellowState`.
   - `RedState.next(light)`    → `light.setState(new GreenState())`
   - `GreenState.next(light)`  → `light.setState(new YellowState())`
   - `YellowState.next(light)` → `light.setState(new RedState())`

4. Boucle 6 fois en appelant `next()` et affiche la couleur.

**Question** : Qu'est-ce qui changerait si tu gérias ça avec des `if/else` au lieu du pattern State ?

---

## Partie 8 — Strategy (20 min)

### Scénario : Algorithmes de tri interchangeables

Un tableau de mots peut être trié alphabétiquement, par longueur, ou par ordre inverse.

### Instructions

1. Interface `SortStrategy<T>` :
   ```typescript
   interface SortStrategy<T> {
     sort(data: T[]): T[];
   }
   ```

2. Crée 3 strategies pour `string[]` :
   - `AlphabeticalSort` : `localeCompare`
   - `LengthSort` : par longueur croissante
   - `ReverseSort` : inverse

3. Crée `Sorter<T>` :
   - `constructor(private strategy: SortStrategy<T>)`
   - `setStrategy(strategy)` : change la stratégie
   - `sort(data: T[]): T[]` : délègue à la stratégie

4. Teste avec `['banane', 'pomme', 'kiwi', 'fraise', 'abricot']`.

**Question** : Comment choisiriez-tu la strategy à utiliser dans une vraie app (selon quel critère) ?

---

## Partie 9 — Template Method (30 min)

### Scénario : Générateur de rapports

Deux formats de rapport : texte et HTML. La structure est toujours la même : en-tête, contenu, pied de page. Seul le formatage change.

### Instructions

1. Classe abstraite `ReportGenerator` :
   ```typescript
   abstract class ReportGenerator {
     // Méthode template — ne pas surcharger
     generate(title: string, data: string[]): string {
       return [
         this.generateHeader(title),
         this.generateBody(data),
         this.generateFooter(),
       ].join('\n');
     }
     protected abstract generateHeader(title: string): string;
     protected abstract generateBody(data: string[]): string;
     protected abstract generateFooter(): string;
   }
   ```

2. Crée `TextReportGenerator` :
   - Header : `=== <title> ===`
   - Body : chaque item sur une ligne avec `- `
   - Footer : `=== Fin du rapport ===`

3. Crée `HtmlReportGenerator` :
   - Header : `<h1><title></h1>`
   - Body : `<ul><li>...</li></ul>`
   - Footer : `<footer>Rapport généré le <date></footer>`

4. Génère le même rapport avec les deux formats.

---

## Partie 10 — Visitor (35 min)

### Scénario : Formes géométriques avec plusieurs opérations

Tu as des formes (Circle, Rectangle, Triangle). Tu veux calculer leur aire ET les exporter en SVG — sans modifier les classes de formes.

### Instructions

1. Interface `ShapeVisitor` :
   ```typescript
   interface ShapeVisitor {
     visitCircle(s: Circle): string;
     visitRectangle(s: Rectangle): string;
     visitTriangle(s: Triangle): string;
   }
   ```

2. Interface `Shape` :
   ```typescript
   interface Shape {
     accept(visitor: ShapeVisitor): string;
   }
   ```

3. Crée les 3 formes (propriétés publiques pour la simplicité) :
   - `Circle` avec `radius`
   - `Rectangle` avec `width` et `height`
   - `Triangle` avec `base` et `height`
   - Chacune implémente `accept(visitor)` → `visitor.visitXxx(this)`

4. Crée `AreaCalculatorVisitor` qui calcule l'aire :
   - Cercle : `π × r²`
   - Rectangle : `w × h`
   - Triangle : `(b × h) / 2`

5. Crée `SvgExporterVisitor` qui produit du SVG simplifié :
   - Cercle : `<circle r="<radius>" />`
   - Rectangle : `<rect width="<w>" height="<h>" />`
   - Triangle : `<polygon points="..." />` (simplifié)

6. Teste avec une liste de formes mixtes.

**Question** : Ajouter `PerimeterCalculatorVisitor` — combien de classes dois-tu modifier ?
