# Correction — Exercice 09 : Modéliser un domaine e-commerce

## Résultat attendu

Un domaine riche avec des value objects immutables, des entités avec méthodes métier, et un agregat Order qui protégé ses invariants.

## Classification

| Concept | Type | Justification |
|---|---|---|
| Product | Entité | Identité propre (UUID), cycle de vie, mutable |
| Money | Value Object | Défini par (amount, currency), immutable, egalite par valeur |
| Address | Value Object | Défini par ses champs, egalite par valeur |
| Email | Value Object | Validation + egalite par valeur |
| Order | Entité + Agregat Root | Identité propre, contient les OrderLines |
| OrderLine | Value Object (dans l'agregat) | Immutable une fois cree, défini par ses valeurs |
| Category | Entité | Identité propre, nom modifiable |

## Value Objects

```typescript
// value-objects/money.ts
export class Money {
  readonly amount: number;
  readonly currency: string;

  constructor(amount: number, currency: string = 'EUR') {
    if (amount < 0) throw new Error('Amount cannot be negative');
    if (!currency || currency.length !== 3) throw new Error('Invalid currency code');
    this.amount = Math.round(amount * 100) / 100; // Arrondi a 2 decimales
    this.currency = currency;
  }

  add(other: Money): Money {
    if (this.currency !== other.currency) {
      throw new Error(`Cannot add ${this.currency} and ${other.currency}`);
    }
    return new Money(this.amount + other.amount, this.currency);
  }

  multiply(factor: number): Money {
    return new Money(this.amount * factor, this.currency);
  }

  equals(other: Money): boolean {
    return this.amount === other.amount && this.currency === other.currency;
  }
}
```

```typescript
// value-objects/email.ts
export class Email {
  readonly value: string;

  constructor(value: string) {
    if (!value || !value.includes('@') || value.length < 5) {
      throw new Error(`Invalid email: ${value}`);
    }
    this.value = value.toLowerCase().trim();
  }

  equals(other: Email): boolean {
    return this.value === other.value;
  }
}
```

```typescript
// value-objects/address.ts
export class Address {
  constructor(
    readonly street: string,
    readonly postalCode: string,
    readonly city: string,
    readonly country: string,
  ) {
    if (!street || !postalCode || !city || !country) {
      throw new Error('All address fields are required');
    }
  }

  equals(other: Address): boolean {
    return (
      this.street === other.street &&
      this.postalCode === other.postalCode &&
      this.city === other.city &&
      this.country === other.country
    );
  }
}
```

```typescript
// value-objects/multi-lang-field.ts
export class MultiLangField {
  constructor(private readonly translations: Readonly<Record<string, string>>) {
    if (Object.keys(translations).length === 0) {
      throw new Error('At least one translation is required');
    }
  }

  get(locale: string, fallback: string = 'fr'): string {
    return this.translations[locale] ?? this.translations[fallback] ?? '';
  }

  equals(other: MultiLangField): boolean {
    const keys = Object.keys(this.translations);
    const otherKeys = Object.keys(other.translations);
    if (keys.length !== otherKeys.length) return false;
    return keys.every((k) => this.translations[k] === other.translations[k]);
  }
}
```

## Entités

```typescript
// entities/product.ts
export class Product {
  readonly id: string;
  private _name: MultiLangField;
  private _price: Money;
  private _stock: number;
  private _categoryId: string;

  constructor(params: {
    id?: string;
    name: MultiLangField;
    price: Money;
    stock: number;
    categoryId: string;
  }) {
    this.id = params.id ?? crypto.randomUUID();
    this._name = params.name;
    this._price = params.price;
    this._stock = params.stock;
    this._categoryId = params.categoryId;

    if (params.stock < 0) throw new Error('Stock cannot be negative');
  }

  get name(): MultiLangField { return this._name; }
  get price(): Money { return this._price; }
  get stock(): number { return this._stock; }
  get categoryId(): string { return this._categoryId; }

  // Methodes metier — pas de setters !
  canFulfill(quantity: number): boolean {
    return this._stock >= quantity;
  }

  decrementStock(quantity: number): void {
    if (!this.canFulfill(quantity)) {
      throw new Error(`Insufficient stock: ${this._stock} < ${quantity}`);
    }
    this._stock -= quantity;
  }

  updatePrice(newPrice: Money): void {
    this._price = newPrice;
  }
}
```

## Agregat Order

```typescript
// value-objects/order-line.ts
export class OrderLine {
  constructor(
    readonly productId: string,
    readonly productName: string,
    readonly unitPrice: Money,   // Prix FIGE au moment de la commande
    readonly quantity: number,
  ) {
    if (quantity <= 0) throw new Error('Quantity must be positive');
  }

  get total(): Money {
    return this.unitPrice.multiply(this.quantity);
  }
}
```

```typescript
// entities/order.ts (Agregat Root)
export class Order {
  readonly id: string;
  private _lines: OrderLine[];
  private _shippingAddress: Address;
  private _customerEmail: Email;
  private _status: 'created' | 'paid' | 'shipped' | 'delivered' | 'cancelled';
  readonly createdAt: Date;

  constructor(params: {
    id?: string;
    lines: OrderLine[];
    shippingAddress: Address;
    customerEmail: Email;
  }) {
    if (params.lines.length === 0) {
      throw new Error('Order must have at least one line');
    }

    this.id = params.id ?? crypto.randomUUID();
    this._lines = [...params.lines]; // Copie defensive
    this._shippingAddress = params.shippingAddress;
    this._customerEmail = params.customerEmail;
    this._status = 'created';
    this.createdAt = new Date();
  }

  // Lecture seule — retourne une copie
  get lines(): ReadonlyArray<OrderLine> {
    return [...this._lines];
  }

  get status(): string { return this._status; }
  get shippingAddress(): Address { return this._shippingAddress; }
  get customerEmail(): Email { return this._customerEmail; }

  get total(): Money {
    return this._lines.reduce(
      (sum, line) => sum.add(line.total),
      new Money(0),
    );
  }

  addLine(line: OrderLine): void {
    if (this._status !== 'created') {
      throw new Error('Cannot modify a confirmed order');
    }
    this._lines.push(line);
  }

  removeLine(productId: string): void {
    if (this._status !== 'created') {
      throw new Error('Cannot modify a confirmed order');
    }
    this._lines = this._lines.filter((l) => l.productId !== productId);
    if (this._lines.length === 0) {
      throw new Error('Order must have at least one line');
    }
  }

  markAsPaid(): void {
    if (this._status !== 'created') {
      throw new Error(`Cannot pay from status: ${this._status}`);
    }
    this._status = 'paid';
  }

  ship(): void {
    if (this._status !== 'paid') {
      throw new Error(`Cannot ship from status: ${this._status}`);
    }
    this._status = 'shipped';
  }

  cancel(): void {
    if (this._status === 'delivered' || this._status === 'cancelled') {
      throw new Error(`Cannot cancel from status: ${this._status}`);
    }
    this._status = 'cancelled';
  }
}
```

## Alternatives et arbitrages

> En architecture, ta valeur n'est pas de connaître UNE solution,
> mais de savoir POURQUOI tu choisis celle-ci plutôt qu'une autre.

### Option A : DDD riche (solution présentée)
**Quand la choisir :** Domaine complexe avec des invariants métier (stock ne peut pas être négatif, prix doit être positif), logique qui évolue fréquemment, besoin de protéger les règles métier.
**Limites :** Plus de code pour des entités simples, les développeurs CRUD doivent changer de mindset, mapping ORM plus complexe.

### Option B : Modèle anémique (CRUD)
**Quand la choisir :** Application principalement CRUD, logique métier minimale, prototypage rapide, équipe habituée aux ORMs type Active Record.
**Limites :** La logique métier fuit dans les services, pas de protection des invariants, duplication de validations, difficulté à tester le domaine isolément.

### Option C : Domaine fonctionnel (immutable)
**Quand la choisir :** Équipe avec culture FP, besoin d'event sourcing (les entités sont reconstituées depuis les events), domaine très testable (fonctions pures).
**Limites :** Moins idiomatique en TypeScript/Java, nécessite des patterns spécifiques (lenses, copy-on-write), ORM mapping plus complexe.

### Matrice de décision
| Critère | DDD riche | Anémique CRUD | Fonctionnel immutable |
|---|---|---|---|
| Protection des invariants | Excellente | Faible | Excellente |
| Courbe d'apprentissage | Moyenne | Faible | Élevée |
| Compatibilité ORM | Bonne | Excellente | Moyenne |
| Testabilité | Très bonne | Moyenne | Excellente |
| Event sourcing ready | Possible | Difficile | Natif |

### Pour ShopArch, on choisit...
Le DDD riche car le domaine e-commerce a des invariants critiques : un Money ne peut pas être négatif, un Product doit avoir un prix, le stock doit être cohérent. Le modèle anémique laisserait ces règles éparpillées dans les services. On ne va pas jusqu'au fonctionnel immutable car l'équipe est plus à l'aise avec l'approche OOP et on n'a pas besoin d'event sourcing au Module 00.

---

## Ce que tu aurais pu oublier

### 1. Utiliser un setter pour le stock

```typescript
// FAUX — setter public, pas de validation
product.stock = -5; // Invalide mais accepte

// CORRECT — methode metier avec validation
product.decrementStock(3); // Throw si stock insuffisant
```

### 2. Oublier de figer le prix dans OrderLine

```typescript
// FAUX — reference au produit (le prix peut changer apres la commande)
class OrderLine {
  constructor(readonly product: Product, readonly quantity: number) {}
  get total() { return product.price.multiply(this.quantity); }
}

// CORRECT — prix copie au moment de la creation
class OrderLine {
  constructor(
    readonly productId: string,
    readonly unitPrice: Money, // Fige !
    readonly quantity: number,
  ) {}
}
```

### 3. Exposer directement le tableau de lignes

```typescript
// FAUX — l'exterieur peut modifier les lignes
get lines(): OrderLine[] { return this._lines; }
// order.lines.push(fakeLine); // Contourne le domain !

// CORRECT — copie defensive
get lines(): ReadonlyArray<OrderLine> { return [...this._lines]; }
```

### 4. Money avec des calculs flottants

```typescript
// FAUX — 0.1 + 0.2 = 0.30000000000000004
new Money(0.1 + 0.2); // 0.30000000000000004€

// CORRECT — arrondir a 2 decimales dans le constructeur
this.amount = Math.round(amount * 100) / 100;
// Ou mieux : travailler en centimes (integers)
```

### 5. Value Object mutable

```typescript
// FAUX — l'adresse peut etre modifiee
class Address {
  street: string;  // Mutable !
  setStreet(s: string) { this.street = s; }
}

// CORRECT — tous les champs readonly, aucun setter
class Address {
  constructor(
    readonly street: string,
    readonly city: string,
  ) {}
}
```
