---
titre: Performance & scalabilité (au niveau architecture)
cours: 13-architecture
notions: ["mesurer avant d'optimiser", "latence vs débit (throughput)", "p50 / p95 / p99", "identifier le goulot d'étranglement", "caching multi-niveaux (stratégie)", "TTL et invalidation de cache", "tolérance à la donnée périmée (staleness)", "scaling vertical vs horizontal", "stateless comme condition du scale-out", "load balancing (round-robin / least-connections)", "réplication primary-replica (read replicas)", "sharding / partitionnement horizontal", "shard key", "ordre de décision par coût"]
outcomes:
  - "sait localiser le goulot d'un système avant de proposer une optimisation (mesurer, pas deviner)"
  - "sait distinguer latence et débit, et raisonner en p95/p99 plutôt qu'en moyenne"
  - "sait concevoir une stratégie de cache multi-niveaux (quel niveau, quel TTL, quelle invalidation, quelle staleness acceptée)"
  - "sait décider entre scaling vertical et horizontal, et énoncer la condition stateless du scale-out"
  - "sait choisir l'ordre des leviers de scaling par coût croissant (cache -> read replicas -> scale-out -> sharding)"
  - "sait dire quand NE PAS sharder et pourquoi le sharding est un dernier recours"
prerequis: ["Modules 00-04 — posture, SOLID, patterns, clean code, DI", "Module 05 — architecture en couches", "Module 08 — monolithe modulaire vs microservices", "Module 12 — jobs, concurrence, async", "Module 13 — architecture données", "Module 16 — communication et intégration", "Module 19 — résilience, consistency, migration"]
next: 22-observabilite-et-testing-archi
libs: []
tribuzen: "backend NestJS + PostgreSQL + Redis de TribuZen — stratégie de scaling du dashboard familial (lecture-intensive) quand le nombre de familles grandit"
last-reviewed: 2026-07
---

# Performance & scalabilité (au niveau architecture)

> **Outcomes — tu sauras FAIRE :** localiser le goulot d'un système avant d'optimiser, raisonner en latence/débit et en p95/p99, concevoir une stratégie de cache multi-niveaux, décider entre scaling vertical et horizontal, ordonner les leviers de scaling par coût, et dire quand ne PAS sharder.
> **Difficulté :** :star::star::star:
>
> **Portée :** ce module traite la performance et la scalabilité comme des **décisions d'architecture** — où est le goulot, quel levier actionner, dans quel ordre. On ne descend PAS dans l'implémentation. Le **HTTP caching** (en-têtes `Cache-Control`, `ETag`, revalidation) et le **CDN / edge** relèvent du **cours 11** ; le **scaling cloud concret** (autoscaling AWS/K8s, HPA, capacity planning outillé) relève du **cours 12** ; le **détail SQL** (index, `EXPLAIN`, requêtes) du **cours 10**. Ici on raisonne stratégie, pas config.

## 1. Cas concret d'abord

TribuZen a grandi : 5 000 familles actives. Le dashboard familial (la page qui affiche les routines du jour + la série de chaque enfant) est devenu lent : **p95 à 850 ms**, les parents râlent le matin au moment du pic.

Un contributeur arrive avec une solution toute prête :

> « C'est un problème de charge. On passe le serveur NestJS de 2 à 6 instances, et on shard PostgreSQL par famille. »

Avant de dépenser trois semaines et de tripler la facture, on **mesure**. Une trace APM sur une requête de dashboard donne ceci :

```
GET /families/:id/dashboard            total 840 ms
├─ auth + parsing HTTP ..................  8 ms
├─ SELECT routines WHERE familyId .......  12 ms
├─ calcul des séries (streak) .......... 790 ms   ← ICI
│   └─ pour CHAQUE enfant :
│        SELECT count(*) FROM completions WHERE ...   (N requêtes)
└─ sérialisation JSON ...................  30 ms
```

Le goulot n'est **ni le CPU du serveur, ni la base globale**. C'est **une** requête : le calcul de série fait un **N+1** (une requête par enfant), et chaque compte scanne toute la table `completions`. Ajouter des serveurs NestJS n'y changerait **rien** — le CPU applicatif n'est pas saturé, c'est la base qui rame sur une requête mal formée. Sharder n'aiderait pas non plus : la requête resterait aussi lente sur chaque shard.

Le vrai correctif est bien moins cher : **précalculer la série** (ou la mettre en cache) et corriger le N+1. Coût : une demi-journée, zéro serveur en plus.

Leçon centrale de ce module, à graver : **on mesure avant d'optimiser, et le goulot est presque jamais là où l'intuition le place.** Tout le reste (cache, load balancing, scaling, sharding) n'a de sens qu'**après** avoir localisé le goulot.

---

## 2. Théorie complète, concise

### 2.1 Mesurer avant d'optimiser — la règle n°1

Optimiser sans mesurer, c'est soigner au hasard. Deux raisons :

1. **Le goulot est rarement où on croit.** L'intuition sur-estime le code « qu'on a écrit » et sous-estime l'I/O, la base, le réseau, la sérialisation.
2. **Optimiser hors du goulot ne sert à rien.** Loi d'Amdahl, en version de poche : accélérer de 2× une partie qui pèse 5 % du temps total gagne 2,5 %. Accélérer la partie qui pèse 90 % change tout. Tant que tu n'as pas mesuré, tu ne sais pas laquelle est laquelle.

Les instruments (le détail outillé est au **cours 12 / module 22 observabilité**) :

- **Profiling / tracing** : décomposer une requête en spans (comme au §1) pour voir où part le temps.
- **Métriques agrégées** : latence, débit, taux d'erreur, saturation des ressources.

### 2.2 Latence vs débit, et pourquoi p95/p99 plutôt que la moyenne

Deux grandeurs distinctes, souvent confondues :

- **Latence** : temps pour traiter **une** requête (ex. 120 ms). C'est l'expérience d'**un** utilisateur.
- **Débit (throughput)** : nombre de requêtes traitées **par seconde** (ex. 2 000 req/s). C'est la **capacité** du système.

Ce sont des axes indépendants : un système peut avoir une faible latence et un faible débit (rapide mais peu de front), ou l'inverse. « Scalabilité » = tenir le **débit** quand la charge monte, en gardant la **latence** acceptable.

Et surtout : **ne raisonne jamais en moyenne.** La moyenne cache les cas lents. On raisonne en **percentiles** :

| Métrique | Sens |
|----------|------|
| p50 (médiane) | la requête « typique » |
| p95 | 5 % des requêtes sont plus lentes que ça |
| p99 | 1 % — souvent l'utilisateur furieux, le timeout, le retry en cascade |

Une moyenne de 100 ms peut cacher un p99 à 3 s. Optimiser le p50 quand le problème est au p99 ne calme personne. **La queue de distribution est l'ennemi.**

### 2.3 Où est le goulot ? La carte des suspects

Une requête traverse une chaîne. Le goulot est **un maillon**, et un seul le plus souvent :

```
Client ─▶ Réseau/DNS ─▶ Load balancer ─▶ App (CPU) ─▶ Base / cache ─▶ Service externe
         (latence           (répartit)     (calcul,     (I/O, requêtes    (API tierce,
          géo, TLS)                          GC)          lentes, verrous)  quota, lenteur)
```

Le réflexe d'architecte : pour un symptôme de lenteur, **localiser le maillon saturé** avant de choisir un levier. Chaque maillon a son levier :

| Goulot mesuré | Mauvais réflexe | Bon levier |
|---------------|-----------------|------------|
| Une requête lente / N+1 | « plus de serveurs » | corriger la requête, précalculer, cacher |
| CPU applicatif saturé | « sharder la base » | scale-out (plus d'instances) + stateless |
| Base saturée en **lecture** | « scale-out l'app » | cache + **read replicas** |
| Base saturée en **écriture** | read replicas | file d'attente / batch, puis sharding en dernier |
| Latence géographique | cache serveur | CDN / edge (**cours 11**) |

### 2.4 Le caching comme stratégie (pas comme réflexe)

Le cache est le levier au **meilleur rapport gain/coût** — quand il est **choisi**, pas saupoudré. Mettre du cache partout crée un enfer d'invalidation et sert de la donnée périmée. Un cache est une **décision** avec quatre questions :

1. **Quoi cacher ?** Ce qui est **lu souvent** et **coûteux à recalculer** (la série d'un enfant), pas ce qui change à chaque requête.
2. **À quel niveau ?** Le cache est **multi-niveaux** — plus il est proche du client, plus il est rapide mais plus il est difficile à invalider :

   | Niveau | Exemple | Latence | Portée / invalidation |
   |--------|---------|---------|-----------------------|
   | Client | mémoire app mobile, `localStorage` | ~0 ms | 1 utilisateur, dur à purger |
   | CDN / edge | réponses publiques (**détail : cours 11**) | ~10 ms | global, purge par surrogate-key |
   | Applicatif in-memory | `Map`/LRU dans l'instance | < 1 ms | 1 instance seulement (incohérent en multi-instance !) |
   | Distribué | Redis / Memcached | ~1-5 ms | partagé entre toutes les instances |
   | Base | vue matérialisée, colonne précalculée | ~10 ms | source de vérité |

3. **Quel TTL ?** Le temps de vie encode la **fraîcheur acceptée**. TTL court = frais mais peu de hits ; TTL long = rapide mais risque de périmé.
4. **Quelle invalidation ?** Le point dur (« il n'y a que deux problèmes difficiles en informatique : l'invalidation de cache et nommer les choses »). Trois familles : **expiration** (TTL), **éviction** (LRU quand plein), **invalidation explicite** (à l'écriture, on purge la clé/le tag concerné).

Question transverse : **quelle staleness tolères-tu ?** La série affichée avec 30 s de retard : sans importance. Le solde d'un paiement : zéro tolérance. La tolérance à la donnée périmée **détermine** TTL et stratégie d'invalidation. C'est une décision **produit**, pas technique.

> **Attention au cache in-memory par instance.** Dès qu'il y a plusieurs instances derrière un load balancer, un cache local à chaque instance devient **incohérent** (l'instance A a purgé, l'instance B sert encore l'ancienne valeur). En multi-instance, le cache partagé (Redis) est la règle ; l'in-memory ne convient qu'à des données quasi-immuables (config, référentiels).

### 2.5 Scaling vertical vs horizontal

Quand la charge dépasse la capacité, deux directions :

- **Vertical (scale up)** : une machine plus grosse (plus de CPU/RAM). **Simple**, aucune coordination — mais **plafond physique**, **coût qui explose** en haut de gamme, et **point unique de défaillance** (SPOF : la machine tombe, tout tombe).
- **Horizontal (scale out)** : plus d'instances identiques derrière un load balancer. **Pas de plafond**, **résilience** (une instance tombe, les autres tiennent), **coût linéaire** — mais exige que les instances soient **stateless** et introduit de la coordination.

Règle : on commence souvent **vertical** (simple, rapide) jusqu'à ce que le coût ou le plafond fasse mal, puis on bascule **horizontal** pour la résilience et l'élasticité. Le scale-out est la voie des architectures modernes, **à condition** de respecter le stateless.

### 2.6 Stateless : la condition du scale-out

Une instance est **stateless** quand elle ne garde **aucun état en mémoire de processus** entre deux requêtes. Tout l'état vit dans des **services externes partagés** :

| État | Où il doit vivre (pas dans le process) |
|------|----------------------------------------|
| Session / auth | JWT (sans état) ou Redis |
| Cache | Redis partagé |
| Fichiers uploadés | stockage objet (S3…) |
| Jobs en cours | file (BullMQ / Redis) — voir **module 12** |

Pourquoi c'est **la** condition : si l'état est dans le process (une `Map` de sessions), une instance qui redémarre **perd tout**, et le load balancer ne peut pas router librement (il faut renvoyer chaque client vers « son » instance). Le corollaire — les **sticky sessions** (affinité de session) — est un **pansement** : ça marche, mais ça sacrifie la résilience et l'équilibrage. En archi moderne : instances **stateless**, état externalisé, load balancer libre de router n'importe où.

### 2.7 Load balancing : répartir la charge

Le load balancer distribue les requêtes entre les instances. Au niveau archi, trois décisions :

- **Algorithme** : **round-robin** (à tour de rôle — instances identiques, requêtes uniformes) ; **least-connections** (vers la moins chargée — requêtes de durées variables) ; **weighted** (poids selon la capacité). Le choix par défaut raisonnable : round-robin, puis least-connections si les durées sont hétérogènes.
- **Niveau** : **L4** (transport, TCP — rapide, ne lit pas le HTTP) vs **L7** (application, HTTP — peut router par URL/header/cookie, terminer le TLS). Le web moderne utilise surtout du **L7** pour router `/api/*`, `/ws/*`, etc.
- **Health checks** : le LB **sonde** chaque instance et **retire du pool** celle qui échoue. Distingue **liveness** (le process est vivant ?) et **readiness** (peut-il servir ? — base connectée, cache chaud). Couplé au **graceful shutdown** (à l'arrêt : ne plus accepter de nouvelles requêtes, finir les en cours, puis fermer), ça permet des déploiements sans coupure. Le détail K8s/cloud est au **cours 12**.

### 2.8 Scaler la donnée : réplication puis sharding

Quand la **base** est le goulot, deux leviers, dans cet ordre :

**1. Réplication primary-replica (répliques de lecture).** Une base **primaire** encaisse les **écritures** ; des **répliques** (copies) encaissent les **lectures**. Le primaire réplique son journal vers les répliques.

```
        écritures                lectures
  App ───────────▶ Primary ──▶ Replica 1  ◀─── App
                     │    (WAL)  Replica 2  ◀─── App
```

- Résout les charges **lecture-intensives** (le cas le plus courant — dashboards, listes).
- **Prix à payer : le replication lag.** Les répliques ont un léger retard (ms à s) → **cohérence à terme (eventual)** en lecture. Si tu écris puis relis immédiatement sur une réplique, tu peux lire l'**ancienne** valeur. À décider : quelles lectures tolèrent le lag, lesquelles doivent taper le primaire.

**2. Sharding (partitionnement horizontal).** Découper les données en **partitions (shards)** réparties sur plusieurs bases, chacune responsable d'un sous-ensemble.

- Résout la **taille** (données trop grosses pour un nœud) et les **écritures** (réparties sur plusieurs primaires).
- **Le choix critique : le shard key.** Bonne clé = **haute cardinalité**, **distribution uniforme** (pas de hotspot), et **présente dans presque toutes les requêtes**. Pour un produit multi-famille, `familyId` (ou `tenantId`) est souvent le meilleur choix : chaque famille tient sur son shard.
- **Le piège : le scatter-gather.** Une requête **sans** le shard key doit interroger **tous** les shards puis fusionner — lent et fragile. Le sharding oblige à penser toutes les requêtes autour de la clé.

**Quand NE PAS sharder :** presque toujours au début. Un PostgreSQL single-node tient très loin (ordre de grandeur : ~1 To, ~10 k req/s). Le sharding ajoute une **complexité énorme** (routing, requêtes cross-shard, rééquilibrage, migrations). **Épuise d'abord** : corriger les requêtes → cache → read replicas → partitionnement natif PG. Le sharding applicatif est un **dernier recours**, pas une architecture de départ.

### 2.9 L'ordre de décision par coût croissant

Le fil conducteur de tout le module : face à un problème de perf/scalabilité, on actionne les leviers **du moins cher au plus cher**, en **mesurant** à chaque étape :

```
0. MESURER   → localiser le goulot (sinon, stop : tu optimises à l'aveugle)
1. Corriger  → la requête / l'algo fautif (N+1, index manquant) — souvent LE fix
2. Cacher    → ce qui est lu souvent et coûteux (Redis, précalcul)
3. Scale reads → read replicas (charge lecture-intensive)
4. Scale out → instances stateless + load balancer (CPU applicatif saturé)
5. Sharder   → dernier recours (taille / écritures qui dépassent un nœud)
```

Sauter des étapes (« on shard direct ») coûte cher et rate souvent le vrai goulot. Descendre la liste **dans l'ordre** est la posture d'architecte.

---

## 3. Worked examples

### Exemple 1 — Diagnostiquer et traiter le goulot du dashboard (§1)

**Symptôme :** `GET /families/:id/dashboard`, p95 850 ms, au pic du matin.

**Étape 0 — mesurer.** La trace (§1) montre : 790 ms sur le calcul de série, avec un N+1 (une requête `count` par enfant, chacune scannant `completions`). Le CPU applicatif est à 20 %, la base à 30 % globalement. **Goulot = une requête, pas la capacité.**

**Étape 1 — corriger la requête (levier le moins cher).**
- Remplacer les N `count` par **une** requête agrégée (`GROUP BY childId`) → supprime le N+1.
- Le calcul de série reste coûteux car il scanne l'historique. Décision : **précalculer** la série et la stocker (colonne `currentStreak` mise à jour à chaque complétion, ou vue matérialisée). Le détail SQL est au **cours 10**.

**Étape 2 — cacher ce qui reste chaud.** Le dashboard est lu plusieurs fois par jour, change peu dans la journée. Décision de cache :
- **Quoi :** la réponse dashboard agrégée par famille.
- **Niveau :** Redis (partagé — on a plusieurs instances NestJS, un cache in-memory serait incohérent).
- **TTL :** 60 s (staleness produit acceptée : voir une routine cochée avec 1 min de retard est sans conséquence).
- **Invalidation :** à chaque complétion d'une routine de la famille, purger la clé `dashboard:family:<id>` (invalidation explicite en plus du TTL).

**Résultat attendu :** p95 qui passe sous 100 ms. **Zéro serveur ajouté, zéro sharding.** On a économisé la solution du contributeur (6 instances + sharding) en localisant le vrai goulot.

**Ce que l'exemple prouve :** les étapes 0-1-2 (mesurer, corriger, cacher) règlent l'immense majorité des cas. Le scale-out et le sharding n'étaient pas la réponse.

### Exemple 2 — Choisir le levier selon le goulot mesuré

On te donne quatre situations TribuZen. Pour chacune : quel goulot, quel levier ?

| Situation mesurée | Goulot | Levier (et pourquoi) |
|-------------------|--------|----------------------|
| CPU des 2 instances NestJS à 95 % au pic, base à 25 % | **App CPU** | **Scale-out** : ajouter des instances stateless + load balancer. Vérifier d'abord qu'aucun état n'est en mémoire de process. |
| Base à 90 %, dont 85 % de lectures (dashboards, listes) ; écritures faibles | **Lecture DB** | **Read replicas** + cache. Router les lectures tolérant le lag vers les répliques. Pas de sharding. |
| Un rapport admin fait `SELECT ... WHERE total > X` sur toute la base et bloque 4 s | **Requête non ciblée** | **Corriger/indexer** la requête (cours 10) + la sortir du chemin critique (job async, module 12). Surtout **pas** sharder : sans shard key, ce serait un scatter-gather. |
| 300 Go de `completions`, écritures qui saturent le primaire, un seul nœud | **Écriture + taille DB** | Là, et seulement là, envisager le **sharding** par `familyId`. Mais d'abord vérifier : partitionnement natif PG ? archivage des vieilles données ? |

La grille de lecture est toujours la même : **mesurer le maillon saturé**, puis prendre le levier **le moins cher** qui traite ce maillon.

---

## 4. Pièges & misconceptions

### PIÈGE #1 — Optimiser sans mesurer (« je sais où c'est lent »)

Le piège fondateur. L'intuition se trompe presque toujours de maillon (§1 : tout le monde disait « manque de serveurs », c'était un N+1). Sans profiling, tu optimises une partie qui ne pèse rien (loi d'Amdahl) et tu rates le goulot. **Règle : pas d'optimisation sans une mesure qui pointe le goulot.**

### PIÈGE #2 — Ajouter des serveurs alors que la base est le goulot

Le scale-out horizontal multiplie les instances **applicatives**. Si le goulot est la **base** (requête lente, saturation lecture/écriture), ajouter des instances **aggrave** souvent le problème : plus d'instances = plus de connexions vers la même base saturée. Le scale-out ne résout que la saturation **CPU applicatif**. Diagnostique la couche saturée avant.

### PIÈGE #3 — Confondre latence et débit (donc scalabilité et performance)

« On va scaler pour que ce soit plus rapide. » Non : scaler augmente le **débit** (plus de requêtes/s), pas forcément la **latence** d'une requête isolée. Une requête à 800 ms restera à 800 ms sur 10 instances au lieu de 2 — tu tiendras juste plus de trafic. Pour la latence, il faut corriger/cacher, pas multiplier les instances.

### PIÈGE #4 — Cacher partout (« le cache, c'est gratuit »)

Le cache n'est pas gratuit : il coûte en **cohérence**. Cacher sans stratégie d'invalidation sert de la donnée périmée et crée des bugs impossibles à reproduire. Et un **cache in-memory par instance** en multi-instance est incohérent par construction. Le cache est une **décision** (quoi, quel niveau, quel TTL, quelle invalidation, quelle staleness), pas un réflexe qu'on saupoudre.

### PIÈGE #5 — Sharder trop tôt

Le sharding est perçu comme « l'architecture qui scale ». En réalité c'est le levier **le plus coûteux** (routing, cross-shard, rééquilibrage) et le **dernier** recours. Un single-node PostgreSQL + read replicas tient très loin. Sharder avant d'avoir épuisé requêtes/cache/replicas/partitionnement natif, c'est payer une complexité énorme pour un problème qu'on n'a pas encore. **Prématuré = dette.**

### PIÈGE #6 — Choisir un mauvais shard key (le jour où on shard vraiment)

Si tu dois sharder, la clé décide de tout. Une clé à faible cardinalité (`country`) ou monotone (`createdAt`) crée des **hotspots** (un shard prend tout le trafic). Une clé absente des requêtes force le **scatter-gather** (interroger tous les shards). Bonne clé = haute cardinalité + distribution uniforme + présente dans presque toutes les requêtes (souvent `familyId`/`tenantId`).

### PIÈGE #7 — Raisonner en moyenne

Une latence moyenne « correcte » cache souvent un p99 catastrophique qui déclenche timeouts et retries en cascade. La moyenne est aveugle à la queue de distribution. **Raisonne en p95/p99**, cible la queue — c'est là que vivent les utilisateurs qui partent.

### PIÈGE #8 — Croire les sticky sessions inoffensives

Les sticky sessions « résolvent » l'état en mémoire en collant chaque client à son instance. Mais elles cassent la résilience (instance perdue = sessions perdues) et l'équilibrage (charge déséquilibrée). C'est un pansement sur un défaut d'archi. Le bon geste : rendre les instances **stateless** (état dans Redis/JWT), pas coller les sessions.

---

## 5. Ancrage TribuZen

TribuZen est **lecture-intensive** : les parents consultent le dashboard bien plus souvent qu'ils ne créent des routines. C'est le profil-type où **cache + read replicas** valent mieux que scale-out ou sharding. La feuille de route de scaling, dans l'ordre de coût :

```
Charge qui monte sur TribuZen — leviers dans l'ordre :

0. MESURER (APM sur les endpoints chauds : dashboard, complétion)
1. Corriger le N+1 du calcul de série + précalculer la série       (module 12/10)
2. Cache Redis du dashboard par famille, TTL 60 s, purge à la complétion
3. Read replica PostgreSQL pour les lectures du dashboard (lag toléré)
4. Scale-out du NestJS : instances stateless derrière un load balancer L7
5. Sharding par familyId — SEULEMENT si taille/écritures dépassent un nœud
```

Décisions d'architecture concrètes :

- **Stateless dès le départ.** L'auth TribuZen est en **JWT** (sans état serveur) ; les jobs (rappels, sync) passent par une **file Redis/BullMQ** (module 12) ; aucun état en mémoire de process. Le scale-out (étape 4) est donc possible **sans** sticky sessions le jour venu.
- **Le cache est une décision produit.** La staleness du dashboard (60 s) est acceptable **parce que** le produit le tolère — une routine cochée apparaît au pire 1 min plus tard. On ne cacherait **pas** avec la même désinvolture une donnée de sécurité ou de facturation.
- **Le stockage Level 1 (device-only, chiffré) réduit la charge serveur.** Une partie des données sensibles TribuZen vit **sur l'appareil** (jamais sur le serveur). C'est aussi, indirectement, un levier de scalabilité : ce trafic-là ne touche jamais la base centrale.
- **Le sharding n'est pas au programme de TribuZen** au lancement, et probablement jamais avant longtemps : le profil lecture-intensive se traite avec cache + replicas. On garde `familyId` comme shard key **potentiel** (le modèle est déjà partitionnable par famille), sans l'implémenter.

> **Défère :** les en-têtes HTTP de cache / le CDN sont le **cours 11** ; l'autoscaling et le capacity planning outillés (K8s/AWS) le **cours 12** ; les index et l'optimisation SQL le **cours 10** ; l'observabilité (comment on mesure vraiment) le **module 22**. Ici on décide **quel levier, dans quel ordre**, pas comment on le configure.

---

## 6. Points clés

1. **Mesurer avant d'optimiser.** Le goulot est presque jamais là où l'intuition le place ; sans profiling tu optimises à l'aveugle (loi d'Amdahl).
2. **Latence ≠ débit.** Scaler augmente le débit, pas la latence d'une requête isolée. Scalabilité = tenir le débit en gardant la latence acceptable.
3. **Raisonne en p95/p99, jamais en moyenne** — la queue de distribution est l'ennemi.
4. **Localise le maillon saturé** (réseau / LB / app CPU / base lecture / base écriture / externe) : chaque goulot a son levier propre.
5. **Le cache est une décision** (quoi, quel niveau, quel TTL, quelle invalidation, quelle staleness), pas un réflexe. In-memory par instance = incohérent en multi-instance.
6. **Vertical = simple mais plafond + SPOF ; horizontal = pas de plafond + résilience, mais exige le stateless.**
7. **Stateless = condition du scale-out.** État externalisé (JWT, Redis, S3, file). Les sticky sessions sont un pansement.
8. **Scaler la donnée : read replicas d'abord** (lecture-intensive, prix = replication lag / eventual consistency), **sharding en dernier recours** (taille/écritures), avec un shard key à haute cardinalité présent dans les requêtes.
9. **Ordre par coût croissant :** mesurer → corriger la requête → cacher → read replicas → scale-out stateless → sharder. On ne saute pas d'étape.

---

## 7. Seeds Anki

```
Quelle est la règle n°1 de la performance au niveau archi ?|Mesurer avant d'optimiser. Le goulot est presque jamais là où l'intuition le place ; sans profiling on optimise à l'aveugle (loi d'Amdahl : accélérer une partie qui pèse 5 % ne gagne que 2,5 %).
Différence entre latence et débit (throughput) ?|Latence = temps pour traiter UNE requête (expérience d'un utilisateur). Débit = nombre de requêtes par seconde (capacité du système). Scaler augmente le débit, pas la latence d'une requête isolée.
Pourquoi raisonner en p95/p99 plutôt qu'en moyenne ?|La moyenne cache les cas lents. Une moyenne à 100 ms peut cacher un p99 à 3 s qui déclenche timeouts et retries. La queue de distribution (p99) est l'ennemi et c'est là que vivent les utilisateurs qui partent.
Un cache est une décision : quelles sont les 4 (5) questions ?|Quoi cacher (lu souvent + coûteux), à quel niveau (client/CDN/in-memory/Redis/DB), quel TTL, quelle invalidation (TTL/éviction/explicite) — et transverse : quelle staleness le produit tolère (décision produit).
Pourquoi un cache in-memory par instance est un piège en multi-instance ?|Chaque instance a sa copie : l'instance A purge, l'instance B sert encore l'ancienne valeur → incohérence. En multi-instance derrière un load balancer, le cache doit être partagé (Redis) ; l'in-memory ne convient qu'à des données quasi-immuables.
Scaling vertical vs horizontal ?|Vertical (scale up) = machine plus grosse : simple, aucune coordination, mais plafond physique + coût exponentiel + SPOF. Horizontal (scale out) = plus d'instances : pas de plafond, résilience, coût linéaire, mais exige des instances stateless.
Pourquoi le stateless est la condition du scale-out ?|Si l'état est en mémoire de process, une instance qui redémarre le perd et le load balancer ne peut pas router librement. Il faut externaliser l'état (JWT, Redis, S3, file). Les sticky sessions sont un pansement qui sacrifie résilience et équilibrage.
Read replicas vs sharding : lequel d'abord et pourquoi ?|Read replicas d'abord : résolvent les charges lecture-intensives (le cas courant), prix = replication lag / eventual consistency. Sharding en dernier recours : résout taille + écritures, mais complexité énorme (routing, cross-shard). Un single-node PG tient très loin (~1 To, ~10 k req/s).
Qu'est-ce qu'un bon shard key et quel piège éviter ?|Haute cardinalité, distribution uniforme (pas de hotspot), présent dans presque toutes les requêtes — souvent familyId/tenantId. Piège : une clé absente des requêtes force le scatter-gather (interroger tous les shards puis fusionner) ; une clé monotone (createdAt) crée un hotspot.
Quel est l'ordre des leviers de scaling par coût croissant ?|Mesurer → corriger la requête/algo (N+1, index) → cacher → read replicas → scale-out stateless → sharder. On descend la liste dans l'ordre, en mesurant à chaque étape ; sauter des étapes coûte cher et rate souvent le vrai goulot.
```

---

## Pont vers le lab

> Lab associé : `labs/lab-21-performance-scalabilite/README.md`. À partir des métriques d'un système TribuZen sous charge, identifier le goulot, concevoir la stratégie de scaling/caching et la justifier dans un mini-ADR — évalué par grille + coach, avec variante J+30. Zéro harnais.
