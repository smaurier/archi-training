# Checklist — Exercice 10b : Context Map

## Diagramme

- [ ] J'ai dessine les 4+ contexts avec leurs frontieres
- [ ] Chaque relation a un pattern DDD nomme
- [ ] Les fleches montrent la direction upstream → downstream
- [ ] Pas de dépendance circulaire

## Patterns de relation

- [ ] J'ai utilise au moins 3 patterns différents
- [ ] Chaque choix est justifie
- [ ] Le Shared Kernel est limite aux types fondamentaux (Money, UUID)
- [ ] J'ai identifie au moins un ACL

## Events

- [ ] J'ai liste au moins 4 domain events
- [ ] Chaque event a un emetteur et un ou plusieurs consommateurs
- [ ] Les events portent les données nécessaires (pas trop, pas trop peu)
- [ ] Les events sont nommes au passe (`order.created`, pas `create.order`)

## Bonus

- [ ] J'ai identifie un Conformist (passerelle de paiement externe)
- [ ] J'ai propose un fallback si un context est down
