# Checklist — Exercice 54 : Fitness functions

- [ ] Pas de dépendance circulaire entre modules
- [ ] Controllers n'importent pas les repositories
- [ ] Entités ne dependent pas des services
- [ ] Build < 60s
- [ ] Bundles JS < 250 KB gzip
- [ ] Endpoints critiques < 200ms
- [ ] Startup time < 5s
- [ ] npm audit : 0 vulnérabilité critique
- [ ] Pas de secret dans le code source
- [ ] Tous les endpoints ont un decorator d'autorisation
- [ ] CSP header present
- [ ] Integre dans le CI (bloque le merge)
- [ ] Messages d'erreur clairs

## Bonus
- [ ] Couverture tests > 80%
- [ ] Dependency drift detector
- [ ] Dashboard d'évolution
