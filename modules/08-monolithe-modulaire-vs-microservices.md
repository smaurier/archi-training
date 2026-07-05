---
titre: Monolithe modulaire vs microservices
cours: 13-architecture
notions: ["monolithe modulaire", "frontières de modules", "API publique de module (barrel file)", "microservices", "data per service", "vertical slice architecture", "features not layers", "quand découper (et surtout quand NON)", "monolithe distribué (anti-pattern)", "nano-services (anti-pattern)", "base de données partagée (anti-pattern)", "12-factor app", "config dans l'environnement", "processes stateless", "idempotence", "clé d'idempotence (Idempotency-Key)", "coûts d'un système distribué"]
outcomes:
  - "sait distinguer style de découpage logique (couches, slices, modules) et style de déploiement (monolithe vs microservices)"
  - "sait structurer un monolithe modulaire à frontières explicites (API publique par module, pas d'accès aux internals)"
  - "sait appliquer un cadre de décision mono-vs-micro et justifier pourquoi le défaut est le monolithe modulaire"
  - "sait nommer les trois anti-patterns distribués fatals (monolithe distribué, nano-services, base partagée)"
  - "sait expliquer l'idempotence et le rôle d'une clé d'idempotence pour rendre un retour de réseau sûr"
  - "connaît les facteurs 12-factor structurants (config externalisée, processes stateless) et leur lien avec le scaling"
prerequis: ["Module 00 — posture d'architecte", "Module 01 — principes SOLID", "Module 02 — design patterns", "Module 03 — clean code / code smells", "Module 04 — dependency injection / IoC", "Module 05 — architecture en couches", "Module 06 — architecture hexagonale", "Module 07 — clean architecture"]
next: 09-ddd-strategique
libs: []
tribuzen: "backend NestJS de TribuZen — décision de style de déploiement (monolithe modulaire vs microservices) et découpage en modules Routines / Family / Notifications / Sync"
last-reviewed: 2026-07
---

# Monolithe modulaire vs microservices

> **Outcomes — tu sauras FAIRE :** séparer style de découpage et style de déploiement, structurer un monolithe modulaire à frontières explicites, appliquer un cadre de décision mono-vs-micro, nommer les trois anti-patterns distribués fatals, et expliquer idempotence + clé d'idempotence.
> **Difficulté :** :star::star::star:
>
> **Portée :** ce module traite du **style de déploiement et de découpage macro** — un seul déployable (monolithe) contre plusieurs services autonomes (microservices), et l'organisation interne en modules ou en tranches verticales. On y ajoute le vocabulaire **12-factor** (config, stateless) et **idempotence** *dans la mesure où ils motivent la décision de découpage*. Le **deep des systèmes distribués** — CQRS, event sourcing, saga, cohérence éventuelle, résilience — est explicitement **déféré aux modules 18 (patterns distribués) et 19 (résilience / consistency)**. Ici on décide **s'il faut** distribuer et **ce que ça coûte** ; on n'implémente pas la mécanique distribuée. Le détail NestJS relève du **cours 09**, la persistance du **cours 10**, la communication inter-services des **modules 16-17**.

## 1. Cas concret d'abord

TribuZen grossit. Le backend NestJS gère les routines familiales, les familles et co-référents, les notifications, et la synchronisation offline du mobile. Un contributeur revient d'une conférence et ouvre une issue :

> « On devrait passer en microservices : un service Routines, un service Family, un service Notifications, un service Sync. Chaque équipe déploie le sien, ça scale mieux. »

Sur le papier ça sonne moderne. Mais TribuZen, c'est **une personne** (toi) et bientôt deux. Le domaine bouge encore chaque semaine (le modèle des routines n'est pas figé). Et « compléter une routine » doit mettre à jour la série (streak) **et** déclencher une notification **dans la même transaction logique**.

Pose-toi les vraies questions avant de découper :

1. **Qui gagne quoi ?** Quatre services = quatre déploiements, quatre configs, potentiellement quatre bases, du tracing distribué pour suivre une seule requête. Pour une équipe de 1-2 personnes, cet **overhead** mange la productivité sans rien rendre.
2. **La transaction « compléter + notifier » devient-elle plus dure ?** Oui : ce qui était un appel local en base ACID devient un appel réseau entre deux services, avec gestion de panne, retries, et risque de double notification si le réseau bégaie.
3. **Qu'est-ce qui te bloque vraiment aujourd'hui ?** Rien, côté scaling. Ce qui te bloquerait sans discipline, c'est le **désordre interne** : le module Routines qui irait lire directement les tables du module Family.

La bonne réponse n'est presque jamais « microservices tout de suite ». C'est **monolithe modulaire** : un seul déployable, mais des **modules à frontières nettes** qui *pourraient* devenir des services le jour où une vraie contrainte (équipe, scale, cycle de vie) l'exige. Ce module te donne le cadre pour décider — et surtout pour dire **non**.

---

## 2. Théorie complète, concise

### 2.1 Deux axes à ne jamais confondre : découpage logique ≠ déploiement

C'est le piège de base. Il y a **deux questions indépendantes** :

- **Comment j'organise le code** (découpage *logique*) : en couches (module 05), en tranches verticales par feature, en modules par domaine.
- **Comment je déploie** (découpage *physique*) : un seul artefact (monolithe) ou N services déployables séparément (microservices).

Un monolithe peut être très bien découpé en modules internes. Des microservices peuvent être un plat de spaghettis. **Le déploiement ne crée pas l'ordre ; les frontières le créent.** Découper en modules est gratuit et réversible ; découper en services est cher et difficile à défaire.

### 2.2 Le monolithe modulaire : un déployable, des frontières internes

Un **monolithe modulaire** est un système où :

- **tout est déployé ensemble** (un seul artefact, un seul processus) ;
- mais le code est **organisé en modules autonomes** (`routines`, `family`, `notifications`, `sync`) ;
- chaque module **cache ses internals** et n'expose qu'une **API publique** ;
- les modules communiquent par cette API (ou par événements internes), jamais en fouillant dans les internes du voisin.

Il combine la **simplicité opérationnelle** du monolithe (un déploiement, transactions ACID natives, un débogage à stack trace complète) et la **lisibilité** des microservices (frontières claires).

**Analogie :** un immeuble d'appartements. Un seul bâtiment (un déployable), mais chaque appartement a sa serrure et ses murs. Tu veux quelque chose chez le voisin ? Tu sonnes à la porte (API), tu ne passes pas par le mur. L'opposé — un grand loft sans cloisons — c'est le *big ball of mud*.

### 2.3 Matérialiser la frontière : l'API publique de module (barrel file)

Une frontière qui n'est pas **imposée par le code** n'existe pas. Le mécanisme concret : chaque module expose un **barrel file** (`index.ts`) qui re-exporte **uniquement** son API publique. Tout le reste est privé.

```ts
// modules/family/index.ts — LA seule porte d'entrée du module Family
export { FamilyModule } from './family.module';
export { GetFamilyService } from './application/get-family.service';
export type { FamilySummary } from './domain/family.entity';
// PAS d'export du repository, de l'entité interne, du schéma Prisma : privés.
```

```ts
// modules/routines/application/complete-routine.service.ts

// INTERDIT — on fouille dans les internals du module Family (viole la frontière)
import { PrismaFamilyRepository } from '../../family/infrastructure/prisma-family.repository';

// AUTORISÉ — on passe par la porte publique du module Family
import { GetFamilyService } from '../../family';
```

Règle : **on n'importe jamais un sous-dossier interne d'un autre module.** Cette discipline peut être vérifiée automatiquement (ESLint `no-restricted-imports`, ou un test de frontière qui échoue si un import traverse un mur). C'est ce qui transforme un « on essaie de bien ranger » en une frontière **réelle**.

### 2.4 Vertical slice : découper par feature plutôt que par couche

Le layering (module 05) découpe **horizontalement** : tous les controllers ensemble, tous les services ensemble, tous les repositories ensemble. Ajouter une feature touche les trois dossiers.

La **vertical slice architecture** (Jimmy Bogard, « *features, not layers* ») découpe **verticalement** : un dossier par cas d'usage, contenant tout ce qu'il faut (entrée, validation, logique, accès données, sortie).

```
Layering (horizontal)          Vertical slice (par feature)
  controllers/                   features/
    routines.controller           complete-routine/
    family.controller               complete-routine.command.ts
  services/                         complete-routine.handler.ts
    routines.service                complete-routine.spec.ts
    family.service                list-routines/
  repositories/                     list-routines.query.ts
    ...                             list-routines.handler.ts   ← SQL direct, pas d'entité
```

Ce que ça achète : **changer une feature ne touche qu'un dossier**, conflits de merge rares, et chaque slice choisit sa stratégie (une lecture d'affichage peut faire du SQL direct sans passer par le domaine riche — *CQRS-lite*, approfondi au module 18). Ce que ça coûte : moins d'uniformité de style entre slices, et un partage de code qui doit rester **conscient et justifié** (entités du domaine, value objects — pas des « services universels » qui recréent une couche horizontale déguisée).

Retiens : vertical slice est un style de **découpage interne**, orthogonal au choix mono/micro. Un monolithe modulaire peut organiser chaque module en slices.

### 2.5 Les microservices : autonomie réelle, à un vrai prix

Un **microservice** est un service qui :

- est responsable d'un **domaine métier délimité** (un bounded context — module 09) ;
- possède **sa propre base de données** (personne d'autre ne la lit directement) ;
- est **déployable indépendamment** ;
- communique par **API** (REST, gRPC) ou **messagerie** (Kafka, RabbitMQ) — vu au module 16-17.

Le découpage se fait **par domaine métier**, jamais par couche technique. Un « service API », un « service logique », un « service données » = trois services qui changent toujours ensemble = un monolithe distribué déguisé (voir §2.7).

Le principe non négociable est **data per service** : chaque service **possède** ses données. Pas de `JOIN` SQL vers la table d'un autre service ; on passe par son API, ou on maintient une copie locale (read model) alimentée par événements. C'est cette isolation qui rend le déploiement réellement indépendant — et c'est aussi elle qui coûte cher (cohérence éventuelle, duplication).

### 2.6 Le cadre de décision — et pourquoi le défaut est le monolithe modulaire

**Le défaut, c'est le monolithe modulaire.** On ne « part pas en microservices » ; on **extrait** un service quand une contrainte réelle le justifie. Le cadre de décision, en cascade :

1. **As-tu plus de ~15-20 développeurs en équipes séparées ?** Non → monolithe modulaire. Les microservices résolvent d'abord un problème **organisationnel** (autonomie d'équipes), pas technique.
2. **Le domaine est-il stable et bien compris ?** Non (il bouge encore) → monolithe modulaire : refactorer une frontière **interne** est gratuit ; déplacer du code entre deux services déployés est très cher.
3. **Deux parties du système ont-elles des besoins de scaling franchement différents ?** Non → monolithe (tu scales l'artefact entier, c'est trivial). Oui → candidat à extraction ciblée.
4. **Es-tu prêt·e à payer la complexité opérationnelle ?** (orchestration type Kubernetes, tracing distribué, gestion de pannes réseau, cohérence éventuelle — modules 18-19) Non → n'y va pas encore.

Martin Fowler recommande, en substance (*MonolithFirst*, 2015), de **commencer par un monolithe bien découpé** dont les frontières de modules épousent de futures frontières de services, plutôt que de démarrer directement en microservices. Autrement dit : soigne tes **frontières de modules** dès maintenant, pour que l'extraction d'un service reste **possible** — sans la faire tant qu'elle n'est pas **nécessaire**.

### 2.7 Les trois anti-patterns distribués fatals

Si on découpe mal, on obtient le pire des deux mondes.

- **Monolithe distribué.** Des services physiquement séparés mais fortement couplés : ils doivent être déployés ensemble, un changement dans l'un force un changement dans les autres, ils s'appellent en chaîne synchrone ou partagent du code métier. On subit **toute** la complexité opérationnelle des microservices **sans** l'indépendance. C'est **pire** qu'un vrai monolithe.
- **Nano-services.** Découpage à l'excès : un service « calculer-le-total », un service « mettre-à-jour-le-statut ». Overhead opérationnel énorme (N déploiements, N bases, N pipelines) pour des opérations triviales, plus des appels réseau là où un appel de fonction suffisait.
- **Base de données partagée.** Deux services qui lisent/écrivent la même base. Le schéma devient un contrat implicite que personne ne peut changer sans coordonner tout le monde : l'indépendance de déploiement est détruite. Viole directement *data per service*.

### 2.8 12-factor : les deux facteurs qui conditionnent le scaling

L'app *twelve-factor* (Heroku, 2012) est une checklist pour des applications cloud-native. Deux facteurs sont **structurants pour la décision de découpage** :

- **Facteur III — Config dans l'environnement.** Aucun secret, aucune URL de base en dur dans le code. Tout vient de variables d'environnement (`process.env.DATABASE_URL`), validées au démarrage. Test : *« puis-je publier mon code source sans compromettre la sécurité ? »* Sans ça, pas de déploiement multi-environnement propre — encore moins multi-services.
- **Facteur VI — Processes stateless.** Un processus ne garde **aucun état** en mémoire entre deux requêtes. L'état vit dehors : Redis (sessions), PostgreSQL (données). Conséquence directe : on peut lancer N instances derrière un load balancer sans que « la session de Bob » soit coincée sur l'instance 1. **Le scaling horizontal — la vraie raison technique d'un jour découper — repose sur le stateless.** Un monolithe stateless scale déjà très loin ; c'est souvent tout ce dont on a besoin.

Les autres facteurs (dépendances déclarées, build/release/run séparés, logs comme streams, disposability / graceful shutdown) sont de la bonne hygiène cloud, mentionnés ici mais détaillés côté déploiement (cours 15).

### 2.9 Idempotence : rendre un retour de réseau sûr

Dès qu'il y a du réseau (entre services, ou entre le mobile et l'API), il y a des **timeouts** et des **retries**. Problème : si le client rejoue un `POST /payments` parce qu'il n'a pas reçu la réponse, il ne faut pas débiter deux fois.

> Une opération est **idempotente** si l'appliquer une ou plusieurs fois produit le même résultat que l'appliquer une seule fois. Formellement : `f(f(x)) = f(x)`.

- Naturellement idempotents : `PUT /users/123` (remplace), `DELETE /orders/456` (déjà supprimé → pas d'erreur).
- Non idempotents par défaut : `POST /orders`, `POST /payments`, incrémenter un compteur.

La technique standard : une **clé d'idempotence** (`Idempotency-Key`), un identifiant unique généré par le **client** (un UUID v4) **avant** l'appel et envoyé dans un header. Le serveur, à la première requête, traite et **stocke le résultat associé à la clé** ; à un retry avec la **même clé**, il **retourne le résultat mémorisé** sans re-exécuter. En pratique : `SET NX` atomique dans Redis pour poser un verrou (« premier arrivé traite »), puis stockage du résultat.

C'est ainsi qu'on obtient un comportement **exactly-once** perçu : *at-least-once* (le réseau peut livrer plusieurs fois) **+ idempotence côté serveur**. Ce module te fait **reconnaître** le besoin et nommer l'outil ; la mécanique complète (saga, compensation, cohérence éventuelle) est aux modules 18-19.

### 2.10 Le coût d'un système distribué (à internaliser)

Passer un appel local en appel réseau, ce n'est pas gratuit. Ce qui était **acquis** dans un monolithe devient **un problème à résoudre** :

| Dans un monolithe | Dans un système distribué |
|---|---|
| Appel de fonction (~microseconde), fiable | Appel réseau (~5-50 ms), peut échouer / timeouter |
| Transaction ACID native | Saga + cohérence éventuelle (modules 18-19) |
| Stack trace complète | Tracing distribué requis (corréler N services) |
| Refactorer une frontière = refactor interne | Déplacer du code entre services = coûteux |
| 1 déploiement, 1 config | N déploiements, N configs, orchestration |

C'est la fameuse règle : les microservices **échangent** de la complexité de code contre de la complexité **opérationnelle et de cohérence**. On ne fait ce troc que quand le bénéfice organisationnel ou de scaling est réel et **mesuré**.

---

## 3. Worked examples

### Exemple 1 — Décider mono vs micro pour TribuZen, avec justification

**Contexte donné :** TribuZen, équipe de 1 dev (bientôt 2), domaine des routines encore mouvant, charge actuelle modeste, une feature critique « compléter une routine → mettre à jour la série → notifier ». On applique le cadre du §2.6.

| Question du cadre | Réponse TribuZen | Conséquence |
|---|---|---|
| > 15-20 devs en équipes séparées ? | Non (1-2 devs) | → monolithe |
| Domaine stable et figé ? | Non (routines évoluent) | → monolithe (frontières internes réversibles) |
| Besoins de scaling franchement divergents ? | Non aujourd'hui | → monolithe |
| Prêt à payer K8s + tracing + saga ? | Non, et rien ne l'exige | → monolithe |

**Décision :** **monolithe modulaire**. Un seul déployable NestJS, découpé en modules `routines`, `family`, `notifications`, `sync`, chacun avec son `index.ts` public. La feature « compléter → série → notifier » reste une transaction locale (le module `notifications` s'abonne à un **événement interne** `RoutineCompleted`, pas à un appel réseau).

**Justification écrite (le livrable qui compte) :**

> On choisit le monolithe modulaire car aucune des quatre conditions d'extraction n'est remplie : équipe minuscule, domaine mouvant, scaling uniforme, appétit opérationnel nul. Le coût des microservices (4 déploiements, cohérence éventuelle sur « compléter + notifier », tracing) serait pur gaspillage. On **investit dans les frontières de modules** (barrel files + test de frontière) pour garder l'option d'extraire plus tard `notifications` (candidat naturel : effet de bord asynchrone, cycle de vie propre) **si** un jour l'envoi de push devient un goulot ou passe à une équipe dédiée.

Note le raisonnement : on ne dit pas « jamais de microservices », on dit « pas maintenant, et voici **la porte** qu'on garde ouverte et **le signal** qui la déclencherait ».

### Exemple 2 — Repérer les violations de frontière dans un monolithe modulaire

On te donne le graphe d'imports d'un monolithe modulaire TribuZen. Flèche = « importe ». Trouve ce qui casse les frontières.

```
routines/application  ──▶ family/index.ts                        (A)
routines/application  ──▶ family/infrastructure/prisma-family.repo (B)
notifications/app     ──▶ shared/event-bus (RoutineCompleted)     (C)
family/application    ──▶ routines/application/complete.service    (D)
sync/infrastructure   ──▶ SELECT ... FROM routines_table (SQL direct) (E)
```

Analyse :

- **(A)** `routines` importe `family` via son **barrel public** : **OK**. C'est la porte prévue.
- **(B)** `routines` importe un **sous-dossier interne** (`infrastructure/...`) de `family` : **violation de frontière**. Le jour où `family` change son ORM, `routines` casse. Corriger en passant par `family/index.ts`.
- **(C)** `notifications` s'abonne à un événement interne via le bus partagé : **OK** — couplage par le **message**, pas par la classe. C'est même le bon design pour garder `notifications` extractible plus tard.
- **(D)** `family` importe `routines` alors que `routines` importe déjà `family` (via A) : **dépendance circulaire** entre modules. Symptôme d'une frontière mal placée : soit une responsabilité est dans le mauvais module, soit il faut inverser via un événement.
- **(E)** `sync` fait un `SELECT` direct dans la **table** d'un autre module : **violation de *data per service*** appliqué en interne. Même dans un monolithe, un module ne lit pas les tables privées d'un autre ; il passe par son API. Sinon l'extraction future est impossible (la base est partagée de fait).

**Verdict :** trois problèmes (B, D, E). A et C sont exemplaires. Le correctif de B et E, c'est « passe par la porte publique » ; celui de D, c'est repenser la frontière ou remplacer l'appel direct par un événement.

---

## 4. Pièges & misconceptions

### PIÈGE #1 — « Microservices = architecture moderne, donc mieux »

Faux. Les microservices sont une **réponse à un problème d'échelle organisationnelle**, pas un niveau de qualité. Pour une petite équipe sur un domaine mouvant, ils **dégradent** la productivité (overhead opérationnel, cohérence éventuelle, débogage distribué) sans rien apporter. Le défaut sain est le **monolithe modulaire**. La question n'est jamais « micro ou pas ? » mais « ai-je une contrainte réelle qui *force* l'extraction ? ».

### PIÈGE #2 — Confondre découpage logique et style de déploiement

« J'ai bien découpé en modules, donc c'est presque des microservices. » Non : découper le **code** (couches, slices, modules) et découper le **déploiement** (1 vs N artefacts) sont deux axes indépendants. Un monolithe peut être parfaitement modulaire ; des microservices peuvent être un big ball of mud distribué. Le déploiement ne range pas le code — **les frontières le rangent**.

### PIÈGE #3 — Le monolithe distribué (le pire des deux mondes)

Découper en services **sans** couper le couplage, c'est obtenir un **monolithe distribué** : services déployés ensemble, appels synchrones en chaîne, base partagée. On paie tout le prix des microservices (réseau, orchestration, tracing) et on n'a aucun de leurs bénéfices (déploiement indépendant, autonomie). Symptôme diagnostique : *« puis-je déployer le service A sans redéployer B, C, D ? »* Si non, ce ne sont pas des microservices.

### PIÈGE #4 — Croire qu'un monolithe modulaire tolère les accès directs entre modules

Un monolithe partage **un** processus et souvent **une** base — donc techniquement rien n'empêche `routines` de faire un `JOIN` vers les tables de `family`. C'est justement le piège : ce qui est *possible* n'est pas *autorisé*. Sans frontière imposée (barrel + lint + « data per module »), le monolithe modulaire redevient un big ball of mud en quelques sprints. La modularité est une **discipline outillée**, pas une intention.

### PIÈGE #5 — Découper trop tôt / trop fin (nano-services)

Extraire un service par cas d'usage (« un service pour calculer le total ») multiplie les déploiements, les bases et les appels réseau pour des opérations triviales — un coût sans valeur. Un microservice doit correspondre à un **bounded context** (un domaine cohérent avec son propre cycle de vie), pas à une fonction. En doute : garde-le comme **module** dans le monolithe.

### PIÈGE #6 — « L'idempotence, c'est juste réessayer »

Non. Réessayer une opération **non** idempotente crée des doublons (double paiement, double notification). L'idempotence est une **propriété** que l'opération doit posséder : rejouée N fois, effet identique à une fois. On l'obtient côté serveur (clé d'idempotence + résultat mémorisé), pas en espérant que « ça passe ». Le retry est sûr **seulement** si l'opération est idempotente.

---

## 5. Ancrage TribuZen

TribuZen est, et restera longtemps, un **monolithe modulaire** NestJS — c'est le choix explicite issu du cadre de décision (Exemple 1). L'enjeu du module n'est pas « faut-il des microservices » (la réponse est non) mais « comment poser des frontières internes assez nettes pour ne jamais avoir à le regretter ».

Découpage cible du backend :

```
tribuzen-api/
  src/
    modules/
      routines/
        index.ts            ← API publique (CompleteRoutineService, RoutineSummary)
        presentation/  application/  domain/  infrastructure/
      family/
        index.ts            ← API publique (GetFamilyService, FamilySummary)
        ...                   (co-référents, capacité max 8, cf. modèle éco « Famille »)
      notifications/
        index.ts            ← s'abonne à RoutineCompleted via le bus interne
      sync/
        index.ts            ← réconciliation offline du mobile (batch au retour réseau)
    shared/
      event-bus.ts          ← communication interne par message entre modules
```

Décisions concrètes pour TribuZen :

- **Frontières imposées, pas espérées.** Chaque module a son `index.ts` ; un test de frontière (ou une règle ESLint `no-restricted-imports`) échoue si `routines` importe un sous-dossier de `family`. C'est ce qui garde l'option d'extraction ouverte.
- **« Compléter une routine » reste local.** La série (streak) est calculée dans le domaine `routines` ; la notification part via un **événement interne** `RoutineCompleted` consommé par `notifications`. Zéro appel réseau, transaction locale — mais le couplage est déjà **par message**, donc `notifications` est extractible plus tard sans réécrire `routines`.
- **Le mobile impose l'idempotence, tout de suite.** Le module `sync` pousse des complétions de routines en **batch** au retour réseau (React Query / MMKV côté RN). Un retour de tunnel qui rejoue le batch ne doit pas doubler les complétions : chaque complétion porte une **clé d'idempotence** (UUID généré sur le device), et l'API renvoie le résultat mémorisé sur un rejeu. C'est le seul endroit où l'idempotence est **non négociable dès la v1**, précisément parce qu'il y a du réseau non fiable.
- **Stateless obligatoire (Facteur VI).** L'API TribuZen ne garde aucune session en mémoire — tout va en base / Redis — pour pouvoir lancer plusieurs instances derrière un load balancer si la charge monte. C'est le scaling **suffisant** pour très longtemps, sans découper en services.
- **Candidat d'extraction identifié (pas exécuté).** Si un jour l'envoi de push devient un goulot ou passe à une équipe dédiée, `notifications` est le premier candidat : effet de bord asynchrone, cycle de vie propre, déjà couplé par événement. On l'extrairait **alors** — pas avant.

> **Défère :** la mécanique distribuée réelle (saga « compléter + notifier + facturer », cohérence éventuelle, event sourcing) est aux **modules 18-19**. La communication inter-services (message broker, contrats d'événements) aux **modules 16-17**. Le détail NestJS (providers, modules dynamiques) au **cours 09**. Ici on décide **le style** et on pose **les frontières**.

---

## 6. Points clés

1. **Deux axes indépendants :** découpage *logique* (couches / slices / modules) ≠ style de *déploiement* (monolithe / microservices). Le déploiement ne range pas le code ; les frontières le rangent.
2. **Le défaut, c'est le monolithe modulaire :** un déployable, des modules à frontières explicites (API publique via barrel file, pas d'accès aux internals ni aux tables du voisin).
3. **Vertical slice** = découper par feature (« *features, not layers* »), orthogonal au choix mono/micro : changer une feature ne touche qu'un dossier.
4. **On n'entre pas en microservices, on extrait un service** quand une contrainte réelle l'exige : équipe nombreuse et séparée, domaine stable, scaling divergent, appétit opérationnel assumé.
5. **Trois anti-patterns fatals :** monolithe distribué (couplage sans indépendance), nano-services (découpage sans valeur), base partagée (couplage de schéma). *Data per service* est non négociable.
6. **12-factor structurant :** config externalisée (III) et processes stateless (VI) — le stateless est ce qui permet le scaling horizontal, souvent suffisant sans découper.
7. **Idempotence :** `f(f(x)) = f(x)`. Une clé d'idempotence (générée par le client, header `Idempotency-Key`) rend les retries sûrs — indispensable dès qu'il y a du réseau non fiable (sync mobile TribuZen).
8. **Le distribué a un coût :** appel réseau faillible, cohérence éventuelle, tracing, N déploiements. On échange de la complexité de code contre de la complexité opérationnelle — seulement si le bénéfice est réel.

---

## 7. Seeds Anki

```
Quelle est la différence entre découpage logique et style de déploiement ?|Le découpage logique organise le CODE (couches, slices, modules) ; le style de déploiement organise les ARTEFACTS (1 monolithe vs N microservices). Ce sont deux axes indépendants : un monolithe peut être très modulaire, des microservices peuvent être un big ball of mud.
Qu'est-ce qu'un monolithe modulaire ?|Un seul déployable dont le code est organisé en modules autonomes à frontières explicites : chaque module cache ses internals et n'expose qu'une API publique (barrel file). Il combine la simplicité opérationnelle du monolithe et la clarté des microservices.
Quel est le style de déploiement par défaut, et pourquoi ?|Le monolithe modulaire. On n'entre pas en microservices, on extrait un service seulement si une contrainte réelle l'exige (équipe nombreuse et séparée, domaine stable, scaling divergent, complexité opérationnelle assumée). Découper en services est cher et dur à défaire ; découper en modules est gratuit et réversible.
Cite les trois anti-patterns distribués fatals.|1) Monolithe distribué : services couplés déployés ensemble (pire qu'un monolithe). 2) Nano-services : découpage trop fin, overhead sans valeur. 3) Base de données partagée : couplage de schéma qui tue l'indépendance de déploiement. Data per service est non négociable.
Qu'est-ce qu'un barrel file dans un monolithe modulaire ?|Un fichier index.ts qui re-exporte uniquement l'API publique d'un module ; tout le reste est privé. Les autres modules importent seulement via ce fichier, jamais dans les sous-dossiers internes. C'est ce qui matérialise et fait respecter la frontière (vérifiable par lint/test).
Qu'est-ce que la vertical slice architecture ?|Organiser le code par feature (CreateRoutine, ListRoutines) plutôt que par couche technique (« features, not layers »). Chaque slice contient tout ce dont elle a besoin ; changer une feature ne touche qu'un dossier. Orthogonal au choix mono/micro.
Définis l'idempotence et le rôle d'une clé d'idempotence.|Une opération est idempotente si l'appliquer N fois donne le même résultat qu'une fois : f(f(x)) = f(x). Une clé d'idempotence (UUID généré par le client, header Idempotency-Key) permet au serveur de mémoriser le résultat et de le renvoyer sur un retry, sans re-exécuter — rendant les retours de réseau (retries) sûrs.
Pourquoi les processes stateless (12-factor VI) comptent pour le scaling ?|Un process stateless ne garde aucun état en mémoire entre requêtes (l'état vit dans Redis/PostgreSQL). On peut donc lancer N instances derrière un load balancer sans qu'une session soit coincée sur une instance. Le scaling horizontal — vraie raison technique d'un jour découper — repose sur le stateless, et un monolithe stateless scale déjà très loin.
Quel est le coût d'un système distribué par rapport à un monolithe ?|On échange de la complexité de code contre de la complexité opérationnelle : appel réseau faillible (~5-50 ms) au lieu d'un appel local fiable, saga + cohérence éventuelle au lieu de transaction ACID, tracing distribué au lieu d'une stack trace, N déploiements/configs au lieu d'un. On ne paie ce prix que si le bénéfice (organisationnel ou de scaling) est réel.
```

---

## Pont vers le lab

> Lab associé : `labs/lab-08-monolithe-modulaire-vs-microservices/README.md`. Décider mono vs micro pour TribuZen avec justification écrite, puis découper le backend en modules à frontières nettes et repérer les violations de frontière. Exercice de conception/décision, évalué par grille + coach + variante J+30 — zéro harnais.
