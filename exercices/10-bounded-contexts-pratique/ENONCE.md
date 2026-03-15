# Exercice 10 — Bounded Contexts : ou couper ?

> 🔵 **Difficulté** : Application | **Temps estimé** : 1h30 | **Ère** : 2 — Le Domaine
>
> **Prérequis** : Module 02 (cours 2)


## Objectif

Identifier les bounded contexts dans un domaine e-commerce et définir les frontieres entre eux.

## Contexte

ShopArch grandit. L'équipe utilise les memes termes pour des concepts différents : "Product" dans le catalogue n'a pas les memes attributs que "Product" dans une commande. Il est temps de définir les bounded contexts.

## Temps estime

1h

## Instructions

### Étape 1 — Analyser le langage ubiquitaire

Voici comment différentes équipes parlent du même "produit" :

| Équipe | Terme | Attributs utilises |
|---|---|---|
| Catalogue | Product | name, description, images, category, tags, SEO slug |
| Stock | StockItem | sku, quantity, warehouse, reorderThreshold |
| Commande | OrderItem | productId, name, unitPrice, quantity (fige) |
| Paiement | PayableItem | amount, currency, taxRate |
| Marketing | PromotableProduct | name, category, discountEligible, featuredUntil |

### Étape 2 — Définir les bounded contexts

Pour chaque context :
1. Nom du bounded context
2. Entités et value objects principaux
3. Ubiquitous language (glossaire de 3-5 termes)
4. Responsabilite principale

### Étape 3 — Définir les relations

Pour chaque paire de contexts qui communiquent :
- Type de relation (Customer/Supplier, Shared Kernel, Conformist, ACL)
- Direction de la dépendance
- Données echangees

### Bonus

- Dessiner un Context Map complet
- Identifier un Shared Kernel (types partages entre contexts)

## Contraintes

- Chaque context a son propre modèle de "Product" (pas de modèle unique partage)
- Les contexts communiquent par events ou API, pas par accès direct à la DB
- Le glossaire de chaque context doit etre non-ambigu
