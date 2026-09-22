# ADR-001 — Identifiants de Family : entiers séquentiels

**Statut :** Acceptée (il y a 8 mois)

## Contexte

TribuZen a besoin d'identifier chaque famille de façon unique en base. À l'époque, le
produit est mono-tenant, usage interne, aucun ID n'est jamais exposé publiquement.

## Décision

Les identifiants de `Family` sont des entiers auto-incrémentés (`1`, `2`, `3`…), générés
par `src/IdGenerator.ts`. Simple, lisible dans les logs, performant en index.

## Conséquences

- Facile à débugger ("la famille 42").
- Compact, index B-tree optimal côté base de données.
- Prédictible — jugé sans conséquence à l'époque : aucun ID n'était exposé côté client.

---

*Ce lab te demande de CONTESTER cette décision avec des preuves, pas juste de l'affirmer
fausse. Le produit a changé depuis — regarde `FINDINGS.md` pour le fait nouveau, puis
regarde `src/IdGenerator.ts`.*
