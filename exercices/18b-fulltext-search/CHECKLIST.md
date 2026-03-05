# Checklist — Exercice 18b : Full-text search

- [ ] Colonne `search_vector tsvector` ajoutee
- [ ] Poids A pour le nom, B pour la description
- [ ] Index GIN sur search_vector
- [ ] Trigger de mise a jour automatique
- [ ] Recherche avec `plainto_tsquery` fonctionne
- [ ] Ranking avec `ts_rank`
- [ ] Configuration 'french' pour le stemming

## Bonus

- [ ] Highlighting avec `ts_headline`
- [ ] Recherche multi-locale
