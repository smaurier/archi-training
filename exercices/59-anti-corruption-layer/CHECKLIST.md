# Checklist — Exercice 59 : Anti-corruption layer

- [ ] Mapping modèle ERP → domaine documente
- [ ] Interface ERPPort (méthodes du domaine)
- [ ] SAPAdapter (implémentation avec API SOAP)
- [ ] Types du domaine sans référence aux types ERP
- [ ] Traducteur toDomain et toERP
- [ ] Gestion des valeurs manquantes (defaults)
- [ ] Validation apres traduction
- [ ] Circuit breaker sur les appels ERP
- [ ] Cache des données ERP (TTL par type)
- [ ] Queue pour les mutations (retry si ERP down)
- [ ] Logging des traductions echouees
- [ ] ACL = seul point de contact avec l'ERP

## Bonus
- [ ] Mode dual-write
- [ ] Health check ERP
- [ ] Stratégie Strangler Fig
