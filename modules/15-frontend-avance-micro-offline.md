---
titre: Frontend avancé — performance, micro-frontends & offline-first (niveau archi)
cours: 13-architecture
notions: ["performance frontend au niveau architecture", "performance budget", "code splitting (frontières de bundle)", "micro-frontends", "Module Federation", "coût organisationnel des micro-frontends", "communication inter-micro-frontends (Custom Events)", "offline-first (posture architecturale)", "stratégies de synchronisation", "file d'attente d'actions (outbox)", "résolution de conflits (Last-Write-Wins, merge, CRDT)", "PWA vs application native (décision)"]
outcomes:
  - "sait traiter la performance frontend comme une contrainte d'architecture (budget, frontières de bundle) et non comme un réglage tardif"
  - "sait décider si un micro-frontend est justifié, et argumenter que dans la grande majorité des cas il ne l'est pas"
  - "sait nommer le coût réel d'une architecture micro-frontend (orchestration, versions partagées, communication)"
  - "sait poser une posture offline-first au niveau architectural : quelles données locales, quelle file d'actions, quelle stratégie de sync"
  - "sait choisir une stratégie de résolution de conflits (Last-Write-Wins, merge, CRDT) selon la nature de la donnée"
prerequis: ["Modules 00-14 du cours 13-architecture (posture, SOLID, couches, hexagonale, clean, DDD, données, architecture frontend)"]
next: 16-communication-et-integration
libs: []
tribuzen: "app mobile TribuZen (React Native Expo) offline-first — décision micro-frontend (non) et stratégie de synchronisation des routines/journal au retour réseau"
last-reviewed: 2026-07
---

# Frontend avancé — performance, micro-frontends & offline-first (niveau archi)

> **Outcomes — tu sauras FAIRE :** traiter la performance frontend comme une **contrainte d'architecture**, décider si un **micro-frontend** est justifié (et défendre le « non » par défaut), nommer son **coût réel**, poser une **posture offline-first** au niveau archi, et choisir une **stratégie de résolution de conflits** selon la donnée.
> **Difficulté :** :star::star::star:
>
> **Portée :** ce module raisonne **décision d'architecture** sur trois sujets frontend avancés. On ne descend PAS dans l'implémentation. Le **service worker**, le détail des **stratégies de cache HTTP**, les **Core Web Vitals** et **Lighthouse**, la mécanique **PWA web** relèvent du **cours 11 (HTTP & caching)** — on y **renvoie** sans dupliquer. Le découpage en composants, le state management et le rendu (SSR/CSR) sont le **module 14 (architecture frontend)**. Ici : *quand* payer le coût d'un micro-frontend, *quelle* posture offline adopter, *quelle* stratégie de sync — pas *comment* coder un `fetch` handler.

## 1. Cas concret d'abord

Tu es sur TribuZen. L'app mobile (React Native Expo) doit marcher **dans le métro, sans réseau** : un parent coche les routines de ses enfants le matin, souvent hors connexion. En parallèle, un collègue lance en réunion : « on devrait passer le front en **micro-frontends** avec Module Federation, comme le web admin, ça découplera les équipes ».

Deux décisions d'architecture atterrissent sur ton bureau le même jour :

```
Décision A — "Micro-frontends pour TribuZen ?"
  Équipe actuelle : 3 devs, un seul produit, une seule stack (Expo + Tamagui).
  Argument avancé : "découpler", "chaque écran son build".

Décision B — "Comment marche l'app sans réseau ?"
  Un parent coche 4 routines à 8h12 dans le métro (offline).
  À 8h40 il retrouve la 4G. Sa conjointe a, entre-temps, modifié la
  même routine depuis SON téléphone. Que devient la donnée ?
```

Pose-toi les vraies questions, avant tout code :

1. **A —** Le micro-frontend résout un problème d'**organisation** (plusieurs équipes qui veulent déployer indépendamment). TribuZen a-t-il ce problème ? Non : 3 devs, un produit. Alors pourquoi payer un coût d'orchestration ? Ce module va te donner la grille pour **dire non** proprement.
2. **B —** Si l'app attend le réseau pour enregistrer la coche, elle est inutilisable dans le métro. Il faut écrire **localement d'abord**, mettre l'action en **file d'attente**, puis **synchroniser** au retour réseau. Et gérer le cas où deux téléphones ont modifié la même routine : c'est un **conflit** à résoudre par une stratégie **choisie**.
3. **Performance —** Personne n'a demandé « la perf », mais l'app doit rester légère sur un téléphone d'entrée de gamme. La performance n'est pas un réglage de fin de projet : c'est une **contrainte** qu'on pose **dès l'architecture** (budget, frontières de bundle).

Ce module traite ces trois sujets **au niveau décision**. Le détail technique (service worker web, cache HTTP, Core Web Vitals) est **déféré au cours 11**.

---

## 2. Théorie complète, concise

### 2.1 Performance frontend comme contrainte d'architecture

La performance mal gérée est traitée **à la fin** (« on optimisera plus tard »). Mal. Certaines décisions de performance sont **structurelles** : les prendre tard coûte une réécriture. Au niveau archi, deux leviers t'appartiennent :

**Le performance budget.** Un plafond **chiffré et versionné** que le build ne doit pas dépasser : par ex. « JS ≤ 200 Ko gzip par écran », « image LCP ≤ 100 Ko ». Le budget transforme la perf d'une intention floue en une **contrainte vérifiable** (idéalement bloquante en CI). C'est une décision d'architecture parce qu'elle **cadre** ce que les features ont le droit de coûter.

**Les frontières de bundle (code splitting).** Découper le code en morceaux chargés à la demande (par route, par feature). C'est un choix de **frontières** — donc d'architecture — pas un réglage de compilateur. Séparer le code applicatif des dépendances tierces (`vendor`) permet aussi qu'une mise à jour de ton code n'invalide pas le cache des libs. *Où* tu coupes est la décision ; *comment* le bundler l'implémente est du détail (déféré).

> **Défère :** la mécanique fine — Core Web Vitals (LCP/CLS/INP), Lighthouse CI, cache HTTP, `fetchpriority`, images WebP/AVIF — est le **cours 11 (HTTP & caching)**. Ici, on retient : perf = contrainte posée tôt (budget) + frontières de chargement (splitting). Rien de plus.

### 2.2 Micro-frontends : définition et promesse

Un **micro-frontend** découpe une application front en plusieurs applications **déployables indépendamment**, assemblées à l'exécution par une **application hôte** (shell). Analogie : un centre commercial (le shell fournit le bâtiment ; chaque boutique/micro-app a sa propre équipe et son propre planning).

La promesse est **organisationnelle**, pas technique :

| Problème visé | Ce que le micro-frontend apporte |
|---|---|
| Plusieurs équipes qui se marchent dessus sur un même repo | Chaque équipe a son app, son repo, son déploiement |
| Build monolithique de 10 min | Chaque app se build seule |
| Une équipe bloquée sur une vieille version de framework | Chaque app choisit sa version (au prix fort, cf. §2.4) |
| Un déploiement risqué qui embarque tout | Déploiement indépendant, blast radius réduit |

Retiens la formule : **le micro-frontend résout un problème d'équipe, pas un problème de code.**

### 2.3 Module Federation en une image

L'approche la plus courante est **Module Federation** (bundler webpack/rspack, aussi porté ailleurs). Un **host** consomme à l'exécution des modules **exposés** par des **remotes**, en partageant les dépendances communes (React chargé une seule fois) :

```
┌──────────────┐        expose ./Dashboard        ┌──────────────┐
│  Shell (host)│ ───────────────────────────────▶ │ Admin (remote)│
│              │        expose ./ProductList       │              │
│  shared:     │ ◀─────────────────────────────── │  shared:     │
│   react (1x) │        expose ./SearchBar         │   react (1x) │
└──────────────┘                                   └──────────────┘
```

C'est élégant sur le papier. Mais chaque flèche est un **contrat de version** et un **point de défaillance** à l'exécution. D'où le coût, ci-dessous.

### 2.4 Le coût réel — pourquoi c'est rarement justifié

C'est **le** message du module. Un micro-frontend ajoute un coût **permanent** :

1. **Orchestration.** Un shell à écrire, déployer, versionner. Le chargement à l'exécution introduit des états d'erreur (« remote injoignable ») à gérer par des *error boundaries* — sinon un remote qui tombe casse la page.
2. **Versions partagées.** Les `shared deps` (React, router) doivent rester **compatibles** entre toutes les apps. Le « chaque app choisit sa version » de la brochure se paie : soit tu synchronises les versions (et tu perds l'indépendance), soit tu charges plusieurs runtimes (et tu exploses le poids — anti-performance, cf. §2.1).
3. **Communication inter-apps.** Deux micro-apps qui doivent échanger (le panier et le catalogue) ont besoin d'un canal : **Custom Events** (`window.dispatchEvent`) pour un découplage total, ou un store partagé (couplage). C'est de la plomberie transverse en plus.
4. **Cohérence UX & design.** Sans discipline forte (design system partagé), les apps divergent visuellement.
5. **Debug & observabilité.** Une erreur peut naître dans un remote, chargé par un host, dans un contexte tiers. La stack trace traverse des frontières.

**Règle de décision :** paie ce coût **uniquement** si tu as le problème d'organisation qu'il résout — **plusieurs équipes** qui ont besoin de **déployer indépendamment**. Sinon : **monolithe frontend modulaire** (bien découpé en modules internes, module 14). Dans la grande majorité des produits — dont TribuZen — la réponse est **non**.

| Ne PAS faire de micro-frontend si… | Raison |
|---|---|
| Équipe < ~5 devs / une seule équipe | Le coût d'orchestration dépasse le bénéfice |
| Un seul domaine métier | Pas de frontière naturelle où couper |
| Stack homogène | Rien à isoler entre frameworks |
| Pas de besoin de déploiement indépendant | Le principal avantage disparaît |
| MVP / produit jeune | Optimisation prématurée |

### 2.5 Offline-first comme posture architecturale

**Offline-first** n'est pas « ajouter un cache à la fin ». C'est une **posture** : l'app est conçue pour fonctionner **sans réseau par défaut**, et le réseau est un **bonus** de synchronisation. Ça change l'architecture, pas un détail :

- **Source de vérité locale.** L'écriture va **d'abord** dans un stockage local (base embarquée sur l'appareil). L'UI lit le local — donc elle est instantanée et marche offline.
- **File d'attente d'actions sortantes (outbox).** Chaque action qui doit atteindre le serveur (« routine cochée ») est **mise en file** localement avec un horodatage, au lieu d'un appel réseau synchrone.
- **Synchronisation en tâche de fond.** Au retour du réseau (détecté par l'appareil), la file est **rejouée** vers le serveur ; les données distantes sont récupérées et fusionnées dans le local.

Le schéma mental :

```
Action utilisateur (offline)
      │  écrit d'abord en LOCAL (UI instantanée)
      ▼
┌────────────────────┐        réseau revient
│ Store local (vérité)│ ─────────────────────────▶  rejoue la file (outbox) vers le serveur
│ + outbox (file)     │ ◀─────────────────────────  récupère le distant, fusionne
└────────────────────┘        (résout les conflits)
```

> **Défère :** l'implémentation offline **web** — service worker, Cache API, stratégies Cache-First / Network-First / Stale-While-Revalidate, manifest PWA — est le **cours 11**. TribuZen n'est d'ailleurs **pas** une PWA (§2.7) : c'est du natif React Native. Ici on retient la **posture** et les **trois briques** (local d'abord, outbox, sync), pas l'API.

### 2.6 Stratégies de synchronisation et résolution de conflits

La sync est facile tant qu'un seul appareil écrit. Le vrai sujet d'archi, c'est le **conflit** : deux appareils ont modifié la même donnée hors ligne. Il n'y a pas de solution universelle — tu **choisis** selon la **nature de la donnée** :

| Stratégie | Principe | Bon pour | Limite |
|---|---|---|---|
| **Last-Write-Wins (LWW)** | Le dernier horodatage écrase | Préférences, état simple, « coché/décoché » | Perte silencieuse de l'autre modification |
| **Merge (fusion métier)** | Règle de fusion propre au domaine | Compteurs additifs, listes (union) | Il faut définir la règle cas par cas |
| **User decides** | On présente le conflit à l'utilisateur | Contenu important (note, texte long) | Frottement UX, à réserver au rare |
| **CRDT** | Types de données à fusion **automatique** mathématiquement garantie | Édition collaborative temps réel | Complexité forte, souvent surdimensionné |

La question à te poser : *que se passe-t-il si on perd une des deux écritures ?* Si c'est anodin (un toggle) → LWW suffit. Si c'est coûteux (le texte d'un journal) → merge ou user-decides. Le **CRDT** est puissant mais **rarement nécessaire** hors collaboratif temps réel — même logique « coût vs bénéfice » que les micro-frontends. Ne le sors pas pour un toggle.

### 2.7 PWA vs natif : une décision, pas un défaut

**PWA** (Progressive Web App) et **application native** sont deux **cibles** pour l'offline mobile — c'est une **décision d'architecture** :

- **PWA** : une app web installable, offline via service worker. Un seul code web, pas de store, mais un accès aux capacités de l'appareil plus limité (biométrie, stockage sécurisé natif, tâches de fond).
- **Natif** (ici React Native Expo) : accès natif complet (trousseau sécurisé, biométrie, background fetch), au prix des stores et d'un runtime dédié.

TribuZen a **choisi le natif** parce que sa contrainte structurante — le chiffrement des données sensibles dans le **trousseau sécurisé de l'appareil** — exige des capacités natives qu'une PWA n'offre pas proprement. La leçon d'archi : la cible (PWA ou natif) **découle d'une contrainte** (ici la sécurité des données), elle ne se choisit pas par habitude.

---

## 3. Worked examples

### Exemple 1 — Décider (et refuser) un micro-frontend pour TribuZen

On te demande : « faut-il passer TribuZen en micro-frontends ? ». Déroule la grille de décision au lieu de répondre au feeling.

**Étape 1 — Quel problème le micro-frontend résout-il ?** Le déploiement indépendant de **plusieurs équipes**. Question filtre : *avons-nous plusieurs équipes qui se bloquent ?* → Non, 3 devs, une équipe.

**Étape 2 — Y a-t-il une frontière naturelle où couper ?** Un micro-frontend a du sens autour de domaines autonomes portés par des équipes distinctes. TribuZen = un seul domaine famille, une seule équipe. → Pas de frontière.

**Étape 3 — Stack hétérogène à isoler ?** Non : Expo + Tamagui partout (web admin et mobile partagent même les tokens). → Rien à isoler.

**Étape 4 — Quel serait le coût ?** Shell + gestion des remotes injoignables + versions `shared` à synchroniser + canal de communication inter-apps + observabilité éclatée. Coût **permanent**, pour zéro bénéfice organisationnel ici.

**Verdict :** **NON.** TribuZen reste un **monolithe frontend modulaire** — bien découpé en modules internes (module 14), sans la taxe d'orchestration. On documente la décision dans un ADR :

```
ADR — Pas de micro-frontends pour TribuZen (2026-07)
Contexte : proposition de découper le front en micro-frontends (Module Federation).
Décision : REJETÉE. On garde un monolithe frontend modulaire.
Raison : le micro-frontend résout un problème d'organisation (N équipes déployant
  indépendamment) que nous n'avons pas (1 équipe, 1 domaine, 1 stack). Le coût
  (shell, versions partagées, communication, observabilité) serait payé sans bénéfice.
Réévaluation : si l'équipe dépasse ~15 devs répartis en squads autonomes par domaine.
```

Ce qui rend cette réponse « senior » : ce n'est pas « non parce que c'est compliqué », c'est « non parce que **le problème que ça résout n'existe pas ici** », avec le **critère de réévaluation** qui rouvrirait la décision.

### Exemple 2 — Concevoir la sync offline de la coche de routine

Le cas B du §1. Objectif : le parent coche une routine offline, ça marche, et ça se synchronise proprement — conflit compris.

**1. Où va l'écriture ?** En **local d'abord** (store embarqué de l'appareil). L'UI affiche la coche immédiatement (optimiste), même sans réseau. La coche n'attend **jamais** le serveur.

**2. Quoi mettre en file (outbox) ?** Une **action** décrite, pas un appel réseau :

```
Outbox (persistée localement) — une action, horodatée
{
  type: "routine.complete",
  routineId: "r-42",
  childId: "c-7",
  day: "2026-07-05",
  clientUpdatedAt: "2026-07-05T08:12:03Z"   // horloge de l'appareil émetteur
}
```

**3. Quand rejouer ?** Au retour réseau (l'appareil signale la reconnexion) ou via une tâche de fond. On rejoue les actions **dans l'ordre** ; en cas de succès on retire l'action de la file ; en cas d'échec réseau on **arrête** et on réessaiera.

**4. Résoudre le conflit (le cœur).** Sur le serveur, la routine `r-42` a peut-être été modifiée par l'autre parent à `08:30`, après le `08:12` local. Nature de la donnée = un **état de complétion** binaire par jour. Perdre une des deux écritures est **anodin** (la routine est cochée dans les deux cas, ou l'idempotence règle le doublon). → **Last-Write-Wins par `clientUpdatedAt`** suffit ; inutile de sortir un CRDT.

En revanche, pour une **note du journal familial** (texte long, Level 1), LWW ferait perdre du contenu écrit → on choisirait **merge** ou **user-decides** pour *cette* donnée. **La stratégie se choisit par type de donnée, pas globalement.**

**5. Idempotence.** Comme on rejoue une file, une action peut partir deux fois (crash entre l'envoi et l'accusé). L'action porte une **clé stable** (`routineId+childId+day`) pour que le serveur traite un rejeu comme un no-op. Sans ça, la sync crée des doublons.

**Ce que la conception achète :** l'app est utilisable dans le métro (local d'abord), aucune action n'est perdue (outbox persistée), et les conflits ont une règle **explicite et adaptée à chaque donnée** (LWW pour la coche, merge pour le journal).

---

## 4. Pièges & misconceptions

### PIÈGE #1 — « Micro-frontends = frontend moderne / scalable »

Faux. Le micro-frontend est un **pattern organisationnel** qui répond à « plusieurs équipes veulent déployer indépendamment ». Ce n'est ni plus moderne ni plus performant — c'est souvent **moins** performant (runtimes partagés, chargement à l'exécution). Sans le problème d'organisation, c'est du coût pur. Le défaut senior, c'est **monolithe frontend modulaire** ; le micro-frontend se **justifie**, il ne se choisit pas par mode.

### PIÈGE #2 — Confondre micro-frontend et simple découpage en modules/lazy-loading

Découper ton app en modules internes et charger des routes en lazy (`code splitting`) n'est **pas** un micro-frontend : tout reste **un seul déploiement**. Le micro-frontend implique des applications **déployées séparément** et assemblées à l'exécution. Tu peux (et dois) avoir un front **modulaire** sans jamais toucher à Module Federation.

### PIÈGE #3 — « Offline-first = mettre un cache »

Non. Un cache accélère la lecture ; l'offline-first change la **source de vérité** : on écrit **local d'abord**, on met les actions en **file**, on **synchronise** après. C'est une posture d'architecture (où vit la vérité, comment elle se réconcilie), pas un `Cache-Control`. Bolter un cache sur une app online-first ne la rend pas offline-first.

### PIÈGE #4 — « Last-Write-Wins, c'est toujours suffisant / toujours nul »

Ni l'un ni l'autre — **ça dépend de la donnée**. Pour un toggle (routine cochée), LWW est parfait et simple. Pour un texte long co-édité, LWW **perd silencieusement** du contenu → inacceptable. Le piège est de choisir **une** stratégie globale. On choisit **par type de donnée** : LWW ici, merge là, user-decides pour le rare et précieux.

### PIÈGE #5 — Sortir un CRDT « pour être robuste »

Le CRDT garantit une fusion automatique sans conflit — au prix d'une **complexité forte** et d'un modèle de données contraint. Il est justifié pour l'**édition collaborative temps réel** (plusieurs curseurs dans le même document). Pour une coche de routine ou des préférences, c'est un canon pour tuer une mouche. Même logique que les micro-frontends : puissant **et** rarement nécessaire → il se justifie.

### PIÈGE #6 — Traiter la performance comme un réglage de fin de projet

« On optimisera à la fin. » Certaines décisions perf sont **structurelles** : les frontières de bundle, le poids qu'on autorise par écran. Les poser tard = réécriture. Le **performance budget** posé **tôt** (et vérifié en CI) transforme la perf en contrainte d'architecture au lieu d'un nettoyage de dernière minute. Le détail (Core Web Vitals, Lighthouse) est du cours 11 ; la **posture budgétaire** est de l'archi.

---

## 5. Ancrage TribuZen

TribuZen est une **app mobile React Native Expo, offline-first**, doublée d'un web admin Next.js. Les trois sujets du module y sont des décisions réelles :

**Micro-frontends → NON (décidé, documenté).** 3 devs, un domaine famille, une stack unifiée (Expo + Tamagui, tokens partagés web/mobile). Aucun problème d'organisation à résoudre → monolithe frontend modulaire. La décision est actée dans un ADR avec critère de réévaluation (>~15 devs en squads autonomes). C'est l'exemple 1.

**Offline-first → posture structurante.** L'app doit marcher dans le métro : les **routines** se cochent hors ligne, le **journal 7 jours** et le **dashboard** sont lisibles offline. Concrètement (niveau archi) :
- **Écriture locale d'abord** dans le store embarqué de l'appareil ; l'UI ne dépend pas du réseau.
- **Outbox** persistée : chaque coche est une action horodatée en file, rejouée au retour réseau par une tâche de fond.
- **Sync** au retour de connexion : rejeu de la file + récupération du distant.

> **Défère :** le choix précis des briques mobiles (stockage local rapide, détection réseau, background fetch, cache de requêtes) est l'**implémentation** vue pendant le cours React Native / au cours 11 pour la partie caching. Ici on décide la **posture** (local d'abord + outbox + sync) et **où** vivent les responsabilités.

**Résolution de conflits → par type de donnée.**
- **Coche de routine** (état binaire par jour) → **Last-Write-Wins** sur l'horodatage client, avec **clé d'idempotence** `routineId+childId+day`. Perdre une écriture est anodin.
- **Note du journal familial** (Level 1, texte long) → **merge** ou **user-decides** : on ne perd pas du contenu écrit silencieusement.
- Pas de CRDT en V1 : aucune édition collaborative temps réel au programme.

**PWA vs natif → natif, par contrainte.** Les données sensibles (Level 1 : prénoms exacts, diagnostics) sont chiffrées dans le **trousseau sécurisé natif** de l'appareil — capacité qu'une PWA n'offre pas proprement. La cible native **découle** de la contrainte de sécurité, elle n'est pas un défaut.

> **Défère :** sécurité/chiffrement en profondeur → **cours 14 (sécurité)** et module 20 ; caching HTTP et service worker → **cours 11** ; découpage en composants/state → **module 14**.

---

## 6. Points clés

1. La **performance** frontend a une part **architecturale** : le **performance budget** (plafond chiffré, vérifié tôt) et les **frontières de bundle** (code splitting). Le reste (Core Web Vitals, Lighthouse, cache HTTP) est **déféré au cours 11**.
2. Un **micro-frontend** est un **pattern organisationnel** : il résout « N équipes déployant indépendamment », pas un problème de code.
3. Son **coût est permanent** : shell d'orchestration, versions `shared` compatibles, communication inter-apps, observabilité éclatée. Il **anti-optimise** souvent la performance.
4. **Par défaut : monolithe frontend modulaire.** Le micro-frontend se **justifie** (plusieurs équipes, plusieurs domaines, besoin de déploiement indépendant) — pour la majorité des produits, dont TribuZen, la réponse est **non**.
5. **Offline-first** est une **posture** : écriture **locale d'abord**, actions en **file (outbox)**, **synchronisation** au retour réseau — pas « un cache ajouté ».
6. La **résolution de conflits** se choisit **par type de donnée** : **LWW** (toggle), **merge** (compteurs/listes), **user-decides** (contenu précieux), **CRDT** (collaboratif temps réel — rarement nécessaire).
7. **PWA vs natif** est une **décision** qui **découle d'une contrainte** (TribuZen : natif, exigé par le stockage sécurisé des données sensibles).
8. Fil rouge : deux « rarement justifiés » à savoir défendre — **micro-frontend** et **CRDT** — au nom du rapport coût/bénéfice.

---

## 7. Seeds Anki

```
Quel problème un micro-frontend résout-il vraiment ?|Un problème d'ORGANISATION : plusieurs équipes qui veulent déployer indépendamment. Pas un problème de code, pas de la performance. Sans plusieurs équipes autonomes, il n'est pas justifié.
Quel est le choix par défaut face à une proposition de micro-frontend ?|Le monolithe frontend modulaire (bien découpé en modules internes). Le micro-frontend se justifie au cas par cas ; il n'est PAS le défaut moderne.
Cite trois coûts permanents d'une architecture micro-frontend.|Orchestration (shell + remotes injoignables à gérer) ; versions des dépendances partagées à garder compatibles ; communication inter-apps (Custom Events / store) ; observabilité/debug éclatés. (3 suffisent.)
Qu'est-ce que la posture offline-first au niveau architecture ?|L'app fonctionne sans réseau PAR DÉFAUT : on écrit en LOCAL d'abord (source de vérité locale), on met les actions dans une file (outbox), on synchronise au retour réseau. Ce n'est pas « ajouter un cache ».
Comment choisir une stratégie de résolution de conflits offline ?|PAR TYPE DE DONNÉE. Last-Write-Wins pour un toggle/état simple (perte anodine) ; merge pour compteurs/listes ; user-decides pour du contenu précieux ; CRDT pour l'édition collaborative temps réel (rarement nécessaire).
Pourquoi Last-Write-Wins peut être un mauvais choix, et quand est-il bon ?|Bon pour une donnée dont perdre une écriture est anodin (routine cochée). Mauvais pour un texte long co-édité : il écrase et perd silencieusement du contenu. Ne jamais choisir UNE stratégie globale.
Pourquoi la performance frontend est-elle en partie une décision d'architecture ?|Parce que le performance budget (plafond chiffré vérifié tôt) et les frontières de bundle (code splitting) sont structurels : posés tard, ils imposent une réécriture. Le détail (Core Web Vitals, Lighthouse, cache HTTP) est déféré au cours 11.
PWA ou natif : sur quoi se fonde la décision (cas TribuZen) ?|Sur une CONTRAINTE, pas l'habitude. TribuZen choisit le natif (React Native) parce que le chiffrement des données sensibles dans le trousseau sécurisé natif exige des capacités qu'une PWA n'offre pas proprement.
Pourquoi éviter un CRDT « pour être robuste » sur une coche de routine ?|Le CRDT garantit une fusion auto sans conflit mais au prix d'une forte complexité et d'un modèle contraint. Justifié pour le collaboratif temps réel ; pour un toggle, c'est un canon pour une mouche — LWW suffit.
```

---

## Pont vers le lab

> Lab associé : `labs/lab-15-frontend-avance-micro-offline/README.md`. Deux décisions d'architecture à trancher et documenter pour TribuZen : (1) micro-frontend ou non (grille + ADR), (2) concevoir la stratégie offline/sync d'une feature (source de vérité locale, outbox, résolution de conflits par type de donnée). Exercice de conception/décision, évalué par grille + coach — zéro harnais.
