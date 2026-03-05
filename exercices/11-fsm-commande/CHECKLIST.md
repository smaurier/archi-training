# Checklist — Exercice 11 : FSM de commande

## FSM de base

- [ ] Les 5 états sont définis (created, paid, shipped, delivered, cancelled)
- [ ] Les transitions autorisees sont définies dans une matrice ou un objet
- [ ] `canTransitionTo()` retourne `true/false` sans throw
- [ ] `transitionTo()` throw si la transition est invalide

## Guards

- [ ] `created → paid` vérifié que le paiement est confirme
- [ ] `paid → shipped` vérifié l'adresse de livraison
- [ ] Seuls `created`, `paid`, `shipped` peuvent etre annules
- [ ] Les guards sont des fonctions injectees (pas hardcodees)

## Audit trail

- [ ] Chaque transition est logguee (from, to, at, by, reason)
- [ ] L'audit trail est append-only (readonly array ou push-only)
- [ ] On peut consulter l'historique complet des transitions

## Side effects

- [ ] Les side effects sont injectes via des handlers
- [ ] Chaque transition peut déclencher 0 a N side effects
- [ ] Les side effects ne bloquent pas la transition (async)

## Bonus

- [ ] La FSM est générique (réutilisable pour un autre workflow)
- [ ] L'état `refunded` est géré
