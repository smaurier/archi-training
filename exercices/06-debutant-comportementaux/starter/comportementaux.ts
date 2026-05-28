// ============================================================
// PARTIE 1 — CHAIN OF RESPONSIBILITY
// ============================================================

class SupportTicket {
  constructor(
    public readonly description: string,
    public readonly priority: 'low' | 'medium' | 'high' | 'critical',
  ) {}
}

// TODO 1 : Crée la classe abstraite SupportHandler
// abstract class SupportHandler {
//   private next: SupportHandler | null = null;
//   setNext(handler: SupportHandler): SupportHandler { ... return handler; }
//   handle(ticket: SupportTicket): void { /* process ou délègue */ }
//   protected abstract process(ticket: SupportTicket): boolean;
// }

// TODO 2 : Level1Support (traite low/medium), Level2Support (traite high), ManagerSupport (traite critical)

// TODO 3 : Chaîne et teste
// const level1 = new Level1Support();
// level1.setNext(new Level2Support()).setNext(new ManagerSupport());
// level1.handle(new SupportTicket('Mot de passe', 'low'));
// level1.handle(new SupportTicket('Perte de données', 'critical'));


// ============================================================
// PARTIE 2 — COMMAND
// ============================================================

// TODO 1 : Interface Command
// interface Command { execute(): void; undo(): void; }

// TextDocument (receiver) — ne pas modifier
class TextDocument {
  private content = '';
  getContent(): string            { return this.content; }
  append(text: string): void      { this.content += text; }
  deleteLast(chars: number): void { this.content = this.content.slice(0, -chars || undefined); }
}

// TODO 2 : AppendCommand implements Command
// class AppendCommand implements Command {
//   constructor(private doc: TextDocument, private text: string) {}
//   execute(): void { /* appelle doc.append */ }
//   undo(): void    { /* appelle doc.deleteLast avec la bonne longueur */ }
// }

// TODO 3 : CommandHistory avec execute(cmd) et undo()
// class CommandHistory {
//   private history: Command[] = [];
//   execute(cmd: Command): void { /* exécute et empile */ }
//   undo(): void { /* dépile et annule */ }
// }

// TODO 4 : Teste
// const doc = new TextDocument();
// const history = new CommandHistory();
// history.execute(new AppendCommand(doc, 'Bonjour'));
// history.execute(new AppendCommand(doc, ' monde'));
// console.log(doc.getContent()); // "Bonjour monde"
// history.undo();
// console.log(doc.getContent()); // "Bonjour"


// ============================================================
// PARTIE 3 — ITERATOR
// ============================================================

// TODO : Crée la classe Range avec [Symbol.iterator]()
// class Range {
//   constructor(
//     private start: number,
//     private end: number,
//     private step: number = 1,
//   ) {}
//
//   [Symbol.iterator](): Iterator<number> {
//     let current = this.start;
//     const { end, step } = this;
//     return {
//       next(): IteratorResult<number> {
//         // retourne { value: current, done: false } tant que current < end
//         // retourne { value: 0, done: true } sinon
//       }
//     };
//   }
// }

// TODO : Teste
// for (const n of new Range(1, 10)) process.stdout.write(n + ' ');
// console.log([...new Range(0, 20, 5)]); // [0, 5, 10, 15]


// ============================================================
// PARTIE 4 — MEDIATOR
// ============================================================

// TODO 1 : Interface AuctionMediator
// interface AuctionMediator {
//   registerBidder(bidder: Bidder): void;
//   placeBid(amount: number, from: Bidder): void;
// }

// TODO 2 : Classe Bidder
// class Bidder {
//   constructor(public name: string, private mediator: AuctionMediator) {
//     mediator.registerBidder(this);
//   }
//   bid(amount: number): void { this.mediator.placeBid(amount, this); }
//   notifyBid(amount: number, from: string): void { /* affiche la notification */ }
// }

// TODO 3 : AuctionRoom implements AuctionMediator
// class AuctionRoom implements AuctionMediator {
//   private bidders: Bidder[] = [];
//   private highestBid = 0;
//   registerBidder(bidder: Bidder): void { ... }
//   placeBid(amount: number, from: Bidder): void {
//     // si amount <= highestBid : refuser
//     // sinon : mettre à jour, notifier tous SAUF from
//   }
// }

// TODO 4 : Teste avec 3 acheteurs


// ============================================================
// PARTIE 5 — MEMENTO
// ============================================================

// TODO 1 : CalculatorMemento
// class CalculatorMemento {
//   constructor(private readonly value: number) {}
//   getValue(): number { return this.value; }
// }

// TODO 2 : Calculator (Originator)
// class Calculator {
//   private value = 0;
//   add(n: number): void       { this.value += n; }
//   multiply(n: number): void  { this.value *= n; }
//   getResult(): number        { return this.value; }
//   save(): CalculatorMemento            { /* snapshot */ }
//   restore(m: CalculatorMemento): void  { /* restaure */ }
// }

// TODO 3 : CalculatorHistory (Caretaker)
// class CalculatorHistory {
//   private stack: CalculatorMemento[] = [];
//   save(calc: Calculator): void { ... }
//   undo(calc: Calculator): void { ... }
// }

// TODO 4 : Teste : add(5), save, add(3), save, multiply(4), save, undo, undo


// ============================================================
// PARTIE 6 — OBSERVER
// ============================================================

// TODO 1 : Interface StockObserver
// interface StockObserver { onPriceChange(symbol: string, price: number): void; }

// TODO 2 : Stock
// class Stock {
//   private observers: StockObserver[] = [];
//   constructor(private name: string, private price: number) {}
//   subscribe(o: StockObserver): void   { ... }
//   unsubscribe(o: StockObserver): void { ... }
//   setPrice(price: number): void       { this.price = price; /* notifie tous */ }
// }

// TODO 3 : PriceLogger (affiche le prix) et PriceAlert (alerte si > seuil)

// TODO 4 : Teste — abonne les 2, change le prix 3 fois, désabonne le Logger, change encore


// ============================================================
// PARTIE 7 — STATE
// ============================================================

// TODO 1 : Interface TrafficLightState
// interface TrafficLightState {
//   getColor(): string;
//   next(light: TrafficLight): void;
// }

// TODO 2 : TrafficLight
// class TrafficLight {
//   private state: TrafficLightState = new RedState();
//   setState(s: TrafficLightState): void { this.state = s; }
//   getColor(): string { return this.state.getColor(); }
//   next(): void       { this.state.next(this); }
// }

// TODO 3 : RedState, GreenState, YellowState
// class RedState implements TrafficLightState {
//   getColor() { return 'ROUGE'; }
//   next(light: TrafficLight) { light.setState(new GreenState()); }
// }
// ... (GreenState → YellowState, YellowState → RedState)

// TODO 4 : Boucle 6 fois
// const light = new TrafficLight();
// for (let i = 0; i < 6; i++) { console.log(light.getColor()); light.next(); }


// ============================================================
// PARTIE 8 — STRATEGY
// ============================================================

// TODO 1 : Interface SortStrategy<T>
// interface SortStrategy<T> { sort(data: T[]): T[]; }

// TODO 2 : AlphabeticalSort, LengthSort, ReverseSort
// Attention : ne pas muter le tableau original — utilise [...data]

// TODO 3 : Sorter<T>
// class Sorter<T> {
//   constructor(private strategy: SortStrategy<T>) {}
//   setStrategy(s: SortStrategy<T>): void { this.strategy = s; }
//   sort(data: T[]): T[] { return this.strategy.sort(data); }
// }

// TODO 4 : Teste avec ['banane', 'pomme', 'kiwi', 'fraise', 'abricot']


// ============================================================
// PARTIE 9 — TEMPLATE METHOD
// ============================================================

// TODO 1 : Classe abstraite ReportGenerator
// abstract class ReportGenerator {
//   generate(title: string, data: string[]): string {
//     return [
//       this.generateHeader(title),
//       this.generateBody(data),
//       this.generateFooter(),
//     ].join('\n');
//   }
//   protected abstract generateHeader(title: string): string;
//   protected abstract generateBody(data: string[]): string;
//   protected abstract generateFooter(): string;
// }

// TODO 2 : TextReportGenerator (=== title ===, - item, === Fin ===)
// TODO 3 : HtmlReportGenerator (<h1>, <ul><li>, <footer>)

// TODO 4 : Génère le même rapport avec les deux formats
// const data = ['Chiffre d\'affaires: 125 000€', 'Nouveaux clients: 42'];
// console.log(new TextReportGenerator().generate('Rapport Q4', data));
// console.log(new HtmlReportGenerator().generate('Rapport Q4', data));


// ============================================================
// PARTIE 10 — VISITOR
// ============================================================

// TODO 1 : Interface ShapeVisitor
// interface ShapeVisitor {
//   visitCircle(s: Circle): string;
//   visitRectangle(s: Rectangle): string;
//   visitTriangle(s: Triangle): string;
// }

// TODO 2 : Interface Shape avec accept(visitor): string

// TODO 3 : Circle (radius), Rectangle (width, height), Triangle (base, height)
// Chacune : accept(v) { return v.visitXxx(this); }  ← double dispatch

// TODO 4 : AreaCalculatorVisitor
// Cercle: π×r², Rectangle: w×h, Triangle: (b×h)/2

// TODO 5 : SvgExporterVisitor
// Cercle: <circle r="..." />, Rectangle: <rect width="..." height="..." />

// TODO 6 : Teste sur liste mixte de formes
// const shapes: Shape[] = [new Circle(5), new Rectangle(4, 6), new Triangle(3, 8)];
// shapes.forEach(s => console.log(s.accept(new AreaCalculatorVisitor())));
// shapes.forEach(s => console.log(s.accept(new SvgExporterVisitor())));
