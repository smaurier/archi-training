# Classes et immutabilite -- Pourquoi `readonly` va devenir ton meilleur ami

Si tu fais du React, tu utilises probablement très peu les classes. Des composants
fonctionnels, des hooks, des objets litteraux -- pourquoi s'embeter avec `class` ?

Parce que les classes en TypeScript ne servent pas à faire de l'héritage a rallonge
comme dans le Java de 2005. Elles servent a **proteger tes donnees** -- créer des
objets qui ne peuvent pas etre dans un état invalide. Dans la formation, tu vas
croiser le pattern **Value Object**. Cette leçon te donne les briques pour le construire.

---

## Le raccourci constructeur

Une classe TypeScript classique est verbeuse. Le raccourci constructeur regle ça :

```typescript
// Verbeux
class Product {
  id: string;
  name: string;
  price: number;
  constructor(id: string, name: string, price: number) {
    this.id = id; this.name = name; this.price = price;
  }
}

// Raccourci -- strictement equivalent
class Product {
  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly price: number,
  ) {}
}
```

Les modificateurs devant les paramètres creent et assignent automatiquement les
propriétés :

| Modificateur | Visible dehors | Modifiable |
|---|---|---|
| `public` | oui | oui |
| `private` | non | oui (interne) |
| `readonly` | oui | non |
| `public readonly` | oui | non |
| `private readonly` | non | non |

**Essaie :** Cree une classe `Product` avec `id` et `name` en `public readonly` et
`price` en `private readonly`. Essaie de modifier `product.price` -- que dit TypeScript ?

---

## Getters : exposer sans laisser modifier

Quand un champ est `private`, un getter l'expose en lecture seule :

```typescript
class CartItem {
  constructor(
    private readonly product: Product,
    private readonly _quantity: number,
  ) {
    if (_quantity <= 0) throw new Error("La quantite doit etre positive");
  }

  get quantity(): number { return this._quantity; }
  get total(): number { return this.product.price * this._quantity; }
  get productName(): string { return this.product.name; }

  withQuantity(newQuantity: number): CartItem {
    return new CartItem(this.product, newQuantity);
  }
}
```

Remarque `withQuantity` : au lieu de modifier l'objet, elle en créé un nouveau.
C'est le debut de l'immutabilite.

**Essaie :** Ajoute un getter `unitPrice` a `CartItem` et une méthode
`withIncrementedQuantity()` qui retourne un nouveau `CartItem` avec quantite + 1.

---

## Champs prives : `private` vs `#`

```typescript
class Example {
  private tsPrivate: string;   // prive au compile-time seulement
  #jsPrivate: string;          // prive au runtime (ES2022)

  constructor(value: string) {
    this.tsPrivate = value;
    this.#jsPrivate = value;
  }
}
const ex = new Example("secret");
// (ex as any).tsPrivate -> accessible a l'execution (triche)
// ex.#jsPrivate -> erreur TS ET erreur JavaScript
```

Pour les Value Objects, `private readonly` suffit. Le `#` est utile si tu veux une
protection au runtime aussi.

**Essaie :** Cree une classe `Secret` avec un champ `#value: string`. Essaie d'y
acceder depuis l'exterieur. Ajoute une méthode `reveal()` qui retourne les trois
premiers caracteres suivis de `"***"`.

---

## Pourquoi l'immutabilite compte

En React, tu sais déjà qu'on ne modifie pas le state directement. L'immutabilite
dans le domaine metier suit la même logique : un prix ne "change" pas -- tu en
crees un nouveau.

Pourquoi c'est important :

1. **Pas d'effets de bord** -- personne ne peut modifier un objet après sa création.
2. **Egalite previsible** -- deux objets avec les memes valeurs sont interchangeables.
3. **Historique gratuit** -- chaque modification créé un nouvel objet.

---

## Le pattern Value Object : `Money`

Voici le pattern central de la formation, qui combine toutes les briques :

```typescript
class Money {
  constructor(
    public readonly amount: number,
    public readonly currency: string,
  ) {
    if (amount < 0) throw new Error("Le montant ne peut pas etre negatif");
    if (!["EUR", "USD", "GBP"].includes(currency)) {
      throw new Error(`Devise non supportee : ${currency}`);
    }
  }

  add(other: Money): Money {
    if (this.currency !== other.currency) {
      throw new Error("Devises incompatibles");
    }
    return new Money(this.amount + other.amount, this.currency);
  }

  multiply(factor: number): Money {
    return new Money(this.amount * factor, this.currency);
  }

  equals(other: Money): boolean {
    return this.amount === other.amount && this.currency === other.currency;
  }

  toString(): string { return `${this.amount.toFixed(2)} ${this.currency}`; }
}

const price = new Money(19.99, "EUR");
const tax = new Money(4.00, "EUR");
const total = price.add(tax);    // nouveau Money(23.99, "EUR")
// price vaut toujours 19.99 EUR -- il n'a pas bouge
```

Validation dans le constructeur, `readonly` partout, méthodes qui retournent de
nouvelles instances, méthode `equals` pour comparer par valeur.

**Essaie :** Ajoute une méthode `subtract(other: Money): Money` a `Money`. N'oublie
pas la vérification de devise. Enchaine : `price.add(tax).subtract(discount)`.
Verifie que `price` n'a pas change.

**Essaie :** Cree une classe `Email` qui prend une string, valide qu'elle contient
`@` et `.`, stocke la valeur en `readonly`, et expose `equals`. Essaie de modifier
`email.value` après création.

---

## `as const` -- L'immutabilite pour les litteraux

`as const` transforme un objet litteral en version `readonly` avec des literal types :

```typescript
const config = { theme: "dark", timeout: 5000 } as const;
// type: { readonly theme: "dark"; readonly timeout: 5000 }
// config.timeout = 9999; -> Erreur !
```

| | `readonly` | `as const` |
|---|---|---|
| S'applique a | une propriété | un litteral entier |
| Profondeur | un niveau | récursif |
| Types | normaux | literal types |
| Utilisation | classes, interfaces | objets, tableaux, constantes |

`as const` est ideal pour les enums maison :

```typescript
const CURRENCIES = ["EUR", "USD", "GBP"] as const;
type Currency = typeof CURRENCIES[number];  // "EUR" | "USD" | "GBP"
```

**Essaie :** Cree `const ROLES = ["admin", "editor", "viewer"] as const` et dérivé
un type `Role`. Cree une fonction `hasRole(user: { roles: Role[] }, role: Role): boolean`.

---

## Les limites de `Object.freeze`

Tu pourrais te dire "pourquoi pas juste `Object.freeze` ?" Le problème : c'est shallow.

```typescript
const product = Object.freeze({
  id: "1", name: "Clavier", tags: ["peripherique", "gaming"],
});
product.name = "Souris";       // Erreur runtime (mode strict)
product.tags.push("promo");    // CA MARCHE ! freeze est superficiel
```

Les objets imbriques restent mutables. Prefere `readonly` et les types pour une
protection au compile-time, complete et gratuite.

**Essaie :** Cree un objet avec `tags: string[]`, applique `Object.freeze`. Verifie
que `push` marche toujours sur `tags`. Puis créé un type `DeepReadonly` récursif
et applique-le -- TypeScript bloque-t-il le `push` ?

---

## Ce que tu retiens

- Le raccourci constructeur (`public readonly` dans les paramètres) elimine le
  boilerplate des classes TypeScript.
- `readonly` empeche la reassignation au compile-time -- ta première ligne de defense.
- `as const` gele un litteral en profondeur avec des literal types -- ideal pour les
  configs et enums maison.
- `Object.freeze` est shallow et runtime seulement -- préféré les types.
- Le pattern Value Object (validation + `readonly` + nouvelles instances) est la
  fondation de la modelisation domaine dans cette formation.

---

Leçon suivante : [Async et gestion d'erreurs -- Promets-moi que tu n'ecriras plus `.then().catch()`](./04-async-error-handling.md)
