# Exercice 29 — API REST avancee (ETag + pagination cursor)

> 🔵 **Difficulté** : Application | **Temps estimé** : 1h | **Ère** : 5 — La Communication
>
> **Prérequis** : Module 06 (cours 2)


## Objectif

Implémenter une API REST avec cache conditionnel (ETag/If-None-Match) et pagination par curseur pour le catalogue produits.

## Contexte

L'API produits de ShopArch sert 50 000 produits. La pagination par offset (`?page=2500`) est lente (OFFSET 50000 en SQL). Les clients mobiles consomment beaucoup de bande passante en re-telechargeant des réponses identiques.

## Temps estime

1h

## Instructions

### Étape 1 — ETag et cache conditionnel
Implemente le cache conditionnel HTTP :
- Genere un ETag base sur le hash du contenu ou la version de l'entité
- Reponds `304 Not Modified` si le client envoie `If-None-Match` avec le meme ETag
- Reponds `412 Precondition Failed` pour les PUT/PATCH avec `If-Match` incorrect

### Étape 2 — Pagination par curseur
Remplace la pagination offset par un curseur :
- Encode le curseur (base64 de `{id, sortField, sortValue}`)
- Retourne les liens `next`/`prev` dans les headers `Link`
- Supporte le tri par prix, nom, date de création

### Étape 3 — Negociation de contenu
Implemente `Accept` header :
- `application/json` (defaut)
- `application/hal+json` (avec `_links` et `_embedded`)
- `406 Not Acceptable` pour les types non supportes

### Étape 4 — Rate limiting
Ajoute un rate limiter :
- 100 requêtes/minute par API key
- Headers `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`
- `429 Too Many Requests` avec `Retry-After`

### Bonus
- Implémenter le champ `fields` pour la selection partielle (`?fields=id,name,price`)
- Ajouter le support `Prefer: return=minimal` / `return=representation`
- Implémenter `PATCH` avec JSON Merge Patch (RFC 7396)

## Contraintes
- La pagination doit etre stable (pas d'éléments manques ou dupliques si les données changent)
- Le curseur doit etre opaque pour le client (pas de reverse-engineering)
- Le rate limiter doit utiliser un token bucket en Redis
