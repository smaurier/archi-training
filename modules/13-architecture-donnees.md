---
titre: Architecture des données (choix du modèle de stockage)
cours: 13-architecture
notions: ["relationnel vs NoSQL", "les 5 familles NoSQL", "polyglot persistence", "coût opérationnel du polyglot", "normalisation vs dénormalisation", "modélisation orientée requêtes", "migrations et versioning de schéma", "migration expand-contract (zero-downtime)", "patterns lecture/écriture (read replica, vue matérialisée, cache)", "architecture de recherche (ILIKE / FTS / moteur dédié / vector)", "decision framework de stockage", "store owner par bounded context"]
outcomes:
  - "sait décider entre relationnel et NoSQL pour un besoin donné, et justifier PostgreSQL par défaut"
  - "sait nommer les 5 familles NoSQL et leur cas d'usage, et décider si un second store se justifie (polyglot)"
  - "sait arbitrer normalisation vs dénormalisation à partir d'un ratio lecture/écriture et d'un bottleneck mesuré"
  - "sait planifier une migration de schéma non-cassante en expand-contract sur plusieurs déploiements"
  - "sait choisir un niveau d'architecture de recherche (ILIKE, FTS, moteur dédié, vector) adapté à la volumétrie et à l'UX"
  - "sait tracer une carte de stockage (quel store possède quelle donnée) et en évaluer le coût opérationnel"
prerequis: ["Module 00 — posture d'architecte", "Module 01 — SOLID", "Module 05 — architecture en couches", "Module 06 — hexagonale (ports & adapters)", "Module 09 — DDD stratégique (bounded contexts)", "Module 10 — DDD tactique (agrégats, invariants)", "Module 11 — API design & backend patterns", "Module 12 — jobs, concurrence, async"]
next: 14-architecture-frontend
libs: []
tribuzen: "backend NestJS + Prisma/PostgreSQL de TribuZen — carte de stockage à 3 niveaux (device chiffré / serveur pseudonymisé / agrégats) et décision assumée de rester mono-store côté serveur"
last-reviewed: 2026-07
---

# Architecture des données (choix du modèle de stockage)

> **Outcomes — tu sauras FAIRE :** décider relationnel vs NoSQL, nommer les 5 familles NoSQL et juger si un second store se justifie, arbitrer normalisation vs dénormalisation, planifier une migration expand-contract non-cassante, choisir un niveau d'architecture de recherche, et tracer une carte de stockage avec son coût opérationnel.
> **Difficulté :** :star::star::star:
>
> **Portée :** ce module traite les **décisions d'architecture de données** — *quel modèle de stockage* pour *quel besoin*, et *comment on le fait évoluer*. On raisonne archi, on n'implémente pas. Le **SQL, le schéma PostgreSQL détaillé, l'indexation, les plans de requête** relèvent du **cours 10 (bases de données)** — on y **défère** le deep, on ne le duplique pas. La **séparation physique des modèles lecture/écriture en CQRS + event sourcing** est le **module 18** — ici on ne voit que la *forme atténuée* (read replica, vue matérialisée, cache). Le détail NestJS/Prisma est le **cours 09**, le cache HTTP le **cours 11**.

## 1. Cas concret d'abord

Tu démarres l'architecture de TribuZen. Un contributeur enthousiaste t'envoie ce message :

> « J'ai lu un article génial. On met **MongoDB** pour les routines (schéma flexible), **Redis** pour le cache, **Elasticsearch** pour la recherche de routines, **Neo4j** pour le graphe des relations familiales, et **PostgreSQL** pour la facturation Stripe. Comme ça chaque donnée est dans le store parfait. C'est du *polyglot persistence*, c'est ce que font les grosses boîtes. »

Cinq bases de données pour une app maintenue par **une personne**, dont le principe directeur écrit noir sur blanc est « ne doit jamais devenir une charge mentale ». Avant de répondre, pose-toi les vraies questions d'architecte :

1. **Qui va monitorer, sauvegarder, patcher et restaurer 5 bases ?** Chaque store ajouté, c'est un backup à tester, une montée de version à suivre, une faille à surveiller, une expertise à maintenir. Le coût n'est pas dans le code — il est dans les **opérations**.
2. **PostgreSQL ne couvre-t-il pas déjà 4 de ces 5 besoins ?** JSON flexible (`jsonb`), recherche plein-texte (FTS natif), relations familiales (une table de jointure), facturation (transactions ACID). Redis est le seul besoin *peut-être* distinct.
3. **Le vrai découpage de TribuZen n'est-il pas ailleurs ?** La contrainte structurante n'est pas la performance — c'est la **confidentialité**. Les prénoms d'enfants et diagnostics santé ne doivent **jamais** toucher le serveur. Ça, aucun choix de moteur ne le règle : c'est une décision de *où* vit la donnée (device vs serveur), pas de *quel* moteur.

Ce module te donne la grille pour répondre : quand un second store se justifie, quand PostgreSQL suffit, comment modéliser, comment faire évoluer un schéma sans casser la prod, et comment tracer une **carte de stockage** défendable. La bonne réponse au contributeur n'est pas « oui, c'est moderne » ni « non, c'est trop » — c'est « voici notre grille de décision, applique-la ».

---

## 2. Théorie complète, concise

### 2.1 Le choix par défaut : relationnel

Une base **relationnelle** (PostgreSQL, MySQL) organise les données en tables reliées par des clés, avec un **schéma explicite**, des **transactions ACID** (atomicité, cohérence, isolation, durabilité) et des **JOIN** pour recomposer l'information éclatée. C'est le choix par défaut pour la quasi-totalité des applications métier, parce qu'il garantit l'intégrité (une commande ne peut pas référencer un utilisateur inexistant) et gère les relations complexes nativement.

**Règle directrice :** PostgreSQL est la bonne réponse *par défaut*. On introduit un autre store seulement quand un besoin **précis** le justifie ET que PostgreSQL ne le couvre pas bien. « Au cas où » n'est pas un besoin.

> Le *comment* du relationnel — types de colonnes, clés, contraintes, index, plans de requête — est le **cours 10**. Ici on décide *quand* choisir le relationnel, pas *comment* écrire le DDL.

### 2.2 Les 5 familles NoSQL

« NoSQL » n'est pas une techno mais un **parapluie** couvrant cinq familles aux propriétés très différentes. Les confondre est l'erreur n°1.

| Famille | Modèle | Force | Faiblesse | Cas d'usage typique |
|---|---|---|---|---|
| **Key-Value** (Redis, DynamoDB) | `clé → valeur` (blob) | latence < 1 ms, scaling trivial, TTL | aucune requête sur le contenu | cache, sessions, files d'attente |
| **Document** (MongoDB, Firestore) | `clé → document JSON` | schéma flexible, une requête ramène tout | pas de JOIN, dénormalisation à maintenir | CMS, catalogue, config variable |
| **Column-Family** (Cassandra) | `row key → colonnes` | écriture massive, distribution horizontale | requêtes limitées, pas d'agrégats riches | logs, IoT, séries à très haut débit |
| **Graph** (Neo4j) | `nœuds + arêtes` | traversées de relations performantes | scaling horizontal difficile | réseau social, recommandation, fraude |
| **Time-Series** (TimescaleDB, InfluxDB) | `timestamp → mesures` | agrégation temporelle ultra-rapide | pas de transactions complexes | monitoring, métriques, télémétrie |

Point crucial : **PostgreSQL empiète sur plusieurs de ces familles.** Le type `jsonb` donne 80 % du document. L'extension TimescaleDB donne le time-series. Le FTS donne une partie de la recherche. Avant d'ajouter une base document ou time-series, vérifie si l'extension Postgres correspondante ne suffit pas.

### 2.3 Quand NE PAS prendre du NoSQL

| Situation | Reste en relationnel parce que… |
|---|---|
| Relations complexes, JOIN fréquents | le SQL est fait pour ça ; recomposer à la main côté app est coûteux et bugué |
| Transactions ACID multi-tables | PostgreSQL garantit l'atomicité ; beaucoup de bases document ne l'offrent que partiellement |
| Schéma stable et connu | la normalisation évite la duplication et les incohérences |
| Petite équipe (< 5 devs) ou solo | chaque store en plus = surcharge ops disproportionnée |
| Volumétrie < ~10 M lignes | PostgreSQL absorbe ça sans effort |

### 2.4 Polyglot persistence — et son coût réel

Le **polyglot persistence** consiste à utiliser, dans un même système, **plusieurs types de stores**, chacun aligné sur le besoin d'un sous-domaine : PostgreSQL pour le métier transactionnel, Redis pour le cache/sessions, un moteur dédié pour la recherche, un object storage (S3) pour les fichiers.

C'est une bonne pratique **à l'échelle**. Mais chaque store ajouté a un **coût opérationnel** qui ne se voit pas dans le code :

- monitoring et alerting dédiés ;
- stratégie de **backup ET de restauration testée** (un backup jamais restauré n'est pas un backup) ;
- montées de version, patchs de sécurité ;
- expertise de l'équipe (savoir diagnostiquer un lag de réplication, un OOM Redis, un split-brain) ;
- cohérence inter-stores (la même donnée dans deux stores = deux sources de vérité à réconcilier).

> **Heuristique :** une équipe de 4 ne devrait pas gérer 5 bases. Le nombre de stores doit être justifié par des besoins que **le store par défaut ne couvre pas**, pas par l'envie d'utiliser un outil. Rester **mono-store** est une décision d'architecture légitime, souvent la meilleure pour un petit produit.

### 2.5 Modélisation : normaliser d'abord, dénormaliser sur preuve

**Normaliser**, c'est éclater la donnée pour qu'un fait ne soit stocké **qu'une fois** (la 3ᵉ forme normale, 3NF, comme règle pratique). Avantage : pas de duplication, pas d'incohérence. Coût : il faut des JOIN pour recomposer.

**Dénormaliser**, c'est **dupliquer volontairement** un fait (copier le nom de la catégorie dans chaque produit) pour éviter un JOIN à la lecture. Avantage : lecture directe, rapide. Coût : à chaque changement, il faut mettre à jour **tous** les exemplaires, sous peine d'incohérence.

| Critère | Normalisé | Dénormalisé |
|---|---|---|
| Écriture | 1 seul endroit à jour | N endroits à synchroniser |
| Lecture | JOIN à chaque fois | déjà assemblé |
| Cohérence | garantie par le schéma | à maintenir à la main |
| Stockage | minimal | redondant |

**Règle :** normaliser par défaut. Dénormaliser **seulement** quand un JOIN est un bottleneck **mesuré** — pas supposé. Dans une base document, c'est l'inverse par nature : on **modélise orienté requêtes** (on stocke la donnée dans la forme où on la lira), et la dénormalisation est le mode normal — d'où le coût de mise à jour multiple qu'elle implique.

### 2.6 Migrations et versioning de schéma

Un schéma vit et change. Une **migration** est un script **versionné et ordonné** (`001`, `002`, …) qui modifie le schéma, appliqué **exactement une fois** (une table de suivi trace ce qui est déjà passé). C'est le pendant « base de données » du versioning de code : linéaire, traçable, reproductible d'un environnement à l'autre.

La difficulté n'est pas d'écrire l'`ALTER TABLE` — c'est de le faire **sans casser la prod** pendant qu'un déploiement progressif fait coexister l'ancienne et la nouvelle version du code.

**Expand-contract** (aussi dit *parallel change*) est LE pattern à connaître pour un changement incompatible, comme renommer une colonne `name` → `title`, en **trois déploiements** :

```
1. EXPAND   — ajoute `title`, recopie les données, garde `name`.
              L'ancien code lit encore `name` : rien ne casse.
2. MIGRATE  — déploie le code qui lit/écrit `title`.
              Les deux colonnes coexistent le temps du rolling update.
3. CONTRACT — plus personne ne lit `name` : on le supprime.
```

**Règle d'or :** chaque migration doit être compatible avec la version **N** *et* **N-1** du code. Corollaires pratiques : une colonne `NOT NULL` s'ajoute avec un `DEFAULT` (sinon les anciennes lignes cassent) ; un index se crée en `CONCURRENTLY` sous PostgreSQL pour ne pas bloquer les écritures ; on arrête de **lire** une colonne avant de la supprimer.

> Le détail SQL de ces migrations (syntaxe `ALTER`, triggers de synchronisation, `CREATE INDEX CONCURRENTLY`) est le **cours 10**. Ici on décide de la **stratégie** : combien d'étapes, quel ordre de déploiement, quelle compatibilité descendante.

### 2.7 Patterns lecture/écriture

Dans la majorité des apps, les **lectures écrasent les écritures** (souvent 90/10). Trois leviers, du moins au plus intrusif, pour scaler la lecture sans toucher au modèle d'écriture :

- **Read replica** : une copie en lecture seule du master, alimentée par réplication **asynchrone**. Les `SELECT` vont sur les replicas, les écritures sur le master. Piège majeur : le **replication lag** (~ms à ~s). Ne **jamais** lire sur un replica juste après avoir écrit sur le master — sinon l'utilisateur ne voit pas son propre changement (*read-your-own-writes problem*) ; pour ce cas, lire sur le master.
- **Vue matérialisée** : le résultat d'une requête d'agrégat (stats, tableaux de bord) **stocké physiquement** et rafraîchi périodiquement. Lecture instantanée, au prix d'une fraîcheur = dernier rafraîchissement.
- **Cache** (Redis, ou cache applicatif) : garder les données chaudes hors de la base. Pattern courant *cache-aside* : lire le cache, sinon lire la base et peupler le cache ; invalider le cache à l'écriture. Le TTL et la stratégie d'invalidation sont les vraies décisions.

Ces trois patterns **séparent des chemins** de lecture et d'écriture, mais gardent **un seul modèle de données**. Pousser la séparation jusqu'à **deux modèles distincts** (un modèle d'écriture normalisé, un modèle de lecture dénormalisé alimenté par événements) = **CQRS**, traité au **module 18**. Ne confonds pas « lire sur un replica » (ici) et « CQRS complet » (module 18).

### 2.8 Architecture de recherche

Chercher « chaussure » avec un `WHERE name LIKE '%chaussure%'` ne scale pas et ne classe rien. La recherche est un **choix d'architecture graduel** selon la volumétrie et l'UX visée :

| Niveau | Techno | Apporte | Coût | Quand |
|---|---|---|---|---|
| Basique | `ILIKE '%q%'` | rien (pas de ranking) | zéro | prototype, < 10 K lignes |
| Intermédiaire | **PostgreSQL FTS** (`tsvector` + index GIN) | stemming, ranking par pertinence | natif, zéro infra en plus | 10 K–500 K lignes, petite équipe |
| Avancé | **moteur dédié** (Elasticsearch, Meilisearch, Typesense) | fuzzy (tolérance aux fautes), facettes, autocomplétion | cluster/service à opérer + synchronisation | > 500 K lignes, UX riche |
| Sémantique | **vector search** (embeddings + ANN) | comprend le *sens*, pas les mots | embeddings à calculer/stocker | recherche « intelligente », RAG |

Deux points d'architecture décisifs : (1) **PostgreSQL FTS suffit pour l'immense majorité des produits** — passer à un moteur dédié se **mérite** par un besoin réel (fuzzy, facettes, très gros volume), car il introduit un second store à synchroniser (donc à réconcilier, donc du lag). (2) Quel que soit le niveau, cache la techno derrière un **port `SearchProvider`** (interface, cf. hexagonale module 06) : tu commences en FTS et tu migres vers un moteur dédié **sans toucher au code métier**. La migration devient un changement d'adaptateur, pas une réécriture.

### 2.9 La synthèse : un arbre de décision

```
Ai-je besoin de…
  relations complexes / transactions ACID ?      → PostgreSQL (défaut)
  accès par clé, latence < 1 ms, TTL ?            → Key-Value (Redis)
  recherche plein-texte / facettes ?             → PG FTS d'abord, moteur dédié si besoin réel
  écriture massive (> 100 K/s) ?                  → Column-Family (Cassandra)
  la RELATION est la donnée principale ?          → Graph (Neo4j)
  métriques temporelles ?                        → Time-Series (TimescaleDB) ou extension PG
  documents JSON très variables ?                → jsonb PostgreSQL d'abord, Document si vraiment justifié
  sinon                                           → PostgreSQL
```

Chaque « oui » qui sort de PostgreSQL doit être **payé** par un besoin qui justifie le coût opérationnel du store supplémentaire.

---

## 3. Worked examples

### Exemple 1 — Trancher la proposition « 5 bases » du §1

On applique la grille au message du contributeur, besoin par besoin.

| Besoin proposé | Store proposé | Verdict | Raison |
|---|---|---|---|
| Routines (CRUD, récurrence, assignation) | MongoDB | **PostgreSQL** | vraies relations (routine ↔ famille ↔ co-référent), invariants métier, ACID. Le « schéma flexible » ne sert à rien : le schéma des routines est stable et connu. |
| Cache de lecture / sessions | Redis | **à évaluer, pas V1** | besoin réel *à terme*, mais tant que la charge est faible, un cache applicatif ou rien suffit. Ajouter Redis = un store à opérer. |
| Recherche de routines | Elasticsearch | **PostgreSQL FTS** | volumétrie minuscule (routines d'une famille). ILIKE ou FTS largement suffisant. Un cluster ES ici est absurde. |
| Graphe des relations familiales | Neo4j | **PostgreSQL** | une famille a ≤ 8 co-référents. Ce n'est pas un « graphe » à traverser en profondeur : une table de jointure `family_members` suffit. |
| Facturation Stripe | PostgreSQL | **PostgreSQL** ✅ | le seul choix correct de la liste. |

**Décision d'architecture :** **mono-store PostgreSQL** côté serveur pour la V1. Réévaluer Redis quand une charge mesurée le justifie, et masquer la recherche derrière un port `SearchProvider` pour garder la porte ouverte. Le polyglot n'est pas rejeté par principe — il est rejeté parce qu'**aucun besoin actuel ne paie son coût opérationnel**, et que le produit doit rester low-effort.

> Le vrai découpage de TribuZen est ailleurs (confidentialité device vs serveur) — voir §5.

### Exemple 2 — Planifier une migration expand-contract

TribuZen a une colonne `routines.label` (titre de la routine). On veut la renommer `title` pour homogénéiser le schéma, **sans downtime**, alors que l'API mobile ancienne (déjà installée sur des téléphones) lit encore `label`.

**Erreur à ne pas faire :** un seul déploiement avec `ALTER TABLE routines RENAME label TO title`. Résultat : dès la migration passée, tout code encore en train de lire `label` (anciens conteneurs pendant le rolling update, requêtes en vol) casse. Downtime garanti.

**Plan correct, en 3 déploiements :**

```
Déploiement 1 — EXPAND
  - ajoute la colonne `title`
  - recopie : title := label pour l'existant
  - garde les deux synchronisées le temps de la transition
  → le code (v N-1) lit toujours `label` : zéro casse

Déploiement 2 — MIGRATE
  - le nouveau code (v N) lit et écrit `title`
  - `label` et `title` coexistent ; l'ancien et le nouveau code tournent ensemble
  → rolling update sûr

Déploiement 3 — CONTRACT
  - on a la certitude que plus aucun code (ni backend, ni app installée) ne lit `label`
  - suppression de `label`
  → schéma final propre
```

**Le point d'architecture, pas de SQL :** l'étape 3 dépend d'une contrainte **hors base** — les apps mobiles installées. Tant qu'un téléphone en circulation lit `label`, on ne peut pas contracter. La décision « quand supprimer `label` » est pilotée par le **taux d'adoption de la nouvelle version mobile**, pas par la base. C'est ça, penser data au niveau architecture : la migration n'est pas un `ALTER`, c'est une **coordination entre le schéma, les déploiements et les clients**.

> La syntaxe exacte (`ALTER`, trigger de synchro, Prisma Migrate) est le **cours 10**. Ici on a décidé du **nombre d'étapes, de l'ordre, et du signal de bascule**.

---

## 4. Pièges & misconceptions

### PIÈGE #1 — « NoSQL = moderne = mieux »

Faux. « NoSQL » n'est pas un niveau supérieur ; c'est un ensemble de compromis **différents**, pas meilleurs. On y **perd** les JOIN, souvent l'ACID multi-documents, et l'intégrité référentielle garantie. On ne choisit une famille NoSQL que pour une **propriété précise** qu'elle offre et que le relationnel n'offre pas bien (latence sub-ms, écriture massive distribuée, traversée de graphe). Le critère est le besoin, jamais la modernité.

### PIÈGE #2 — Confondre les 5 familles NoSQL

« On passe en NoSQL » ne veut rien dire. Redis (key-value) et Neo4j (graph) n'ont **rien** en commun à part l'étiquette. Choisir « du NoSQL » sans dire **quelle famille** et **pour quelle propriété**, c'est ne pas avoir décidé. Nomme la famille, nomme la propriété recherchée, sinon la décision est vide.

### PIÈGE #3 — Croire que polyglot = maturité

Empiler des stores n'est pas un signe de sophistication ; c'est souvent une dette opérationnelle déguisée. Chaque base est un système à monitorer, sauvegarder, restaurer, patcher, et à réconcilier avec les autres. La vraie maturité, c'est de **résister** à l'ajout d'un store tant que le besoin ne paie pas son coût. Mono-store bien tenu > polyglot subi. « Boring technology » est une stratégie, pas un aveu de faiblesse.

### PIÈGE #4 — Dénormaliser « pour la performance » sans mesure

Dupliquer une donnée pour éviter un JOIN *supposé* lent est une des sources d'incohérence les plus courantes : un jour un des exemplaires n'est pas mis à jour, et deux vérités s'affrontent. On normalise par défaut ; on ne dénormalise **qu'après avoir mesuré** qu'un JOIN précis est le bottleneck, et en sachant qu'on s'engage à maintenir la synchronisation. Optimisation sans mesure = pessimisation avec bugs.

### PIÈGE #5 — Migration « big bang » qui casse le déploiement progressif

Renommer/supprimer une colonne en un seul déploiement suppose que **tout** le code bascule au même instant. En rolling update (et *a fortiori* avec des apps mobiles déjà installées), l'ancienne et la nouvelle version coexistent. Toute migration incompatible doit être **expand-contract** : compatible N **et** N-1. Oublier ça, c'est du downtime ou de la perte de données.

### PIÈGE #6 — Sortir Elasticsearch au premier besoin de recherche

Un moteur de recherche dédié est puissant *et* coûteux : c'est un second store, à alimenter et à **synchroniser** avec la base de vérité (donc du lag, des désynchronisations à gérer). PostgreSQL FTS (`tsvector` + GIN) couvre la grande majorité des cas jusqu'à des centaines de milliers de lignes, sans infra supplémentaire. On commence en FTS derrière un port `SearchProvider`, et on ne migre que quand un besoin réel (fuzzy, facettes, volume) le justifie.

### PIÈGE #7 — Confondre « read replica » et « CQRS »

Lire sur un replica en lecture seule, ce n'est **pas** faire du CQRS. Un replica est une **copie** du même modèle. Le CQRS, c'est **deux modèles distincts** (écriture normalisée, lecture dénormalisée) potentiellement dans des stores différents, alimentés par événements. Le premier est une optimisation d'infra transparente ; le second est une décision d'architecture lourde (module 18). Les mélanger fait sur-vendre une simple réplication.

---

## 5. Ancrage TribuZen

Pour TribuZen, la décision structurante **n'est pas** la performance — c'est la **confidentialité**. Le produit stocke des données ultra-sensibles (prénoms d'enfants, dates de naissance, diagnostics TSA/TDAH, photos) qui ne doivent **jamais** atteindre le serveur. La carte de stockage se dessine d'abord selon *qui a le droit de voir quoi*, pas selon *quel moteur est le plus rapide*.

**Carte de stockage à 3 niveaux (décision d'architecture centrale) :**

| Niveau | Donnée | Store | Pourquoi ce store |
|---|---|---|---|
| **1 — device uniquement, chiffré** | prénoms exacts, dates de naissance, diagnostics santé, photos | stockage **local du téléphone**, chiffré (clé maître dans le trousseau sécurisé, données chiffrées sur le système de fichiers) | RGPD Art. 9 : ces données ne quittent **jamais** l'appareil. Aucun serveur ne les voit. |
| **2 — serveur pseudonymisé** | UUID, tranche d'âge, tags de besoins **génériques** (`routine_intensive`, `sensory_support`), booléens de complétion de routines | **PostgreSQL** (via Prisma) | métier relationnel, transactions, invariants (max 8 co-référents, unicité). Aucun terme médical, aucun prénom. |
| **3 — agrégats anonymes** | métriques d'usage, statistiques | outil d'analytics dédié | agrégats non ré-identifiables, découplés du métier. |

**Décisions d'architecture de données pour TribuZen :**

- **Mono-store côté serveur : PostgreSQL, point.** Pas de MongoDB, pas de Neo4j, pas d'Elasticsearch en V1. Le produit est maintenu par une personne et « ne doit jamais devenir une charge mentale » : chaque store en plus violerait ce principe. C'est un **polyglot refusé sciemment**, décision documentée, pas un oubli.
- **Le « polyglot » réel de TribuZen est l'axe device ↔ serveur**, pas un zoo de moteurs serveur. Sur l'appareil, un store clé-valeur local rapide sert le cache et la file d'écritures offline (mode hors-ligne : les complétions faites sans réseau sont mises en file, puis synchronisées au retour). Ça, c'est du polyglot *justifié* — imposé par la contrainte offline mobile — et non un choix de confort.
- **Modélisation orientée invariants, pas orientée moteur.** Les règles (routine archivée non complétable, capacité famille) vivent dans le domaine (module 10) ; PostgreSQL est un **détail d'infrastructure** derrière un repository (modules 05-06). Changer le niveau 1 de stockage local n'impacte pas le domaine.
- **Migrations expand-contract obligatoires** : des apps mobiles installées lisent le schéma d'API pendant des mois. Toute évolution de schéma serveur doit rester compatible N/N-1, avec la bascule pilotée par l'adoption de la nouvelle version mobile (cf. §3, Exemple 2).
- **Recherche : FTS PostgreSQL derrière un port**, si tant est qu'on en ait besoin (chercher une routine dans une liste courte ne le justifie même pas). Aucun moteur dédié en vue.

> **Défère :** le schéma Prisma détaillé, les types de colonnes, les index, l'écriture concrète des migrations = **cours 10**. La séparation lecture/écriture poussée en CQRS = **module 18**. Le chiffrement device (dérivation de clé, crypto) = module de sécurité **20** / cours **14**. Ici on décide **quel store possède quelle donnée**, et **pourquoi** — la carte de stockage, pas le DDL.

---

## 6. Points clés

1. **PostgreSQL par défaut.** On n'ajoute un store que pour un besoin précis que le relationnel ne couvre pas bien — jamais « au cas où ».
2. **« NoSQL » = 5 familles distinctes** (key-value, document, column-family, graph, time-series). Nommer la famille ET la propriété recherchée, sinon la décision est vide.
3. **Le polyglot a un coût opérationnel** (monitoring, backup/restore, patch, expertise, cohérence inter-stores). Rester mono-store est une décision légitime, souvent la meilleure pour un petit produit.
4. **Normaliser par défaut, dénormaliser sur bottleneck mesuré** — jamais supposé. En base document, on modélise orienté requêtes (dénormalisation assumée + coût de mise à jour multiple).
5. **Migration = coordination, pas `ALTER`.** Expand-contract (expand / migrate / contract) garantit la compatibilité N et N-1 ; la bascule dépend souvent des clients (apps installées), pas de la base.
6. **Patterns lecture/écriture** (read replica + lag, vue matérialisée, cache-aside) séparent les *chemins* mais gardent **un** modèle. Deux modèles = CQRS (module 18).
7. **Recherche graduée** : ILIKE → PostgreSQL FTS → moteur dédié → vector. Commencer en FTS derrière un port `SearchProvider` ; migrer seulement si un besoin réel le paie.
8. **Carte de stockage = décision d'archi.** Tracer quel store possède quelle donnée, et évaluer son coût. Pour TribuZen, l'axe structurant est la confidentialité (device chiffré vs serveur pseudonymisé), pas la performance.

---

## 7. Seeds Anki

```
Quel est le store par défaut d'une application métier, et quand en ajouter un autre ?|PostgreSQL (relationnel) par défaut. On ajoute un autre store seulement pour un besoin précis que le relationnel ne couvre pas bien, jamais « au cas où » — chaque store a un coût opérationnel.
Cite les 5 familles NoSQL et une propriété clé de chacune.|Key-Value (latence <1ms), Document (schéma flexible), Column-Family (écriture massive distribuée), Graph (traversée de relations), Time-Series (agrégation temporelle). « NoSQL » sans nommer la famille ne veut rien dire.
Qu'est-ce que le polyglot persistence et quel est son vrai coût ?|Utiliser plusieurs types de stores, chacun aligné sur un besoin. Le coût réel n'est pas dans le code mais dans les opérations : monitoring, backup/restore testé, patchs, expertise, cohérence inter-stores. Une équipe de 4 ne devrait pas gérer 5 bases.
Normalisation vs dénormalisation : quelle est la règle de décision ?|Normaliser par défaut (un fait stocké une fois, cohérence garantie). Dénormaliser seulement quand un JOIN précis est un bottleneck MESURÉ, en acceptant de maintenir la synchronisation des copies. Jamais sur une performance supposée.
En quoi consiste une migration expand-contract et pourquoi ?|Trois déploiements : EXPAND (ajoute la nouvelle colonne, garde l'ancienne), MIGRATE (le code bascule, les deux coexistent), CONTRACT (supprime l'ancienne). But : rester compatible avec le code N et N-1 pendant un rolling update, donc zéro downtime.
Read replica vs CQRS : quelle différence ?|Un read replica est une COPIE du même modèle (optimisation d'infra transparente, attention au replication lag). Le CQRS, ce sont DEUX modèles distincts (écriture normalisée, lecture dénormalisée) alimentés par événements — une décision d'architecture lourde (module 18).
Quels sont les niveaux d'architecture de recherche, et lequel choisir d'abord ?|ILIKE (proto) → PostgreSQL FTS (tsvector+GIN, jusqu'à ~500K lignes) → moteur dédié (fuzzy, facettes) → vector search (sens). Commencer en FTS derrière un port SearchProvider ; migrer seulement si un besoin réel (fuzzy/facettes/volume) le justifie.
Pour TribuZen, quel est l'axe structurant de la carte de stockage ?|La confidentialité, pas la performance. 3 niveaux : device chiffré (prénoms, diagnostics, photos — jamais sur le serveur), serveur pseudonymisé (PostgreSQL, UUID + tags génériques), agrégats anonymes (analytics). Côté serveur : mono-store PostgreSQL assumé.
```

---

## Pont vers le lab

> Lab associé : `labs/lab-13-architecture-donnees/README.md`. À partir d'un besoin TribuZen, tu traces la **carte de stockage** (quel store possède quelle donnée), tu décides polyglot ou mono-store en justifiant par le coût opérationnel, et tu planifies une **migration expand-contract**. Exercice de conception/décision, évalué par grille + coach — zéro harnais.
