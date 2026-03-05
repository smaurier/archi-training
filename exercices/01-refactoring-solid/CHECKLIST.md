# Checklist — Exercice 01 : Refactoring SOLID

## Analyse des violations

- [ ] J'ai identifie la violation SRP (OrderProcessor fait validation + calcul + persistance + email + log)
- [ ] J'ai identifie la violation OCP (réduction VIP et TVA hardcodees — pas extensible sans modifier le code)
- [ ] J'ai identifie la violation DIP (dépendance concrete sur PostgresDatabase et nodemailer)
- [ ] J'ai note l'injection SQL dans la requête (`'${order.customerEmail}'`)

## Refactoring

- [ ] J'ai cree une interface `OrderValidator` (ou classe) séparée
- [ ] J'ai cree une interface `PricingStrategy` pour les reductions
- [ ] J'ai cree une interface `TaxCalculator` pour la TVA
- [ ] J'ai cree une interface `OrderRepository` avec une méthode `save()`
- [ ] J'ai cree une interface `NotificationService` avec une méthode `notify()`
- [ ] Le `OrderProcessor` recoit TOUTES ses dépendances par le constructeur
- [ ] Le `OrderProcessor` ne contient AUCUN `new`
- [ ] Le `OrderProcessor` ne contient AUCUN import de librairie concrete (pas de `require('nodemailer')`)

## Typage

- [ ] Aucun `any` dans le code
- [ ] J'ai cree un type/interface `Order` avec les champs types
- [ ] J'ai cree un type/interface `OrderItem` avec `price: number` et `quantity: number`
- [ ] Les méthodes ont des types de retour explicites

## Bonus

- [ ] J'ai cree au moins 2 implémentations de `PricingStrategy` (VIP + Standard)
- [ ] J'ai cree au moins 2 implémentations de `TaxCalculator` (France 20% + Belgique 21%)
- [ ] J'ai écrit un test du `OrderProcessor` avec des mocks injectes
- [ ] Mon test ne touche ni la BDD ni le SMTP
