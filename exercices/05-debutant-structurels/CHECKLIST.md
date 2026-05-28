# Checklist — Exercice 05 : Patterns Structurels

## Partie 1 — Adapter
- [ ] Interface `PaymentGateway` définie avec la signature correcte
- [ ] `StripeAdapter` implémente `PaymentGateway`
- [ ] Conversion euros → centimes présente (`* 100`)
- [ ] Le code client n'importe que `PaymentGateway`, jamais `StripeSDK` directement
- [ ] Je peux expliquer comment changer de prestataire sans toucher le code métier

## Partie 2 — Bridge
- [ ] Interface `MessageSender` définie (implémentation)
- [ ] `EmailSender` et `SlackSender` implémentent `MessageSender`
- [ ] Classe abstraite `Message` avec `protected sender: MessageSender` (abstraction)
- [ ] `UrgentMessage` et `InfoMessage` étendent `Message`
- [ ] Les 4 combinaisons fonctionnent sans créer 4 classes
- [ ] Je peux calculer l'explosion de classes sans Bridge

## Partie 3 — Composite
- [ ] Interface `FileSystemItem` avec `getName`, `getSize`, `display`
- [ ] `File` (feuille) implémente l'interface
- [ ] `Folder` (composite) délègue `getSize()` à ses enfants récursivement
- [ ] `Folder` peut contenir des `File` ET d'autres `Folder`
- [ ] `display()` indente correctement selon la profondeur
- [ ] La taille du dossier racine est correcte (somme récursive)

## Partie 4 — Decorator
- [ ] Interface `Coffee` avec `getDescription` et `getCost`
- [ ] `SimpleCoffee` classe de base
- [ ] `CoffeeDecorator` wrape un `Coffee` (composition, pas héritage direct)
- [ ] 3 decorators concrets ajoutent leur contribution
- [ ] Le chaînage fonctionne dans n'importe quel ordre
- [ ] Je peux calculer pourquoi 5 extras = 32 sous-classes sans Decorator

## Partie 5 — Facade
- [ ] 3 sous-systèmes implémentés avec leurs méthodes
- [ ] `HomeTheaterFacade` coordonne les 3 sans les exposer
- [ ] `watchMovie()` appelle les méthodes dans le bon ordre
- [ ] `endMovie()` éteint proprement
- [ ] Le client n'interagit qu'avec la Facade
- [ ] Je peux expliquer où ajouter `LightingSystem`

## Partie 6 — Flyweight
- [ ] `BulletType` contient l'état intrinsèque (partagé)
- [ ] `BulletTypeFactory` met en cache par clé composite
- [ ] `Bullet` contient l'état extrinsèque (position) + référence `BulletType`
- [ ] 15 balles → seulement 2 `BulletType` créés
- [ ] Je peux expliquer la différence état intrinsèque/extrinsèque

## Partie 7 — Proxy
- [ ] `ProxyImage` implémente la même interface que `RealImage`
- [ ] `RealImage` n'est créé qu'au premier appel de `display()`
- [ ] Le deuxième appel réutilise l'instance existante
- [ ] Je peux citer 2 autres usages du Proxy (cache, contrôle d'accès, logging...)
