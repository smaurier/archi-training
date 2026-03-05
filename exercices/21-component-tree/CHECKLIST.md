# Checklist — Exercice 21 : Component tree

- [ ] Arbre de composants dessine avec 10+ composants
- [ ] Chaque composant a ses props typees (interface TypeScript)
- [ ] Distinction presentationnel / conteneur identifiee
- [ ] `ProductPrice` formatte le prix avec devise
- [ ] `AddToCartButton` géré loading et out-of-stock
- [ ] `VariantSelector` appelle onSelect avec la variante selectionnee
- [ ] Pas de props drilling > 2 niveaux (React Context si besoin)
- [ ] Callbacks types pour la communication enfant → parent

## Bonus
- [ ] Custom hook `useProduct(id)` avec loading/error state
- [ ] Error Boundary pour degradation gracieuse
