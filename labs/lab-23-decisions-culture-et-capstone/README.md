# Lab 23 — Capstone : concevoir l'architecture complète de TribuZen

> **Outcome :** à la fin, tu sais **concevoir une architecture logicielle de bout en bout** pour un vrai produit — découpage métier, style, données, communication, résilience, sécurité, observabilité — puis la **figer** (ADR) et la **communiquer** (diagramme C4), en **justifiant chaque décision par un trade-off** et en assumant ce que tu **n'ajoutes pas**.
> **Vrai outil :** papier / tableau blanc / fichiers `.md` dans un dossier `docs/architecture/`. C'est un exercice de **décision et de synthèse d'architecture**, pas d'implémentation : tu produis un **dossier d'architecture** (C4 + série d'ADR + carte des décisions). Aucun code à faire tourner, aucun service à installer.
> **Feedback :** le coach valide le raisonnement en session avec la grille récapitulative ci-dessous. Pas de test-runner auto-correcteur.

---

## Énoncé

C'est le **capstone** du cours 13. Tu ne pratiques pas une notion isolée : tu **assembles tout le parcours** (modules 00-22) en une seule architecture cohérente, décidée et défendable.

Tu es l'**unique architecte** de TribuZen. On te demande de produire le **dossier d'architecture** du produit — le document qu'un contributeur bénévole lit pour comprendre *comment ça marche* et *pourquoi c'est fait comme ça*.

**Rappel du produit (spec TribuZen) :**

- App **mobile-first (React Native)** pour aider les familles à tenir des **routines** (créer, compléter, calculer des séries) et un **journal de famille**.
- Backend **NestJS** pour la synchronisation d'état, les notifications, les agrégats.
- Données **très sensibles** : prénoms d'enfants, photos, notes intimes (**RGPD Art. 9**). Les données identifiantes/santé **ne doivent jamais atteindre le serveur**.
- **Mode hors-ligne** obligatoire : on écrit une complétion ou une note sans réseau, elle part au retour de connexion.
- **Notifications** (rappels de routine) et **e-mails** (récap hebdo aux co-référents).
- Maintenu par **une seule personne**, principe **non négociable** : *le produit ne doit jamais devenir une charge mentale ni financière.*

**Ta mission — produire un dossier d'architecture en 7 décisions :**

1. **Bounded contexts** — découpe le domaine en contextes (DDD stratégique). Nomme-les, dis ce que chacun possède, et lequel est le **core domain**.
2. **Style d'architecture** — monolithe modulaire ou microservices ? couches / hexagonale / clean à l'intérieur ? Justifie **par la contrainte d'équipe** (Conway) et le coût opérationnel.
3. **Architecture de données** — carte de stockage : quel store possède quelle donnée, à quel niveau de confidentialité (device chiffré / serveur pseudonymisé / agrégat). PostgreSQL par défaut ; justifie tout store en plus.
4. **Communication** — comment les morceaux se parlent : sync (API) vs async (file/événement), interne et device↔serveur. Décide si un bus d'événements se justifie (probablement **non** — argumente).
5. **Résilience & offline** — la file d'écritures offline (où vit-elle ? rejeu idempotent ?), la dégradation gracieuse si le service mail tombe, les timeouts.
6. **Sécurité** — comment la contrainte RGPD Art. 9 est **structurellement** garantie (pas juste « on fait attention ») : quelles données montent, lesquelles restent sur le device, où vit l'authz.
7. **Observabilité** — que loguer sans jamais fuiter une donnée niveau 1 ; 1-2 SLO qui comptent pour ce produit.

**Puis, figer et communiquer :**

8. **Rédige 3 ADR** minimum (parmi tes décisions structurantes) au format contexte / décision / conséquences / alternatives rejetées.
9. **Dessine le C4** : niveau 1 (Context) **et** niveau 2 (Container), en ASCII ou sur papier.
10. **Nomme 2 fitness functions** qui protègent tes décisions les plus importantes dans la CI.

**Contrainte de portée :** tu restes au niveau **décision d'architecture**. Pas de code NestJS, pas de schéma Prisma, pas d'implémentation de chiffrement. Tu décides *quoi vit où* et *pourquoi*, tu le **traces** (ADR) et tu le **communiques** (C4). La sophistication se mesure aux **trade-offs assumés** et à ce que tu **refuses d'ajouter**, pas au nombre de boîtes.

---

## Étapes (en friction)

1. **Descends la carte des décisions du module (§2.11), dans l'ordre.** Ne saute pas au style avant d'avoir les contextes ; ne choisis pas un store avant d'avoir classé la sensibilité des données. Chaque décision s'appuie sur la précédente.
2. **Pour la sécurité, pars de la contrainte, pas de la techno.** « Les données Art. 9 ne montent jamais » → déduis-en la carte de stockage **avant** de penser moteur. La confidentialité pilote les données, qui pilotent la communication.
3. **Laisse la contrainte d'équipe trancher le style.** Une personne = Conway t'interdit l'essaim de services. Écris-le explicitement : c'est ta justification la plus forte contre les microservices.
4. **Pour chaque brique que tu ajoutes, écris son coût opérationnel.** Un store, une file, un bus = quelque chose à opérer/sauvegarder/monitorer seul. Si le coût n'est pas payé par un besoin **prouvé**, tu ne l'ajoutes pas — et tu l'écris.
5. **Chasse les pièges du cours dans ta propre copie.** Ai-je mis « des microservices parce que ça fait sérieux » (piège 1) ? « du DDD sur un CRUD » (piège 9) ? « une file Redis serveur pour l'offline » (non-sens physique) ? « eventual consistency » là où il faut de l'ACID (piège 4) ?
6. **Rédige les ADR au moment où tu décides**, pas à la fin — le contexte est frais. 10-15 lignes chacun.
7. **Dessine le C4 en deux temps** : Context (qui utilise, quels systèmes externes) puis Container (app RN, API, PostgreSQL, device chiffré, service mail). Un diagramme = un niveau, pas de mélange.
8. **Nomme 2 fitness functions** qui rendent tes décisions exécutables (ex. « le domaine n'importe pas Prisma », « aucune donnée niveau 1 dans un log »).
9. **Auto-contrôle.** Repasse la grille ci-dessous sur ta copie avant de la montrer au coach. Vérifie surtout : chaque décision a-t-elle un **trade-off** nommé ? ai-je justifié au moins une **non-addition** ?

---

## Corrigé complet commenté

> Le corrigé porte sur les **décisions et leur justification**, pas sur du code. Une solution différente est valable si chaque décision est justifiée par un trade-off explicite et cohérente avec les contraintes (solo, RGPD Art. 9, offline, low-effort).

### 1. Bounded contexts

| Contexte | Possède | Core ? |
|---|---|---|
| **Routines** | routines, complétions, calcul des séries (streaks) | **Oui — core domain** (c'est la valeur du produit) |
| **Familles** | familles, membres, rôles (co-référents), invitations | supporting |
| **Journal** | notes, photos (données Art. 9, device only) | supporting |
| **Notifications** | rappels de routine, e-mails de récap | generic |

Ce sont des **modules internes** d'un même déployable, pas des services. Le core domain (Routines) reçoit le soin DDD (agrégats, invariants) ; les autres restent plus simples (le piège 9 : pas de DDD cérémonieux sur un CRUD de contact).

### 2. Style d'architecture

**Monolithe modulaire NestJS** — un seul déployable, modules internes bien séparés (un module par bounded context). À l'intérieur, **architecture en couches / hexagonale** : le domaine (règle « routine archivée non complétable », calcul de série) est isolé de l'infra via des interfaces de repository.

- **Justification (Conway) :** une seule personne opère le produit. Un essaim de microservices = autant de pipelines, stores et alertes qu'une personne ne peut pas porter → violation directe du principe « jamais une charge ». C'est la décision la mieux ancrée.
- **Trade-off assumé :** pas de déploiement indépendant par contexte. Acceptable : aucun contexte n'a de besoin **prouvé** de scalabilité isolée.
- **Piège évité :** n°1 « on m'a dit microservices ». On garde la **modularité** (frontières internes) sans le **coût distribué**.

### 3. Architecture de données

| Donnée | Niveau | Store propriétaire | Pourquoi |
|---|---|---|---|
| Texte de note, photos | **1 — device chiffré** | stockage local chiffré | Art. 9 : jamais sur le serveur |
| Routines, complétions (métadonnées) | **2 — serveur pseudonymisé** | **PostgreSQL** | relationnel, invariants ACID, réf. enfant pseudonyme |
| File d'écritures offline | **1 — device** | store local + file de sync | doit marcher sans réseau |
| Index de recherche journal (V2) | **1 — device** | index local | le serveur n'a pas le texte |
| Agrégats d'usage (anonymes) | **3 — agrégat** | analytics | non ré-identifiable |

**Mono-store PostgreSQL côté serveur.** Aucun besoin ne sort du relationnel. **Polyglot serveur refusé** (Mongo/ES/Redis serveur = coût opérationnel injustifiable à une personne). **Polyglot device↔serveur assumé** (imposé par offline + confidentialité, pas par confort).

### 4. Communication

- **Device ↔ serveur :** API REST NestJS (sync) pour la sync d'état ; rejeu de la file offline au retour réseau (async côté device).
- **Interne (entre modules) :** appels directs in-process (même déployable). **Pas de bus d'événements.** Un module peut appeler l'interface d'un autre.
- **Non-addition justifiée :** un bus (Kafka/RabbitMQ) ne se justifie **pas** — un seul processus, pas de découplage inter-services à obtenir, pas de volumétrie d'événements. L'ajouter serait du piège « eventual consistency partout » (n°4) + un store de plus à opérer. Les notifications par e-mail, elles, partent **en async** (file légère / job) car non critiques et tolérantes au délai.

### 5. Résilience & offline

- **File offline sur le device** (jamais un Redis serveur — un parent hors-réseau ne peut pas écrire dans un Redis distant, non-sens). Rejeu avec **clé d'idempotence par écriture** → pas de double complétion au rejeu (module 12).
- **Service mail down :** dégradation gracieuse — le récap hebdo est mis en file et réessayé ; l'échec d'un e-mail **ne bloque jamais** une complétion de routine (les deux chemins sont découplés).
- **Timeouts** définis sur les appels sortants (mail, push). Pas de circuit breaker sophistiqué : sur-dimensionné pour la volumétrie.

### 6. Sécurité

- **Garantie structurelle, pas comportementale :** les données niveau 1 (texte, photos) n'ont **aucun chemin** vers le serveur — elles ne sont pas dans les DTO d'API, pas dans le schéma PostgreSQL. On ne « fait pas attention » : c'est **impossible par construction**.
- Le serveur ne détient que du **pseudonymisé** (UUID, réf. enfant pseudonyme, date). Authz côté API (un membre n'accède qu'à sa famille).
- **Trade-off :** la recherche dans le journal reste **device-only** (le serveur n'a pas le texte) → pas d'Elasticsearch. Conséquence assumée d'une décision de confidentialité.

### 7. Observabilité

- **Logs structurés + correlation ID** par requête, mais **règle absolue : aucune donnée niveau 1** (prénom, texte de note) dans un log. On logue des UUID et des événements, jamais du contenu.
- **SLO qui comptent ici :** (a) *la complétion d'une routine réussit et se synchronise* (le cœur de l'usage) ; (b) *le récap hebdo part le dimanche*. Pas de SLO de latence agressif : peu d'utilisateurs, pas la contrainte.

### 8. Trois ADR (extraits attendus)

```markdown
# ADR-002 — Monolithe modulaire NestJS
## Contexte
Produit maintenu par une seule personne. 4 bounded contexts identifiés.
## Décision
Un seul déployable, un module interne par contexte, couches + hexagonale à l'intérieur.
## Conséquences
+ Un pipeline, un store, un point d'observabilité à opérer.
+ Transactions ACID locales pour les invariants.
- Pas de scalabilité indépendante par contexte (non requise aujourd'hui).
## Alternatives rejetées
- Microservices : coût opérationnel impossible à porter seul (Conway). Réviser si un
  contexte prouve un besoin de scalabilité isolée.
```

```markdown
# ADR-001 — PostgreSQL mono-store serveur
## Décision
PostgreSQL unique côté serveur pour les métadonnées pseudonymisées.
## Conséquences  + un seul moteur à opérer  - pas de store spécialisé sans nouvel ADR
## Alternatives rejetées  Mongo (schéma implicite), polyglot serveur (coût injustifiable).
```

```markdown
# ADR-014 — File d'écritures offline côté device (rejeu idempotent)
## Décision  File sur l'appareil ; rejeu vers l'API avec clé d'idempotence.
## Alternatives rejetées  File Redis serveur : injoignable hors-réseau, par définition.
```

### 9. Diagramme C4

**Niveau 1 — Context :**

```
  ┌──────────┐   complète routines,     ┌──────────────┐   envoie   ┌───────────┐
  │  Parent  │──  écrit le journal,   ──▶│   TribuZen   │── mails ──▶│ Service   │
  │ (mobile) │    reçoit des rappels     │  (système)   │            │ mail (ext)│
  └──────────┘                           └──────────────┘            └───────────┘
```

**Niveau 2 — Container :**

```
┌──────────────────────── TribuZen ────────────────────────┐
│  ┌───────────────┐   REST/HTTPS   ┌────────────────────┐  │
│  │  App mobile   │───────────────▶│   API NestJS       │  │
│  │  React Native │                │  (monolithe mod.)  │  │
│  │               │                └─────────┬──────────┘  │
│  │  ┌─────────┐  │                          │             │
│  │  │ device  │  │                  ┌────────▼─────────┐   │
│  │  │ chiffré │  │  (jamais         │   PostgreSQL     │   │
│  │  │ + file  │  │   synchronisé    │  (pseudonymisé)  │   │
│  │  │ offline │  │   au serveur)    └──────────────────┘   │
│  │  └─────────┘  │                                         │
│  └───────────────┘                                         │
└────────────────────────────────────────────────────────────┘
```

### 10. Deux fitness functions

1. **Isolation du domaine :** aucun fichier de `src/**/domain/` n'importe `@prisma/client` / `@nestjs/common` (grep en CI). Protège la décision « domaine isolé de l'infra » (couches/hexagonale).
2. **Zéro donnée niveau 1 côté serveur :** le schéma PostgreSQL et les DTO d'API ne contiennent **aucun** champ de contenu (texte de note, nom d'enfant en clair). Test qui échoue si un champ interdit apparaît. Protège la garantie RGPD **structurelle**.

**Pourquoi ce corrigé est correct :** il **descend la carte des décisions dans l'ordre** (contextes → style → données → communication → résilience → sécurité → observabilité) ; chaque décision est justifiée par un **trade-off nommé** ; la contrainte **solo (Conway)** tranche le style ; la contrainte **RGPD Art. 9** pilote données et sécurité de façon **structurelle** ; et la maturité se voit dans les **non-additions assumées** (pas de microservices, pas de polyglot serveur, pas de bus d'événements, pas d'Elasticsearch) — chacune payant son coût opérationnel au principe low-effort.

---

## Grille d'évaluation (coach)

| Critère | Attendu | ✅ / ❌ |
|---|---|---|
| Ordre des décisions | Descend la carte du module : contextes → style → données → … → observabilité, sans sauter | |
| Bounded contexts + core | Contextes nommés, propriétaire clair, core domain (Routines) identifié | |
| Style justifié par Conway | Monolithe modulaire justifié **explicitement** par la contrainte solo, pas par goût | |
| Carte de stockage 3 niveaux | Chaque donnée classée par sensibilité AVANT le moteur ; contenu = device niveau 1 | |
| Sécurité structurelle | RGPD Art. 9 garantie **par construction** (pas de chemin serveur), pas « on fait attention » | |
| Trade-off par décision | Chaque décision majeure nomme ce qu'elle **perd** | |
| Au moins une non-addition | Refus argumenté d'au moins une brique (microservices / bus / polyglot / ES) par le coût | |
| Pièges du cours évités | Pas de microservices réflexe (1), DDD sur CRUD (9), eventual consistency mal placée (4), Redis offline serveur | |
| 3 ADR bien formés | Contexte / décision / conséquences / alternatives ; immuables | |
| C4 Context + Container | Deux niveaux distincts, un diagramme = un niveau, acteurs externes au niveau 1 | |
| 2 fitness functions | Deux invariants exécutables reliés aux décisions clés | |

Seuil : **8/11** pour valider le capstone. En dessous, reprends l'étape où la chaîne casse — le plus souvent : une décision sans trade-off, ou une sécurité « comportementale » au lieu de structurelle.

---

## Variante J+30 (fading)

**Même exercice, contraintes ajoutées :**

1. **En 45 minutes, de mémoire**, sans relire ce corrigé ni les modules 00-22. Tu produis : la carte des 7 décisions (une ligne chacune), **1 seul** ADR (le plus structurant, à toi de choisir lequel), et le C4 niveau Container uniquement.
2. **Nouveau besoin produit :** TribuZen ajoute le **partage inter-familles** — deux familles voisines peuvent partager un défi de routine commun (« challenge de quartier »). Cela introduit des données qui **traversent** deux familles.
3. **Décisions à trancher spécifiquement :** ce nouveau besoin justifie-t-il (a) un **nouveau bounded context** ? (b) un changement de **style** (enfin des microservices ?) (c) un **store en plus** ? Pour chaque : décide, et si c'est **non**, dis pourquoi le monolithe modulaire + PostgreSQL absorbe le besoin.
4. **Piège à traiter en une phrase :** le partage inter-familles touche-t-il des données niveau 1 (prénoms d'enfants d'une autre famille) ? Où se fait alors l'assemblage — serveur ou device ?

**Critère de réussite :** les 7 décisions + 1 ADR + C4 Container produits en 45 min, avec le partage inter-familles intégré **sans** ajouter de microservice ni de store (ou avec une justification en béton si tu en ajoutes un), et le placement correct des données sensibles du partage.

---

## Application TribuZen

Ce lab **est** l'architecture réelle de TribuZen — le dossier que tu commiteras dans le repo.

- Le dossier `docs/architecture/` (C4 + `adr/`) devient la **source de vérité** du produit, lue par tout contributeur avant de coder.
- Les décisions ici tranchées (monolithe modulaire, PG mono-store, device chiffré, offline idempotent, RGPD structurel) sont la **matérialisation** du principe non négociable *« jamais une charge mentale ni financière »* — chaque ADR a pour conséquence commune un coût opérationnel minimal.
- Les **fitness functions** définies iront dans la CI du repo `smaurier/tribuzen-api` pour empêcher l'érosion (domaine isolé, zéro donnée niveau 1 côté serveur).

**Commit cible (dossier d'architecture) :**
```
docs(architecture): dossier d'archi TribuZen — C4 + ADR (monolithe modulaire, PG mono-store, offline device, RGPD structurel)
```

> **Bravo — tu as bouclé le cours 13.** L'architecture n'est pas une destination, c'est un fil de décisions justifiées et révisées. Tu sais maintenant les prendre, les tracer, les défendre, et — le plus dur — refuser ce qui ne sert pas. Continue : construis.
