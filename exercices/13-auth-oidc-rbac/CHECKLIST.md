# Checklist — Exercice 13 : Auth OIDC + RBAC

## JWT Guard

- [ ] Le guard extrait le Bearer token du header Authorization
- [ ] Le JWT est valide avec RS256 (pas HS256)
- [ ] La cle publique vient du JWKS endpoint de Keycloak
- [ ] Le JWKS est cache dans Redis (TTL 1h)
- [ ] Si la validation échoué, force refresh du JWKS avant de rejeter

## RBAC

- [ ] La hierarchie est définie : superadmin > admin > editor > viewer
- [ ] Un decorateur `@Roles('editor')` protégé les endpoints
- [ ] La hierarchie est respectee (admin a les droits d'editor)
- [ ] 403 Forbidden si le role est insuffisant

## Endpoints protégés

- [ ] GET products → viewer minimum
- [ ] POST/PUT products → editor minimum
- [ ] DELETE products → admin minimum
- [ ] GET users → admin minimum

## Auth adapter

- [ ] Interface commune pour OIDC et Mock
- [ ] Le switch se fait via `AUTH_MODE` env var
- [ ] En mode mock, pas besoin de Keycloak running
- [ ] En mode OIDC, validation reelle du JWT

## Bonus

- [ ] Custom voter pour règles métier (owner-only edit)
- [ ] Refresh token flow
