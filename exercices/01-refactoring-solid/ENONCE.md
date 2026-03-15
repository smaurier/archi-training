# Exercice 01 — Refactoring SOLID

> 🟢 **Difficulté** : Découverte | **Temps estimé** : 1h | **Ère** : 1 — Les Fondations
>
> **Prérequis** : Module 00 (cours 1-4)


## Objectif

Identifier les violations des principes SOLID dans un code existant et le refactorer pour qu'il les respecte.

## Contexte

Tu travailles sur le back-end d'une application e-commerce. L'équipe précédente a écrit un `OrderProcessor` qui fait tout : validation, calcul de prix, envoi d'email, sauvegarde en base. C'est le chaos.

## Temps estime

1h

## Instructions

### Étape 1 — Analyser le code

Lis le code ci-dessous. Pour chaque principe SOLID, identifie quelle violation est présenté.

```typescript
// order-processor.ts — Le code a refactorer

class OrderProcessor {
  private db: Database;

  constructor() {
    // Violation : le constructeur cree ses propres dependances
    this.db = new PostgresDatabase('postgres://localhost:5432/shop');
  }

  async processOrder(order: any): Promise<void> {
    // --- Validation ---
    if (!order.items || order.items.length === 0) {
      throw new Error('Order must have at least one item');
    }
    if (!order.customerEmail) {
      throw new Error('Customer email is required');
    }
    if (!order.customerEmail.includes('@')) {
      throw new Error('Invalid email');
    }
    for (const item of order.items) {
      if (item.quantity <= 0) {
        throw new Error('Quantity must be positive');
      }
      if (item.price < 0) {
        throw new Error('Price cannot be negative');
      }
    }

    // --- Calcul du prix ---
    let total = 0;
    for (const item of order.items) {
      total += item.price * item.quantity;
    }
    // Reduction VIP hardcodee
    if (order.customerType === 'vip') {
      total *= 0.9; // 10% de reduction
    }
    // TVA France hardcodee
    total *= 1.2;
    order.total = total;

    // --- Sauvegarde ---
    const sql = `INSERT INTO orders (customer_email, total, status, items)
                 VALUES ('${order.customerEmail}', ${total}, 'pending',
                         '${JSON.stringify(order.items)}')`;
    await this.db.query(sql);

    // --- Envoi d'email ---
    const nodemailer = require('nodemailer');
    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 587,
      auth: { user: 'shop@gmail.com', pass: 'password123' },
    });
    await transporter.sendMail({
      from: 'shop@gmail.com',
      to: order.customerEmail,
      subject: 'Commande confirmee',
      text: `Votre commande de ${total}€ a ete confirmee.`,
    });

    // --- Log ---
    console.log(`Order processed for ${order.customerEmail}: ${total}€`);
  }
}
```

### Étape 2 — Lister les violations

Pour chaque principe, ecris la violation identifiee :

- **S** (Single Responsibility) : ...
- **O** (Open/Closed) : ...
- **L** (Liskov Substitution) : ...
- **I** (Interface Segregation) : ...
- **D** (Dependency Inversion) : ...

### Étape 3 — Refactorer

Reecris le code en respectant SOLID :

1. **Extraire** la validation dans un `OrderValidator`
2. **Extraire** le calcul de prix dans un `PricingService` avec une stratégie de discount
3. **Extraire** la persistance derriere une interface `OrderRepository`
4. **Extraire** la notification derriere une interface `NotificationService`
5. **Injecter** toutes les dépendances via le constructeur
6. **Typer** correctement (pas de `any`)

### Bonus

- Ajouter une stratégie de TVA par pays (sans modifier le code existant — OCP)
- Écrire un test unitaire du `OrderProcessor` refactore avec des mocks

## Contraintes

- TypeScript strict (`strict: true`)
- Zero `any`
- Zero `new` dans le `OrderProcessor` (tout est injecte)
- Zero import de librairie concrete dans le `OrderProcessor`

## Fichier a editer

Cree les fichiers dans `src/exercises/ex01/`
