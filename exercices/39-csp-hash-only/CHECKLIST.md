# Checklist — Exercice 39 : CSP hash-only

- [ ] Inventaire de tous les scripts inline
- [ ] Hash SHA-256 calcule pour chaque script inline autorise
- [ ] CSP sans unsafe-inline et sans unsafe-eval
- [ ] Styles inline migres en classes CSS
- [ ] Event handlers inline migres en addEventListener
- [ ] Report-Only déployé d'abord
- [ ] Endpoint /csp-report pour collecter les violations
- [ ] CSP complete (default-src, script-src, style-src, img-src, etc.)
- [ ] frame-ancestors 'none' (anti-clickjacking)
- [ ] base-uri 'self' (anti-injection base tag)

## Bonus
- [ ] Nonce-based CSP alternative
- [ ] Trusted Types
- [ ] Comparaison hash vs nonce
