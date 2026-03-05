# Checklist — Exercice 02 : Identifier les design patterns

## Partie A — Identification

- [ ] Extrait 1 : identifie comme **Singleton** + mentionne le risque (état global, difficulte a tester)
- [ ] Extrait 2 : identifie comme **Adapter** (traduit l'interface Stripe vers PaymentGateway)
- [ ] Extrait 3 : identifie comme **Builder** (construction pas a pas avec validation au build)
- [ ] Extrait 4 : identifie comme **Observer** (pub/sub avec EventBus)
- [ ] Extrait 5 : identifie comme **Strategy** (algorithme interchangeable a runtime)

## Partie B — Application

- [ ] Utilise le pattern **Observer** pour découvrir les events (OrderConfirmed, DeliveryDelayed)
- [ ] Utilise le pattern **Strategy** pour les canaux de notification (Email, SMS, Push)
- [ ] Cree une interface `NotificationChannel` avec une méthode `send()`
- [ ] Implemente au moins `EmailChannel` et `SmsChannel`
- [ ] Les notifications sont envoyees de manière asynchrone (non-bloquante)
- [ ] Le code est extensible : ajouter WhatsApp ne modifie pas le code existant
- [ ] Justifie pourquoi Singleton est un MAUVAIS choix ici (état partage inutile, testabilité)
