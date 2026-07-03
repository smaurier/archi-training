# Correction — Exercice 01b : Refactoring par les code smells

> Cette solution a été **vérifiée byte-pour-byte** équivalente à l'original sur 216 combinaisons (4 types × 6 pays × 3 poids × 3 prix). Le comportement observable est strictement identique — c'est la définition d'un refactoring réussi.

## Étape 1 — Diagnostic

| Smell (nom exact) | Famille | Localisation |
|---|---|---|
| **Long Parameter List** | Bloater | signature `buildOrderSummary(customerType, country, street, city, zip, items)` |
| **Data Clumps** | Bloater | `street, city, zip, country` : toujours ensemble → une adresse |
| **Long Method** | Bloater | la fonction fait sous-total + remise + port + TVA + rendu |
| **Switch Statements** | OO Abuser | `switch (customerType)` |
| **Magic Number** | Dispensable / Primitive Obsession | `2000`, `10000`, `15000`, `0.15`, `0.2`, `0.21`, `0.19` |
| **Duplicate Code** | Dispensable | deux boucles `for` quasi identiques + structure répétée des 3 paliers de port |

## Étape 3 — Séquence de refactoring appliquée

Chaque transformation = **une** technique nommée, tests relancés verts avant de continuer.

1. **Introduce Parameter Object** → `ShippingAddress`
2. **Extract Method** → `computeSubtotal`, `computeTotalWeight`, `renderLines`
3. **Replace Magic Number with Symbolic Constant** → seuils et zones nommés
4. **Replace Conditional with Polymorphism** (variante table de stratégies, idiomatique en TS) → `DISCOUNT_RATES`
5. **Extract Class / Extract Method** → calcul du port (`zoneFor` + `shippingFor`) et TVA (`vatFor`) isolés
6. **Decompose Conditional** → `zoneFor` sépare la sélection de zone du calcul de palier

## Solution

```typescript
// order-summary.refactored.ts
import type { Item } from './order-summary.js';

// Introduce Parameter Object : fin du Data Clumps + de la Long Parameter List
export type ShippingAddress = { street: string; city: string; zip: string; country: string };

// Replace Conditional with Polymorphism (table de stratégies) : plus de switch.
// Ajouter 'platinum' = une ligne, zéro modification du code existant (OCP).
const DISCOUNT_RATES: Record<string, number> = { vip: 0.15, gold: 0.1, silver: 0.05, standard: 0 };

// Replace Magic Number with Symbolic Constant
const FREE_SHIPPING_THRESHOLD = 15000;
const HEAVY_G = 10000;
const MEDIUM_G = 2000;

type ShippingTier = { light: number; medium: number; heavy: number };
const SHIPPING_ZONES: Record<string, ShippingTier> = {
  FR:    { light: 490,  medium: 900,  heavy: 1500 },
  EU:    { light: 990,  medium: 1900, heavy: 3000 },
  WORLD: { light: 1990, medium: 3900, heavy: 6000 },
};
const EU_COUNTRIES = new Set(['BE', 'DE', 'ES']);
const VAT_RATES: Record<string, number> = { FR: 0.2, BE: 0.21, DE: 0.19, ES: 0.21 };

// Extract Method : une responsabilité, un nom
function computeSubtotal(items: Item[]): number {
  return items.reduce((s, it) => s + it.price * it.qty, 0);
}
function computeTotalWeight(items: Item[]): number {
  return items.reduce((s, it) => s + it.weight * it.qty, 0);
}
function discountFor(customerType: string, subtotal: number): number {
  const rate = DISCOUNT_RATES[customerType];
  if (rate === undefined) throw new Error('unknown customer type');
  return subtotal * rate;
}
// Decompose Conditional : choisir la zone est une décision distincte du palier
function zoneFor(country: string): ShippingTier {
  if (country === 'FR') return SHIPPING_ZONES.FR;
  if (EU_COUNTRIES.has(country)) return SHIPPING_ZONES.EU;
  return SHIPPING_ZONES.WORLD;
}
function shippingFor(country: string, totalWeight: number, afterDiscount: number): number {
  if (afterDiscount > FREE_SHIPPING_THRESHOLD) return 0;
  const tier = zoneFor(country);
  if (totalWeight > HEAVY_G) return tier.heavy;
  if (totalWeight > MEDIUM_G) return tier.medium;
  return tier.light;
}
function vatFor(country: string, taxable: number): number {
  return taxable * (VAT_RATES[country] ?? 0);
}
function renderLines(items: Item[]): string {
  return items.map((it) => `  ${it.label} x${it.qty} = ${(it.price * it.qty) / 100}€\n`).join('');
}

// La fonction principale se lit maintenant « comme une phrase »
export function buildOrderSummary(addr: ShippingAddress, customerType: string, items: Item[]): string {
  const subtotal = computeSubtotal(items);
  const discount = discountFor(customerType, subtotal);
  const afterDiscount = subtotal - discount;
  const shipping = shippingFor(addr.country, computeTotalWeight(items), afterDiscount);
  const vat = vatFor(addr.country, afterDiscount + shipping);
  const total = afterDiscount + shipping + vat;

  return (
    `Livraison: ${addr.street}, ${addr.zip} ${addr.city} (${addr.country})\n` +
    renderLines(items) +
    `Sous-total: ${subtotal / 100}€\n` +
    `Remise: -${discount / 100}€\n` +
    `Frais de port: ${shipping / 100}€\n` +
    `TVA: ${vat / 100}€\n` +
    `Total: ${total / 100}€\n`
  );
}
```

> **Note sur la signature** : la version ci-dessus change la signature publique (Parameter Object en premier argument). Adapte alors le seul adaptateur `summary` du fichier de test — **jamais** les assertions :
> ```typescript
> const summary = (o: Order) =>
>   buildOrderSummary({ street: o.street, city: o.city, zip: o.zip, country: o.country }, o.customerType, o.items);
> ```
> Si tu préfères garder les tests strictement inchangés, conserve une façade positionnelle qui construit l'adresse et délègue — les deux approches sont valides.

## Bonus — corrigés

**`platinum` (20%)** : une entrée dans `DISCOUNT_RATES`, rien d'autre.
```typescript
const DISCOUNT_RATES = { vip: 0.15, gold: 0.1, silver: 0.05, standard: 0, platinum: 0.2 };
```

**Zone `US`** : une entrée dans `SHIPPING_ZONES` + une règle dans `zoneFor` — sans toucher FR/EU.
```typescript
SHIPPING_ZONES.US = { light: 2500, medium: 4500, heavy: 7000 };
// et dans zoneFor : if (country === 'US') return SHIPPING_ZONES.US;
```

**Money (fin de la Primitive Obsession)** : encapsule les centimes.
```typescript
class Money {
  private constructor(private readonly cents: number) {}
  static of(cents: number) { return new Money(cents); }
  add(m: Money) { return new Money(this.cents + m.cents); }
  scale(factor: number) { return new Money(this.cents * factor); }
  format() { return `${this.cents / 100}€`; }
}
```

## Ce que tu dois retenir

- **Un smell = un nom + une famille + une technique.** Le diagnostic précède le traitement.
- **Le filet de sécurité rend le refactoring sûr** : sans les tests golden-master, chaque pas serait un pari.
- **La plupart des techniques vont par paires** (Extract/Inline, Introduce/Remove Parameter Object). Le bon design est un équilibre, pas un extrême.
- Le résultat n'est pas « plus joli » : il est **ouvert à l'extension** (nouveau pays, nouveau type client) **sans modification** de l'existant. C'est là que le refactoring paie sa dette.

> Manuel d'atelier : [refactoring.guru/refactoring](https://refactoring.guru/refactoring) — garde-le ouvert.
