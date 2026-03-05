// Ce fichier viole tous les principes SOLID. Ton job : le refactorer.
//
// Problèmes à identifier :
// - Single Responsibility : cette classe fait TOUT (validation, calcul, persistence, notification)
// - Open/Closed : impossible d'ajouter un type client sans modifier la classe
// - Liskov Substitution : pas d'interface, couplage direct à PostgresDatabase
// - Interface Segregation : la classe dépend de tout, même ce qu'elle n'utilise pas
// - Dependency Inversion : dépend de classes concrètes (PostgresDatabase, nodemailer)
//
// Bonus : injection SQL dans la requête, require() en plein milieu du code

import type { Order } from './types.js';

// ---------- Infrastructure couplée en dur ----------

export interface Database {
  query(sql: string): Promise<void>;
}

export class PostgresDatabase implements Database {
  async query(sql: string): Promise<void> {
    // Stub — en prod ce serait pg.Pool
    console.log(`[DB] Executing: ${sql}`);
  }
}

// ---------- Le monolithe ----------

export class OrderProcessor {
  private db: PostgresDatabase;

  constructor() {
    // Violation DIP : instancie sa propre dépendance
    this.db = new PostgresDatabase();
  }

  async processOrder(order: Order): Promise<void> {
    // --- Validation (devrait être une classe séparée) ---
    if (!order.items || order.items.length === 0) {
      throw new Error('Order must have at least one item');
    }
    if (!order.customerEmail || !order.customerEmail.includes('@')) {
      throw new Error('Invalid email');
    }

    // --- Calcul du prix (devrait être une stratégie) ---
    let subtotal = 0;
    for (const item of order.items) {
      subtotal += item.price * item.quantity;
    }

    // Discount hardcodé — impossible d'ajouter un nouveau type sans modifier ici
    let discount = 0;
    if (order.customerType === 'vip') {
      discount = subtotal * 0.10; // 10% VIP
    } else if (order.customerType === 'employee') {
      discount = subtotal * 0.25; // 25% employé
    }

    // TVA hardcodée — impossible de gérer d'autres pays sans modifier ici
    let taxRate = 0;
    if (order.country === 'FR') {
      taxRate = 0.20;
    } else if (order.country === 'DE') {
      taxRate = 0.19;
    } else if (order.country === 'US') {
      taxRate = 0;
    } else {
      taxRate = 0.20; // défaut
    }

    const taxableAmount = subtotal - discount;
    const tax = taxableAmount * taxRate;
    order.total = subtotal - discount + tax;

    // --- Persistence (injection SQL !) ---
    // DANGER : concaténation de strings → injection SQL
    const sql = `INSERT INTO orders (id, email, total) VALUES ('${order.id}', '${order.customerEmail}', ${order.total})`;
    await this.db.query(sql);

    // --- Notification (require en plein milieu, couplage fort) ---
    try {
      // En vrai ça ferait : const nodemailer = require('nodemailer');
      // Ici on simule juste le couplage
      console.log(`[EMAIL] Sending confirmation to ${order.customerEmail}`);
      console.log(`[EMAIL] Subject: Commande ${order.id} confirmée — Total: ${order.total}€`);
    } catch (err) {
      // On avale l'erreur silencieusement — autre mauvaise pratique
      console.log('[EMAIL] Failed to send email, but we continue anyway...');
    }

    // --- Logging direct ---
    console.log(`[LOG] Order ${order.id} processed. Total: ${order.total}€`);
  }
}
