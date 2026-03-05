# Checklist — Exercice 29 : API REST avancee

- [ ] ETag généré sur chaque réponse GET
- [ ] 304 Not Modified avec If-None-Match
- [ ] 412 Precondition Failed avec If-Match incorrect sur PUT/PATCH
- [ ] Pagination par curseur (pas d'offset)
- [ ] Curseur opaque (base64 encode)
- [ ] Headers Link avec next/prev
- [ ] Tri par prix, nom, date
- [ ] Negociation de contenu (JSON + HAL)
- [ ] 406 Not Acceptable
- [ ] Rate limiting avec token bucket Redis
- [ ] Headers X-RateLimit-*
- [ ] 429 Too Many Requests avec Retry-After

## Bonus
- [ ] Selection partielle (?fields=)
- [ ] Prefer header
- [ ] JSON Merge Patch
