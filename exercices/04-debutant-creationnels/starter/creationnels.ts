// ============================================================
// PARTIE 1 — FACTORY
// ============================================================

// TODO 1 : Crée l'interface Notification
// interface Notification { ... }

// TODO 2 : Implémente EmailNotification, SmsNotification, PushNotification
// class EmailNotification implements Notification { ... }

// TODO 3 : Crée NotificationFactory avec create(type)
// class NotificationFactory { ... }

// TODO 4 : Teste les 3 types
// const n = NotificationFactory.create('email');
// n.send('alice@mail.com', 'Bienvenue !');


// ============================================================
// PARTIE 2 — ABSTRACT FACTORY
// ============================================================

// TODO 1 : Crée les interfaces UIButton et UIInput
// interface UIButton { render(): string; }

// TODO 2 : Implémente les 4 classes (DarkButton, LightButton, DarkInput, LightInput)

// TODO 3 : Crée l'interface ThemeFactory
// interface ThemeFactory { createButton(): UIButton; createInput(): UIInput; }

// TODO 4 : Implémente DarkThemeFactory et LightThemeFactory

// TODO 5 : Écris buildLoginForm(factory: ThemeFactory): void

// TODO 6 : Teste avec les deux factories


// ============================================================
// PARTIE 3 — BUILDER
// ============================================================

// TODO 1 : Crée la classe Pizza
// class Pizza {
//   size: 'small' | 'medium' | 'large' = 'medium';
//   crust: 'thin' | 'thick' | 'stuffed' = 'thin';
//   toppings: string[] = [];
// }

// TODO 2 : Crée PizzaBuilder
// class PizzaBuilder {
//   private pizza = new Pizza();
//   setSize(size: ...): this { ... return this; }
//   setCrust(crust: ...): this { ... return this; }
//   addTopping(topping: string): this { ... return this; }
//   build(): Pizza { ... }
// }

// TODO 3 : Construis 2 pizzas différentes avec chaînage fluent


// ============================================================
// PARTIE 4 — PROTOTYPE
// ============================================================

// TODO 1 : Crée la classe Character avec clone()
// class Character {
//   constructor(
//     public name: string,
//     public health: number,
//     public attack: number,
//     public skills: string[],
//   ) {}
//
//   clone(): Character {
//     // Attention : copie profonde du tableau skills !
//     return new Character(/* ... */);
//   }
// }

// TODO 2 : Crée le template warriorTemplate
// const warriorTemplate = new Character('Guerrier', 100, 15, ['sword']);

// TODO 3 : Clone pour Arthur et Lancelot, ajoute des skills différents

// TODO 4 : Vérifie que warriorTemplate.skills n'a pas changé

// BONUS — Prouve le bug du spread superficiel :
// const badClone = { ...warriorTemplate };
// badClone.skills.push('lance');
// console.log(warriorTemplate.skills); // ['sword', 'lance'] — BUG !


// ============================================================
// PARTIE 5 — SINGLETON
// ============================================================

// TODO 1 : Crée AppLogger avec constructeur privé
// class AppLogger {
//   private static instance: AppLogger | null = null;
//   private constructor() {}
//
//   static getInstance(): AppLogger {
//     // TODO : crée si null, retourne toujours l'instance
//   }
//
//   log(level: 'info' | 'warn' | 'error', message: string): void {
//     console.log(`[${level.toUpperCase()}] ${new Date().toISOString()} — ${message}`);
//   }
// }

// TODO 2 : Vérifie que a === b
// const a = AppLogger.getInstance();
// const b = AppLogger.getInstance();
// console.log(a === b); // doit être true
