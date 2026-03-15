# Checklist — Exercice 10 : Bounded Contexts

## Identification

- [ ] J'ai identifie au moins 4 bounded contexts distincts
- [ ] Chaque context à un nom clair et non-ambigu
- [ ] Chaque context a son propre modèle de "Product"
- [ ] Les termes ne sont pas ambigus DANS un context

## Glossaire

- [ ] Chaque context à un glossaire de 3-5 termes
- [ ] Le même mot peut avoir des sens différents entre contexts (ex: "Product")
- [ ] Les définitions sont precises et non-ambigues

## Relations

- [ ] J'ai identifie les relations Customer/Supplier (qui dépend de qui)
- [ ] J'ai identifie les données echangees entre contexts
- [ ] Les contexts ne partagent PAS de base de données
- [ ] La communication est par events ou API

## Bonus

- [ ] J'ai dessine un Context Map
- [ ] J'ai identifie un Shared Kernel (ex: types Money, UUID)
- [ ] J'ai identifie un ACL entre deux contexts
