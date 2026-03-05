# Checklist — Exercice 16 : Race condition & locking

## Analyse

- [ ] J'ai identifie la race condition (read-modify-write non-atomique)
- [ ] J'ai explique le scénario T0-T3 (two reads before write)
- [ ] J'ai compris pourquoi le stock peut devenir negatif

## Optimistic locking

- [ ] Le champ `version` est dans l'entité
- [ ] L'UPDATE utilise `WHERE version = :expected`
- [ ] Si 0 rows updated → Conflict (409 ou retry)
- [ ] Le code retente en cas de conflit

## Pessimistic locking

- [ ] `SELECT ... FOR UPDATE` dans une transaction
- [ ] La transaction englobe le read + write
- [ ] Le verrou est relache a la fin de la transaction

## Comparaison

- [ ] Tableau rempli avec les compromis des deux approches
- [ ] J'ai choisi la bonne approche selon le cas d'usage

## Bonus

- [ ] Distributed lock Redis implémenté
- [ ] Test de concurrence avec Promise.all
