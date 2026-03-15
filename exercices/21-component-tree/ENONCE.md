# Exercice 21 — Component tree e-commerce

> 🟢 **Difficulté** : Découverte | **Temps estimé** : 1h | **Ère** : 3 — Le Front
>
> **Prérequis** : Module 05 (cours 1)


## Objectif

Concevoir l'arbre de composants d'une page produit e-commerce avec composition, props typing, et séparation presentationnel/conteneur.

## Contexte

Tu dois concevoir la page produit de ShopArch en React (TypeScript). La page contient : image gallery, titre, prix, selecteur de variantes, bouton panier, description, avis clients.

## Temps estime

1h

## Instructions

### Étape 1 — Decomposer en composants

Dessine l'arbre de composants de la page produit :
```
ProductPage
├── ProductGallery
│   ├── MainImage
│   └── ThumbnailList
│       └── ThumbnailItem (×N)
├── ProductInfo
│   ├── ProductTitle
│   ├── ProductPrice
│   ├── VariantSelector
│   └── AddToCartButton
├── ProductDescription (tabs)
│   ├── DescriptionTab
│   ├── SpecificationsTab
│   └── ReviewsTab
└── RelatedProducts
    └── ProductCard (×4)
```

### Étape 2 — Typer les props

Pour chaque composant, définis les props avec une interface TypeScript.

### Étape 3 — Identifier les patterns

Pour chaque composant, identifie :
- Presentationnel (stateless, recoit des props, appelle des callbacks) ?
- Conteneur (fetch data, géré le state) ?
- Headless (logique sans UI, custom hook) ?

### Étape 4 — Implémenter les composants clés

Implemente au minimum :
- `ProductPrice` (formattage, promotion, devise)
- `AddToCartButton` (état loading, disabled si hors stock)
- `VariantSelector` (selection taille/couleur)

### Bonus

- Ajouter un custom hook `useProduct(id)` pour le data fetching
- Implémenter un Error Boundary pour la page

## Contraintes

- React avec TypeScript
- Props typees avec des interfaces TypeScript
- Callbacks types pour la communication enfant → parent
- Pas de props drilling > 2 niveaux (utiliser React Context si nécessaire)
