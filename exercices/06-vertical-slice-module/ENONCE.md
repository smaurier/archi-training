# Exercice 06 — Vertical Slice d'un module

> 🔵 **Difficulté** : Application | **Temps estimé** : 1h30 | **Ère** : 2 — Le Domaine
>
> **Prérequis** : Module 01 (cours 6)


## Objectif

Implémenter un module NestJS complet en Vertical Slice Architecture — chaque feature est un dossier autonome contenant handler, DTO, validation et test.

## Temps estime

1h

## Contexte

ShopArch a besoin d'un module "Wishlist" (liste de souhaits). Plutot que de structurer par couche technique (controllers/, services/, repositories/), tu vas structurer par feature.

## Instructions

### Étape 1 — Structure du module (10 min)

Cree la structure de dossiers suivante :

```
src/wishlist/
├── add-to-wishlist/
│   ├── add-to-wishlist.handler.ts     # Controller + logique
│   ├── add-to-wishlist.dto.ts         # DTO d'entree
│   └── add-to-wishlist.test.ts        # Test
├── remove-from-wishlist/
│   ├── remove-from-wishlist.handler.ts
│   ├── remove-from-wishlist.dto.ts
│   └── remove-from-wishlist.test.ts
├── get-wishlist/
│   ├── get-wishlist.handler.ts
│   └── get-wishlist.test.ts
├── wishlist.entity.ts                  # Entite partagee du module
├── wishlist.repository.ts             # Interface repository
└── wishlist.module.ts                 # Module NestJS
```

### Étape 2 — Implémenter les 3 features (30 min)

Pour chaque feature :
1. **add-to-wishlist** : `POST /api/wishlists/items` — ajoute un produit à la wishlist de l'utilisateur. Contrainte : pas de doublon (même produit 2 fois).
2. **remove-from-wishlist** : `DELETE /api/wishlists/items/:productId` — retire un produit.
3. **get-wishlist** : `GET /api/wishlists` — retourne la wishlist de l'utilisateur connecte.

Chaque handler est un controller NestJS qui contient sa propre logique (pas de service partage entre features).

### Étape 3 — Écrire les tests (15 min)

Un test par feature :
- `add-to-wishlist.test.ts` : ajoute un produit, vérifié qu'il est dans la wishlist, vérifié le rejet de doublon
- `get-wishlist.test.ts` : retourne la liste triee par date d'ajout

### Étape 4 — Comparer avec le layered (5 min)

Reponds aux questions :
- Combien de fichiers touches si tu modifies `add-to-wishlist` ?
- Combien en architecture layered (controller + service + repository) ?
- Quel est l'avantage du vertical slice pour une équipe de 4 devs ?

## Bonus

- Ajouter un `check-in-wishlist` slice : `GET /api/wishlists/check/:productId` → `{ isInWishlist: boolean }`
- Utiliser un `InMemoryWishlistRepository` pour les tests
