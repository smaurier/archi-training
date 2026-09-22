# Findings — avant de contester ADR-001

Le fait nouveau, depuis ADR-001 : le produit expose maintenant un lien d'invitation public,
`tribuzen.app/invite/<id-de-famille>` — n'importe qui avec ce lien rejoint la page de la
famille correspondante (pas encore les données privées, juste la page publique d'invitation
— mais c'est le premier endroit où un ID de famille sort du système).

À répondre AVANT d'ouvrir `src/IdGenerator.ts` :

1. Si les identifiants sont des entiers séquentiels (`1`, `2`, `3`…) et qu'un attaquant
   connaît UN lien valide (`.../invite/42`), que peut-il faire avec une boucle `for` toute
   simple ? Sois concret : qu'obtient-il, en combien de requêtes ?

2. Ce problème porte un nom en sécurité applicative — le connais-tu ? (Indice : proche de
   l'IDOR vu au cours 09 NestJS, mais pas identique — ici, c'est l'ID LUI-MÊME qui fuit de
   l'information, pas une absence de contrôle d'accès.)

3. **La preuve, pas l'opinion.** Écris (mentalement, puis dans ton ADR-002) COMMENT tu
   prouverais que les nouveaux identifiants ne sont plus énumérables — qu'est-ce qui rend
   un identifiant "non-devinable" par construction, pas juste "moins évident" ?

4. Après ta correction, remplis `ADR-002-identifiants-familles-uuid.md` (déjà présent, à
   compléter) : il DOIT citer le fait nouveau (le lien public) comme preuve, pas répéter
   "les UUID c'est mieux" sans justification.
