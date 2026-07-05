# Lab 00 — Qu'est-ce que l'architecture logicielle et la posture d'architecte

> **Outcome :** à la fin, tu sais lire un système inconnu et **séparer ce qui est structurant de ce qui est un détail**, qualifier la réversibilité de chaque décision, et formuler un trade-off avec substance — le réflexe de base de tout architecte.
> **Vrai outil :** ta tête + une feuille (ou un fichier `.md`). C'est un lab de **raisonnement**, pas de code : rien à installer, rien à exécuter, rien à compiler.
> **Feedback :** le coach valide ton raisonnement en session à l'aide de la grille ci-dessous. Il n'y a pas de « bonne réponse » unique — il y a des raisonnements bien argumentés et des raisonnements non argumentés.

---

## Énoncé

On te présente **MealPlan**, un système que tu ne connais pas. Tu dois l'analyser en architecte, sans le coder.

> **Contexte MealPlan.** Une petite équipe (5 personnes) lance une app de planification de repas pour familles. Voici les choix déjà pris ou en discussion, en vrac, tels qu'ils sortent d'une réunion :
>
> 1. Le backend sera un **monolithe** unique (pas de microservices).
> 2. Les mots de passe seront hachés avec **bcrypt**.
> 3. On stocke les recettes en **PostgreSQL**.
> 4. Le bouton principal de l'écran d'accueil sera **vert**.
> 5. L'authentification se fera via un **fournisseur tiers (OAuth Google/Apple)**, pas de compte maison.
> 6. Les logs seront au format **JSON** plutôt que texte brut.
> 7. Le front communiquera avec le back via une **API REST** (pas de GraphQL).
> 8. La liste de courses sera **triée par rayon de supermarché**.
> 9. Toutes les données utilisateur (y compris allergies alimentaires des enfants) seront stockées **sur nos serveurs**, chiffrées au repos.
> 10. On utilisera **Tailwind** pour le style.

Ta mission : produire une **note d'analyse d'architecte** de MealPlan.

**Aucun starter de code.** Tu produis un document structuré (papier ou markdown). Le livrable, c'est ton **raisonnement**, pas un artefact technique.

---

## Étapes (en friction)

Produis, dans l'ordre, ces quatre livrables. Ne saute pas d'étape : la friction est le but.

1. **Tri architecture / détail.** Pour chacun des 10 choix, décide : **décision d'architecture** (structurante, coûteuse à défaire) ou **détail d'implémentation** ? Applique le test « si on se trompe, combien coûte le retour arrière ? ». Écris une phrase de justification par choix. Résiste à l'envie de tout classer « architecture ».

2. **Qualifie la réversibilité** des décisions que tu as classées « architecture ». Pour chacune, indique : **porte à sens unique** (coûteuse/impossible à défaire → décider lentement) ou **porte à double sens** (réversible → décider vite) ? Justifie.

3. **Repère la décision la plus risquée.** Une seule des 10 lignes cache un vrai problème structurant si on la traite comme un détail. Trouve-la, explique **pourquoi** elle est risquée (indice : qui sont les utilisateurs de MealPlan, et quelles données particulières manipule-t-on ?), et propose une **alternative** formulée en trade-off (« on gagne X, on perd Y »).

4. **Nomme les 3 caractéristiques d'architecture (-ilities) prioritaires** pour MealPlan selon toi, et une phrase disant *pourquoi* ces trois-là et pas d'autres. (Rappel : 3 à 7 max sont critiques ; choisir, c'est renoncer.)

---

## Corrigé complet commenté

> C'est un corrigé de **raisonnement**. Ta formulation peut différer ; ce qui compte, c'est que le classement et la justification tiennent debout.

### 1. Tri architecture / détail

| # | Choix | Verdict | Justification |
|---|---|---|---|
| 1 | Monolithe vs microservices | **Architecture** | Structure l'organisation et le déploiement de tout le système ; migrer plus tard est un projet à part entière. |
| 2 | bcrypt pour les mots de passe | **Détail** | Algorithme de hachage encapsulé dans une fonction ; on peut passer à argon2 sans toucher au reste. |
| 3 | PostgreSQL pour les recettes | **Architecture** | Le choix SQL vs NoSQL contraint le modèle de données, les transactions, les requêtes. Difficile à défaire une fois les données peuplées. |
| 4 | Bouton vert | **Détail** | Une valeur CSS. Changement instantané, zéro impact structurel. |
| 5 | Auth via tiers (OAuth) vs maison | **Architecture** | Détermine les flux d'authentification, la dépendance à un tiers, la sécurité. Changer de modèle d'auth est toujours coûteux (porte à sens unique). |
| 6 | Logs en JSON | **Détail** (limite) | Format d'un log ; se change avec un adaptateur. *Devient* structurant seulement si toute une chaîne d'observabilité en dépend déjà. |
| 7 | REST vs GraphQL | **Architecture** | Style de communication front/back ; contamine tous les endpoints et les clients. Coûteux à changer après coup. |
| 8 | Liste de courses triée par rayon | **Détail** | Une logique de `.sort()` locale. On la change quand on veut. |
| 9 | Toutes les données (dont allergies enfants) sur serveur | **Architecture** | Décide où vivent des données sensibles → schéma DB, API, conformité RGPD. **La plus structurante de la liste** (voir étape 3). |
| 10 | Tailwind pour le style | **Détail** | Choix de librairie CSS remplaçable ; pas de frontière système en jeu ici. |

**Ce que révèle le tri :** seules ~4-5 lignes sur 10 sont réellement de l'architecture (1, 3, 5, 7, 9). Traiter les 10 comme structurantes ferait perdre des jours en réunions inutiles (sur-délibération). Traiter la n°9 comme un détail est une faute grave.

### 2. Réversibilité des décisions d'architecture

| Décision | Réversibilité | Justification |
|---|---|---|
| 1 — Monolithe | **Double sens** (plutôt) | Un monolithe bien découpé peut évoluer vers des services plus tard. Commencer monolithe est même recommandé à 5 devs. |
| 3 — PostgreSQL | **Sens unique** (modérée) | Migrer des données relationnelles vers un autre paradigme est coûteux une fois en prod. |
| 5 — Auth tierce | **Sens unique** | Changer de modèle d'auth impacte tous les utilisateurs et tous les flux. |
| 7 — REST | **Sens unique** (modérée) | On peut ajouter GraphQL à côté, mais réécrire tous les clients existants est lourd. |
| 9 — Données sur serveur | **Sens unique — la plus dure** | Une fois des données sensibles collectées côté serveur, revenir à un modèle device-only implique migration + purge + reconquête du consentement. |

**Leçon :** on délibère lentement sur les portes à sens unique (3, 5, 7, 9) et on avance vite sur les portes à double sens (1). Confondre les deux — hésiter 3 semaines sur le monolithe, mais bâcler la n°9 — est l'erreur classique.

### 3. La décision la plus risquée : n°9

**Pourquoi elle est risquée :** MealPlan est une app **familiale** manipulant les **allergies alimentaires des enfants** — potentiellement des **données de santé** (RGPD, article 9, catégorie particulière). Les mettre « sur nos serveurs, chiffrées au repos » (chiffrement que *nous* détenons) est traité ici comme un choix anodin, alors que c'est la décision la plus structurante et la plus difficile à défaire de toute la liste. Elle engage la conformité légale, le schéma de données, ce que l'API accepte, et l'exposition en cas de fuite.

**Alternative formulée en trade-off :**

> Stocker les données de santé (allergies liées à un enfant nommé) **chiffrées de bout en bout sur le device**, et ne garder côté serveur que des données **pseudonymisées** (identifiants opaques, catégories génériques d'allergène sans lien nominatif).
> - **On gagne :** confidentialité de niveau médical, surface d'attaque réduite, conformité RGPD art. 9 simplifiée, pas de responsabilité d'hébergement de données de santé.
> - **On perd :** la simplicité d'une sync serveur classique, et on hérite d'un modèle de chiffrement/backup device plus complexe.
> - **Réversibilité :** sens unique — donc on tranche *avant* de coder, avec un ADR.

*(C'est exactement la logique de l'architecture 3 tiers de TribuZen — un cas réel de cette décision.)*

### 4. Les 3 -ilities prioritaires pour MealPlan

Un choix défendable (d'autres triplets sont acceptables s'ils sont justifiés) :

1. **Confidentialité / sécurité** — on manipule des données de santé d'enfants ; c'est non négociable (cf. n°9).
2. **Maintenabilité** — équipe de 5, app jeune : la vélocité dépend d'un code simple à faire évoluer. C'est ce qui justifie le monolithe modulaire plutôt que des microservices prématurés.
3. **Fiabilité** — une app de planification familiale doit « juste marcher » au quotidien ; une liste de courses fausse ou perdue tue l'usage.

*Pourquoi pas d'autres :* la **scalabilité extrême** n'est pas critique (public familial, pas de pic viral attendu) ; la **performance sub-100ms** n'est pas un différenciateur. Les garder « acceptables » suffit — les prioriser serait de l'over-engineering.

---

## Variante J+30 (fading)

**Même exercice, contraintes ajoutées, à faire sans relire ce corrigé ni le module :**

1. Prends un système que **tu connais réellement** (ton app au travail, un side-project, ou TribuZen). Liste **10 décisions techniques** qui y ont été prises.
2. En **20 minutes chrono**, produis les 4 livrables (tri archi/détail, réversibilité, décision la plus risquée + alternative en trade-off, 3 -ilities prioritaires).
3. Contrainte supplémentaire : pour la décision que tu juges la plus structurante, **rédige un mini-ADR de 6 lignes** (Contexte → Décision → 2 conséquences positives → 2 conséquences négatives). *(L'ADR complet est vu au module 23 ; ici c'est juste le réflexe de tracer.)*

**Critère de réussite :** un collègue qui lit ta note comprend, sans que tu parles, **quelles décisions méritent une réunion et lesquelles non**, et pourquoi la décision risquée l'est.

---

## Grille d'évaluation (le coach s'en sert en session)

| Critère | Insuffisant | Attendu | Excellent |
|---|---|---|---|
| **Tri archi/détail** | Tout classé « architecture », ou classement au hasard | La majorité des 10 correctement triés avec le test du coût de retour | Tri juste + reconnaît les cas « limites » (ex : logs JSON) et explique le contexte qui les fait basculer |
| **Réversibilité** | Absente ou confond sens unique / double sens | Chaque décision d'archi qualifiée avec justification | Relie la réversibilité à la vitesse de décision recommandée |
| **Décision risquée** | N°9 non repérée | N°9 identifiée + pourquoi (données de santé enfants) | Alternative proposée **en trade-off explicite** (gagne/perd) + réversibilité qualifiée |
| **-ilities** | Liste de 7+ « tout est important » | 3 nommées et justifiées | Justifie aussi ce qu'on **renonce** à prioriser et pourquoi |
| **Posture** | Affirmations non argumentées (« X c'est mieux ») | Raisonne en « ça dépend + axes » | Formule des questions avant les réponses ; distingue contexte MealPlan vs Netflix |

**Seuil de validation :** « Attendu » sur les 4 premiers critères. La colonne « Excellent » est la cible pour la variante J+30.

---

## Application TribuZen

Ce lab est directement transférable au vrai produit. Dans le repo `smaurier/tribuzen-doc`, l'analyse équivalente **existe déjà** sous forme de la spec `SPEC-TRIBUZEN-2026.md` (§6, architecture de confidentialité).

**Ce que tu portes de ce lab vers TribuZen :**

- Refais l'étape 3 (décision la plus risquée) **sur TribuZen** : confirme par toi-même *pourquoi* le choix « données de santé en Level 1 device uniquement » était la bonne porte à sens unique, et ce qu'on a accepté de perdre (sync device-to-device complexe).
- Quand tu ouvriras le repo de code `smaurier/tribuzen`, la toute première tâche d'archi ne sera pas d'écrire du code mais de **tracer un ADR** (module 23) pour cette décision des 3 tiers — en réutilisant le format trade-off pratiqué ici.

**Commit cible (dans le repo doc, pas de code) :**
```
docs(archi): ADR-001 — confidentialité 3 tiers (Level 1 device E2EE / Level 2 pseudonymisé / Level 3 agrégats)
```
