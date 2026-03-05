# Checklist — Exercice 32 : CAP classifier

- [ ] Classification CP/AP pour chaque composant (6 minimum)
- [ ] Justification du risque cohérence vs disponibilité pour chaque
- [ ] Stock : verrou pessimiste (CP, SELECT FOR UPDATE)
- [ ] Catalogue : eventual consistency (AP, cache + TTL)
- [ ] Panier : AP avec stratégie de merge
- [ ] Stratégie de compensation au checkout (vérification stock)
- [ ] Saga de compensation si paiement accepte + stock insuffisant
- [ ] Tableau recapitulatif des classifications

## Bonus
- [ ] Read-Your-Writes guarantee
- [ ] Diagramme de sequence partition
