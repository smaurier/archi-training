# Checklist — Exercice 06 : Vertical Slice d'un module

## Structure

- [ ] Un dossier par feature (`add-to-wishlist/`, `remove-from-wishlist/`, `get-wishlist/`)
- [ ] Chaque dossier contient handler + DTO (si applicable) + test
- [ ] L'entité et le repository sont au niveau du module (partages)
- [ ] Le module NestJS enregistre tous les handlers

## Implémentation

- [ ] `add-to-wishlist` vérifié les doublons avant d'ajouter
- [ ] `remove-from-wishlist` géré le cas "produit pas dans la wishlist" (404 ou silent)
- [ ] `get-wishlist` retourne la liste triee par date d'ajout (desc)
- [ ] Chaque handler est autonome (pas de service partage)
- [ ] Les DTOs utilisent class-validator

## Tests

- [ ] Test d'ajout avec vérification que le produit est dans la wishlist
- [ ] Test de rejet de doublon
- [ ] Test de get-wishlist avec tri par date
- [ ] Les tests utilisent un mock ou InMemoryRepository

## Comparaison

- [ ] Identifie que le vertical slice touche 1-2 fichiers par modification
- [ ] Identifie que le layered touche 3+ fichiers (controller + service + repo)
- [ ] Explique l'avantage pour l'équipe (moins de merge conflicts)

## Bonus

- [ ] `check-in-wishlist` slice implémentée
- [ ] `InMemoryWishlistRepository` pour les tests
