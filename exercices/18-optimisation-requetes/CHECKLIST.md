# Checklist — Exercice 18 : Optimisation de requêtes

## Diagnostic

- [ ] J'ai identifie les Seq Scan dans les plans d'exécution
- [ ] J'ai identifie les sorts en mémoire (Sort Method: external merge)
- [ ] J'ai mesure le temps d'exécution de chaque requête

## Index

- [ ] Index composite pour la requête 1 (category_id + status + created_at)
- [ ] Index GIN ou trgm pour la recherche ILIKE
- [ ] Index sur order_lines(order_id) pour le JOIN
- [ ] Partial indexes utilises quand pertinent

## Reecriture

- [ ] La recherche ILIKE remplacee par tsvector ou trigram
- [ ] Le ORDER BY utilise l'index (pas de sort en mémoire)
- [ ] Le LIMIT est pousse dans l'index scan

## Bonus

- [ ] Covering index avec INCLUDE
- [ ] Index GIN pg_trgm pour ILIKE
