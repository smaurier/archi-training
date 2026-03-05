# Correction — Exercice 10 : Bounded Contexts

## Résultat attendu

4-5 bounded contexts bien définis avec des glossaires clairs, des modèles propres a chacun, et un Context Map montrant les relations.

## Bounded Contexts

### 1. Catalog Context

- **Responsabilite** : gérer le catalogue produits visible par les clients
- **Entités** : CatalogProduct, Category, Tag
- **Value Objects** : MultiLangField, Slug, Image
- **Glossaire** :
  - **Product** : un article visible dans le catalogue avec nom, description, images
  - **Category** : un regroupement thematique de produits
  - **Slug** : identifiant URL-friendly unique par locale

### 2. Inventory Context

- **Responsabilite** : gérer le stock et la disponibilité
- **Entités** : StockItem, Warehouse
- **Value Objects** : SKU, StockLevel
- **Glossaire** :
  - **StockItem** : une référence physique avec quantité en stock
  - **SKU** : identifiant unique du stock-keeping unit
  - **Reorder** : seuil en dessous duquel il faut recommander

### 3. Order Context

- **Responsabilite** : gérer le cycle de vie des commandes
- **Entités** : Order (agregat root), OrderLine
- **Value Objects** : Money, Address, OrderLine
- **Glossaire** :
  - **Order** : une intention d'achat avec des lignes, un total, un statut
  - **OrderLine** : un produit fige (nom + prix au moment de la commande)
  - **Fulfillment** : le processus de preparation et expedition

### 4. Payment Context

- **Responsabilite** : gérer les transactions financieres
- **Entités** : Payment, Refund
- **Value Objects** : Money, PaymentMethod
- **Glossaire** :
  - **Payment** : une transaction financiere associee a une commande
  - **Charge** : debiter le client
  - **Refund** : rembourser partiellement ou totalement

### 5. Identity Context

- **Responsabilite** : gérer l'identité et les accès
- **Entités** : User, Role
- **Value Objects** : Email, Address
- **Glossaire** :
  - **User** : un individu avec un compte
  - **Role** : un ensemble de permissions (admin, customer, editor)

## Context Map

```
┌──────────┐  Customer/Supplier  ┌───────────┐
│ Catalog  │────────────────────>│ Inventory │
│ Context  │  (catalog demande   │  Context  │
│          │   le stock dispo)   │           │
└────┬─────┘                     └─────┬─────┘
     │                                 │
     │ Publishes: product.published    │ Publishes: stock.updated
     │                                 │
     ▼                                 ▼
┌──────────┐  Customer/Supplier  ┌───────────┐
│  Order   │────────────────────>│  Payment  │
│ Context  │  (order demande     │  Context  │
│          │   le paiement)      │           │
└────┬─────┘                     └───────────┘
     │
     │ Conformist (utilise les types Identity tels quels)
     ▼
┌──────────┐
│ Identity │
│ Context  │
└──────────┘

Shared Kernel : Money, UUID (types partages)
ACL : Order ←ACL← Catalog (Order traduit CatalogProduct en OrderLine)
```

## Relations detaillees

| Upstream | Downstream | Relation | Données echangees |
|---|---|---|---|
| Catalog | Order | ACL | productId, name, price → OrderLine |
| Inventory | Catalog | Customer/Supplier | stockLevel (dispo oui/non) |
| Order | Payment | Customer/Supplier | orderId, amount, currency |
| Identity | Order | Conformist | userId, email |
| Catalog | Inventory | Events | `product.created` → créer StockItem |
| Order | Inventory | Events | `order.paid` → decrementer stock |

## Modèle "Product" par context

```typescript
// Catalog Context
interface CatalogProduct {
  id: string;
  name: MultiLangField;
  description: MultiLangField;
  images: Image[];
  category: Category;
  slug: Slug;
  seoTitle: string;
}

// Inventory Context
interface StockItem {
  productId: string;  // Reference externe
  sku: string;
  quantity: number;
  warehouseId: string;
  reorderThreshold: number;
}

// Order Context
interface OrderLine {
  productId: string;        // Reference, pas l'entite complete
  productName: string;      // COPIE figee au moment de la commande
  unitPrice: Money;         // COPIE figee
  quantity: number;
}

// Payment Context — ne connait PAS le "produit"
interface PaymentItem {
  label: string;
  amount: Money;
  taxRate: number;
}
```

## Ce que tu aurais pu oublier

### 1. Un seul modèle Product partage

```
FAUX — interface Product utilisee par tous les contexts
  → Chaque changement impacte tous les contexts
  → Le modele grossit avec les besoins de chacun (God Object)

CORRECT — chaque context a son propre modele
  → CatalogProduct, StockItem, OrderLine, PaymentItem
  → Communication par events ou API
```

### 2. Accéder a la DB d'un autre context

```
FAUX — Order Service fait un JOIN sur la table products
  → Couplage au schema du Catalog
  → Impossible de deployer independamment

CORRECT — Order appelle l'API du Catalog ou ecoute ses events
  → Decouplage, chaque context peut evoluer independamment
```

### 3. Oublier le Shared Kernel

```
FAUX — chaque context redefinit Money, UUID, etc.
  → Duplication, divergence possible

CORRECT — Shared Kernel pour les types fondamentaux
  → Money, UUID, DateRange dans un package partage
  → Mais PAS les entites metier !
```

### 4. Confondre context et module technique

```
FAUX — bounded contexts = frontend, backend, database
  → C'est une separation technique, pas metier

CORRECT — bounded contexts = Catalog, Order, Payment
  → Separation par domaine metier
  → Chaque context peut avoir son propre front + back + DB
```
