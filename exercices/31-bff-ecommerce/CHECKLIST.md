# Checklist — Exercice 31 : BFF pour e-commerce

- [ ] Endpoints BFF par ecran (/bff/home, /bff/product/:id, /bff/checkout)
- [ ] Appels microservices en parallele (Promise.all)
- [ ] Timeout individuel par service (2s)
- [ ] Mode degrade si un service est down (valeur par defaut)
- [ ] Champs filtres (pas de sur-fetching)
- [ ] Cache Redis pour données peu changeantes
- [ ] Cache-key avec tenant ID
- [ ] Pas de cache pour données utilisateur
- [ ] Adaptation par device (X-Device-Type)
- [ ] Aucune logique métier dans le BFF

## Bonus
- [ ] DataLoader pattern
- [ ] Endpoint GraphQL alternatif
- [ ] Response streaming
