# Correction — Exercice 06 : Patterns Comportementaux

## Partie 1 — Chain of Responsibility

```typescript
class SupportTicket {
  constructor(
    public readonly description: string,
    public readonly priority: 'low' | 'medium' | 'high' | 'critical',
  ) {}
}

abstract class SupportHandler {
  private next: SupportHandler | null = null;

  setNext(handler: SupportHandler): SupportHandler {
    this.next = handler;
    return handler; // chaînage : a.setNext(b).setNext(c)
  }

  handle(ticket: SupportTicket): void {
    if (this.process(ticket)) return;
    if (this.next) {
      this.next.handle(ticket);
    } else {
      console.log(`[ESCALADE] Aucun handler pour: ${ticket.description}`);
    }
  }

  protected abstract process(ticket: SupportTicket): boolean;
}

class Level1Support extends SupportHandler {
  protected process(ticket: SupportTicket): boolean {
    if (['low', 'medium'].includes(ticket.priority)) {
      console.log(`[Niveau 1] Résolu: ${ticket.description} (${ticket.priority})`);
      return true;
    }
    console.log(`[Niveau 1] Escalade: ${ticket.priority} trop complexe`);
    return false;
  }
}

class Level2Support extends SupportHandler {
  protected process(ticket: SupportTicket): boolean {
    if (ticket.priority === 'high') {
      console.log(`[Niveau 2] Résolu: ${ticket.description}`);
      return true;
    }
    console.log(`[Niveau 2] Escalade: critique → manager`);
    return false;
  }
}

class ManagerSupport extends SupportHandler {
  protected process(ticket: SupportTicket): boolean {
    console.log(`[Manager] Pris en charge: ${ticket.description} (${ticket.priority})`);
    return true;
  }
}

const level1 = new Level1Support();
level1.setNext(new Level2Support()).setNext(new ManagerSupport());

level1.handle(new SupportTicket('Mot de passe oublié', 'low'));
level1.handle(new SupportTicket('Bug d\'affichage', 'medium'));
level1.handle(new SupportTicket('Fuite mémoire', 'high'));
level1.handle(new SupportTicket('Perte de données prod', 'critical'));
```

**Réponse** : Si aucun handler ne traite, la chaîne atteint la fin. À implémenter : soit un handler "fallback" obligatoire en bout de chaîne (ManagerSupport ici), soit logger un warning si `this.next` est null.

---

## Partie 2 — Command

```typescript
interface Command {
  execute(): void;
  undo(): void;
}

class TextDocument {
  private content = '';
  getContent(): string            { return this.content; }
  append(text: string): void      { this.content += text; }
  deleteLast(chars: number): void { this.content = this.content.slice(0, -chars || undefined); }
}

class AppendCommand implements Command {
  constructor(
    private readonly doc: TextDocument,
    private readonly text: string,
  ) {}

  execute(): void { this.doc.append(this.text); }
  undo(): void    { this.doc.deleteLast(this.text.length); }
}

class CommandHistory {
  private history: Command[] = [];

  execute(cmd: Command): void {
    cmd.execute();
    this.history.push(cmd);
  }

  undo(): void {
    const cmd = this.history.pop();
    if (cmd) {
      cmd.undo();
    } else {
      console.log('Rien à annuler');
    }
  }
}

const doc     = new TextDocument();
const history = new CommandHistory();

history.execute(new AppendCommand(doc, 'Bonjour'));
console.log(doc.getContent()); // "Bonjour"

history.execute(new AppendCommand(doc, ' monde'));
console.log(doc.getContent()); // "Bonjour monde"

history.undo();
console.log(doc.getContent()); // "Bonjour"

history.undo();
console.log(doc.getContent()); // ""
```

**Extension avec DeleteCommand** :
```typescript
class DeleteCommand implements Command {
  private deleted = '';

  constructor(private readonly doc: TextDocument, private readonly chars: number) {}

  execute(): void {
    const content = this.doc.getContent();
    this.deleted = content.slice(-this.chars); // mémorise ce qui est supprimé
    this.doc.deleteLast(this.chars);
  }

  undo(): void { this.doc.append(this.deleted); }
}
```

---

## Partie 3 — Iterator

```typescript
class Range {
  constructor(
    private start: number,
    private end: number,
    private step: number = 1,
  ) {}

  [Symbol.iterator](): Iterator<number> {
    let current = this.start;
    const { end, step } = this;

    return {
      next(): IteratorResult<number> {
        if (current < end) {
          const value = current;
          current += step;
          return { value, done: false };
        }
        return { value: 0, done: true };
      }
    };
  }
}

for (const n of new Range(1, 10))    process.stdout.write(n + ' '); // 1 2 3 4 5 6 7 8 9
console.log();
for (const n of new Range(0, 20, 5)) process.stdout.write(n + ' '); // 0 5 10 15
console.log();
console.log([...new Range(1, 6)]);   // [1, 2, 3, 4, 5]

// Bonus — version generator
function* rangeGenerator(start: number, end: number, step = 1): Generator<number> {
  for (let i = start; i < end; i += step) {
    yield i;
  }
}
console.log([...rangeGenerator(1, 6)]); // [1, 2, 3, 4, 5]
```

**Réponse** : `Iterable<T>` est un objet qui a `[Symbol.iterator](): Iterator<T>`. `Iterator<T>` est l'objet avec `next(): IteratorResult<T>`. Un `Iterable` produit des `Iterator`. `for...of` appelle `[Symbol.iterator]()` automatiquement.

---

## Partie 4 — Mediator

```typescript
interface AuctionMediator {
  registerBidder(bidder: Bidder): void;
  placeBid(amount: number, from: Bidder): void;
}

class Bidder {
  constructor(
    public readonly name: string,
    private mediator: AuctionMediator,
  ) {
    mediator.registerBidder(this);
  }

  bid(amount: number): void {
    console.log(`[${this.name}] Enchère: ${amount}€`);
    this.mediator.placeBid(amount, this);
  }

  notifyBid(amount: number, from: string): void {
    console.log(`  → ${this.name} notifié: ${from} a enchéri ${amount}€`);
  }
}

class AuctionRoom implements AuctionMediator {
  private bidders: Bidder[] = [];
  private highestBid = 0;
  private highestBidder = '';

  registerBidder(bidder: Bidder): void {
    this.bidders.push(bidder);
  }

  placeBid(amount: number, from: Bidder): void {
    if (amount <= this.highestBid) {
      console.log(`  [Salle] Offre refusée — actuelle: ${this.highestBid}€`);
      return;
    }
    this.highestBid    = amount;
    this.highestBidder = from.name;
    this.bidders
      .filter(b => b !== from)
      .forEach(b => b.notifyBid(amount, from.name));
  }
}

const room  = new AuctionRoom();
const alice = new Bidder('Alice', room);
const bob   = new Bidder('Bob', room);
const carol = new Bidder('Carol', room);

alice.bid(100);
bob.bid(150);
carol.bid(120); // refusé
alice.bid(200);
```

**Réponse** : 5 acheteurs sans Mediator = 5×4/2 = **10 liens directs** (chaque paire). Avec Mediator : **5 liens** (chacun → médiateur).

---

## Partie 5 — Memento

```typescript
class CalculatorMemento {
  constructor(private readonly value: number) {}
  getValue(): number { return this.value; }
}

class Calculator {
  private value = 0;

  add(n: number): void       { this.value += n; }
  multiply(n: number): void  { this.value *= n; }
  getResult(): number        { return this.value; }

  save(): CalculatorMemento              { return new CalculatorMemento(this.value); }
  restore(m: CalculatorMemento): void    { this.value = m.getValue(); }
}

class CalculatorHistory {
  private stack: CalculatorMemento[] = [];

  save(calc: Calculator): void  { this.stack.push(calc.save()); }
  undo(calc: Calculator): void  {
    const m = this.stack.pop();
    if (m) calc.restore(m);
    else console.log('Rien à annuler');
  }
}

const calc    = new Calculator();
const history = new CalculatorHistory();

history.save(calc);
calc.add(5);
console.log(calc.getResult()); // 5

history.save(calc);
calc.add(3);
console.log(calc.getResult()); // 8

history.save(calc);
calc.multiply(4);
console.log(calc.getResult()); // 32

history.undo(calc);
console.log(calc.getResult()); // 8

history.undo(calc);
console.log(calc.getResult()); // 5
```

---

## Partie 6 — Observer

```typescript
interface StockObserver {
  onPriceChange(symbol: string, price: number): void;
}

class Stock {
  private observers: StockObserver[] = [];
  private price: number;

  constructor(private readonly name: string, initialPrice: number) {
    this.price = initialPrice;
  }

  subscribe(observer: StockObserver): void   { this.observers.push(observer); }
  unsubscribe(observer: StockObserver): void {
    this.observers = this.observers.filter(o => o !== observer);
  }

  setPrice(price: number): void {
    this.price = price;
    this.observers.forEach(o => o.onPriceChange(this.name, price));
  }
}

class PriceLogger implements StockObserver {
  onPriceChange(symbol: string, price: number): void {
    console.log(`[LOG] ${symbol}: ${price}€`);
  }
}

class PriceAlert implements StockObserver {
  constructor(private readonly threshold: number) {}

  onPriceChange(symbol: string, price: number): void {
    if (price > this.threshold) {
      console.log(`[ALERT] ${symbol} a dépassé ${this.threshold}€ — prix actuel: ${price}€`);
    }
  }
}

const appleStock = new Stock('AAPL', 150);
const logger = new PriceLogger();
const alert  = new PriceAlert(170);

appleStock.subscribe(logger);
appleStock.subscribe(alert);

appleStock.setPrice(165); // log + pas d'alerte
appleStock.setPrice(175); // log + alerte
appleStock.setPrice(180); // log + alerte

appleStock.unsubscribe(logger);
appleStock.setPrice(190); // alerte seulement
```

---

## Partie 7 — State

```typescript
interface TrafficLightState {
  getColor(): string;
  next(light: TrafficLight): void;
}

class TrafficLight {
  private state: TrafficLightState;

  constructor() {
    this.state = new RedState();
  }

  setState(state: TrafficLightState): void { this.state = state; }
  getColor(): string                        { return this.state.getColor(); }
  next(): void                              { this.state.next(this); }
}

class RedState implements TrafficLightState {
  getColor(): string              { return 'ROUGE'; }
  next(light: TrafficLight): void { light.setState(new GreenState()); }
}

class GreenState implements TrafficLightState {
  getColor(): string              { return 'VERT'; }
  next(light: TrafficLight): void { light.setState(new YellowState()); }
}

class YellowState implements TrafficLightState {
  getColor(): string              { return 'ORANGE'; }
  next(light: TrafficLight): void { light.setState(new RedState()); }
}

const light = new TrafficLight();
for (let i = 0; i < 6; i++) {
  console.log(light.getColor());
  light.next();
}
// ROUGE, VERT, ORANGE, ROUGE, VERT, ORANGE
```

**Réponse** : Sans State, `next()` serait `if (this.color === 'red') this.color = 'green'; else if (this.color === 'green') this.color = 'yellow'; ...`. Ajouter un état "clignotant" = modifier ce switch partout. Avec State, tu crées une classe `BlinkingState` et les transitions existantes ne changent pas.

---

## Partie 8 — Strategy

```typescript
interface SortStrategy<T> {
  sort(data: T[]): T[];
}

class AlphabeticalSort implements SortStrategy<string> {
  sort(data: string[]): string[] { return [...data].sort((a, b) => a.localeCompare(b)); }
}

class LengthSort implements SortStrategy<string> {
  sort(data: string[]): string[] { return [...data].sort((a, b) => a.length - b.length); }
}

class ReverseSort implements SortStrategy<string> {
  sort(data: string[]): string[] { return [...data].reverse(); }
}

class Sorter<T> {
  constructor(private strategy: SortStrategy<T>) {}
  setStrategy(strategy: SortStrategy<T>): void { this.strategy = strategy; }
  sort(data: T[]): T[] { return this.strategy.sort(data); }
}

const fruits = ['banane', 'pomme', 'kiwi', 'fraise', 'abricot'];
const sorter = new Sorter<string>(new AlphabeticalSort());

console.log(sorter.sort(fruits)); // abricot, banane, fraise, kiwi, pomme

sorter.setStrategy(new LengthSort());
console.log(sorter.sort(fruits)); // kiwi, pomme, fraise, banane, abricot

sorter.setStrategy(new ReverseSort());
console.log(sorter.sort(fruits)); // abricot, fraise, kiwi, pomme, banane
```

---

## Partie 9 — Template Method

```typescript
abstract class ReportGenerator {
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

class TextReportGenerator extends ReportGenerator {
  protected generateHeader(title: string): string {
    return `=== ${title} ===`;
  }
  protected generateBody(data: string[]): string {
    return data.map(item => `- ${item}`).join('\n');
  }
  protected generateFooter(): string {
    return '=== Fin du rapport ===';
  }
}

class HtmlReportGenerator extends ReportGenerator {
  protected generateHeader(title: string): string {
    return `<h1>${title}</h1>`;
  }
  protected generateBody(data: string[]): string {
    const items = data.map(item => `  <li>${item}</li>`).join('\n');
    return `<ul>\n${items}\n</ul>`;
  }
  protected generateFooter(): string {
    return `<footer>Rapport généré le ${new Date().toLocaleDateString('fr-FR')}</footer>`;
  }
}

const data = ['Chiffre d\'affaires: 125 000€', 'Nouveaux clients: 42', 'Taux de rétention: 87%'];

console.log(new TextReportGenerator().generate('Rapport Q4 2025', data));
console.log('---');
console.log(new HtmlReportGenerator().generate('Rapport Q4 2025', data));
```

---

## Partie 10 — Visitor

```typescript
interface ShapeVisitor {
  visitCircle(s: Circle): string;
  visitRectangle(s: Rectangle): string;
  visitTriangle(s: Triangle): string;
}

interface Shape {
  accept(visitor: ShapeVisitor): string;
}

class Circle implements Shape {
  constructor(public readonly radius: number) {}
  accept(visitor: ShapeVisitor): string { return visitor.visitCircle(this); }
}

class Rectangle implements Shape {
  constructor(public readonly width: number, public readonly height: number) {}
  accept(visitor: ShapeVisitor): string { return visitor.visitRectangle(this); }
}

class Triangle implements Shape {
  constructor(public readonly base: number, public readonly height: number) {}
  accept(visitor: ShapeVisitor): string { return visitor.visitTriangle(this); }
}

class AreaCalculatorVisitor implements ShapeVisitor {
  visitCircle(s: Circle): string {
    return `Circle area: ${(Math.PI * s.radius ** 2).toFixed(2)}`;
  }
  visitRectangle(s: Rectangle): string {
    return `Rectangle area: ${s.width * s.height}`;
  }
  visitTriangle(s: Triangle): string {
    return `Triangle area: ${(s.base * s.height) / 2}`;
  }
}

class SvgExporterVisitor implements ShapeVisitor {
  visitCircle(s: Circle): string {
    return `<circle r="${s.radius}" />`;
  }
  visitRectangle(s: Rectangle): string {
    return `<rect width="${s.width}" height="${s.height}" />`;
  }
  visitTriangle(s: Triangle): string {
    return `<polygon points="0,${s.height} ${s.base},${s.height} ${s.base / 2},0" />`;
  }
}

const shapes: Shape[] = [new Circle(5), new Rectangle(4, 6), new Triangle(3, 8)];

const areaCalc  = new AreaCalculatorVisitor();
const svgExport = new SvgExporterVisitor();

shapes.forEach(s => console.log(s.accept(areaCalc)));
shapes.forEach(s => console.log(s.accept(svgExport)));
```

**Réponse** : Ajouter `PerimeterCalculatorVisitor` → crée **1 nouvelle classe**. Zéro modification sur `Circle`, `Rectangle`, `Triangle`. C'est le principe Open/Closed appliqué via Visitor.
