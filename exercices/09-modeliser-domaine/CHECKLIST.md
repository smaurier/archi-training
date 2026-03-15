# Checklist — Exercice 09 : Modéliser un domaine e-commerce

## Classification

- [ ] Product = Entité (identité propre, cycle de vie)
- [ ] Price / Money = Value Object (défini par sa valeur, immutable)
- [ ] Address = Value Object (deux adresses identiques sont egales)
- [ ] Email = Value Object (validation + egalite par valeur)
- [ ] Order = Entité + Agregat Root
- [ ] OrderLine = Entité (identité dans l'agregat) ou Value Object (selon le choix)

## Value Objects

- [ ] Tous les champs sont `readonly`
- [ ] La validation se fait dans le constructeur (fail fast)
- [ ] `Money` refuse les montants negatifs
- [ ] `Email` valide le format
- [ ] `Address` à une méthode `equals()` basee sur les champs
- [ ] Aucun setter

## Entités

- [ ] Product à un `id: string` (UUID)
- [ ] Product a des méthodes métier (`decrementStock()`, pas `setStock()`)
- [ ] Order est l'agregat root
- [ ] Les OrderLines ne sont accessibles que via Order

## Agregat Order

- [ ] Le constructeur exige au moins 1 ligne
- [ ] `addLine()` vérifié la validite
- [ ] `getTotal()` calcule dynamiquement depuis les lignes
- [ ] Les OrderLines sont exposees en lecture seule (copie ou getter immutable)
- [ ] L'invariant "stock suffisant" est vérifié

## Bonus

- [ ] `MultiLangField` est un value object avec `get(locale)` et `equals()`
- [ ] Au moins une Spécification implémentée (ex : `InStockSpecification`)
