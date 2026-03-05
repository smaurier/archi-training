# Exercice integratif -- Construis ton premier domaine

Tu as lu cinq lecons de theorie. Maintenant tu codes.

Cet exercice te guide pas a pas dans la construction de vrais objets metier -- exactement
ceux de la formation. Chaque etape te dit quoi faire et pourquoi. A la fin, tu auras un
mini-domaine e-commerce fonctionnel avec des tests.

```bash
mkdir exercice-prerequis && cd exercice-prerequis
npm init -y && npm install -D typescript vitest
npx tsc --init   # assure-toi que "strict": true
```

---

## Etape 1 : Le Value Object `Money`

Un montant sans devise, c'est un nombre qui ne veut rien dire. Le `Money` colle les
deux ensemble et garantit qu'on ne peut jamais en creer un invalide.

Cree `money.ts`.

**Tache 1.1 :** Classe `Money` avec `readonly amount: number` et `readonly currency: string`.

**Tache 1.2 :** Validation dans le constructeur :
- Montant negatif -> erreur. Devise != 3 caracteres -> erreur.
- Arrondi a 2 decimales : `Math.round(amount * 100) / 100`.
- Devise en majuscules : `currency.toUpperCase()`.
- Devise par defaut : `"EUR"`.

**Tache 1.3 :** Methodes (chacune retourne un **nouveau** Money -- jamais de mutation) :

```typescript
add(other: Money): Money        // verifie meme devise
subtract(other: Money): Money   // verifie meme devise
multiply(factor: number): Money
isZero(): boolean
isPositive(): boolean
equals(other: Money): boolean
toString(): string               // "19.99 EUR"
```

Extrais la verification de devise dans `private assertSameCurrency(other: Money): void`.

**Tache 1.4 :** Verifie l'immutabilite :

```typescript
const price = new Money(19.99, "EUR");
const total = price.add(new Money(4, "EUR"));
console.log(price.amount);  // toujours 19.99
console.log(total.amount);  // 23.99
```

---

## Etape 2 : Le Value Object `Email`

Un email n'est pas une string quelconque. Le VO garantit qu'on ne transporte jamais une
adresse invalide dans le systeme. Cree `email.ts`.

**Tache 2.1 :** Classe `Email` avec `readonly value: string`.

**Tache 2.2 :** Validation : pas vide, contient `@`, au moins 5 caracteres.
Normalise : `value.toLowerCase().trim()`.

**Tache 2.3 :** Methodes :

```typescript
get domain(): string         // partie apres @
equals(other: Email): boolean
toString(): string
```

**Tache 2.4 :** Essaie `email.value = "x"` -- TypeScript doit bloquer.

---

## Etape 3 : Le `CartItem`

Une ligne de panier : un produit avec une quantite. Cree `cart-item.ts`.

**Tache 3.1 :** Classe avec `readonly productId`, `readonly productName`,
`readonly unitPrice: Money`, `private _quantity: number`. Utilise un objet parametre :

```typescript
constructor(params: {
  productId: string; productName: string; unitPrice: Money; quantity: number;
}) { /* valide quantity > 0, assigne les proprietes */ }
```

**Tache 3.2 :** Getter `quantity`, getter `total` qui retourne
`this.unitPrice.multiply(this._quantity)`.

**Tache 3.3 :** Methode `updateQuantity(newQuantity: number): void` -- valide > 0.

```typescript
const item = new CartItem({
  productId: "prod-1", productName: "Clavier",
  unitPrice: new Money(89.99, "EUR"), quantity: 2,
});
console.log(item.total.toString());  // "179.98 EUR"
```

---

## Etape 4 : L'entite `Cart`

Le `Cart` est un agregat qui protege ses invariants. Regle : un meme produit n'apparait
qu'une fois -- ajouter un produit deja present incremente la quantite. Cree `cart.ts`.

**Tache 4.1 :** Classe avec `readonly id`, `readonly userId`, `private _items: CartItem[]`.
Genere `id` avec `crypto.randomUUID()` si non fourni.

**Tache 4.2 :** Getters :

```typescript
get items(): ReadonlyArray<CartItem>  // copie pour proteger le tableau
get isEmpty(): boolean
get itemCount(): number               // somme des quantites
get total(): Money                    // somme des totaux
```

**Tache 4.3 :** Methode `addItem(item: CartItem): void` -- gere le doublon :

```typescript
const existing = this._items.find(i => i.productId === item.productId);
if (existing) existing.updateQuantity(existing.quantity + item.quantity);
else this._items.push(item);
```

**Tache 4.4 :** Methodes `removeItem(productId)`, `updateItemQuantity(productId, quantity)`
(erreur si absent), `clear()`.

Teste le scenario complet :

```typescript
const cart = new Cart({ userId: "user-42" });
cart.addItem(new CartItem({ productId: "p1", productName: "Clavier", unitPrice: new Money(89.99), quantity: 1 }));
cart.addItem(new CartItem({ productId: "p2", productName: "Souris", unitPrice: new Money(49.99), quantity: 2 }));
console.log(cart.total.toString());  // "189.97 EUR"

cart.addItem(new CartItem({ productId: "p1", productName: "Clavier", unitPrice: new Money(89.99), quantity: 1 }));
console.log(cart.itemCount);         // 4 (2 claviers + 2 souris)
```

---

## Etape 5 : Les tests avec vitest

Les tests protegent les invariants quand quelqu'un modifie le code plus tard.

**Tache 5.1 :** Cree `money.test.ts` :

```typescript
import { describe, it, expect } from "vitest";
import { Money } from "./money";

describe("Money", () => {
  it("cree un Money valide", () => {
    const m = new Money(10.5, "EUR");
    expect(m.amount).toBe(10.5);
    expect(m.currency).toBe("EUR");
  });
  it("arrondit a 2 decimales", () => expect(new Money(10.999).amount).toBe(11));
  it("rejette un montant negatif", () => expect(() => new Money(-1)).toThrow());
  it("rejette une devise invalide", () => expect(() => new Money(10, "EU")).toThrow());
  // Ajoute : add, subtract, multiply, equals, toString, devises incompatibles
});
```

**Tache 5.2 :** Cree `email.test.ts` -- creation valide, normalisation, rejet des
invalides (vide, sans @, trop court), getter `domain`, methode `equals`.

**Tache 5.3 :** Cree `cart.test.ts` -- panier vide a total 0, ajout met a jour
`itemCount` et `total`, doublon incremente la quantite, `removeItem`, `clear`.

```bash
npx vitest run
```

---

## Etape 6 : Compare avec la reference

Ouvre les fichiers de reference de la formation et compare :

- `src/domain/shared/money.ts` et `src/domain/shared/money.test.ts`
- `src/domain/shared/email.ts`
- `src/domain/shared/types.ts` (les branded types : UUID, CurrencyCode)
- `src/domain/cart/cart-item.ts` et `src/domain/cart/cart.ts`

Differences a observer : la reference utilise des **branded types** pour les identifiants,
un defaut `"EUR"`, et un objet parametre dans les constructeurs. Ton code peut etre
different -- l'important c'est que les invariants soient respectes.

**Tache bonus :** Remplace tes `string` par des branded types (`ProductId`, `UserId`)
en suivant le pattern de `src/domain/shared/types.ts`. Observe les erreurs de compilation
-- chacune represente un endroit ou une confusion etait possible.

---

## Ce que tu retiens

- Un **Value Object** (Money, Email) encapsule une valeur avec sa validation. Immutable,
  compare par valeur.
- Une **entite** (Cart) a une identite propre et protege ses **invariants**.
- La **composition** (CartItem contient Money) reutilise les VO sans heritage.
- Les **tests** documentent les invariants et empechent les regressions.
- Les **branded types** empechent de confondre des valeurs de meme type sous-jacent.

Si tous tes tests passent, tu es pret pour la formation.

---

Prochaine etape : [Module 00 -- Qu'est-ce que l'architecture logicielle ?](../00-fondamentaux/01-quest-ce-que-architecture.md)
