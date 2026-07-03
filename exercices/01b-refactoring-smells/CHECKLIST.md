# Checklist — Exercice 01b : Refactoring par les code smells

## Diagnostic (nommer les smells)

- [ ] J'ai identifié **Long Parameter List** (Bloater) sur la signature de `buildOrderSummary` (6 paramètres)
- [ ] J'ai identifié **Data Clumps** (Bloater) : `street, city, zip, country` voyagent toujours ensemble → une adresse
- [ ] J'ai identifié **Long Method** (Bloater) : une seule fonction fait sous-total + remise + port + TVA + rendu
- [ ] J'ai identifié **Switch Statements** (OO Abuser) sur `customerType`
- [ ] J'ai identifié **Magic Number** (via Primitive Obsession / Dispensables) : 2000, 10000, 15000, 0.15, 0.2…
- [ ] J'ai identifié **Duplicate Code** (Dispensable) : les deux boucles `for` (sous-total et poids) et la structure répétée des paliers de port
- [ ] J'ai nommé la **famille** de chaque smell

## Refactoring (techniques nommées)

- [ ] **Introduce Parameter Object** : `ShippingAddress { street, city, zip, country }`
- [ ] **Extract Method** : `computeSubtotal`, `computeTotalWeight`, `renderLines`
- [ ] **Replace Magic Number with Symbolic Constant** : tous les seuils et taux nommés
- [ ] **Replace Conditional with Polymorphism** (ou table de stratégies) : remise par type de client, plus de `switch`
- [ ] **Extract Class** : `ShippingCalculator` (zone + poids) isolée
- [ ] **Extract Class** : `TaxPolicy` (TVA par pays) isolée
- [ ] **Decompose Conditional** : logique zone/poids lisible

## Invariant (le plus important)

- [ ] Les tests `order-summary.test.ts` sont restés **verts à chaque étape**
- [ ] Je n'ai **jamais** modifié une assertion (seulement l'adaptateur `summary` si j'ai changé la signature)
- [ ] Les sorties texte sont **identiques** à la version d'origine
- [ ] Ajouter un pays ou un type de client ne demande plus de modifier le code existant (OCP)

## Bonus

- [ ] J'ai ajouté `platinum` (20%) sans modifier les stratégies existantes
- [ ] J'ai ajouté la zone `US` sans toucher au calcul FR/EU
- [ ] J'ai introduit un value object `Money` (fin de la Primitive Obsession sur les montants)
- [ ] J'ai supprimé tout Data Class / Dead Code résiduel
