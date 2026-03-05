# Checklist — Exercice 58 : CRDT pour editeur collaboratif

- [ ] G-Counter implémenté (grow-only, merge = max)
- [ ] LWW-Register implémenté (timestamp, merge = most recent)
- [ ] Egalite de timestamp résolue par node ID
- [ ] LWW-Map pour les champs produit
- [ ] Merge independant par champ
- [ ] Synchronisation via WebSocket
- [ ] Modifications locales diffusees
- [ ] Merge a la reception
- [ ] Indicateur "Editing..." pour les autres
- [ ] Merge commutatif, associatif, idempotent
- [ ] Fonctionne avec deconnexion temporaire

## Bonus
- [ ] CRDT texte (Yjs/RGA)
- [ ] Historique undo/redo
- [ ] Comparaison CRDT vs OT
