---
titre: "Patterns distribués : CQRS, Event Sourcing & Saga"
cours: 13-architecture
notions: ["CQRS (Command Query Responsibility Segregation)", "modèle d'écriture vs modèle de lecture", "projection", "read model", "Event Sourcing", "event store (append-only)", "snapshot", "rejeu (replay)", "outbox pattern (transactional outbox)", "problème du dual write", "Saga pattern", "orchestration vs choreography", "transaction locale + compensation", "pivot transaction", "coût vs bénéfice de ces patterns", "quand NE PAS les utiliser"]
outcomes:
  - "sait expliquer ce que CQRS sépare (chemin d'écriture vs chemin de lecture) et à quel niveau l'appliquer sans surcoût"
  - "sait décrire l'Event Sourcing (stocker les faits, pas l'état) et nommer projection, snapshot et rejeu"
  - "sait poser le problème du dual write et expliquer comment l'outbox pattern le résout"
  - "sait décrire une saga (transactions locales + compensations) et opposer orchestration et choreography"
  - "sait décider si CQRS / Event Sourcing / Saga se justifient sur un cas donné — et surtout justifier un REFUS"
prerequis: ["Modules 00–17 du cours 13-architecture", "Module 10 — DDD tactique (agrégat, entité, invariant, événement de domaine)", "Module 16 — communication et intégration (sync vs async)", "Module 17 — event-driven & messaging (broker, queue/topic, idempotence, choreography vs orchestration)"]
next: 19-resilience-consistency-migration
libs: []
tribuzen: "backend TribuZen — revue d'architecture : décider si le module Routines passe en Event Sourcing, si le feed familial justifie CQRS, et si l'activation d'un abonnement premium justifie une saga"
last-reviewed: 2026-07
---

# Patterns distribués : CQRS, Event Sourcing & Saga

> **Outcomes — tu sauras FAIRE :** expliquer ce que CQRS sépare et à quel niveau l'appliquer, décrire l'Event Sourcing (faits vs état) avec projection/snapshot/rejeu, poser le problème du dual write et le résoudre par l'outbox, décrire une saga (transactions locales + compensations) et opposer orchestration/choreography — et décider si ces patterns se justifient, y compris **refuser**.
> **Difficulté :** :star::star::star::star:
>
> **Portée :** ce module reste au niveau **architecture** : on décide *quel pattern répond à quel besoin, et à quel coût*. On **ne** traite **pas** ici la **théorie des systèmes distribués** (théorème CAP, cohérence forte vs éventuelle, quorums) — c'est le **module 19 (next)** pour le versant cohérence/résilience, et le **cours distribués dédié (cours 17)** pour le fond. Le **détail d'implémentation** (broker managé, Debezium/CDC, config Kafka) relève du **cours 12 / cours 17**, la mécanique **jobs/workers** du **module 12**, le **schéma SQL** du **cours 10**. Ici, on raisonne : *ce pattern vaut-il sa complexité sur CE cas ?*
>
> **Fil rouge du module — à retenir avant tout :** ces trois patterns sont **coûteux** et **rarement justifiés**. Ils résolvent des problèmes réels mais étroits. Le réflexe par défaut d'un architecte n'est pas « lequel je prends », c'est « ai-je vraiment ce problème ? ». La bonne réponse est le plus souvent **non**.

## 1. Cas concret d'abord

Revue d'architecture TribuZen, un jeudi matin. Trois propositions arrivent au tableau, une par contributeur pressé de « faire de l'archi sérieuse » :

1. **« Passons le module Routines en Event Sourcing.** Comme ça on garde tout l'historique des complétions, on pourra recalculer les séries (streaks) autrement plus tard, et on aura un audit gratuit. »
2. **« Le feed familial rame** quand une famille a beaucoup d'activité. Séparons lecture et écriture avec CQRS : un modèle de lecture dénormalisé, dédié au feed. »
3. **« L'abonnement premium** touche trois choses : encaisser via Stripe, activer le compte premium en base, envoyer l'email de bienvenue. Si l'email plante après le paiement, c'est incohérent. Faisons une **saga** avec compensations. »

Ton job n'est **pas** d'implémenter les trois. C'est de **décider, pour chacune, si le pattern est justifié** — et de savoir dire non avec un argument, pas avec un haussement d'épaules.

Pour trancher, il te faut : savoir *ce que fait vraiment* chaque pattern, *ce qu'il coûte*, et *quel problème précis* il faut avoir pour qu'il rembourse ce coût. Spoiler : sur ces trois cas, **une seule** proposition survivra — et pas sous la forme demandée. Ce module te donne les critères. On y revient au §5 (et le lab te fait trancher toi-même).

---

## 2. Théorie complète, concise

Ces trois patterns partagent un ADN : ils naissent quand **un seul modèle / une seule transaction ne suffit plus**. Ils ajoutent tous de la complexité. On les voit un par un, puis on outille la décision.

### 2.1 CQRS — séparer le chemin d'écriture du chemin de lecture

**CQRS** (*Command Query Responsibility Segregation*) part d'un constat : dans un CRUD classique, **le même modèle** sert à écrire (valider des invariants, normaliser) et à lire (afficher, agréger, chercher). Ces deux usages tirent le modèle dans des directions opposées :

- L'écriture veut un modèle **normalisé** (3NF), qui protège les invariants métier.
- La lecture veut un modèle **dénormalisé**, pré-joint, optimisé pour l'affichage.

CQRS **sépare les deux chemins** :

```
              écriture (Command)         lecture (Query)
              POST / PUT / DELETE          GET
                    │                        │
                    ▼                        ▼
            ┌────────────────┐        ┌────────────────┐
            │ modèle d'écriture│      │ modèle de lecture│
            │ normalisé,       │      │ dénormalisé,     │
            │ invariants       │      │ optimisé lecture │
            └───────┬────────┘        └────────────────┘
                    │        projection        ▲
                    └───────────────────────────┘
```

La **projection** est le pont : elle transforme les données du côté écriture vers le côté lecture (une vue matérialisée qu'on rafraîchit, ou un consumer d'événements qui met à jour une table dédiée).

**Le point clé — CQRS est un spectre, pas un interrupteur.** Du moins cher au plus cher :

| Niveau | Read model | Cohérence | Quand |
|---|---|---|---|
| 0 — pas de CQRS | même modèle | forte | défaut, CRUD, la plupart des cas |
| 1 — vues matérialisées (même DB) | vue SQL dénormalisée | forte (même DB) | lectures lourdes localisées |
| 2 — read replica | réplica en lecture seule | éventuelle (lag ~100 ms) | trafic lecture très élevé |
| 3 — store spécialisé (Elasticsearch, Redis) | index dédié | éventuelle (~secondes) | recherche plein-texte, dashboards |

On **commence toujours au niveau 0**. On monte d'un cran **quand une lecture précise est mesurée comme goulot**, jamais par anticipation. Le niveau 1 (une vue matérialisée) apporte 80 % du bénéfice sans changer l'architecture : c'est du SQL, pas un système distribué.

> **CQRS ≠ deux bases par défaut.** Beaucoup croient que « faire du CQRS » impose une seconde base et de la cohérence éventuelle. Faux : le niveau 1 vit dans **la même** base. Séparer physiquement (niveaux 2-3) est un choix distinct, motivé par la charge, pas par le pattern.

### 2.2 Event Sourcing — stocker les faits, pas l'état

En CRUD, on stocke **l'état courant** : `routine.status = 'completed'`. L'état précédent est écrasé, l'historique perdu.

L'**Event Sourcing** (ES) inverse : on stocke la **suite des faits** (événements immuables), et l'état se **reconstruit en les rejouant**.

```
CRUD (state-based)                Event Sourcing
┌──────────────────┐            ┌────────────────────────────────┐
│ routine abc       │            │ event_store (append-only)      │
│ status: completed │            │ 1. RoutineCréée   { ... }      │
│ streak: 4         │  ◄── perd  │ 2. RoutineComplétée { day: 12 }│
└──────────────────┘  l'histoire│ 3. RoutineComplétée { day: 13 }│
                                 │ 4. RoutineArchivée  { ... }    │
                                 └────────────────────────────────┘
                                   état = rejeu de 1→4
```

Vocabulaire à tenir :

- **Event store** : le journal **append-only** (jamais d'`UPDATE` ni de `DELETE`), source de vérité. Ordonné par `(agrégat, version)`.
- **Rejeu (replay)** : reconstruire l'état d'un agrégat en réappliquant ses événements depuis le début.
- **Snapshot** : photo de l'état tous les N événements, pour éviter de rejouer 10 000 faits à chaque fois (on repart du dernier snapshot).
- **Projection** : un consumer qui transforme le flux d'événements en **read model** requêtable (une vue, un index). En ES, les projections **sont** le côté lecture — ce qui fait que ES **entraîne quasi toujours CQRS**.

Ce que ES achète : audit complet **gratuit** (l'historique EST la donnée), rejeu temporel (« état au 15 janvier ? »), possibilité de dériver de **nouvelles** vues a posteriori en rejouant le passé.

Ce que ES coûte, et c'est lourd : versionnage des événements (le schéma d'un `RoutineComplétée` évolue → il faut gérer les vieilles versions **pour toujours**), pas de `DELETE` (conflit frontal avec le **droit à l'oubli RGPD** → nécessite du *crypto-shredding*), complexité mentale pour toute l'équipe, et projections à maintenir. **On ne « met pas un peu » d'Event Sourcing** : c'est un engagement de fond sur un agrégat.

### 2.3 Le problème du dual write et l'outbox pattern

Sous-problème récurrent dès qu'on publie des événements (ES ou simple event-driven du module 17) : je dois **à la fois** persister en base **et** publier un message. Deux systèmes, deux écritures — le **dual write** :

```
DANGER — dual write
  1. BEGIN
  2. INSERT INTO routines ...
  3. COMMIT
  4. broker.publish('RoutineComplétée')   ← crash ICI : DB écrite, event PERDU
```

Il n'existe **pas** de transaction commune entre la base et le broker. Un crash entre les deux laisse le système incohérent (base à jour, consumers jamais prévenus — ou l'inverse).

L'**outbox pattern** (transactional outbox) résout ça : on écrit l'événement dans une **table `outbox`** de la **même** base, **dans la même transaction** que la modification métier. Un processus séparé (poller, ou CDC type Debezium) lit ensuite l'outbox et publie.

```
  1. BEGIN
  2. INSERT INTO routines ...
  3. INSERT INTO outbox (event, payload)   ← MÊME transaction
  4. COMMIT                                ← atomique : les deux, ou rien
  ─────────
  5. poller/CDC lit outbox → publie → marque comme publié
```

Garantie obtenue : **at-least-once** (le même event peut être publié 2 fois en cas de crash après publication et avant marquage) → **les consumers doivent être idempotents** (vu au module 17). L'outbox transforme un problème de cohérence distribuée insoluble en un problème SQL trivial (une table + un poller). C'est le pattern le plus **rentable** des trois familles de ce module, et le seul qu'on croise dès l'event-driven basique.

### 2.4 Saga — transactions distribuées sans commit global

Une transaction SQL locale est ACID : `BEGIN … COMMIT`, tout ou rien. Mais dès qu'un cas d'usage touche **plusieurs services** (ou plusieurs systèmes externes) avec **chacun sa base**, il n'y a **pas** de `COMMIT` global. Le *Two-Phase Commit* (2PC) existe mais bloque si le coordinateur tombe, ne scale pas, et n'est pas supporté par la plupart des brokers.

La **saga** est l'alternative pragmatique : une **suite de transactions locales**, chacune dans un service, avec pour chaque étape une **compensation** (l'opération qui annule sémantiquement son effet).

```
Saga : Réserver → Payer → Expédier

Succès :      T1 Réserver ✓ → T2 Payer ✓ → T3 Expédier ✓   → saga complète

Échec en T2 : T1 Réserver ✓ → T2 Payer ✗
              C1 Libérer (compense T1)                      → saga annulée
```

Vocabulaire :

- **Transaction locale (Ti)** : une opération atomique dans un seul service.
- **Compensation (Ci)** : l'inverse sémantique de Ti (rembourser un paiement, libérer un stock). Doit être **idempotente** et **toujours finir par réussir** (sinon → dead letter + alerte humaine). On ne fait pas un vrai *rollback* : un paiement déjà encaissé se **rembourse**, il ne « s'annule » pas.
- **Pivot transaction** : le point de non-retour. Après le pivot, on ne compense plus en arrière — on ne fait qu'avancer (« un colis parti ne se dé-livre pas »).

**Deux façons de coordonner une saga** (rappel du module 17, ici appliqué aux transactions) :

| | **Choreography** | **Orchestration** |
|---|---|---|
| Coordination | décentralisée : chaque service réagit aux événements | centralisée : un orchestrateur (machine à états) pilote |
| Couplage | faible | moyen (dépend de l'orchestrateur) |
| Visibilité / debug | difficile (flux implicite entre events) | claire (état de la saga persisté) |
| Adapté à | 2–3 étapes, flux simple | > 3 étapes, flux complexe |
| Risque | cycles implicites, dead letters difficiles à tracer | SPOF si l'orchestrateur tombe |

**Règle pragmatique :** au-delà de 3 étapes, préférer l'**orchestration** — la visibilité vaut de l'or en production.

### 2.5 L'outil de décision : ces patterns coûtent, prouve qu'ils remboursent

C'est **la** compétence du module. Chaque pattern a un **déclencheur légitime** unique. Sans ce déclencheur, c'est de l'over-engineering.

| Pattern | Le SEUL bon déclencheur | Coût principal | Défaut si pas le problème |
|---|---|---|---|
| CQRS niv. 1 | une lecture lourde **mesurée** | une vue à rafraîchir | inutile mais peu cher |
| CQRS niv. 2-3 | trafic lecture qui écrase l'écriture | cohérence éventuelle, ops | bugs « je ne vois pas ma propre écriture » |
| Event Sourcing | audit/rejeu **exigé** (métier, légal) | versionnage events, RGPD, équipe | complexité massive gratuite |
| Saga | transaction **réellement** répartie sur plusieurs services/bases | compensations, recovery, debug | complexité pour un problème inexistant |

Trois questions qui tuent 90 % des propositions :

1. **Ai-je vraiment ce problème, mesuré ?** (pas « ça pourrait aider un jour »)
2. **Le cas est-il vraiment distribué ?** Si tout tient dans **une** base, une transaction SQL locale suffit — **pas** de saga.
3. **Une version plus simple existe-t-elle ?** (une colonne `history` JSON plutôt qu'ES ; une vue matérialisée plutôt qu'un read store séparé ; une transaction locale plutôt qu'une saga.)

Le monolithe modulaire (module 08) rend la plupart de ces patterns **inutiles**, parce qu'il conserve les transactions locales. C'est la découpe en microservices qui *fabrique* le besoin de sagas — souvent un besoin qu'on aurait pu éviter en ne découpant pas.

---

## 3. Worked examples

### Exemple 1 — Trancher la proposition « Routines en Event Sourcing »

**Demande :** passer le module Routines en ES pour « avoir l'historique et un audit gratuit ».

**Analyse par les trois questions :**

1. *Ai-je vraiment le problème ?* Le besoin réel est : garder l'historique des complétions pour afficher un calendrier et calculer les séries. C'est **de la donnée d'historique**, pas un besoin d'**audit réglementaire** ni de **rejeu temporel arbitraire**.
2. *Version plus simple ?* Oui, évidente : une table `completions` en **append-only applicatif** (une ligne par complétion, jamais supprimée). C'est déjà l'historique complet, requêtable en SQL trivial, sans event store, sans projections, sans versionnage d'events, sans problème RGPD insoluble.
3. *Coût d'ES ici ?* Énorme et sans contrepartie : versionner `RoutineComplétée` pour toujours, gérer le droit à l'oubli sur des events immuables (TribuZen manipule des **données d'enfants** — RGPD strict), former l'équipe.

**Décision : REFUSÉ.** On obtient 100 % du bénéfice demandé avec une table `completions` classique. On garde ES en réserve *si un jour* un besoin d'audit légal ou de rejeu apparaît — il n'existe pas aujourd'hui.

> Ce qu'il faut savoir dire en revue : « Tu confonds *garder l'historique* (une table append-only suffit) avec *Event Sourcing* (reconstruire l'état par rejeu). On a besoin du premier, pas du second. »

### Exemple 2 — Trancher « feed familial lent → CQRS » et « premium → saga »

**Feed lent → CQRS.** Les trois questions :

1. *Problème mesuré ?* À vérifier : le feed est-il lent à cause de **JOINs de lecture** coûteux, ou d'un simple index manquant ? On mesure d'abord. Supposons qu'après mesure, ce sont bien des agrégations lourdes (activités de 8 co-référents, tri, comptages).
2. *Version la plus simple ?* **CQRS niveau 1** : une **vue matérialisée** `feed_famille` dénormalisée, rafraîchie à l'écriture (ou via l'outbox). Pas de seconde base, pas de cohérence éventuelle, cohérence forte (même DB).
3. *Coût ?* Faible : une vue SQL à rafraîchir. On **n'introduit pas** de read replica ni d'Elasticsearch (niveaux 2-3) — non mesurés comme nécessaires.

**Décision : ACCEPTÉ, mais niveau 1 seulement.** La proposition « séparer lecture/écriture » est validée dans sa version la moins chère (vue matérialisée), pas dans une version « deux bases ». On monte de niveau *si et seulement si* le niveau 1 est mesuré insuffisant.

**Premium → saga.** Les trois questions :

1. *Problème mesuré ?* Le risque est réel (paiement OK, email KO → incohérence perçue).
2. *Est-ce vraiment distribué ?* **Non.** Encaisser Stripe, activer le compte (ligne en base) et envoyer l'email se passent dans **un seul service** (le monolithe TribuZen) avec **une seule base**. Le seul système externe est Stripe.
3. *Version plus simple ?* Oui : **transaction locale + outbox**. Dans une transaction SQL, on active le compte premium ET on écrit un event `PremiumActivé` dans l'outbox. Un poller envoie ensuite l'email (retry si échec, idempotent). Le paiement Stripe se sécurise par une **clé d'idempotence** et un webhook, pas par une saga maison.

**Décision : REFUSÉ (saga), REMPLACÉ par outbox.** Une saga avec compensations serait une machinerie distribuée pour un problème qui tient dans une transaction locale. La vraie réponse est l'outbox (§2.3) + idempotence Stripe.

**Bilan de la revue :** sur trois propositions « patterns distribués », **zéro** n'est retenue sous sa forme initiale. Une devient une vue matérialisée, une devient une table append-only, une devient un outbox. **C'est le résultat normal d'une bonne revue d'archi.**

---

## 4. Pièges & misconceptions

### PIÈGE #1 — « CQRS = deux bases de données »

Faux. CQRS **sépare deux modèles**, pas forcément deux bases. Le niveau 1 (vue matérialisée) vit dans la **même** base, en cohérence forte. Croire que CQRS impose une seconde base et de la cohérence éventuelle fait rejeter le pattern là où sa version simple serait parfaite — ou fait déployer une usine à gaz là où une vue SQL suffit.

### PIÈGE #2 — Confondre « garder l'historique » et « Event Sourcing »

Une table append-only (une ligne par fait, jamais supprimée) donne l'historique **sans** Event Sourcing. L'ES, c'est reconstruire l'**état courant par rejeu** des événements, avec event store, projections, snapshots et versionnage. Si tu veux juste consulter le passé, tu n'as pas besoin d'ES. Le mot « historique » ne justifie **jamais** à lui seul l'Event Sourcing.

### PIÈGE #3 — « On va mettre un peu d'Event Sourcing sur cet agrégat »

Il n'y a pas de « un peu ». Dès qu'un agrégat est event-sourced, tu t'engages **pour toujours** sur le versionnage de ses événements, la maintenance des projections, et le casse-tête RGPD (pas de `DELETE` sur un journal immuable → crypto-shredding). C'est une décision de fond, pas un détail d'implémentation qu'on ajoute le vendredi après-midi.

### PIÈGE #4 — Faire une saga pour une transaction qui tient dans une seule base

C'est le piège le plus fréquent et le plus coûteux. Une saga n'a de sens que si l'opération est **réellement répartie** sur plusieurs services/bases sans transaction commune. Si tes trois étapes sont trois écritures dans **la même** base PostgreSQL, un `BEGIN … COMMIT` local fait le travail, atomiquement, sans compensation. Introduire une saga ici, c'est fabriquer un problème distribué là où il n'y en avait pas.

### PIÈGE #5 — Croire qu'une compensation est un « rollback »

Une compensation **n'annule pas** l'action, elle en **compense l'effet sémantiquement**. Un paiement encaissé ne se « rollback » pas : il se **rembourse** (nouvelle opération, visible, traçable). Un email envoyé ne se « dé-envoie » pas. D'où le concept de **pivot** : passé un certain point, on ne compense plus, on ne fait qu'avancer. Raisonner « saga = rollback distribué » mène à des compensations impossibles.

### PIÈGE #6 — Adopter ces patterns « parce que c'est de l'archi sérieuse »

CQRS/ES/Saga sont impressionnants sur un schéma et en entretien. Ce n'est pas un critère. Le critère est : **ai-je le problème précis que ce pattern résout, mesuré ?** Un monolithe modulaire (module 08) avec des transactions locales et un outbox couvre l'immense majorité des besoins. Choisir la complexité pour elle-même est une faute d'architecte, pas une preuve de maturité. La maturité, c'est **refuser** le pattern quand il ne rembourse pas.

---

## 5. Ancrage TribuZen

Retour à la revue du §1. Le mapping fil-rouge de TribuZen (backend monolithe modulaire NestJS, une base PostgreSQL) rend la décision nette :

- **Routines → Event Sourcing : NON.** Une table `completions` append-only (module 10 : l'agrégat `Routine` émet un fait `RoutineComplétée` persisté en ligne) donne l'historique et les séries sans le coût d'un event store. TribuZen manipule des données d'enfants : le droit à l'oubli RGPD rend l'immuabilité d'un event store **hostile**. ES resterait envisageable *uniquement* si un besoin d'audit légal apparaissait — il n'existe pas.
- **Feed familial → CQRS niveau 1 : OUI (si mesuré).** Une **vue matérialisée** `feed_famille`, dénormalisée, rafraîchie via l'outbox quand une activité est créée. Même base, cohérence forte, zéro système distribué ajouté. On ne monte aux niveaux 2-3 que si la charge le prouve.
- **Premium → Saga : NON, outbox à la place.** Activation premium + email tiennent dans **une** transaction locale ; l'email part via l'**outbox** (le pattern déjà utilisé par TribuZen pour découpler l'event-driven du module 17). Stripe se sécurise par clé d'idempotence + webhook. Aucune saga : rien n'est réparti sur plusieurs bases.

**Quand une vraie saga arriverait-elle dans TribuZen ?** Seulement le jour où un module serait **extrait** en service séparé avec sa **propre** base — par exemple un service de facturation autonome. C'est précisément le coût caché des microservices (module 08) : ils **fabriquent** le besoin de sagas. Tant que TribuZen reste un monolithe modulaire, les transactions locales suffisent, et c'est un **avantage**, pas un retard.

> **Défère :** le versant **cohérence** de ces choix (forte vs éventuelle, read-your-own-writes, CAP) est le **module 19 (next)**. Le fond **systèmes distribués** est le **cours 17 dédié**. Le **schéma SQL** de la vue matérialisée et de l'outbox est le **cours 10**. Ici, on a seulement **décidé** quel pattern (ou non-pattern) répond à chaque besoin.

---

## 6. Points clés

1. **CQRS** sépare le chemin d'écriture (normalisé, invariants) du chemin de lecture (dénormalisé, optimisé). C'est un **spectre** : niveau 0 (rien) → 1 (vue matérialisée, même base) → 2 (replica) → 3 (store spécialisé). Commence au 0, monte sur mesure.
2. **CQRS ≠ deux bases.** Le niveau 1 vit dans la même base, en cohérence forte. La séparation physique est un choix distinct motivé par la charge.
3. **Event Sourcing** stocke les **faits** (event store append-only), pas l'état ; l'état se reconstruit par **rejeu**, accéléré par **snapshots**, exposé via **projections** (donc ES ⇒ CQRS).
4. **« Garder l'historique » ≠ Event Sourcing.** Une table append-only suffit pour consulter le passé. ES ne se justifie que par un besoin **d'audit/rejeu réel**, et coûte cher (versionnage, RGPD, équipe).
5. **Dual write** = écrire en base ET publier un message sans transaction commune → incohérence au moindre crash. **Outbox pattern** : écrire l'event dans une table de la même base, dans la même transaction ; un poller publie ensuite (at-least-once → consumers idempotents). Le pattern le plus rentable du module.
6. **Saga** = transactions locales + **compensations** (idempotentes, doivent réussir), pour un cas **réellement distribué** sans commit global. **Pivot** = point de non-retour. Une compensation **rembourse**, elle n'annule pas.
7. **Orchestration** (coordinateur central, visible) pour > 3 étapes ; **choreography** (events décentralisés) pour 2-3 étapes simples.
8. **Décision > implémentation.** Chaque pattern a **un** déclencheur légitime, mesuré. Sans lui, c'est de l'over-engineering. La bonne réponse par défaut est **non** — refuser le pattern est une compétence d'architecte.

---

## 7. Seeds Anki

```
Que sépare CQRS, et est-ce forcément deux bases ?|Il sépare le modèle d'ÉCRITURE (normalisé, invariants) du modèle de LECTURE (dénormalisé, optimisé). Non : le niveau 1 (vue matérialisée) vit dans la MÊME base, en cohérence forte. Deux bases = choix distinct motivé par la charge.
Quels sont les niveaux de CQRS du moins au plus cher ?|0 = pas de CQRS (défaut) ; 1 = vue matérialisée même DB (cohérence forte) ; 2 = read replica (éventuelle) ; 3 = store spécialisé Elasticsearch/Redis. On commence au 0 et on monte sur mesure mesurée.
Quelle est la différence entre "garder l'historique" et Event Sourcing ?|Garder l'historique = une table append-only (une ligne par fait) suffit. Event Sourcing = reconstruire l'ÉTAT COURANT par rejeu des événements (event store, projections, snapshots, versionnage). Le mot "historique" ne justifie jamais à lui seul l'ES.
Qu'est-ce que le problème du dual write et comment l'outbox le résout ?|Dual write = écrire en base ET publier un message sans transaction commune → crash entre les deux = incohérence. Outbox : écrire l'event dans une table de la MÊME base, dans la MÊME transaction ; un poller/CDC publie ensuite (at-least-once → consumers idempotents).
Qu'est-ce qu'une saga et quand est-elle justifiée ?|Une suite de transactions locales + compensations, alternative pragmatique au 2PC pour une transaction RÉELLEMENT répartie sur plusieurs services/bases. Injustifiée si tout tient dans une seule base (transaction SQL locale suffit).
Compensation vs rollback dans une saga ?|Une compensation ne fait pas un rollback : elle compense sémantiquement (un paiement encaissé se REMBOURSE, un email envoyé ne se dé-envoie pas). Le PIVOT est le point de non-retour : après lui, on ne compense plus, on avance.
Orchestration vs choreography pour une saga ?|Choreography = décentralisée (chaque service réagit aux events), pour 2-3 étapes simples, mais debug difficile. Orchestration = coordinateur central en machine à états, visible/traçable, pour > 3 étapes ou flux complexe (mais SPOF).
Quelles 3 questions tuent une proposition CQRS/ES/Saga ?|1) Ai-je vraiment ce problème, MESURÉ ? 2) Le cas est-il vraiment distribué (sinon transaction locale) ? 3) Une version plus simple existe-t-elle (vue matérialisée / table append-only / outbox) ? La bonne réponse par défaut est NON.
Pourquoi les microservices "fabriquent"-ils le besoin de sagas ?|Découper en services séparés donne à chacun sa propre base → plus de transaction commune → il faut des sagas pour les opérations multi-services. Un monolithe modulaire garde des transactions locales et évite ce besoin : c'est un avantage.
```

---

## Pont vers le lab

> Lab associé : `labs/lab-18-patterns-distribues-cqrs-es-saga/README.md`. On te donne trois besoins TribuZen ; pour chacun tu décides si CQRS / Event Sourcing / Saga s'applique, tu justifies — et surtout tu sais **refuser** et proposer la version la moins chère. Exercice de décision, évalué par grille + coach. Zéro harnais.
