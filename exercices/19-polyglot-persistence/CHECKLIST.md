# Checklist — Exercice 19 : Polyglot persistence

- [ ] Chaque besoin a une technologie choisie et justifiee
- [ ] PostgreSQL est la base principale (catalogue, commandes, utilisateurs)
- [ ] Redis est utilise pour cache et sessions (pas comme DB principale)
- [ ] La recherche utilise PostgreSQL FTS ou Elasticsearch (justifie)
- [ ] Le nombre de bases est raisonnable (3-4 max pour une équipe de 5-10)
- [ ] J'ai identifie les besoins ou PostgreSQL suffit (pas besoin d'ajouter)
- [ ] Le diagramme montre les flux de données entre les bases
- [ ] La sync PostgreSQL → Elasticsearch est abordee

## Bonus
- [ ] Stratégie de sync detaillee (CDC ou dual-write)
- [ ] Cout operationnel estime
