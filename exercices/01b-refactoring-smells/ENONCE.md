# Exercice 01b — Refactoring par les code smells

> 🟢 **Difficulté** : Découverte → Intermédiaire | **Temps estimé** : 1h30 | **Ère** : 1 — Les Fondations
>
> **Prérequis** : Cours 05 — Code smells et refactoring

## Objectif

Prendre un module qui **fonctionne mais qui pue**, **nommer précisément** chaque code smell (avec sa famille), puis le soigner en appliquant les **techniques de refactoring nommées** — sans jamais casser le comportement. Les tests fournis sont ton filet de sécurité : ils doivent rester **verts à chaque étape**.

C'est le geste réel du métier : tu ne "réécris pas mieux au feeling", tu diagnostiques et tu appliques un traitement connu.

## Contexte — ShopArch

Le calcul du récapitulatif de commande de ShopArch (prix, remise, frais de port, TVA) a été écrit sous pression par un stagiaire pressé. Il marche, les tests passent — mais chaque évolution est un cauchemar. Ta mission : le rendre sain **sans changer une seule sortie**.

## Le code à refactorer

```typescript
// order-summary.ts — fonctionne, mais accumule les smells

type Item = { sku: string; label: string; price: number; qty: number; weight: number };

function buildOrderSummary(
  customerType: string,
  country: string,
  street: string,
  city: string,
  zip: string,
  items: Item[],
): string {
  // --- sous-total ---
  let subtotal = 0;
  for (const it of items) {
    subtotal += it.price * it.qty;
  }

  // --- remise selon le type de client ---
  let discount = 0;
  switch (customerType) {
    case 'vip':
      discount = subtotal * 0.15;
      break;
    case 'gold':
      discount = subtotal * 0.1;
      break;
    case 'silver':
      discount = subtotal * 0.05;
      break;
    case 'standard':
      discount = 0;
      break;
    default:
      throw new Error('unknown customer type');
  }
  const afterDiscount = subtotal - discount;

  // --- frais de port selon poids + pays ---
  let totalWeight = 0;
  for (const it of items) {
    totalWeight += it.weight * it.qty;
  }
  let shipping = 0;
  if (country === 'FR') {
    if (totalWeight > 10000) shipping = 1500;
    else if (totalWeight > 2000) shipping = 900;
    else shipping = 490;
  } else if (country === 'BE' || country === 'DE' || country === 'ES') {
    if (totalWeight > 10000) shipping = 3000;
    else if (totalWeight > 2000) shipping = 1900;
    else shipping = 990;
  } else {
    if (totalWeight > 10000) shipping = 6000;
    else if (totalWeight > 2000) shipping = 3900;
    else shipping = 1990;
  }
  // livraison offerte au-dessus de 15000
  if (afterDiscount > 15000) shipping = 0;

  // --- TVA selon pays ---
  let vatRate = 0;
  if (country === 'FR') vatRate = 0.2;
  else if (country === 'BE') vatRate = 0.21;
  else if (country === 'DE') vatRate = 0.19;
  else if (country === 'ES') vatRate = 0.21;
  else vatRate = 0;
  const vat = (afterDiscount + shipping) * vatRate;

  const total = afterDiscount + shipping + vat;

  // --- rendu texte ---
  let out = '';
  out += `Livraison: ${street}, ${zip} ${city} (${country})\n`;
  for (const it of items) {
    out += `  ${it.label} x${it.qty} = ${(it.price * it.qty) / 100}€\n`;
  }
  out += `Sous-total: ${subtotal / 100}€\n`;
  out += `Remise: -${discount / 100}€\n`;
  out += `Frais de port: ${shipping / 100}€\n`;
  out += `TVA: ${vat / 100}€\n`;
  out += `Total: ${total / 100}€\n`;
  return out;
}
```

> Les montants sont en **centimes** (entiers) — d'où les `/100` à l'affichage. C'est volontaire (on ne calcule jamais de l'argent en flottants).

## Instructions

### Étape 1 — Diagnostiquer (nommer les smells)

Sans toucher au code, remplis le tableau. Pour **chaque** smell, donne son **nom exact**, sa **famille** (Bloaters / OO Abusers / Change Preventers / Dispensables / Couplers) et **où** tu le vois.

| Smell (nom exact) | Famille | Localisation |
|---|---|---|
| … | … | … |

Il y en a **au moins 6**. Indices : la signature de `buildOrderSummary`, les deux `switch`/chaînes de `if` sur `country`, les nombres qui apparaissent sans nom, les paramètres d'adresse qui voyagent ensemble, le calcul qui fait tout dans une seule fonction.

### Étape 2 — Établir le filet de sécurité

Lance les tests fournis (`order-summary.test.ts`). **Ils doivent être verts avant de commencer.** Sinon, stop : pas de filet, pas de refactoring.

### Étape 3 — Refactorer par petits pas nommés

Pour **chaque** transformation : tu appliques **une** technique nommée, tu relances les tests, tu vérifies le vert, tu continues. Séquence attendue (adapte si besoin, mais garde les noms) :

1. **Introduce Parameter Object** — `street, city, zip, country` → un objet `ShippingAddress`.
2. **Extract Method** — sortir `computeSubtotal`, `computeTotalWeight`, `renderLines`.
3. **Replace Magic Number with Symbolic Constant** — tous les seuils (2000, 10000, 15000) et taux (0.15, 0.2…) reçoivent un nom.
4. **Replace Conditional with Polymorphism** (ou table de stratégies) — la remise par `customerType` : une stratégie par type, plus de `switch`.
5. **Extract Class** — `ShippingCalculator` (frais selon zone + poids) et `TaxPolicy` (TVA par pays) : chacune isole une raison de changer (anti Divergent Change / Shotgun Surgery).
6. **Decompose Conditional** — rendre lisible la logique zone/poids.

### Étape 4 — Vérifier l'invariant

Le refactoring est réussi **si et seulement si** : mêmes sorties qu'avant (tests verts, y compris les tests de non-régression sur le texte produit), et ajouter un nouveau pays ou un nouveau type de client ne demande plus de modifier le code existant (OCP).

### Bonus (pour être super fort)

- Ajoute un type client `platinum` (20% de remise) **sans modifier** les stratégies existantes.
- Ajoute une zone d'expédition `US` **sans toucher** au calcul FR/EU.
- Remplace le smell **Primitive Obsession** sur les montants : introduis un value object `Money` (centimes) avec `add`, `multiply`, `format`. Vérifie que les tests passent toujours.
- Repère et retire tout **Data Class** / **Dead Code** résiduel.

## Contraintes

- TypeScript strict, zéro `any`.
- **Comportement identique** : aucune sortie ne change (les tests texte font foi).
- Une technique nommée par commit (ou par étape) — pas de big-bang.
- Chaque nombre magique nommé ; chaque `switch` sur un type éliminé.

## Fichiers

- `starter/order-summary.ts` — le code à refactorer
- `starter/order-summary.test.ts` — ton filet de sécurité (ne pas affaiblir ; tu peux en **ajouter**)
- Corrigé : `CORRECTION.md`

> **Réflexe à ancrer** : quand un smell apparaît, ouvre sa fiche sur [refactoring.guru/refactoring/smells](https://refactoring.guru/refactoring/smells) — elle te donne la liste des techniques applicables et le pas-à-pas. Ce site est ton manuel d'atelier.
