# Checklist — Exercice 04 : Patterns Creationnels

## Partie 1 — Factory

- [ ] Interface `Notification` avec `send(to, message)`
- [ ] 3 classes concrètes implémentent l'interface
- [ ] `NotificationFactory.create()` retourne le bon type selon le paramètre
- [ ] Une erreur est levée pour un type inconnu
- [ ] Le code client n'utilise que `Notification` — pas `EmailNotification` directement
- [ ] Je peux expliquer pourquoi Factory centralise la création

## Partie 2 — Abstract Factory

- [ ] Interfaces `UIButton` et `UIInput` définies
- [ ] 4 classes concrètes (2 × 2 thèmes)
- [ ] Interface `ThemeFactory` avec `createButton()` et `createInput()`
- [ ] `DarkThemeFactory` et `LightThemeFactory` implémentent `ThemeFactory`
- [ ] `buildLoginForm(factory)` utilise uniquement l'interface, jamais les classes concrètes
- [ ] Je peux expliquer la différence avec Factory simple

## Partie 3 — Builder

- [ ] `Pizza` a les 3 propriétés (`size`, `crust`, `toppings`)
- [ ] `PizzaBuilder` a `setSize`, `setCrust`, `addTopping`, `build`
- [ ] Chaque méthode retourne `this` pour permettre le chaînage
- [ ] `build()` remet le builder à zéro (chaque appel produit un objet indépendant)
- [ ] J'ai construit 2 pizzas différentes avec le chaînage fluent
- [ ] Je peux expliquer pourquoi retourner `this`

## Partie 4 — Prototype

- [ ] `clone()` retourne une instance indépendante (pas une référence)
- [ ] Le tableau `skills` est copié en profondeur (`[...this.skills]`)
- [ ] Modifier les skills d'Arthur ne modifie pas le template
- [ ] Modifier les skills de Lancelot ne modifie pas le template
- [ ] J'ai prouvé le bug du spread superficiel `{ ...obj }`
- [ ] Je peux expliquer quand `structuredClone()` est utile

## Partie 5 — Singleton

- [ ] Constructeur privé (`private constructor()`)
- [ ] `private static instance: AppLogger | null = null`
- [ ] `getInstance()` crée l'instance seulement si elle n'existe pas
- [ ] `Logger.getInstance() === Logger.getInstance()` retourne `true`
- [ ] Je peux expliquer pourquoi le Singleton pose problème en tests
- [ ] Je peux expliquer comment l'injection de dépendances résout ce problème
