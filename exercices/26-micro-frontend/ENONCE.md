# Exercice 26 — Micro-frontend avec Module Federation

> 🟡 **Difficulté** : Conception | **Temps estimé** : 1h | **Ère** : 3 — Le Front
>
> **Prérequis** : Module 05 (cours 9)


## Objectif

Implémenter une architecture micro-frontend avec Module Federation pour un e-commerce multi-équipe.

## Temps estime

1h

## Instructions

### Étape 1 — Identifier les frontiers

Decompose ShopArch en micro-frontends :
- Shell (layout, navigation, auth) — équipe platform
- Catalog (listing, fiches produits, search) — équipe catalog
- Cart/Checkout (panier, paiement) — équipe commerce
- Account (profil, commandes, adresses) — équipe users

### Étape 2 — Module Federation config

Configure Webpack Module Federation (ou Vite plugin) pour exposer et consommer des composants React entre les micro-frontends.

### Étape 3 — Communication inter-apps

Implemente la communication entre micro-frontends via Custom Events :
- Le Cart écoute `product:add-to-cart` du Catalog
- Le Shell écoute `cart:updated` pour le badge panier
- Le Shell écoute `auth:logout` pour la deconnexion

### Étape 4 — Shared dependencies

Configure les dépendances partagees (React, React Router, Design Tokens) pour éviter les doublons.

### Bonus
- Implémenter un fallback si un micro-frontend est indisponible
- Ajouter le routing inter-micro-frontends

## Contraintes

- Chaque micro-frontend est deployable independamment
- Pas de couplage direct entre micro-frontends (events only)
- Design tokens partages via CSS custom properties
- Fallback graceful si un module est down
