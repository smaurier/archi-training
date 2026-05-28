// ============================================================
// PARTIE 1 — ADAPTER
// ============================================================

// Interface de TON application (ne pas modifier)
interface PaymentGateway {
  charge(amountEuros: number, currency: string, description: string): Promise<string>;
}

// API Stripe simulée (ne pas modifier)
class StripeSDK {
  async createPaymentIntent(params: {
    amount: number;
    currency: string;
    metadata: { description: string };
  }): Promise<{ id: string; status: string }> {
    console.log(`[Stripe] PaymentIntent: ${JSON.stringify(params)}`);
    return { id: `pi_${Date.now()}`, status: 'succeeded' };
  }
}

// TODO : Crée StripeAdapter implements PaymentGateway
// class StripeAdapter implements PaymentGateway {
//   constructor(private readonly stripe: StripeSDK) {}
//
//   async charge(amountEuros: number, currency: string, description: string): Promise<string> {
//     // TODO : appelle this.stripe.createPaymentIntent(...)
//     // Rappel : Stripe veut des CENTIMES, pas des euros
//   }
// }

// TODO : Teste
// const adapter = new StripeAdapter(new StripeSDK());
// const txId = await adapter.charge(29.99, 'EUR', 'Abonnement mensuel');
// console.log(`Transaction: ${txId}`);


// ============================================================
// PARTIE 2 — BRIDGE
// ============================================================

// TODO 1 : Interface MessageSender (implémentation)
// interface MessageSender { send(content: string, recipient: string): void; }

// TODO 2 : EmailSender et SlackSender

// TODO 3 : Classe abstraite Message avec protected sender: MessageSender
// abstract class Message {
//   constructor(protected sender: MessageSender) {}
//   abstract send(recipient: string): void;
// }

// TODO 4 : UrgentMessage ([URGENT] préfixe) et InfoMessage ([INFO] préfixe)

// TODO 5 : Teste les 4 combinaisons
// new UrgentMessage(new EmailSender(), 'Serveur en feu !').send('admin');
// new UrgentMessage(new SlackSender(), 'Serveur en feu !').send('ops-team');


// ============================================================
// PARTIE 3 — COMPOSITE
// ============================================================

// TODO 1 : Interface FileSystemItem
// interface FileSystemItem {
//   getName(): string;
//   getSize(): number;
//   display(indent?: number): void;
// }

// TODO 2 : File (feuille — pas d'enfants)
// class File implements FileSystemItem { ... }

// TODO 3 : Folder (composite — peut contenir des File ET des Folder)
// class Folder implements FileSystemItem {
//   private children: FileSystemItem[] = [];
//   getSize() { /* somme des enfants */ }
//   add(item: FileSystemItem): void { ... }
//   display(indent = 0): void { /* affiche nom puis recurse */ }
// }

// TODO 4 : Construis cette arborescence et affiche
// Documents/
//   CV.pdf (120 Ko)
//   Projets/
//     app.ts (45 Ko)
//     README.md (8 Ko)
//   Photo.jpg (2048 Ko)


// ============================================================
// PARTIE 4 — DECORATOR
// ============================================================

// TODO 1 : Interface Coffee
// interface Coffee { getDescription(): string; getCost(): number; }

// TODO 2 : SimpleCoffee (Café, 1.00€)

// TODO 3 : CoffeeDecorator abstrait qui wrape un Coffee
// abstract class CoffeeDecorator implements Coffee {
//   constructor(protected coffee: Coffee) {}
//   getDescription() { return this.coffee.getDescription(); }
//   getCost() { return this.coffee.getCost(); }
// }

// TODO 4 : MilkDecorator (+Lait, +0.30€), SugarDecorator (+Sucre, +0.10€), CaramelDecorator (+Caramel, +0.50€)

// TODO 5 : Crée un latte (lait + sucre) et un caramel macchiato (lait + caramel + sucre)
// const latte = new SugarDecorator(new MilkDecorator(new SimpleCoffee()));
// console.log(latte.getDescription(), latte.getCost());


// ============================================================
// PARTIE 5 — FACADE
// ============================================================

// Sous-systèmes (implémente les méthodes avec console.log)
// class Projector { turnOn(); setInput(source); turnOff() }
// class SoundSystem { turnOn(); setSurroundMode(); setVolume(v); turnOff() }
// class StreamingService { connect(); play(title); stop() }

// TODO : Crée HomeTheaterFacade
// class HomeTheaterFacade {
//   watchMovie(title: string): void { /* coordonne les 3 sous-systèmes */ }
//   endMovie(): void { /* éteint proprement */ }
// }

// TODO : Teste
// const theater = new HomeTheaterFacade();
// theater.watchMovie('Inception');
// theater.endMovie();


// ============================================================
// PARTIE 6 — FLYWEIGHT
// ============================================================

// BulletType (état intrinsèque — ne pas modifier)
class BulletType {
  constructor(
    public readonly color: string,
    public readonly texture: string,
    public readonly damage: number,
  ) {}
  draw(x: number, y: number): void {
    console.log(`[${this.color} bullet] (${x},${y}) dmg:${this.damage}`);
  }
}

// TODO 1 : BulletTypeFactory avec cache
// class BulletTypeFactory {
//   private static cache = new Map<string, BulletType>();
//   static get(color: string, texture: string, damage: number): BulletType {
//     // clé composite = `${color}_${texture}_${damage}`
//   }
//   static count(): number { ... }
// }

// TODO 2 : Bullet (état extrinsèque : x, y + référence BulletType)
// class Bullet { constructor(private x, private y, private type: BulletType) {} draw() { ... } }

// TODO 3 : 10 balles rouges + 5 balles bleues → vérifie que count() === 2


// ============================================================
// PARTIE 7 — PROXY
// ============================================================

// Interface commune (ne pas modifier)
interface ImageItem {
  display(): void;
}

// Sujet réel (ne pas modifier)
class RealImage implements ImageItem {
  constructor(private filename: string) { this.load(); }
  private load(): void { console.log(`[RealImage] Chargement: ${this.filename}`); }
  display(): void      { console.log(`[RealImage] Affichage: ${this.filename}`); }
}

// TODO : Crée ProxyImage implements ImageItem
// class ProxyImage implements ImageItem {
//   private realImage: RealImage | null = null;
//
//   constructor(private filename: string) {
//     // NE PAS créer RealImage ici
//   }
//
//   display(): void {
//     // Crée RealImage seulement au premier appel
//     // Réutilise aux appels suivants
//   }
// }

// TODO : Teste
// const img = new ProxyImage('photo.jpg');
// console.log('Créé — pas encore chargé');
// img.display(); // charge + affiche
// img.display(); // affiche seulement
