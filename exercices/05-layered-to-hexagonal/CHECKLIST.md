# Checklist — Exercice 05 : Layered to Hexagonal

## Identification des ports

- [ ] Identifie `OrderRepository` comme port sortant (persistance)
- [ ] Identifie `InventoryClient` comme port sortant (stock externe)
- [ ] Identifie `PricingClient` comme port sortant (prix externe)
- [ ] Identifie `NotificationService` comme port sortant (emails)

## Interfaces

- [ ] `OrderRepository` avec `save(order)` et optionnellement `findById(id)`
- [ ] `InventoryClient` avec `checkStock(productId)` et `reserve(productId, quantity, orderId)`
- [ ] `PricingClient` avec `getPrice(productId)`
- [ ] `NotificationService` avec `sendOrderConfirmation(order)`
- [ ] Aucune interface ne mentionne de technologie (pas de TypeORM, Axios, Redis)

## Refactoring

- [ ] `OrderService` recoit les 4 interfaces par le constructeur
- [ ] Zero `import` de librairies d'infrastructure
- [ ] Zero `new` dans le service (sauf Value Objects ou entités)
- [ ] La logique métier (verif stock → calcul prix → taxe → save → notify → reserve) est preservee
- [ ] Le calcul de taxe est explicite (pas cache dans un appel externe)

## Test

- [ ] Test de `createOrder()` avec 4 mocks injectes
- [ ] Verifie le total (prix * quantité pour chaque item)
- [ ] Verifie la taxe (20% du subtotal)
- [ ] Verifie que `reserve` est appele pour chaque item
- [ ] Verifie que `sendOrderConfirmation` est appele une fois
- [ ] Le test ne nécessité aucune infra

## Bonus

- [ ] `TaxCalculator` extrait comme service de domaine pur
- [ ] `InMemoryOrderRepository` implementant `OrderRepository`
