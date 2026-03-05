# Exercice 21 — Starter

Cet exercice est indépendant — tu peux le faire dans un fichier TypeScript simple.

## Setup
```bash
cd exercices && npm install && npm run test:ex21
```

## Ta mission
Organise un catalogue e-commerce en composants selon l'Atomic Design :
- **Atoms** : Price, Badge, Image, Button
- **Molecules** : ProductCard (compose atoms)
- **Organisms** : ProductGrid (compose molecules)
- **Template** : CatalogPage (compose organisms + layout)

Les tests vérifient que chaque composant a les bonnes props et la bonne composition.
