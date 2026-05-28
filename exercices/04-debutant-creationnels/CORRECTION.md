# Correction — Exercice 04 : Patterns Creationnels

## Partie 1 — Factory

```typescript
interface Notification {
  send(to: string, message: string): void;
}

class EmailNotification implements Notification {
  send(to: string, message: string): void {
    console.log(`[EMAIL] → ${to}: ${message}`);
  }
}

class SmsNotification implements Notification {
  send(to: string, message: string): void {
    console.log(`[SMS]   → ${to}: ${message}`);
  }
}

class PushNotification implements Notification {
  send(to: string, message: string): void {
    console.log(`[PUSH]  → ${to}: ${message}`);
  }
}

class NotificationFactory {
  static create(type: 'email' | 'sms' | 'push'): Notification {
    switch (type) {
      case 'email': return new EmailNotification();
      case 'sms':   return new SmsNotification();
      case 'push':  return new PushNotification();
      // TypeScript exhaustiveness : le switch couvre tout le type union
    }
  }
}

// Test
const n1 = NotificationFactory.create('email');
n1.send('alice@mail.com', 'Bienvenue !');

const n2 = NotificationFactory.create('sms');
n2.send('+33600000000', 'Code: 1234');
```

**Réponse — Pourquoi Factory ?**

Sans Factory, chaque endroit du code fait `new EmailNotification()`. Si tu renommes la classe ou changes son constructeur, tu dois modifier **N** endroits. Avec Factory, tu modifies **1** endroit. De plus, le type vient souvent d'une config ou d'une requête HTTP — impossible de faire `new` directement sur une chaîne.

---

## Partie 2 — Abstract Factory

```typescript
interface UIButton { render(): string; }
interface UIInput  { render(): string; }

class DarkButton  implements UIButton { render() { return '<button class="dark">Valider</button>'; } }
class LightButton implements UIButton { render() { return '<button class="light">Valider</button>'; } }
class DarkInput   implements UIInput  { render() { return '<input class="dark" />'; } }
class LightInput  implements UIInput  { render() { return '<input class="light" />'; } }

interface ThemeFactory {
  createButton(): UIButton;
  createInput(): UIInput;
}

class DarkThemeFactory implements ThemeFactory {
  createButton(): UIButton { return new DarkButton(); }
  createInput(): UIInput   { return new DarkInput(); }
}

class LightThemeFactory implements ThemeFactory {
  createButton(): UIButton { return new LightButton(); }
  createInput(): UIInput   { return new LightInput(); }
}

function buildLoginForm(factory: ThemeFactory): void {
  const btn   = factory.createButton();
  const input = factory.createInput();
  console.log(btn.render());
  console.log(input.render());
}

buildLoginForm(new DarkThemeFactory());
buildLoginForm(new LightThemeFactory());
```

**Réponse — Garantie d'Abstract Factory**

Factory simple garantit que tu obtiens "un objet du bon type". Abstract Factory garantit que **tous les objets créés ensemble sont compatibles**. Impossible de mélanger `DarkButton` + `LightInput` si tu n'utilises que la factory — elle produit toujours des composants cohérents entre eux.

---

## Partie 3 — Builder

```typescript
class Pizza {
  size: 'small' | 'medium' | 'large' = 'medium';
  crust: 'thin' | 'thick' | 'stuffed' = 'thin';
  toppings: string[] = [];

  describe(): string {
    return `Pizza ${this.size}, pâte ${this.crust}, garnitures: ${this.toppings.join(', ') || 'aucune'}`;
  }
}

class PizzaBuilder {
  private pizza = new Pizza();

  setSize(size: 'small' | 'medium' | 'large'): this {
    this.pizza.size = size;
    return this;
  }

  setCrust(crust: 'thin' | 'thick' | 'stuffed'): this {
    this.pizza.crust = crust;
    return this;
  }

  addTopping(topping: string): this {
    this.pizza.toppings.push(topping);
    return this;
  }

  build(): Pizza {
    // reset : chaque appel à build() produit une pizza indépendante
    const result = this.pizza;
    this.pizza = new Pizza();
    return result;
  }
}

const margherita = new PizzaBuilder()
  .setSize('medium')
  .setCrust('thin')
  .addTopping('tomate')
  .addTopping('mozzarella')
  .build();

const calzone = new PizzaBuilder()
  .setSize('large')
  .setCrust('stuffed')
  .addTopping('jambon')
  .addTopping('champignons')
  .addTopping('fromage')
  .build();

console.log(margherita.describe());
console.log(calzone.describe());
```

**Réponse — Pourquoi retourner `this` ?**

Retourner `this` permet le **chaînage fluent** : `builder.setSize('large').setCrust('thin').addTopping('fromage').build()`. Sans `this`, tu devrais stocker le builder dans une variable et appeler chaque méthode séparément — beaucoup plus verbeux.

---

## Partie 4 — Prototype

```typescript
class Character {
  constructor(
    public name: string,
    public health: number,
    public attack: number,
    public skills: string[],
  ) {}

  clone(): Character {
    // [...this.skills] crée un nouveau tableau — copie profonde du tableau
    return new Character(this.name, this.health, this.attack, [...this.skills]);
  }
}

const warriorTemplate = new Character('Guerrier', 100, 15, ['sword']);

const arthur    = warriorTemplate.clone();
arthur.name     = 'Arthur';
arthur.skills.push('shield');

const lancelot  = warriorTemplate.clone();
lancelot.name   = 'Lancelot';
lancelot.skills.push('horse');

console.log(warriorTemplate.skills); // ['sword'] — non modifié
console.log(arthur.skills);          // ['sword', 'shield']
console.log(lancelot.skills);        // ['sword', 'horse']
```

**Preuve du piège spread superficiel**

```typescript
// MAUVAIS — spread objet copie le tableau par référence
const badClone = { ...warriorTemplate };
badClone.skills.push('lance');
console.log(warriorTemplate.skills); // ['sword', 'lance'] — MODIFIÉ ! Bug.

// Pourquoi : { ...obj } copie les propriétés au premier niveau.
// Pour 'skills', il copie la référence vers le tableau, pas le tableau lui-même.
// Les deux objets partagent le même tableau en mémoire.
```

---

## Partie 5 — Singleton

```typescript
class AppLogger {
  private static instance: AppLogger | null = null;

  private constructor() {}

  static getInstance(): AppLogger {
    if (!AppLogger.instance) {
      AppLogger.instance = new AppLogger();
    }
    return AppLogger.instance;
  }

  log(level: 'info' | 'warn' | 'error', message: string): void {
    const timestamp = new Date().toISOString();
    console.log(`[${level.toUpperCase()}] ${timestamp} — ${message}`);
  }
}

const a = AppLogger.getInstance();
const b = AppLogger.getInstance();
console.log(a === b); // true — même instance

a.log('info', 'Application démarrée');
b.log('warn', 'Mémoire basse');
```

**Réponse — Problème en tests**

Le Singleton conserve son état entre les tests. Si un test modifie l'instance (ex: change le niveau de log), le test suivant hérite de cet état — tests **non isolés**. De plus, `AppLogger.getInstance()` est impossible à remplacer par un mock sans modifier la classe.

Solution : **injection de dépendances**. Passe le logger en paramètre plutôt que de l'appeler globalement.

```typescript
// MIEUX : injection
function processOrder(orderId: string, logger: AppLogger): void {
  logger.log('info', `Processing order ${orderId}`);
}
// En test, tu passes un mock. En prod, tu passes AppLogger.getInstance().
```
