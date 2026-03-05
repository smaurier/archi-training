# Exercice 12 — API REST NestJS (CRUD + ETag)

> 🟡 **Difficulté** : Conception | **Temps estimé** : 2h | **Ère** : 4 — L'Autre Côté
>
> **Prérequis** : Module 03 (cours 1-2), NestJS basics


## Objectif

Implémenter une API REST propre avec NestJS : CRUD complet, ETag pour optimistic locking, pagination, et serialization groups.

## Contexte

Tu créés l'API produits de ShopArch. Les produits doivent supporter le CRUD complet, le cache conditionnel (ETag), et la pagination serveur.

## Temps estime

1h

## Instructions

### Étape 1 — Définir le DTO et l'entité

```typescript
// Entite Product avec version pour ETag
interface Product {
  id: string;          // UUID
  name: string;
  description: string;
  price: number;
  categoryId: string;
  stock: number;
  version: number;     // Incremente a chaque modification
  createdAt: Date;
  updatedAt: Date;
}
```

Cree :
- `CreateProductDto` (validation : name required, price > 0)
- `UpdateProductDto` (partial, memes validations)
- Serialization groups : `product:read` (tout), `product:list` (sans description)

### Étape 2 — Implémenter le CRUD

| Route | Méthode | Description |
|---|---|---|
| `GET /api/products` | List | Pagination cursor, 20 items max |
| `GET /api/products/:id` | Read | ETag dans le header `ETag` |
| `POST /api/products` | Create | Retourne 201 + Location header |
| `PUT /api/products/:id` | Update | Requiert `If-Match` header (ETag) |
| `DELETE /api/products/:id` | Delete | Soft delete (status → deleted) |

### Étape 3 — Implémenter ETag

- GET retourne `ETag: "v{version}"` dans le header
- PUT/PATCH requiert `If-Match: "v{version}"`
- Si version mismatch → `412 Precondition Failed`

### Étape 4 — Pagination cursor

- `GET /api/products?after={lastId}&limit=20`
- Retourne `{ data: Product[], meta: { hasMore: boolean, cursor: string } }`
- Maximum 20 items par page (cap serveur)

### Bonus

- Ajouter le header `If-None-Match` sur GET (304 Not Modified si pas de changement)
- Implémenter la recherche `GET /api/products?search=keyword`

## Contraintes

- NestJS avec class-validator
- UUID pour les IDs (pas de sequential)
- ETag obligatoire pour les mutations
- Réponses conformes RFC 7807 pour les erreurs
