# ADR-002 — Identifiants de Family : UUID non-prédictibles (supersède ADR-001)

**Statut :** à compléter par toi, après ton GREEN.

## Contexte

À remplir : cite le fait nouveau précis (voir `FINDINGS.md`) qui invalide la conséquence
"prédictible — jugé sans conséquence" d'ADR-001. Une décision se conteste avec un fait
nouveau et vérifiable, pas avec "les entiers c'est has-been".

## Décision

À remplir : ce que tu as changé dans `IdGenerator.ts`, précisément.

## Preuve

À remplir : comment ton test (`test/adr-contestation.spec.ts`, déjà écrit, tu ne le modifies
pas) démontre que le nouveau schéma n'est plus énumérable — pas "je pense que c'est mieux",
la preuve mesurable qui fait passer l'oracle au vert.

## Conséquences

À remplir, les deux sens : qu'est-ce que cette décision RÉSOUT, qu'est-ce qu'elle COÛTE
(indice : relis "compact, index B-tree optimal" dans ADR-001 — est-ce toujours vrai avec un
UUID v4 aléatoire ? Un ADR honnête nomme ce qui se dégrade, pas seulement ce qui s'améliore).
