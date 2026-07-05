---
titre: Décisions, culture d'architecte et capstone
cours: 13-architecture
notions: ["Architecture Decision Record (ADR)", "modèle C4 (Context / Container / Component / Code)", "documentation vivante (living contract)", "architecture review vs code review", "ATAM (analyse des trade-offs)", "checklist d'architecture review", "fitness functions", "dette technique (quadrant de Fowler)", "matrice impact / effort", "refactoring tactique vs stratégique", "Boy Scout Rule", "loi de Conway", "Inverse Conway Maneuver", "Team Topologies (4 types d'équipes)", "evolutionary architecture (guided change)", "build vs buy", "posture et culture d'architecte", "pièges fréquents (synthèse)", "capstone : concevoir une architecture de bout en bout"]
outcomes:
  - "sait rédiger un ADR (contexte / décision / conséquences / alternatives) et décider quand un ADR se justifie"
  - "sait dessiner les 3 premiers niveaux du modèle C4 (Context, Container, Component) d'un système"
  - "sait mener une architecture review avec une checklist et identifier les trade-offs (ATAM)"
  - "sait classer une dette technique (quadrant de Fowler) et la prioriser (impact / effort)"
  - "sait relier structure d'équipe et architecture (loi de Conway, Inverse Conway, Team Topologies)"
  - "sait concevoir l'architecture complète d'un système de bout en bout et la défendre (capstone)"
prerequis: ["Modules 00-04 — posture, SOLID, patterns, clean code, DI", "Modules 05-08 — couches, hexagonale, clean, monolithe modulaire vs microservices", "Modules 09-10 — DDD stratégique et tactique", "Modules 11-13 — API/backend, jobs/async, données", "Modules 14-15 — architecture frontend", "Modules 16-19 — communication, event-driven, patterns distribués, résilience", "Modules 20-22 — sécurité, performance, observabilité et testing d'archi"]
next: fin-parcours-13-architecture
libs: []
tribuzen: "architecture complète de TribuZen — synthèse de bout en bout : bounded contexts, style, données, communication, résilience, sécurité, observabilité, ADR et diagramme C4"
last-reviewed: 2026-07
---

# Décisions, culture d'architecte et capstone

> **Outcomes — tu sauras FAIRE :** rédiger un ADR, dessiner un C4 (Context/Container/Component), mener une architecture review avec checklist et ATAM, classer et prioriser une dette technique, relier structure d'équipe et architecture (Conway, Team Topologies), et concevoir l'architecture complète d'un système de bout en bout.
> **Difficulté :** :star::star::star::star:
>
> **Portée :** ce module ne contient **aucune notion technique neuve** — c'est l'**intégration** de tout le cours 13. On ajoute la couche qui manquait : comment **documenter**, **réviser**, **faire évoluer** et **défendre** une architecture, et comment la **culture** et l'**organisation** la façonnent. Le lab est le **capstone** : concevoir l'archi complète de TribuZen. Les techniques citées (patterns, hexagonale, DDD, sécurité, observabilité…) sont déjà couvertes dans les modules 00-22 — ici on les **assemble** et on les **décide**, on ne les ré-explique pas.

## 1. Cas concret d'abord

Tu es le seul architecte de TribuZen. Un contributeur bénévole rejoint le projet et pose trois questions en une journée :

1. **« Pourquoi PostgreSQL et pas Mongo ? On m'avait dit que Mongo était plus flexible. »** Tu as pris cette décision il y a six mois. Tu te souviens *à peu près* du raisonnement, mais tu n'as rien écrit. Tu vas devoir re-débattre à chaque nouvel arrivant.

2. **« Je ne comprends pas comment les morceaux s'emboîtent. Il y a l'app mobile, le backend, la file offline, le device chiffré… tu as un schéma ? »** Tu n'en as pas. Tout est dans ta tête.

3. **« Le module Routines commence à être lourd, on refait tout en microservices ? »** Réponse réflexe tentante — mais est-ce une vraie douleur mesurée, ou un réflexe « on m'a dit microservices » (piège n°1 du cours) ?

Ces trois questions n'ont **rien de technique nouveau**. Elles sont sur la **traçabilité des décisions** (ADR), la **communication de l'architecture** (C4), et la **discipline de révision** (ne pas céder à un changement non justifié). C'est exactement l'objet de ce module : une architecture qui n'est ni **documentée**, ni **révisée**, ni **assumée culturellement** se dégrade — quelle que soit sa qualité technique initiale.

Ce module te donne les outils pour répondre : un ADR pour la question 1, un diagramme C4 pour la question 2, une architecture review + le réflexe anti-pièges pour la question 3. Puis le lab te fait **tout assembler** : l'archi complète de TribuZen, décidée et défendue.

---

## 2. Théorie complète, concise

### 2.1 Documenter une décision : l'ADR

Un **Architecture Decision Record** (ADR) est une note courte qui fige **une** décision d'architecture et **pourquoi** elle a été prise. Sans ça, le « pourquoi » se perd, et chaque nouvel arrivant re-débat des choix déjà tranchés.

Structure canonique (Michael Nygard) :

```markdown
# ADR-001 — Utiliser PostgreSQL comme store serveur unique

## Statut
Accepté (2026-03-01)

## Contexte
Le backend doit stocker des métadonnées pseudonymisées (routines, complétions,
familles). Projet maintenu par une seule personne : coût opérationnel = contrainte dure.

## Décision
PostgreSQL, mono-store côté serveur. jsonb pour les champs souples,
full-text search intégré si besoin plus tard.

## Conséquences
+ Un seul moteur à opérer, sauvegarder, monitorer.
+ Transactions ACID pour les invariants (une complétion par jour).
- Pas de store spécialisé (recherche, graphe) sans décision ultérieure.

## Alternatives rejetées
- MongoDB : schéma implicite (piège), pas de gain réel ici.
- Polyglot (PG + Redis + ES) : coût opérationnel injustifiable à une personne.
```

**Quand écrire un ADR** — quand la décision est **coûteuse à inverser** : choix de techno (base, framework), choix de style (monolithe vs microservices, CQRS), choix de pattern transverse (stratégie d'auth, de cache). **Pas** d'ADR pour une convention locale (camelCase) ou un choix réversible en 5 minutes.

Un ADR est **immuable** : on ne le modifie pas, on le **remplace**. Un ADR devenu faux passe en statut `Superseded by ADR-067`, et le nouveau explique pourquoi. C'est un journal, pas un wiki.

### 2.2 Communiquer l'architecture : le modèle C4

Le **C4** (Simon Brown) décrit un système à **4 niveaux de zoom**. On monte le zoom selon l'audience.

| Niveau | Question | Audience |
|---|---|---|
| **1 — Context** | Le système vu de l'extérieur : qui l'utilise, à quels systèmes externes il parle | tout le monde (même non-tech) |
| **2 — Container** | Les grands blocs déployables : app mobile, API, base, cache, workers | devs, ops |
| **3 — Component** | Les modules internes d'un container | devs du container |
| **4 — Code** | Classes/interfaces — **rarement nécessaire**, le code fait foi | ponctuel |

Exemple Context (niveau 1) pour TribuZen :

```
   ┌──────────┐        complète routines,         ┌──────────────┐
   │  Parent  │───────  écrit le journal  ────────▶│  TribuZen    │
   │ (mobile) │                                    │  (système)   │
   └──────────┘                                    └──────┬───────┘
                                                          │ envoie mails
                                                   ┌──────▼───────┐
                                                   │  Service mail │
                                                   │  (externe)    │
                                                   └───────────────┘
```

Règle d'or : **un diagramme = un niveau**. Le piège est le diagramme fourre-tout qui mélange un composant interne et un acteur externe. Reste discipliné sur le niveau de zoom. Les niveaux 1-3 suffisent quasiment toujours ; le niveau 4 est du gaspillage (le code est déjà là).

### 2.3 Documentation vivante (living contract)

Une doc utile **vit dans le repo**, à côté du code, mise à jour **dans la même PR** que le changement qu'elle décrit. Une doc Word sur un drive partagé est morte le jour où elle est écrite.

| Doc morte | Doc vivante |
|---|---|
| Word/Confluence jamais relu | Markdown dans le repo, versionné |
| personne ne sait où elle est | découvrable (README, dossier `docs/adr/`) |
| jamais validée | la CI peut vérifier (statut ADR valide, liens) |
| écrite une fois, oubliée | évolue avec le code |

### 2.4 Réviser une architecture : review + ATAM

L'**architecture review** n'est pas une code review.

| | Code review | Architecture review |
|---|---|---|
| Périmètre | une PR, un fichier | un système, un module entier |
| Quand | chaque PR | avant un projet, à chaque milestone |
| Durée | 15-30 min | 1-4 h |
| Objet | style, bugs, perf locale | trade-offs, couplage, scalabilité |

> *Une brique parfaitement posée au mauvais endroit est pire qu'une brique mal posée au bon endroit.*

**ATAM** (Architecture Tradeoff Analysis Method) structure la review :
1. présenter l'archi (diagrammes C4) ;
2. lister les **attributs de qualité** prioritaires (perf, sécurité, maintenabilité…) ;
3. analyser des **scénarios critiques** — « et si le trafic triple ? », « et si le service mail tombe ? » ;
4. nommer les **trade-offs** — « le cache améliore la latence mais complique l'invalidation » ;
5. documenter risques et décisions en ADR.

**Checklist de review** (à parcourir à chaque milestone) — SoC (dépendances circulaires ? domaine isolé de l'infra ?), scalabilité (stateless ? bottlenecks ?), résilience (timeouts ? dégradation gracieuse ?), sécurité (threat model ? PII dans les logs ?), observabilité (logs corrélés ? SLO ?), testabilité (pyramide de tests ? contract tests ?).

### 2.5 Protéger l'archi dans le temps : fitness functions

Une **fitness function** est un **test automatisé qui vérifie un invariant architectural**. Elle empêche l'érosion : si quelqu'un viole la règle, la CI échoue.

Exemples : « aucune dépendance circulaire » (`madge --circular`), « le domaine n'importe jamais l'infra », « le bundle JS reste < 200 KB gzip », « aucun endpoint sans rate limiting », « p95 API < 300 ms ». C'est le pendant exécutable d'un ADR : l'ADR **décide**, la fitness function **fait respecter**.

### 2.6 Gérer la dette technique

La dette technique est comme une dette financière : un emprunt **délibéré et remboursé** est sain ; s'endetter **par ignorance** est dangereux. Le **quadrant de Fowler** croise deux axes :

```
                Délibérée              Accidentelle
          ┌──────────────────────┬──────────────────────┐
Prudente  │ « raccourci assumé,  │ « on a appris une    │
          │  remboursé au        │  meilleure façon     │
          │  prochain sprint »   │  depuis »            │
          ├──────────────────────┼──────────────────────┤
Imprudente│ « pas le temps de    │ « c'est quoi une     │
          │  bien faire »        │  archi hexagonale ? »│
          └──────────────────────┴──────────────────────┘
```

Délibérée + prudente = **acceptable** (trade-off conscient). Accidentelle + imprudente = **dangereuse** (ignorance).

**Prioriser** avec la matrice **impact / effort** : Quick Wins (fort impact, faible effort) d'abord ; Strategic (fort impact, gros effort) planifiés ; ignorer le fort-effort-faible-impact (« money pit »).

**Rembourser** à deux échelles :
- **tactique** — la **Boy Scout Rule** : « laisse le code plus propre que tu ne l'as trouvé », dans la PR courante (renommer, extraire une fonction). Jamais un gros refactoring dans une PR de feature.
- **stratégique** — un refactoring de module/contexte, planifié sur 1-3 sprints, tracé par un ADR.

Et savoir **ne pas rembourser** : un module bientôt supprimé, ou du code qui marche et que personne ne touche, a un coût de maintenance nul. *Working code that nobody touches has zero maintenance cost.*

### 2.7 Organisation et architecture : loi de Conway

**Loi de Conway (1967)** : *les organisations produisent des systèmes qui copient leur structure de communication.* Trois équipes par couche technique (front / back / DBA) → un monolithe en 3 couches à forte coordination. Trois équipes par domaine (Catalog / Orders / Users) → trois services autonomes.

**Inverse Conway Maneuver** : au lieu de subir cette loi, on la **retourne** — on définit l'architecture cible, **puis** on organise les équipes pour qu'elles y correspondent. « Tu veux des microservices ? organise tes équipes comme des microservices. »

**Team Topologies** — 4 types d'équipes :

| Type | Mission |
|---|---|
| **Stream-aligned** | livrer de la valeur métier (une par domaine) |
| **Platform** | fournir des outils aux stream-aligned (CI/CD, design system) |
| **Enabling** | faire monter les autres en compétence (coaching, pas de code en prod) |
| **Complicated-subsystem** | gérer un sous-système technique pointu (ML, sécurité) |

Corollaire solo : sur TribuZen, tu es l'**unique** équipe. Conway te dit alors de garder une architecture **simple et peu fragmentée** — un monolithe modulaire, pas un essaim de services qu'une personne ne peut pas opérer. La structure d'équipe (une personne) **doit** dicter le style (module 08).

### 2.8 Faire évoluer : evolutionary architecture & build vs buy

L'**architecture évolutive** remplace « planifier tout puis ne plus toucher » par une **boucle** : construire → mesurer (fitness functions) → adapter. Principes : **guided change** (les fitness functions guident l'évolution), **incremental change** (petits changements fréquents > gros changements rares).

Le changement peut être **guidé** (feature voulue, migration planifiée) ou **subi** (nouvelle réglementation, fin de support d'une techno) — l'architecture doit pouvoir **absorber** les deux.

**Build vs Buy** : construire ce qui est un **avantage concurrentiel** (le cœur produit), acheter/déléguer le reste (auth, mail, hosting). Pour TribuZen : le moteur de routines et la confidentialité device = **build** (c'est le produit) ; l'envoi de mails, l'hébergement = **buy** (aucune valeur à les gérer soi-même).

### 2.9 Moderniser sans tout casser (rappel)

Face à du legacy, on n'exécute **jamais** un Big Bang Rewrite (piège n°7). On applique le **Strangler Fig** : un proxy devant l'ancien, on migre **feature par feature**, on ne décommissionne l'ancien qu'à 100 % migré. Et une **Anti-Corruption Layer** (ACL) traduit entre le vieux modèle et le nouveau, pour que le legacy ne **contamine** pas le code propre. (Détail : module 19 — résilience & migration.)

### 2.10 La culture d'architecte

L'architecture n'est pas qu'un diagramme, c'est une **posture** (module 00, bouclé ici) :

- **Décider avec des trade-offs explicites**, jamais « c'est mieux » sans justification. Tout choix perd quelque chose ; nommer ce qu'on perd.
- **Adapter le message à l'audience** : au décideur → impact/coût/risque en une slide ; au dev → ADR + C4 ; à l'utilisateur → « ça marche, c'est fiable ».
- **Résister aux pièges de cargo cult** — le cours a ouvert sur 20 pièges (« on m'a dit microservices », « SOLID partout », « DDD sur un CRUD », « eventual consistency partout »…). Le fil rouge : **le contexte décide**, pas la mode. Un architecte mûr sait dire *« pas ici »* à une bonne pratique appliquée au mauvais endroit.
- **YAGNI** : la simplicité qui répond au besoin bat l'élégance qui anticipe un futur hypothétique.

### 2.11 Synthèse : la carte du cours

Concevoir une architecture, c'est enchaîner des **décisions**, dans cet ordre approximatif :

```
1. Découpage métier   → bounded contexts (DDD stratégique, module 09)
2. Style              → monolithe modulaire vs microservices (08), couches/hexa/clean (05-07)
3. Modèle du domaine  → agrégats, invariants (DDD tactique, module 10)
4. Données            → store owner par contexte, PG par défaut (module 13)
5. API & jobs         → contrats, async, idempotence (modules 11-12)
6. Communication      → sync/async, event-driven, intégration (modules 16-17)
7. Distribution       → CQRS/ES/saga SI justifié, résilience (modules 18-19)
8. Sécurité           → confidentialité, authz, secure by design (module 20)
9. Performance        → scalabilité, cache, budget (module 21)
10. Observabilité     → logs corrélés, SLO, testabilité d'archi (module 22)
11. Décisions & évo   → ADR, C4, review, fitness functions, dette (CE module)
```

Chaque flèche est un **ADR potentiel**. Le capstone (lab) te fait descendre cette carte **entièrement** pour TribuZen.

---

## 3. Worked examples

### Exemple 1 — Répondre à la question 3 du §1 avec une architecture review

Le contributeur propose : *« le module Routines est lourd, on passe en microservices ? »* Menons une mini-review ATAM plutôt que de répondre au réflexe.

**1. Attribut de qualité visé ?** Le contributeur invoque la « lourdeur » — attribut = *maintenabilité* / *vitesse de livraison*. Pas la scalabilité (TribuZen a peu d'utilisateurs), pas la disponibilité différenciée.

**2. Scénario critique.** « Découper Routines en service séparé : que gagne-t-on, que perd-on ? »
- Gagné : déploiement indépendant… mais **il n'y a qu'une équipe** (Conway) → personne pour opérer un service de plus.
- Perdu : transactions ACID locales (l'invariant « une complétion par jour » devient une transaction distribuée), +1 réseau, +1 pipeline, +1 store à sauvegarder.

**3. Trade-off nommé.** On échangerait une modularité qu'on peut obtenir **dans le monolithe** (module 08 : monolithe modulaire) contre un coût opérationnel qu'**une personne ne peut pas porter**.

**4. Diagnostic du vrai problème.** La « lourdeur » est-elle un problème de **frontière de module** (le contexte Routines fait trop de choses) ou de **déploiement** ? Presque toujours le premier. La solution est un **refactoring stratégique interne** (mieux découper le module), pas une extraction en service.

**5. Décision + ADR.** *Rejeté : rester monolithe modulaire. Refactorer les frontières internes du module Routines (dette stratégique, 1 sprint). Réviser si un jour une partie a un besoin prouvé de scalabilité indépendante.* → un ADR de 12 lignes qui évitera de re-débattre au prochain contributeur.

**Ce que l'exemple montre :** la bonne réponse à « on fait des microservices ? » n'est ni oui ni non par réflexe — c'est une **review** qui relie attribut de qualité, contrainte d'équipe (Conway) et coût, tranchée par un ADR.

### Exemple 2 — Rédiger l'ADR de la file offline de TribuZen

Décision réelle : l'app mobile doit permettre d'écrire une complétion **sans réseau**. Où vit la file d'attente ?

```markdown
# ADR-014 — File d'écritures offline côté device

## Statut
Accepté (2026-05-10)

## Contexte
L'app mobile (React Native) doit accepter une complétion de routine hors-ligne
et l'envoyer au retour du réseau. Les données peuvent contenir des références
sensibles (enfant). Un contributeur propose une file Redis serveur.

## Décision
La file d'écritures vit SUR L'APPAREIL (store local + file de sync).
Au retour réseau, l'app rejoue les écritures vers l'API, avec une clé
d'idempotence par écriture (module 12) pour tolérer les rejeux.

## Conséquences
+ Marche vraiment hors-ligne (une file Redis distante est inatteignable sans réseau).
+ Aucune donnée sensible ne stationne côté serveur avant traitement.
- Logique de rejeu et de résolution de conflits à gérer côté client.

## Alternatives rejetées
- File Redis serveur : contradictoire — hors-ligne = serveur injoignable, par définition.
- Rejouer sans idempotence : risque de doublons de complétion au rejeu.
```

**Ce que l'exemple montre :** l'ADR capture le **piège évité** (« Redis pour l'offline » est un non-sens physique), la décision, **et** le lien avec un pattern déjà vu (idempotence, module 12). Il rend la décision défendable en 30 secondes face au prochain arrivant.

---

## 4. Pièges & misconceptions

### PIÈGE #1 — « On documentera l'architecture à la fin »

La doc d'archi écrite « à la fin » n'est jamais écrite, ou décrit un système qui a déjà changé. Un ADR se rédige **au moment de la décision** (le contexte est frais), un C4 se met à jour **dans la PR** qui change les containers. La doc vivante est un **flux**, pas un livrable final. Corollaire : un ADR de 12 lignes écrit aujourd'hui vaut mille fois un document de 30 pages promis pour « plus tard ».

### PIÈGE #2 — Confondre architecture review et code review

Approuver chaque PR ligne à ligne ne garantit **rien** au niveau système. On peut avoir 100 % de PRs « clean » et une architecture pourrie (couplage, domaine qui dépend de l'infra, dépendances circulaires). La code review regarde la **brique** ; l'architecture review regarde **où sont les murs porteurs**. Ce sont deux rituels distincts, à deux fréquences distinctes.

### PIÈGE #3 — Croire qu'un ADR se modifie

Un ADR est **immuable**. On ne réécrit pas l'histoire : un ADR obsolète passe en `Superseded by ADR-XXX`, et le nouveau explique le changement de contexte. Si tu édites l'ancien, tu perds précisément l'information la plus précieuse — *pourquoi on pensait différemment avant*. Le journal des décisions vaut par sa continuité.

### PIÈGE #4 — « Toute dette technique est mauvaise »

Faux. La dette **délibérée et prudente** (raccourci assumé, tracé, remboursé au bon moment) est un **outil stratégique** légitime — comme un emprunt en finance. Ce qui tue, c'est la dette **accidentelle et imprudente** (par ignorance). Et parfois le bon choix est de **ne pas rembourser** : refactorer un module qui marche et que personne ne touche est du gaspillage. Le critère n'est jamais « c'est sale », c'est « ça coûte ».

### PIÈGE #5 — Ignorer la loi de Conway (« ça ne s'applique pas à nous »)

Concevoir l'architecture puis « voir » pour les équipes garantit une friction : la structure de communication **finira** par imprimer sa forme sur le système. Pour un projet solo, le piège prend une autre forme — vouloir une architecture de grande organisation (microservices, multi-services) qu'une seule personne ne peut pas opérer. La structure d'équipe est une **contrainte d'architecture de premier ordre**, pas un détail RH.

### PIÈGE #6 — Prendre une bonne pratique pour une loi universelle

Le fil rouge des 20 pièges du cours : SOLID, DDD, microservices, eventual consistency, cache — **toutes** sont d'excellentes pratiques **au bon endroit**, et des désastres appliquées partout. « DDD sur un formulaire de contact », « microservices pour 3 features », « cache sans invalidation »… La maturité d'architecte, ce n'est pas connaître plus de patterns : c'est savoir dire *« pas ici »*. Le **contexte** décide, jamais la mode.

### PIÈGE #7 — Un capstone qui empile des technos au lieu de décider

Face à « conçois l'archi complète », le réflexe junior est d'aligner tous les outils vus (Kafka + CQRS + microservices + ES + Redis…). Un capstone réussi fait souvent l'**inverse** : justifier ce qu'on **n'ajoute pas** (« pas de bus d'événements : un seul contexte émet, un appel direct suffit »). Chaque brique doit payer son coût opérationnel. La sophistication se mesure aux **trade-offs assumés**, pas au nombre de boîtes sur le diagramme.

---

## 5. Ancrage TribuZen

Ce module est le **point de convergence** de tout le fil rouge TribuZen. Chaque décision d'archi vue dans les modules 00-22 devient ici une **ligne documentée** de l'architecture du produit.

**Le dossier d'architecture cible de TribuZen** (ce que le capstone produit) :

```
tribuzen/
  docs/
    architecture/
      c4-context.md          ← niveau 1 : Parent, TribuZen, service mail
      c4-container.md         ← niveau 2 : app RN, API NestJS, PostgreSQL, device chiffré
      c4-component-routines.md← niveau 3 : le module Routines en couches
      adr/
        ADR-001-postgresql-mono-store.md
        ADR-002-monolithe-modulaire.md
        ADR-014-file-offline-device.md
        ...
```

Décisions structurantes de TribuZen, chacune un ADR, chacune reliée à un module :

- **Style : monolithe modulaire NestJS** (module 08) — pas de microservices : une seule personne l'opère (Conway). ADR-002.
- **Bounded contexts** (module 09) : Familles, Routines, Journal, Notifications — modules internes, pas services.
- **Données : PostgreSQL mono-store serveur + device chiffré** (module 13), carte à 3 niveaux (device chiffré / serveur pseudonymisé / agrégats). ADR-001.
- **Confidentialité (RGPD Art. 9)** (module 20) : les données identifiantes/santé ne montent **jamais** au serveur — contrainte qui pilote toute la carte de stockage.
- **Offline** (modules 12, 15) : file d'écritures sur device, rejeu idempotent. ADR-014.
- **Fitness functions** : « le domaine n'importe pas Prisma », « aucune donnée niveau 1 dans un log serveur » — protègent les décisions ci-dessus dans la CI.

> **Le principe non négociable** de TribuZen — *le produit ne doit jamais devenir une charge mentale ni financière* — est lui-même une **contrainte d'architecture**. Il justifie le mono-store, le monolithe, le refus du polyglot serveur : autant d'ADR dont la conséquence commune est « coût opérationnel minimal ». C'est l'exemple parfait d'un attribut de qualité (frugalité opérationnelle) qui **dicte** les décisions techniques.

---

## 6. Points clés

1. Un **ADR** fige une décision coûteuse à inverser (contexte / décision / conséquences / alternatives) ; il est **immuable** et se **remplace**, jamais ne se modifie.
2. Le **C4** décrit un système à 4 niveaux de zoom (Context / Container / Component / Code) ; un diagramme = un niveau ; les 3 premiers suffisent quasiment toujours.
3. La **doc vivante** vit dans le repo et se met à jour dans la même PR que le code ; la doc « à la fin » n'existe pas.
4. L'**architecture review** (système, trade-offs, milestones) est distincte de la **code review** (PR, style) ; **ATAM** la structure autour des scénarios critiques.
5. Les **fitness functions** rendent les décisions d'archi exécutables : la CI échoue si un invariant est violé.
6. La **dette** se classe (quadrant de Fowler : délibérée+prudente = OK, accidentelle+imprudente = danger) et se priorise (impact/effort) ; parfois on **ne rembourse pas**.
7. Refactoring **tactique** (Boy Scout Rule, dans la PR) vs **stratégique** (module/contexte, planifié, tracé par ADR).
8. **Loi de Conway** : l'organisation imprime sa forme sur le système ; **Inverse Conway** la retourne ; **Team Topologies** nomme 4 types d'équipes. Solo → architecture simple, peu fragmentée.
9. **Evolutionary architecture** : construire → mesurer → adapter ; **build** l'avantage concurrentiel, **buy** le reste.
10. La **culture d'architecte** : trade-offs explicites, message adapté à l'audience, YAGNI, et savoir dire *« pas ici »* à une bonne pratique mal placée (les 20 pièges).

---

## 7. Seeds Anki

```
Qu'est-ce qu'un ADR et quand en écrire un ?|Un Architecture Decision Record fige UNE décision (contexte / décision / conséquences / alternatives). On en écrit un quand la décision est coûteuse à inverser (techno, style, pattern transverse), jamais pour une convention locale.
Un ADR se modifie-t-il quand la décision change ?|Non. Un ADR est immuable : il passe en statut « Superseded by ADR-XXX » et un nouvel ADR explique le changement de contexte. On ne réécrit pas l'histoire des décisions.
Quels sont les 4 niveaux du modèle C4 ?|Context (système vu de l'extérieur), Container (blocs déployables), Component (modules internes d'un container), Code (classes — rarement utile). Règle : un diagramme = un seul niveau.
Différence entre architecture review et code review ?|Code review = une PR, style/bugs/perf locale, 15-30 min, chaque PR. Architecture review = un système, trade-offs/couplage/scalabilité, 1-4 h, à chaque milestone.
Qu'est-ce qu'une fitness function ?|Un test automatisé qui vérifie un invariant architectural (pas de dépendance circulaire, domaine isolé de l'infra, bundle < 200 KB). Si l'invariant est violé, la CI échoue — c'est l'ADR rendu exécutable.
Quadrant de Fowler : quelle dette est acceptable, laquelle est dangereuse ?|Délibérée + prudente = acceptable (trade-off conscient, remboursé). Accidentelle + imprudente = dangereuse (par ignorance). Parfois le bon choix est de ne pas rembourser (code qui marche, jamais touché).
Refactoring tactique vs stratégique ?|Tactique = Boy Scout Rule, dans la PR courante (renommer, extraire) — petit. Stratégique = un module/contexte entier, planifié sur 1-3 sprints, tracé par un ADR — jamais dans une PR de feature.
Énonce la loi de Conway et l'Inverse Conway Maneuver.|Conway : les organisations produisent des systèmes qui copient leur structure de communication. Inverse Conway : on définit l'architecture cible d'abord, puis on organise les équipes pour qu'elles y correspondent.
Quels sont les 4 types d'équipes de Team Topologies ?|Stream-aligned (valeur métier), Platform (outils partagés), Enabling (coaching, pas de code en prod), Complicated-subsystem (sous-système technique pointu).
Quelle est la marque d'un architecte mûr face aux bonnes pratiques (SOLID, DDD, microservices) ?|Savoir dire « pas ici ». Toutes sont excellentes au bon endroit et désastreuses appliquées partout. Le contexte décide, jamais la mode (YAGNI, les 20 pièges).
Pour un projet solo, que dicte la loi de Conway sur le style d'architecture ?|Une architecture simple et peu fragmentée : monolithe modulaire, pas un essaim de microservices qu'une seule personne ne peut pas opérer. La structure d'équipe est une contrainte d'archi de premier ordre.
```

---

## Pont vers le lab

> Lab associé : `labs/lab-23-decisions-culture-et-capstone/README.md`. **Capstone du parcours** : concevoir l'architecture **complète** de TribuZen de bout en bout — bounded contexts, style, données, communication, résilience, sécurité, observabilité — puis la figer en **ADR** + un **diagramme C4**. Exercice de conception et de décision, évalué par grille + coach, avec variante J+30. Zéro harnais. C'est l'intégration de tout le cours 13.
