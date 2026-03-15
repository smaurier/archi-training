# Checklist — Exercice 12 : API REST NestJS

## DTOs et validation

- [ ] `CreateProductDto` avec class-validator decorators
- [ ] `UpdateProductDto` en partial (PartialType)
- [ ] `name` est required, `price` > 0, `stock` >= 0
- [ ] Zero `any` dans les types

## CRUD

- [ ] GET /api/products retourne une liste paginee
- [ ] GET /api/products/:id retourne un produit avec ETag header
- [ ] POST /api/products retourne 201 + Location header
- [ ] PUT /api/products/:id met a jour avec ETag check
- [ ] DELETE /api/products/:id fait un soft delete

## ETag

- [ ] GET retourne `ETag: "v{version}"` dans le response header
- [ ] PUT requiert `If-Match` header
- [ ] 412 Precondition Failed si version mismatch
- [ ] La version est incrementee à chaque update

## Pagination

- [ ] Pagination cursor (pas offset)
- [ ] Maximum 20 items par page (cap serveur même si limit=100)
- [ ] `hasMore` et `cursor` dans la réponse

## Erreurs

- [ ] 400 pour validation errors
- [ ] 404 si produit non trouve
- [ ] 412 pour ETag mismatch
- [ ] Format RFC 7807 (type, title, status, detail)

## Bonus

- [ ] If-None-Match sur GET → 304 Not Modified
- [ ] Recherche par keyword
