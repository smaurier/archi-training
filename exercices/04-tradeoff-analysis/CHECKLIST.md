# Checklist — Exercice 04 : Trade-off analysis

## Étape 1 — Architecture characteristics

- [ ] Performance classee comme critique (1-2) — c'est un besoin explicite (< 200ms)
- [ ] Maintenabilite classee comme importante (1-2) — équipe de 4, pas de DBA
- [ ] Scalabilite classee comme importante (2) — croissance x10 prevue
- [ ] Cout classe comme modere (2-3) — budget modere
- [ ] Evolvabilite classee correctement (dépend du raisonnement)

## Étape 2 — Matrice de trade-offs

- [ ] Option A correctement évaluée comme mauvaise en performance a 500K (ILIKE = full scan)
- [ ] Option B correctement évaluée comme bonne en perf et maintenabilité (natif PostgreSQL)
- [ ] Option C correctement évaluée comme excellente en features mais couteuse en ops
- [ ] La matrice est cohérente (pas de ✓✓ partout — chaque option a des faiblesses)

## Étape 3 — ADR

- [ ] Le contexte explique clairement le besoin et les contraintes
- [ ] Les 3 options sont decrites factuellement (pas de biais)
- [ ] La decision est argumentee avec référence à la matrice
- [ ] Les consequences negatives sont honnetes (pas juste les positives)
- [ ] Un plan d'évolution est défini (trigger de migration)

## Qualité du raisonnement

- [ ] Aucun "ça dépend" sans justification
- [ ] Les estimations de performance sont plausibles
- [ ] Le trade-off cout/complexité est explicite
- [ ] La solution recommandee est cohérente avec les contraintes (équipe de 4, budget modere)

## Bonus

- [ ] Diagramme ASCII de l'architecture cible
- [ ] Au moins 2 fitness functions définies
