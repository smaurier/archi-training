# Checklist — Exercice 38 : Sécuriser l'API

- [ ] Requetes SQL parametrees (pas de concatenation)
- [ ] Validation des types pour NoSQL
- [ ] IDOR : vérification proprietaire de la ressource
- [ ] Mass assignment : DTOs explicites
- [ ] Permissions verifiees a chaque endpoint
- [ ] HSTS header
- [ ] X-Content-Type-Options: nosniff
- [ ] X-Frame-Options: DENY
- [ ] Content-Security-Policy
- [ ] Validation de tous les inputs (params, query, body)
- [ ] Whitelist des champs acceptes
- [ ] Limite taille payload (1 MB)
- [ ] Erreurs génériques en production (pas de stack trace)

## Bonus
- [ ] WAF middleware
- [ ] Honeypot endpoint
- [ ] Scan OWASP ZAP
