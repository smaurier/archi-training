# Exercice 09 — Modéliser un domaine e-commerce

> 🟡 **Difficulté** : Conception | **Temps estimé** : 2h | **Ère** : 2 — Le Domaine
>
> **Prérequis** : Module 02 (cours 1-3)


## Objectif

Appliquer les concepts DDD (entités, value objects, agregats) pour modéliser le domaine d'un e-commerce.

## Contexte

Tu construis ShopArch. Le Product Owner te donne les règles métier suivantes :
- Un produit a un nom (multilingue), un prix HT, une categorie, et un stock
- Le prix ne peut jamais etre negatif
- Le stock ne peut jamais etre negatif
- Une commande contient 1 a N lignes de commande
- Chaque ligne référence un produit, une quantité et un prix unitaire (fige au moment de la commande)
- Une adresse de livraison a : rue, code postal, ville, pays
- Deux adresses identiques sont "egales" meme si ce sont des objets différents

## Temps estime

1h

## Instructions

### Étape 1 — Identifier entités vs value objects

Classe chaque concept :

| Concept | Entité ou Value Object ? | Justification |
|---|---|---|
| Product | | |
| Price | | |
| OrderLine | | |
| Order | | |
| Address | | |
| Category | | |
| Email | | |
| Money | | |

### Étape 2 — Modéliser les value objects

Implemente les value objects avec :
- Immutabilite (readonly)
- Validation dans le constructeur
- Méthode `equals()` basee sur les valeurs

### Étape 3 — Modéliser les entités

Implemente les entités avec :
- UUID comme identifiant
- Méthodes métier (pas de setters)
- Agregat root pour Order (contient les OrderLines)

### Étape 4 — Modéliser l'agregat Order

L'agregat Order doit :
- Garantir qu'une commande a au moins 1 ligne
- Calculer le total automatiquement
- Empecher d'ajouter un item si le stock est insuffisant
- Protéger ses invariants (pas d'accès direct aux OrderLines)

### Bonus

- Ajouter un `MultiLangField` value object pour les noms multilingues
- Implémenter le pattern Spécification pour filtrer les produits

## Contraintes

- TypeScript strict
- Zero `any`
- Value objects immutables (tous les champs `readonly`)
- Entités avec UUID, pas d'IDs sequentiels
- Pas de setters publics sur les entités
