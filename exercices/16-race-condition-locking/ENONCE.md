# Exercice 16 — Race condition & locking

> 🟡 **Difficulté** : Conception | **Temps estimé** : 1h30 | **Ère** : 4 — L'Autre Côté
>
> **Prérequis** : Module 03 (cours 8)


## Objectif

Identifier et corriger des race conditions dans un e-commerce en utilisant optimistic locking et pessimistic locking.

## Contexte

ShopArch à un problème : deux clients achetent en même temps le dernier exemplaire d'un produit. Le stock passe a -1. Il faut corriger ça.

## Temps estime

1h

## Instructions

### Étape 1 — Identifier la race condition

Analyse ce code et explique la race condition :

```typescript
async purchaseProduct(productId: string, quantity: number): Promise<void> {
  const product = await this.productRepo.findById(productId);

  if (product.stock < quantity) {
    throw new Error('Insufficient stock');
  }

  product.stock -= quantity;
  await this.productRepo.save(product);
}
```

Scénario : deux requêtes arrivent en parallele pour le même produit (stock = 1) :
- T0 : Requête A lit stock = 1
- T1 : Requête B lit stock = 1
- T2 : Requête A écrit stock = 0
- T3 : Requête B écrit stock = 0 (devrait etre -1 → violation !)

### Étape 2 — Corriger avec optimistic locking

Utilise le champ `version` pour détecter les modifications concurrentes :
- Lire le produit avec sa version
- Écrire avec `WHERE version = :expectedVersion`
- Si 0 rows updated → `409 Conflict`, retry

### Étape 3 — Corriger avec pessimistic locking

Utilise `SELECT ... FOR UPDATE` pour verrouiller la ligne pendant la transaction :
- Commencer une transaction
- `SELECT * FROM products WHERE id = :id FOR UPDATE`
- Modifier et sauvegarder dans la même transaction

### Étape 4 — Comparer les deux approches

Remplis ce tableau :

| Critère | Optimistic | Pessimistic |
|---|---|---|
| Performance (faible contention) | | |
| Performance (haute contention) | | |
| Complexite | | |
| Risque de deadlock | | |
| Quand l'utiliser | | |

### Bonus

- Implémenter un distributed lock avec Redis (`SETNX`)
- Écrire un test de concurrence qui prouve que la race condition est corrigee

## Contraintes

- Le stock ne doit JAMAIS etre negatif
- Les deux approches doivent etre implémentées
- Le test de concurrence utilise `Promise.all` pour simuler des requêtes paralleles
