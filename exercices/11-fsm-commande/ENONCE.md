# Exercice 11 — Implémenter une FSM de commande

> 🟡 **Difficulté** : Conception | **Temps estimé** : 1h30 | **Ère** : 2 — Le Domaine
>
> **Prérequis** : Module 02 (cours 4)


## Objectif

Implémenter une Finite State Machine (FSM) pour le workflow de commande e-commerce avec des transitions validees et un audit trail.

## Contexte

La commande ShopArch suit ce cycle de vie :
```
Created → Paid → Shipped → Delivered
  ↓                ↓
Cancelled      Cancelled (avec remboursement)
```

## Temps estime

1h

## Instructions

### Étape 1 — Définir les états et transitions

Implemente la FSM avec :
- Les états : `created`, `paid`, `shipped`, `delivered`, `cancelled`
- Les transitions autorisees (voir diagramme)
- Une méthode `canTransitionTo(targetState)` qui retourne `boolean`
- Une méthode `transitionTo(targetState)` qui throw si la transition est invalide

### Étape 2 — Ajouter des guards

Certaines transitions ont des conditions :
- `created → paid` : le paiement doit etre confirme
- `paid → shipped` : l'adresse de livraison doit etre valide
- `shipped → delivered` : le numéro de suivi doit exister
- `* → cancelled` : seules `created`, `paid`, `shipped` peuvent etre annulees

### Étape 3 — Audit trail

Chaque transition doit etre logguee dans un tableau immutable :
```typescript
interface Transition {
  from: OrderStatus;
  to: OrderStatus;
  at: Date;
  by: string; // userId
  reason?: string;
}
```

### Étape 4 — Side effects

A chaque transition, des actions doivent se déclencher :
- `→ paid` : decrementer le stock
- `→ shipped` : envoyer notification tracking
- `→ delivered` : envoyer email satisfaction
- `→ cancelled` : rembourser + restaurer le stock

### Bonus

- Ajouter un état `refunded` apres `cancelled` (si le paiement avait ete fait)
- Implémenter la FSM de manière générique (réutilisable pour d'autres workflows)

## Contraintes

- TypeScript strict
- Zero `any`
- L'audit trail est append-only (jamais modifie)
- Les side effects sont injectes (pas hardcodes dans la FSM)
