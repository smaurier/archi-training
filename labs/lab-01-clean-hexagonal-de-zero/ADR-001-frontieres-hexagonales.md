# ADR-001 — Frontières hexagonales de la fonctionnalité "inviter un membre"

À remplir APRÈS ton GREEN (le correcteur le lit avec ton code, pas à la place). Format
court : décision, contexte, alternatives rejetées, conséquences.

## Contexte

Quel problème cette architecture résout-elle ici ? Pourquoi pas juste une fonction qui parle
directement à la base de données ?

## Décision

Où as-tu tracé la frontière domaine/application/infrastructure ? Pourquoi
`FamilyNotFoundError` vit dans `application/` et pas dans `domain/` — qu'est-ce qui, dans le
lab, te dit que c'est le bon endroit ?

## Alternatives rejetées

Une alternative que tu as envisagée (ex. : mettre la validation "famille pleine" dans le use
case plutôt que dans `Family.addMember`) — pourquoi l'as-tu écartée ?

## Conséquences

Qu'est-ce que cette frontière rend FACILE (ex. : tester l'orchestration sans base de
données) ? Qu'est-ce qu'elle rend plus LOURD (ex. : un aller-retour de plus entre couches
pour un cas simple) ? Un ADR honnête nomme les deux.
