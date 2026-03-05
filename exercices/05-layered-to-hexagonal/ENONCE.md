# Exercice 05 — Layered to Hexagonal

> 🟡 **Difficulté** : Conception | **Temps estimé** : 2h | **Ère** : 2 — Le Domaine
>
> **Prérequis** : Module 01 (cours 1-2)


## Objectif

Refactorer un service NestJS écrit en architecture en couches vers une architecture hexagonale (Ports & Adapters).

## Temps estime

1h

## Contexte

Tu as un `OrderService` qui melange logique métier, accès base de données et appels HTTP externes. Tout est dans un seul fichier avec des imports directs de TypeORM et Axios.

## Code de depart

```typescript
// order.service.ts — Architecture en couches (tout couple)
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import axios from 'axios';
import { OrderEntity } from './order.entity';

@Injectable()
export class OrderService {
  constructor(
    @InjectRepository(OrderEntity)
    private readonly orderRepo: Repository<OrderEntity>,
  ) {}

  async createOrder(userId: string, items: Array<{ productId: string; quantity: number }>) {
    // 1. Verifier le stock via API externe
    for (const item of items) {
      const response = await axios.get(`http://inventory-service/api/stock/${item.productId}`);
      if (response.data.available < item.quantity) {
        throw new Error(`Insufficient stock for product ${item.productId}`);
      }
    }

    // 2. Calculer le prix
    let total = 0;
    for (const item of items) {
      const response = await axios.get(`http://pricing-service/api/price/${item.productId}`);
      total += response.data.price * item.quantity;
    }

    // 3. Appliquer la taxe (20%)
    const tax = total * 0.2;

    // 4. Creer la commande
    const order = this.orderRepo.create({
      userId,
      items,
      subtotal: total,
      tax,
      total: total + tax,
      status: 'created',
      createdAt: new Date(),
    });

    const saved = await this.orderRepo.save(order);

    // 5. Envoyer un email de confirmation
    await axios.post('http://notification-service/api/emails', {
      to: userId,
      template: 'order-confirmation',
      data: { orderId: saved.id, total: saved.total },
    });

    // 6. Reserver le stock
    for (const item of items) {
      await axios.post(`http://inventory-service/api/stock/${item.productId}/reserve`, {
        quantity: item.quantity,
        orderId: saved.id,
      });
    }

    return saved;
  }
}
```

## Instructions

### Étape 1 — Identifier les ports (10 min)

Liste toutes les dépendances externes du service :
- Quels sont les **ports sortants** (driven) ? (ce que le domaine a besoin de l'exterieur)
- Y a-t-il des **ports entrants** (driving) ? (comment le monde exterieur déclenché le domaine)

### Étape 2 — Définir les interfaces (15 min)

Cree une interface TypeScript pour chaque port sortant :
- `OrderRepository` — persistance
- `InventoryClient` — vérification et reservation de stock
- `PricingClient` — récupération des prix
- `NotificationService` — envoi de notifications

### Étape 3 — Refactorer le service (20 min)

Reecris `OrderService` en injectant les interfaces par le constructeur. Le service ne doit :
- Avoir **aucun import** de TypeORM, Axios, ou toute librairie d'infra
- Contenir **uniquement** de la logique métier
- Utiliser les interfaces définies a l'étape 2

### Étape 4 — Écrire un test unitaire (15 min)

Ecris un test pour `createOrder` avec des mocks pour chaque interface :
- Mock `InventoryClient` : stock suffisant
- Mock `PricingClient` : prix connus
- Mock `OrderRepository` : sauvegarde réussie
- Mock `NotificationService` : envoi réussi
- Verifie : le total, la taxe, l'appel a `reserve`, l'appel a `send`

## Bonus

- Extraire un `TaxCalculator` comme service de domaine (pas un port — c'est de la logique pure)
- Créer un `InMemoryOrderRepository` pour les tests d'intégration
