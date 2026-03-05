# Exercice 13 — Auth OIDC + RBAC

> 🟡 **Difficulté** : Conception | **Temps estimé** : 2h | **Ère** : 4 — L'Autre Côté
>
> **Prérequis** : Module 03 (cours 3), Exercice 12


## Objectif

Implémenter l'authentification OIDC (Authorization Code + PKCE) et le controle d'accès RBAC dans une API NestJS.

## Contexte

ShopArch utilise Keycloak comme Identity Provider. L'API doit valider les JWT, extraire les roles, et appliquer le RBAC sur chaque endpoint.

## Temps estime

1h

## Instructions

### Étape 1 — JWT Guard

Implemente un guard NestJS qui :
1. Extrait le token du header `Authorization: Bearer <token>`
2. Valide le JWT avec la cle publique JWKS de Keycloak
3. Cache la cle JWKS dans Redis (TTL 1h, force refresh on failure)
4. Extrait le `tenantId` et les `roles` du payload

### Étape 2 — Role hierarchy

Implemente une hierarchie de roles :
```
superadmin > admin > editor > viewer
```
- `superadmin` a tous les droits de `admin`, qui a tous ceux d'`editor`, etc.
- Un endpoint protégé par `@Roles('editor')` autorise aussi `admin` et `superadmin`

### Étape 3 — Protéger les endpoints

| Endpoint | Role minimum |
|---|---|
| `GET /api/products` | `viewer` |
| `POST /api/products` | `editor` |
| `PUT /api/products/:id` | `editor` |
| `DELETE /api/products/:id` | `admin` |
| `GET /api/users` | `admin` |

### Étape 4 — Auth adapter pattern

Cree un adapter qui permet de switcher entre :
- **Production** : validation OIDC reelle (Keycloak JWKS)
- **Development** : mock auth (token généré localement, pas besoin de Keycloak)

Le switch se fait via une variable d'environnement `AUTH_MODE=oidc|mock`.

### Bonus

- Ajouter un custom voter pour des règles métier (ex: un editor ne peut modifier que ses propres articles)
- Implémenter le refresh token flow

## Contraintes

- JWT RS256 (pas HS256)
- Pas de secret partage (asymmetric keys)
- JWKS cache dans Redis
- Le guard est global (applique a tous les endpoints sauf whitelist)
