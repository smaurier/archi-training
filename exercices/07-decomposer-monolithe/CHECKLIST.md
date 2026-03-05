# Checklist — Exercice 07 : Decomposer un monolithe

## Analyse des dépendances

- [ ] J'ai identifie que `OrderService` dépend de 6 autres modules (cart, payment, user, notification, catalog, analytics)
- [ ] J'ai dessine le graphe de dépendances complet
- [ ] J'ai identifie les dépendances partagees (database, auth, tenant filter)
- [ ] J'ai note les appels synchrones critiques (stock check, payment)

## Service boundaries

- [ ] J'ai regroupe les modules en services logiques (pas 1 module = 1 service naif)
- [ ] J'ai justifie pourquoi certains modules restent ensemble (ex : catalog + search)
- [ ] Chaque service a sa propre base de données (data per service)
- [ ] J'ai identifie les données partagees et propose une solution (events, API calls)

## Communication

- [ ] Les opérations critiques (paiement, stock) sont synchrones
- [ ] Les opérations non-critiques (notification, analytics) sont asynchrones
- [ ] J'ai utilise des events pour le découplage (ex : `order.created` → notification)
- [ ] J'ai un API Gateway devant les services

## Architecture cible

- [ ] J'ai un diagramme clair de l'architecture cible
- [ ] Chaque service a des responsabilités claires
- [ ] Pas de dépendance circulaire entre services
- [ ] Les données ne sont pas partagees entre services

## Bonus

- [ ] J'ai propose un ordre de migration (le moins couple en premier)
- [ ] J'ai identifie les risques de distributed monolith
- [ ] J'ai envisage de garder certains modules dans le monolithe (quand la decomposition n'apporte pas de valeur)
