# Exercice 12 — Starter

Cet exercice utilise le projet fil rouge. Ouvre `projet-fil-rouge/apps/api/`.

## Setup
1. `cd projet-fil-rouge && npm install`
2. `docker compose up -d` (PostgreSQL nécessaire)
3. `npm run dev:api`

## Ta mission
Crée un module `catalog` dans `apps/api/src/catalog/` avec :
- `catalog.module.ts` — le module NestJS
- `product.entity.ts` — l'entité TypeORM
- `catalog.controller.ts` — les endpoints REST
- `catalog.service.ts` — la logique métier

## Endpoints à implémenter
- `GET /api/products` — liste paginée (cursor-based)
- `GET /api/products/:id` — détail d'un produit
- `POST /api/products` — créer un produit (admin only pour l'instant)
- `PATCH /api/products/:id` — modifier un produit
- `DELETE /api/products/:id` — supprimer un produit

## Vérification
```bash
# Créer un produit
curl -X POST http://localhost:3001/api/products \
  -H "Content-Type: application/json" \
  -d '{"name":"Widget","price":1999,"stock":50,"description":"Un widget"}'

# Lister les produits
curl http://localhost:3001/api/products
```
