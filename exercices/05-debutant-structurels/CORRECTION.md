# Correction — Exercice 05 : Patterns Structurels

## Partie 1 — Adapter

```typescript
interface PaymentGateway {
  charge(amountEuros: number, currency: string, description: string): Promise<string>;
}

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

class StripeAdapter implements PaymentGateway {
  constructor(private readonly stripe: StripeSDK) {}

  async charge(amountEuros: number, currency: string, description: string): Promise<string> {
    const result = await this.stripe.createPaymentIntent({
      amount: Math.round(amountEuros * 100), // conversion euros → centimes
      currency: currency.toLowerCase(),
      metadata: { description },
    });
    return result.id;
  }
}

// Usage — le code métier ne connaît que PaymentGateway
async function processPayment(gateway: PaymentGateway): Promise<void> {
  const txId = await gateway.charge(29.99, 'EUR', 'Abonnement mensuel');
  console.log(`Transaction: ${txId}`);
}

const adapter = new StripeAdapter(new StripeSDK());
await processPayment(adapter);
```

**Réponse** : Passer de Stripe à Braintree = créer `BraintreeAdapter implements PaymentGateway`. Le code métier (`processPayment`) ne change pas d'une ligne.

---

## Partie 2 — Bridge

```typescript
// Implémentation — comment envoyer
interface MessageSender {
  send(content: string, recipient: string): void;
}

class EmailSender implements MessageSender {
  send(content: string, recipient: string): void {
    console.log(`[EMAIL] → ${recipient}: ${content}`);
  }
}

class SlackSender implements MessageSender {
  send(content: string, recipient: string): void {
    console.log(`[SLACK] @${recipient}: ${content}`);
  }
}

// Abstraction — quoi envoyer
abstract class Message {
  constructor(protected sender: MessageSender) {}
  abstract send(recipient: string): void;
}

class UrgentMessage extends Message {
  constructor(sender: MessageSender, private body: string) { super(sender); }
  send(recipient: string): void {
    this.sender.send(`[URGENT] ${this.body}`, recipient);
  }
}

class InfoMessage extends Message {
  constructor(sender: MessageSender, private body: string) { super(sender); }
  send(recipient: string): void {
    this.sender.send(`[INFO] ${this.body}`, recipient);
  }
}

// 4 combinaisons — 4 lignes, pas 4 classes
new UrgentMessage(new EmailSender(), 'Serveur en feu !').send('admin');
new UrgentMessage(new SlackSender(), 'Serveur en feu !').send('ops-team');
new InfoMessage(new EmailSender(), 'Déploiement terminé').send('equipe');
new InfoMessage(new SlackSender(), 'Déploiement terminé').send('devs');
```

**Réponse** : Sans Bridge, 3 types × 4 canaux = **12 classes** (`UrgentEmailMessage`, `UrgentSlackMessage`, `UrgentDiscordMessage`, `UrgentWhatsappMessage`…). Avec Bridge, 3 + 4 = **7 classes**.

---

## Partie 3 — Composite

```typescript
interface FileSystemItem {
  getName(): string;
  getSize(): number;
  display(indent?: number): void;
}

class File implements FileSystemItem {
  constructor(private name: string, private size: number) {}
  getName(): string  { return this.name; }
  getSize(): number  { return this.size; }
  display(indent = 0): void {
    console.log(' '.repeat(indent) + `📄 ${this.name} (${this.size} Ko)`);
  }
}

class Folder implements FileSystemItem {
  private children: FileSystemItem[] = [];
  constructor(private name: string) {}
  getName(): string  { return this.name; }
  getSize(): number  { return this.children.reduce((s, c) => s + c.getSize(), 0); }
  add(item: FileSystemItem): void { this.children.push(item); }
  display(indent = 0): void {
    console.log(' '.repeat(indent) + `📁 ${this.name}/ (${this.getSize()} Ko)`);
    this.children.forEach(c => c.display(indent + 2));
  }
}

const root = new Folder('Documents');
root.add(new File('CV.pdf', 120));

const projets = new Folder('Projets');
projets.add(new File('app.ts', 45));
projets.add(new File('README.md', 8));

root.add(projets);
root.add(new File('Photo.jpg', 2048));

root.display();
console.log('Taille totale:', root.getSize(), 'Ko'); // 2221 Ko
```

**Réponse** : `getSize()` sur la racine appelle `getSize()` sur chaque enfant. Pour `Folder`, ça recurse sur ses enfants. C'est la récursion automatique du Composite — tu n'as pas à connaître la profondeur de l'arbre.

---

## Partie 4 — Decorator

```typescript
interface Coffee {
  getDescription(): string;
  getCost(): number;
}

class SimpleCoffee implements Coffee {
  getDescription(): string { return 'Café'; }
  getCost(): number        { return 1.00; }
}

abstract class CoffeeDecorator implements Coffee {
  constructor(protected coffee: Coffee) {}
  getDescription(): string { return this.coffee.getDescription(); }
  getCost(): number        { return this.coffee.getCost(); }
}

class MilkDecorator extends CoffeeDecorator {
  getDescription(): string { return this.coffee.getDescription() + ' + Lait'; }
  getCost(): number        { return this.coffee.getCost() + 0.30; }
}

class SugarDecorator extends CoffeeDecorator {
  getDescription(): string { return this.coffee.getDescription() + ' + Sucre'; }
  getCost(): number        { return this.coffee.getCost() + 0.10; }
}

class CaramelDecorator extends CoffeeDecorator {
  getDescription(): string { return this.coffee.getDescription() + ' + Caramel'; }
  getCost(): number        { return this.coffee.getCost() + 0.50; }
}

// Latte : café + lait + sucre
const latte = new SugarDecorator(new MilkDecorator(new SimpleCoffee()));
console.log(latte.getDescription()); // Café + Lait + Sucre
console.log(latte.getCost());        // 1.40

// Caramel macchiato : café + lait + caramel + sucre
const macchiato = new SugarDecorator(new CaramelDecorator(new MilkDecorator(new SimpleCoffee())));
console.log(macchiato.getDescription()); // Café + Lait + Caramel + Sucre
console.log(macchiato.getCost());        // 1.90
```

**Réponse** : 5 extras = 2⁵ = **32 sous-classes** pour couvrir toutes les combinaisons. Avec Decorator : 5 classes + composition à l'exécution.

---

## Partie 5 — Facade

```typescript
class Projector {
  turnOn(): void                { console.log('[Projector] Allumé — 4K'); }
  setInput(source: string): void { console.log(`[Projector] Source: ${source}`); }
  turnOff(): void               { console.log('[Projector] Éteint'); }
}

class SoundSystem {
  turnOn(): void              { console.log('[Sound] Allumé'); }
  setSurroundMode(): void     { console.log('[Sound] Surround 5.1'); }
  setVolume(v: number): void  { console.log(`[Sound] Volume: ${v}`); }
  turnOff(): void             { console.log('[Sound] Éteint'); }
}

class StreamingService {
  connect(): void              { console.log('[Streaming] Connecté'); }
  play(title: string): void    { console.log(`[Streaming] ▶ ${title}`); }
  stop(): void                 { console.log('[Streaming] Arrêté'); }
}

class HomeTheaterFacade {
  private projector = new Projector();
  private sound     = new SoundSystem();
  private streaming = new StreamingService();

  watchMovie(title: string): void {
    console.log('--- Préparation du home theater ---');
    this.projector.turnOn();
    this.projector.setInput('HDMI-1');
    this.sound.turnOn();
    this.sound.setSurroundMode();
    this.sound.setVolume(40);
    this.streaming.connect();
    this.streaming.play(title);
  }

  endMovie(): void {
    console.log('--- Fin du film ---');
    this.streaming.stop();
    this.sound.turnOff();
    this.projector.turnOff();
  }
}

const theater = new HomeTheaterFacade();
theater.watchMovie('Inception');
theater.endMovie();
```

**Réponse** : Ajouter `LightingSystem` → modifier **seulement** `HomeTheaterFacade`. Les clients qui appellent `watchMovie()` ne changent pas.

---

## Partie 6 — Flyweight

```typescript
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

class BulletTypeFactory {
  private static cache = new Map<string, BulletType>();

  static get(color: string, texture: string, damage: number): BulletType {
    const key = `${color}_${texture}_${damage}`;
    if (!this.cache.has(key)) {
      this.cache.set(key, new BulletType(color, texture, damage));
      console.log(`[Factory] Nouveau BulletType: ${color}`);
    }
    return this.cache.get(key)!;
  }

  static count(): number { return this.cache.size; }
}

class Bullet {
  constructor(
    private x: number,
    private y: number,
    private type: BulletType, // référence partagée
  ) {}
  draw(): void { this.type.draw(this.x, this.y); }
}

const bullets: Bullet[] = [];

// 10 balles rouges — partagent 1 seul BulletType 'red'
for (let i = 0; i < 10; i++) {
  const type = BulletTypeFactory.get('red', 'fire.png', 25);
  bullets.push(new Bullet(i * 5, i * 3, type));
}

// 5 balles bleues — partagent 1 seul BulletType 'blue'
for (let i = 0; i < 5; i++) {
  const type = BulletTypeFactory.get('blue', 'ice.png', 15);
  bullets.push(new Bullet(i * 8, i * 4, type));
}

console.log(`BulletTypes créés: ${BulletTypeFactory.count()}`); // 2, pas 15
```

**Réponse** : 15 balles × 50 Ko = 750 Ko. Avec Flyweight : 2 types × 50 Ko = 100 Ko. À 10 000 balles, la différence devient critique.

---

## Partie 7 — Proxy

```typescript
interface Image {
  display(): void;
}

class RealImage implements Image {
  constructor(private filename: string) {
    this.load();
  }
  private load(): void { console.log(`[RealImage] Chargement: ${this.filename}`); }
  display(): void      { console.log(`[RealImage] Affichage: ${this.filename}`); }
}

class ProxyImage implements Image {
  private realImage: RealImage | null = null;

  constructor(private filename: string) {
    // Pas de chargement ici — différé au premier display()
  }

  display(): void {
    if (!this.realImage) {
      this.realImage = new RealImage(this.filename); // chargement lazy
    }
    this.realImage.display();
  }
}

const img = new ProxyImage('photo-haute-resolution.jpg');
console.log('Image créée — pas encore chargée');
img.display(); // [RealImage] Chargement: photo... puis [RealImage] Affichage: ...
img.display(); // [RealImage] Affichage: ... (déjà chargée)
```

**Réponse — Autres usages du Proxy** :
1. **Contrôle d'accès** : vérifier les droits avant de déléguer à l'objet réel
2. **Cache** : mémoriser le résultat d'un appel coûteux et le retourner directement les fois suivantes
3. **Logging** : journaliser chaque accès sans modifier l'objet réel
4. **Remote Proxy** : représenter un objet qui se trouve sur un autre serveur
