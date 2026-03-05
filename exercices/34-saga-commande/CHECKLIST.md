# Checklist — Exercice 34 : Saga de commande

- [ ] 4 étapes définies avec compensations
- [ ] Orchestrateur exécuté les étapes sequentiellement
- [ ] Compensations en ordre inverse sur echec
- [ ] État de la saga persiste en base
- [ ] Chaque étape est idempotente
- [ ] Recovery apres crash (reprise depuis l'état persiste)
- [ ] Paiement refuse → libération stock
- [ ] Timeout + retry sur le service de paiement
- [ ] Notification best-effort (pas de compensation)
- [ ] Compensations avec retry infini

## Bonus
- [ ] Timeout global (5 min)
- [ ] Dashboard sagas
- [ ] Saga choregraphiee alternative
