---
titre: API design et backend patterns
cours: 13-architecture
notions: ["ressource vs endpoint", "contrat d'API", "verbes HTTP et codes de retour", "actions non-CRUD", "versioning d'API", "pipeline middleware (cross-cutting concerns)", "ordre du pipeline et court-circuit", "Repository pattern", "Unit of Work", "Active Record vs Data Mapper", "validation en couches (format / règle / persistance)", "erreurs structurées (Problem Details / RFC 9457, ex-7807)", "fail-fast"]
outcomes:
  - "sait concevoir le contrat d'une API REST au niveau archi : modéliser les ressources, choisir verbes et codes, exprimer une action non-CRUD"
  - "sait décider d'une stratégie de versioning d'API et justifier son coût"
  - "sait placer les préoccupations transverses (auth, log, validation, erreurs) dans un pipeline middleware ordonné et raisonner sur le court-circuit"
  - "sait choisir un pattern d'accès aux données (Repository, Unit of Work, Data Mapper vs Active Record) selon le couplage domaine/infra voulu"
  - "sait organiser la validation en couches et concevoir un format d'erreur structuré et stable"
prerequis: ["Module 00 — posture d'architecte", "Module 01 — principes SOLID (SRP, DIP)", "Module 04 — dependency injection / IoC", "Module 05 — architecture en couches", "Module 06 — architecture hexagonale (ports & adapters)", "Module 07 — clean architecture", "Module 10 — DDD tactique (entités, agrégats, invariants)"]
next: 12-jobs-concurrence-async
libs: []
tribuzen: "backend NestJS de TribuZen — conception du contrat d'API du module Routines/Familles : ressources, erreurs, validation, couche d'accès aux données"
last-reviewed: 2026-07
---

# API design et backend patterns

> **Outcomes — tu sauras FAIRE :** concevoir le contrat d'une API REST (ressources, verbes, codes, actions non-CRUD), décider d'une stratégie de versioning, ordonner un pipeline middleware pour les préoccupations transverses, choisir un pattern d'accès aux données (Repository / Unit of Work / Data Mapper vs Active Record), et structurer validation et erreurs de façon stable.
> **Difficulté :** :star::star::star:
>
> **Portée :** ce module raisonne **archi backend** — les **décisions de forme** d'une API et les **patterns** qui structurent la couche de service et d'accès aux données. On conçoit un **contrat** et on choisit des **patterns**, on n'implémente pas. Les frontières fermes :
> - L'**implémentation NestJS** (modules, providers, décorateurs, `class-validator`, filtres d'exception concrets) = **cours 09**. Ici, pas de code de framework lourd.
> - Le **SQL, le schéma, les requêtes, l'ORM en détail** = **cours 10**. Ici, on parle du *pattern* Repository, pas de la requête.
> - Le **HTTP fin** — cache, ETag, verrouillage optimiste `If-Match`/412, négociation de contenu, upload via presigned URL, pagination et perf — = **cours 11 (HTTP & caching)**. On les **nomme et renvoie**, on ne les déroule pas.
> - La **concurrence, les transactions longues, les jobs** = **module 12** (suivant). Le Unit of Work est vu ici comme *pattern de cohérence transactionnelle*, sa mécanique concurrente est déférée.

## 1. Cas concret d'abord

Tu conçois l'API du backend NestJS de TribuZen. Un contributeur propose ce premier jet de « contrat » pour gérer les routines et leur complétion :

```
POST /createRoutine          { familyId, childId, title }
POST /getRoutines            { familyId }
POST /updateRoutineTitle     { routineId, title }
POST /completeRoutineToday   { routineId, childId }
POST /deleteRoutine          { routineId }
GET  /routineError           → { "error": "something went wrong" }
```

Ça « marche » : le front peut appeler ces URL. Mais pose-toi cinq questions d'architecte, **avant** d'écrire la moindre ligne de NestJS :

1. **Où sont les ressources ?** Ces URL sont des **verbes déguisés** (`createRoutine`, `getRoutines`). Le client doit apprendre un nom de fonction par action. Il n'y a aucune **structure** : rien ne dit qu'une routine appartient à une famille, ni qu'une complétion est un sous-objet d'une routine.
2. **Où est passé HTTP ?** Tout est `POST`. Le verbe HTTP porte déjà une sémantique (lire, créer, remplacer, supprimer) et des garanties (une lecture ne modifie rien, une suppression répétée a le même effet). En mettant tout en `POST`, on jette gratuitement cette information.
3. **Comment le client sait-il ce qui a échoué ?** `{ "error": "something went wrong" }` : un client mobile hors-ligne ne peut pas distinguer « routine introuvable » (ne pas réessayer) de « conflit temporaire » (réessayer plus tard). Le **contrat d'erreur** est aussi important que le contrat de succès.
4. **Qui valide quoi ?** `title` vide ? `childId` d'un enfant d'une autre famille ? Rien ne dit **où** ces vérifications vivent, ni comment elles remontent au client.
5. **Comment ce contrat va-t-il vieillir ?** Le jour où l'app mobile v1 est déployée chez des utilisateurs et qu'on veut changer la forme d'une routine, comment ne pas casser les apps déjà installées ?

Ce module te donne le vocabulaire pour transformer ce pêle-mêle en un **contrat d'API** : des **ressources** exposées via des verbes HTTP et des codes de retour, un pipeline qui range les préoccupations transverses (auth, log, validation, erreurs), un pattern d'accès aux données qui protège le domaine, et un format d'erreur stable. On décide **la forme**, pas l'implémentation.

---

## 2. Théorie complète, concise

### 2.1 Ressource vs endpoint : le décalage fondateur de REST

Une **ressource** est un **nom** — une chose du domaine qu'on peut identifier : une routine, une famille, une complétion. Un **endpoint** est une **URL + un verbe** qui agit sur une ressource. La bascule mentale de REST : tu ne conçois pas une **liste de fonctions distantes** (`createRoutine`, `getRoutines`), tu conçois un **ensemble de ressources** sur lesquelles s'appliquent quelques verbes standard.

```
Style RPC (verbes dans l'URL)      Style ressource (REST)
─────────────────────────────      ─────────────────────────────
POST /createRoutine                POST   /routines
POST /getRoutines                  GET    /routines
POST /getRoutine                   GET    /routines/{{id}}
POST /updateRoutineTitle           PATCH  /routines/{{id}}
POST /deleteRoutine                DELETE /routines/{{id}}
```

L'intérêt : le client apprend **un** modèle (des ressources + 5 verbes) au lieu d'**un nom de fonction par action**. Les URL deviennent **prévisibles** : si <code v-pre>/routines/{{id}}</code> existe, tu devines `/routines`.

### 2.2 Le contrat d'API : ce que tu promets, indépendamment de l'impl

Le **contrat** est l'ensemble des promesses faites au client : quelles ressources existent, quels verbes elles acceptent, quelle forme ont les corps de requête/réponse, quels codes et quelles erreurs sont possibles. C'est **l'interface publique** de ton backend — au sens du module 01 (ISP) et du module 06 (le contrat est un *port* côté entrant).

Propriété clé : le contrat est **stable et découplé de l'implémentation**. Derrière <code v-pre>GET /routines/{{id}}</code>, tu peux changer d'ORM, de base, de langage — tant que la **forme** ne change pas, aucun client ne casse. C'est l'analogie du menu de restaurant : le client commande « entrecôte à point » sans connaître la cuisine ; changer de four ne change pas le menu.

### 2.3 Verbes HTTP et codes de retour : de la sémantique gratuite

Chaque verbe HTTP porte une **sémantique** et deux propriétés qui aident à raisonner :

| Verbe | Sur `/routines` | Sur <code v-pre>/routines/{{id}}</code> | Sûr (safe) | Idempotent |
|-------|-----------------|------------------------|:----------:|:----------:|
| GET | lister | lire | oui | oui |
| POST | créer | — | non | non |
| PUT | — | remplacer entièrement | non | oui |
| PATCH | — | modifier partiellement | non | non* |
| DELETE | — | supprimer | non | oui |

- **Sûr** = ne modifie pas l'état serveur (les lectures). Un proxy peut les mettre en cache, un client peut les rejouer sans risque.
- **Idempotent** = rejouer la même requête donne le même état final. `DELETE /routines/42` deux fois → la routine est supprimée, point (le 2ᵉ appel renvoie 404, mais l'**état** est identique). C'est ce qui rend une API **réessayable** — crucial pour un client mobile offline qui rejoue une file d'actions au retour réseau. (*PATCH peut être conçu idempotent ou non selon l'opération.)

Les **codes de retour** sont la première ligne du contrat d'erreur. À connaître au niveau archi :

| Code | Sens | Le client doit… |
|------|------|-----------------|
| 200 / 201 / 204 | OK / créé / OK sans corps | continuer |
| 400 | requête malformée (syntaxe) | corriger la requête |
| 401 / 403 | non authentifié / interdit | se (ré)authentifier / abandonner |
| 404 | ressource inexistante | ne **pas** réessayer |
| 409 | conflit (unicité, état) | rafraîchir puis réessayer |
| 422 | entité non traitable (validation métier) | afficher les violations, corriger |
| 429 | trop de requêtes | attendre puis réessayer |
| 5xx | erreur serveur | réessayer avec back-off |

Le choix du code **est** une décision d'architecture : il dit au client **quoi faire**. Distinguer 404 (n'insiste pas) de 409 (réessaie) de 422 (corrige) évite au front de deviner.

> Le **détail HTTP fin** — négociation de contenu, cache, ETag/`If-Match`, 304, 412 pour verrouillage optimiste — est **déféré au cours 11**. Ici on retient : *le code exprime l'action attendue du client*.

### 2.4 Actions non-CRUD : quand le verbe n'est pas un CRUD

Toutes les opérations ne se plient pas à créer/lire/modifier/supprimer. « Compléter une routine aujourd'hui », « archiver une routine », « inviter un co-référent » sont des **actions métier**. Trois options, par ordre de préférence archi :

1. **Modéliser l'action comme une sous-ressource** qu'on crée : compléter = créer une complétion → <code v-pre>POST /routines/{{id}}/completions</code>. Le plus RESTful : la complétion **est** une ressource (elle a une date, un enfant, un id).
2. **Changer d'état via la ressource** : archiver = <code v-pre>PATCH /routines/{{id}}</code> avec `{ status: "archived" }`, quand c'est un simple champ.
3. **Endpoint d'action explicite** quand ni l'un ni l'autre ne colle : <code v-pre>POST /routines/{{id}}/archive</code>. Assumé, pas honteux — mais à réserver aux vraies actions (effet de bord, transition d'état non trivial), pas à un déguisement de CRUD.

Le piège : tout transformer en endpoint d'action (`/doThis`, `/doThat`) et revenir au style RPC. Cherche d'abord la **ressource cachée** derrière l'action.

### 2.5 Versioning d'API : faire vieillir un contrat sans casser les clients

Dès qu'un client que tu ne contrôles pas dépend de ton API (app mobile déployée, partenaire), tu ne peux plus **casser** le contrat librement. Le versioning gère l'évolution :

- **Changement rétrocompatible** (ajouter un champ optionnel, un nouvel endpoint) : **pas** besoin de nouvelle version. Règle de robustesse : un client tolérant ignore les champs qu'il ne connaît pas.
- **Changement cassant** (retirer/renommer un champ, changer un type, durcir une validation) : nécessite une **nouvelle version**.

Stratégies courantes :

| Stratégie | Exemple | Remarque |
|-----------|---------|----------|
| Version dans l'URL | `/v1/routines`, `/v2/routines` | La plus visible et cache-friendly ; la plus répandue |
| Version dans un header | `Accept: application/vnd.tribuzen.v2+json` | URL « propre » mais moins visible/debuggable |
| Pas de version, évolution additive seule | jamais de breaking change | Idéal si faisable, discipline forte |

Le **coût** du versioning est réel : maintenir 2 versions = 2 chemins de code, 2 jeux de tests, une stratégie de dépréciation (annoncer, laisser une fenêtre, retirer). D'où la règle : **versionne le moins possible**, privilégie les changements additifs, et ne crée une v2 que pour un vrai breaking change. Pour TribuZen (app mobile déployée chez des familles), le versioning par URL est le choix par défaut : une app v1 installée continue d'appeler `/v1` pendant que `/v2` sert les nouvelles.

### 2.6 Le pipeline middleware : ranger les préoccupations transverses

Certaines préoccupations ne concernent **aucune** ressource en particulier : logguer chaque requête, vérifier l'authentification, valider le corps, formater les erreurs. Ce sont des **préoccupations transverses** (*cross-cutting concerns*). Les répéter dans chaque handler = duplication massive et oublis. Le **pipeline middleware** les extrait en **étapes ordonnées** que **toute** requête traverse avant/après le handler.

```
REQUÊTE ─▶ [ log ] ─▶ [ auth ] ─▶ [ autorisation ] ─▶ [ validation ] ─▶ HANDLER
                                                                            │
RÉPONSE ◀─ [ formatage erreurs ] ◀─ [ transformation réponse ] ◀──────────┘
```

Deux propriétés d'architecture à retenir :

1. **L'ordre est une décision.** Authentifier **avant** d'autoriser (savoir *qui* avant de décider *a-t-il le droit*). Valider **après** l'auth (inutile de valider le corps d'un intrus). Un mauvais ordre = faille ou travail gaspillé.
2. **Le court-circuit.** Une étape peut **arrêter** la chaîne : si l'auth échoue (401), la validation et le handler ne s'exécutent **jamais**. C'est l'analogie de la chaîne de montage : une station qui détecte un défaut rejette la pièce, les stations suivantes ne la voient pas.

Chaque étape a **une** responsabilité (SRP à l'échelle du pipeline). Le handler, lui, ne fait plus que traduire « requête validée → appel métier → réponse ». La déclinaison exacte en NestJS (middleware / guards / interceptors / pipes / exception filters, et leur ordre précis) est **déférée au cours 09** — ici on retient le **principe** : préoccupations transverses = étapes ordonnées, court-circuitables.

### 2.7 Patterns d'accès aux données : découpler le domaine du stockage

La couche métier doit manipuler des **objets du domaine**, pas des lignes SQL. Quatre patterns structurent ce passage, du plus couplé au plus découplé :

**Active Record** — l'entité **hérite** d'une classe de base et **sait se persister** : `routine.save()`, `routine.delete()`. L'objet métier « connaît » la base.

```ts
// Active Record : l'entité parle à la base elle-même
class Routine extends BaseModel {
  title: string;
  async archive() {
    this.status = 'archived';
    await this.save();  // l'entité connaît la persistance
  }
}
```

- **+** rapide à écrire, peu de cérémonie — excellent pour du CRUD simple, du prototypage.
- **–** l'entité est **couplée** à l'ORM/la base : difficile à tester sans base, et le domaine dépend de l'infra (contraire à ce que veulent hexagonale/clean, modules 06-07).

**Data Mapper** — l'entité est **pure** (aucune référence à la base). Un **mapper** séparé traduit entité ↔ ligne de stockage.

```ts
// Data Mapper : l'entité ignore tout de la base
class Routine {                       // domaine pur, testable sans base
  constructor(readonly id: string, private status: RoutineStatus) {}
  archive() {
    if (this.status === RoutineStatus.Archived) throw new DomainError('déjà archivée');
    this.status = RoutineStatus.Archived;
  }
}
class RoutineMapper {                 // vit dans l'infrastructure
  toDomain(row: RoutineRow): Routine { /* row -> entité */ }
  toPersistence(r: Routine): RoutineRow { /* entité -> row */ }
}
```

- **+** domaine totalement découplé, testable, portable — c'est ce qu'exigent DDD tactique (module 10) et l'hexagonale.
- **–** plus de code (le mapping), justifié seulement si le domaine a de vraies règles.

**Repository** — expose au domaine une interface **façon collection** (`findById`, `save`, `remove`), **définie dans le domaine**, **implémentée dans l'infra**. C'est le pattern-clé pour respecter la règle de dépendance (modules 05-07) : le métier dépend de l'**interface**, pas de Prisma.

```ts
// Interface : vit dans le DOMAINE, ne connaît aucune techno de stockage
interface RoutineRepository {
  findById(id: string): Promise<Routine | null>;
  save(routine: Routine): Promise<void>;
  remove(routine: Routine): Promise<void>;
}
```

Règles du Repository : (1) l'interface est **dans le domaine** ; (2) il retourne des **entités**, pas des rows ; (3) **un repository par agrégat**, pas par table ; (4) il encapsule la requête — le domaine ignore si c'est SQL, Mongo ou un fichier. Repository et Data Mapper se **combinent** naturellement (le repo utilise un mapper en interne).

**Unit of Work** — regroupe plusieurs modifications (créations, updates, suppressions) et les **commit en une seule transaction**, garantissant la **cohérence** : tout passe ou rien ne passe. Il traque les entités « sales » et écrit tout d'un coup.

```
Unit of Work
  nouvelles : [Completion]      commit() → BEGIN
  modifiées : [Routine]                    INSERT Completion
  supprimées: []                           UPDATE Routine
                                          COMMIT   (atomique)
```

En pratique, les ORM (TypeORM, Prisma via `$transaction`, Doctrine) **fournissent** le Unit of Work — tu le codes rarement à la main. Au niveau archi, retiens : *c'est le pattern qui garantit qu'un cas d'usage écrit ses données de façon atomique*. La **mécanique transactionnelle sous concurrence** (isolation, verrous, deadlocks) est déférée — SQL au **cours 10**, concurrence au **module 12** (suivant).

Tableau de décision :

| Pattern | Couplage domaine/base | Testabilité | Quand le choisir |
|---------|:---------------------:|:-----------:|------------------|
| Active Record | fort | faible | CRUD simple, prototype, pas de vraies règles |
| Data Mapper | nul | excellente | domaine riche à isoler (DDD) |
| Repository | nul (interface) | excellente | dès qu'on veut respecter la règle de dépendance |
| Unit of Work | — | — | cohérence transactionnelle multi-entités d'un cas d'usage |

### 2.8 Validation en couches et erreurs structurées

La validation n'arrive **pas** en un seul endroit. Elle se fait à **trois niveaux**, chacun répondant à une question différente :

```
Requête ─▶ 1. FORMAT        (présentation / DTO)   « la donnée a-t-elle la bonne forme ? »
                             title est-il une string non vide ? childId un UUID ?   → 400 / 422
        ─▶ 2. RÈGLE MÉTIER  (domaine)               « l'action est-elle permise ? »
                             la routine est-elle archivée ? l'enfant est-il de cette famille ? → 422 / 409
        ─▶ 3. PERSISTANCE   (infrastructure)        « la base l'accepte-t-elle ? »
                             contrainte d'unicité, clé étrangère                     → 409
```

Le principe directeur est le **fail-fast** : rejeter **au plus tôt**, au niveau le plus proche de l'entrée. Inutile de charger l'entité si le `title` est vide. **Exception** : pour la validation de **format**, on **collecte** toutes les erreurs d'un coup (sinon le client corrige un champ, resoumet, découvre le suivant, etc.) — on renvoie **la liste** des violations.

Ne **pas** confondre les niveaux : « le rôle est une string » = format (couche 1) ; « le rôle est un rôle TribuZen autorisé » = règle métier (couche 2). C'est le même piège qu'au module 05.

Enfin, les erreurs elles-mêmes font partie du **contrat** et doivent avoir une **forme stable et structurée**, pas des chaînes ad hoc. Le standard de référence est **Problem Details** (RFC 9457, ex-7807) : un objet uniforme avec `type`, `title`, `status`, `detail`, `instance`, et une extension `violations` pour le détail par champ.

```json
{
  "type": "https://api.tribuzen.app/problems/validation-error",
  "title": "Validation Error",
  "status": 422,
  "detail": "Le corps de la requête contient des champs invalides.",
  "instance": "/v1/routines/42/completions",
  "violations": [
    { "field": "childId", "message": "enfant absent de cette famille" }
  ]
}
```

Pourquoi structurer : un front peut **mapper** chaque code/champ à un comportement (afficher sous le bon champ, rejouer, rediriger) sans parser une phrase. Et jamais **exposer les détails internes** (stack, requête SQL) sur un 500 : côté client, message générique ; côté serveur, log complet. Le format d'erreur est un contrat : le figer tôt évite que chaque endpoint invente le sien.

---

## 3. Worked examples

### Exemple 1 — Concevoir le contrat de « compléter une routine » pour TribuZen

On reprend le pêle-mêle RPC du §1 et on conçoit le **contrat** (pas le NestJS). But : ressources claires, verbes justes, codes sémantiques, erreurs structurées.

**Étape A — Identifier les ressources.** Les noms du domaine : `Family`, `Routine`, `Completion`. Une routine appartient à une famille ; une complétion appartient à une routine. D'où une hiérarchie d'URL (imbrication ≤ 2 niveaux) :

```
/families/{{familyId}}/routines            collection de routines d'une famille
/routines/{{id}}                            une routine
/routines/{{id}}/completions                les complétions d'une routine
```

**Étape B — Mapper les opérations sur des verbes.**

| Opération (métier) | Endpoint | Code succès | Pourquoi |
|--------------------|----------|:-----------:|----------|
| Lister les routines d'une famille | <code v-pre>GET /families/{{familyId}}/routines</code> | 200 | lecture, sûre, idempotente |
| Créer une routine | <code v-pre>POST /families/{{familyId}}/routines</code> | 201 | création → 201 |
| Lire une routine | <code v-pre>GET /routines/{{id}}</code> | 200 | lecture |
| Renommer une routine | <code v-pre>PATCH /routines/{{id}}</code> | 200 | modification partielle d'un champ |
| Archiver une routine | <code v-pre>PATCH /routines/{{id}}</code> `{status:"archived"}` | 200 | transition d'état = champ |
| **Compléter aujourd'hui** | <code v-pre>POST /routines/{{id}}/completions</code> | 201 | **action non-CRUD → sous-ressource créée** |
| Supprimer une routine | <code v-pre>DELETE /routines/{{id}}</code> | 204 | suppression, idempotente |

Le point de conception clé : « compléter » n'est **pas** un `POST /completeRoutineToday`. C'est **créer une complétion** — une ressource qui a une date, un enfant, un id. On a trouvé la ressource cachée derrière l'action (§2.4).

**Étape C — Le contrat d'erreur de la complétion.** Trois échecs possibles, trois codes :

| Situation | Code | Corps (Problem Details) |
|-----------|:----:|-------------------------|
| Routine inexistante | 404 | `type: .../routine-not-found` — le client n'insiste pas |
| Routine archivée (règle métier) | 422 | `type: .../routine-archived`, `detail` explicite |
| Déjà complétée aujourd'hui | 409 | `type: .../already-completed` — conflit d'état |

**Ce que le contrat achète :** un client mobile offline qui rejoue sa file d'actions sait, **sans deviner**, s'il doit abandonner (404), corriger/afficher (422) ou considérer l'action déjà faite (409). Et comme `POST /completions` crée une ressource identifiée, on peut plus tard rendre l'opération réessayable proprement (déduplication par clé), sujet déféré au module 12.

### Exemple 2 — Choisir le pattern d'accès aux données du module Routines

On te demande : « Active Record (comme `routine.save()`) ou Repository + Data Mapper ? »

Analyse par critères :

- **Y a-t-il de vraies règles métier ?** Oui : « archivée non complétable », calcul de série, capacité famille. → le domaine doit être **riche et isolé** (module 10). Active Record couplerait ces règles à l'ORM.
- **Veut-on tester les règles sans base ?** Oui (c'est tout l'intérêt des modules 05-07). → Data Mapper (entité pure) + Repository (interface mockable).
- **Le domaine doit-il ignorer Prisma ?** Oui, décision prise au module 05/06. → interface `RoutineRepository` **dans le domaine**, implémentation Prisma **dans l'infra**.
- **Y a-t-il des écritures multi-entités à rendre atomiques ?** Compléter = créer une `Completion` + éventuellement mettre à jour un compteur sur `Routine`. → un **Unit of Work** (fourni par `prisma.$transaction`) garantit l'atomicité.

**Décision :** Repository + Data Mapper pour le domaine Routines ; Unit of Work via la transaction de l'ORM pour l'écriture atomique. On **écarte** Active Record ici (mais on l'accepterait pour une table de configuration sans règles — cohérent avec la nuance « anémique OK si pas de règles » du module 05).

```ts
// Contrat côté domaine — aucune techno de stockage visible
interface RoutineRepository {
  findById(id: string): Promise<Routine | null>;
  hasCompletion(routineId: string, childId: string, day: string): Promise<boolean>;
  saveCompletion(c: Completion): Promise<void>;
}
```

> Le *comment* on implémente ce repository avec Prisma (requêtes, transaction) = **cours 10**. Ici on a **décidé** le pattern et la frontière, pas écrit le SQL.

---

## 4. Pièges & misconceptions

### PIÈGE #1 — « REST = mettre des verbes dans l'URL »

Faux, c'est l'inverse. `POST /createRoutine`, `GET /getRoutines` est du **RPC déguisé en HTTP**. REST met les **noms** (ressources) dans l'URL et les **verbes** dans la méthode HTTP. Le test : si tes URL contiennent des verbes (`create`, `get`, `update`, `delete`), tu as raté la modélisation en ressources. Cherche le **nom** de la chose manipulée.

### PIÈGE #2 — Tout passer en POST « parce que ça marche »

Mettre chaque opération en `POST` fonctionne, mais jette la sémantique HTTP : plus de distinction sûr/non-sûr (le cache ne peut plus aider les lectures), plus d'idempotence (impossible de rejouer sans risque une action réseau). Un client offline qui rejoue une file d'actions **dépend** de l'idempotence de `PUT`/`DELETE`. Le verbe juste est de l'information **gratuite** que tu offres au client — ne la gaspille pas.

### PIÈGE #3 — Confondre 401, 403, 404, 409 et 422

Ces codes disent au client **quoi faire** ; les mélanger le force à deviner. 401 = « authentifie-toi » ; 403 = « authentifié mais interdit » ; 404 = « n'existe pas, n'insiste pas » ; 409 = « conflit, rafraîchis et réessaie » ; 422 = « ta donnée est syntaxiquement OK mais viole une règle, corrige ». Renvoyer 400 pour tout, ou 500 pour une règle métier violée, casse la capacité du front à réagir correctement.

### PIÈGE #4 — Confondre validation de format et validation de règle

« `role` est une string » (format, couche présentation/DTO) n'est **pas** « `role` est un rôle TribuZen autorisé » (règle métier, domaine). Mettre la règle métier dans le DTO la disperse hors du domaine (règle orpheline, cf. module 05) ; mettre le format dans le domaine pollue le métier avec du parsing d'entrée. Chaque validation à sa couche : format en entrée, règle dans le domaine, contrainte technique en base.

### PIÈGE #5 — Croire que Repository = un fichier par table avec du CRUD générique

Un Repository n'est **pas** un DAO générique `findByColumn` collé sur chaque table. Il est orienté **agrégat** (un repo par agrégat métier, pas par table), retourne des **entités** (pas des rows), et son interface parle le **langage du domaine** (`findActiveRoutinesFor(family)`), pas SQL. Un « RoutineRepository » qui expose `executeQuery(sql)` ou `findByStatusColumn` n'est un repository que de nom : il refuit l'infra dans le domaine.

### PIÈGE #6 — Versionner trop tôt, ou jamais

Deux excès. **Trop tôt** : créer `/v1`, `/v2`, `/v3` à chaque petit changement additif → coût de maintenance multiplié pour rien (un ajout de champ optionnel ne casse personne). **Jamais** : durcir une validation ou renommer un champ « en douce » sur une API dont dépend une app mobile déployée → tu casses les clients installés. La règle : **additif = pas de version** ; **breaking = nouvelle version, avec dépréciation annoncée**. Versionne le moins possible, mais assume un breaking change proprement.

### PIÈGE #7 — Exposer les erreurs internes au client

Renvoyer la stack trace, le message d'exception SQL ou le nom de la table sur un 500 est à la fois une **faille de sécurité** (fuite d'infra) et un **contrat instable** (le client se met à parser des messages internes). Un 500 renvoie un message **générique et stable** côté client ; le détail complet est **loggué côté serveur**. Le format d'erreur (Problem Details) est un contrat : structuré, stable, sans fuite.

---

## 5. Ancrage TribuZen

Le backend de TribuZen est un NestJS en couches (modules 05-07). Ce module en conçoit la **surface** : le contrat d'API que consomme l'app mobile React Native, et les patterns qui structurent la couche de données derrière.

**Contrat d'API TribuZen (extrait, versionné par URL) :**

```
GET    /v1/families/{{familyId}}/routines        lister les routines d'une famille
POST   /v1/families/{{familyId}}/routines        créer une routine        → 201
GET    /v1/routines/{{id}}                        détail d'une routine
PATCH  /v1/routines/{{id}}                        renommer / archiver
DELETE /v1/routines/{{id}}                        supprimer                → 204
POST   /v1/routines/{{id}}/completions            compléter aujourd'hui    → 201
POST   /v1/families/{{familyId}}/invitations      inviter un co-référent   → 201
```

Décisions concrètes pour TribuZen :

- **`/v1` d'emblée.** L'app mobile est déployée chez des familles ; le jour d'un breaking change, `/v2` cohabite pendant que les apps v1 continuent sur `/v1`. Coût assumé, mais indispensable dès qu'un client non contrôlé existe.
- **« Compléter » = créer une complétion** (`POST .../completions`), pas un endpoint d'action. La complétion est une vraie ressource (date, enfant, id) — utile pour l'historique et la future déduplication offline (module 12).
- **Contrat d'erreur stable en Problem Details.** Le client offline (React Query + file d'actions rejouée au retour réseau) s'appuie sur les codes : 404 = abandonner l'action, 409 = déjà fait, 422 = montrer la violation à l'utilisateur. Sans ce contrat, la synchro offline devine — et se trompe.
- **Repository + Data Mapper** pour le domaine Routines/Familles : les règles (archivée non complétable, max 8 co-référents) vivent dans des entités pures, testables sans base, derrière `RoutineRepository` / `FamilyRepository`. Le jour où une partie des données passe en Level 1 (device-only, chiffré), on change l'implémentation du repository — le domaine ne bouge pas.
- **Validation en 3 couches** : DTO (format du corps) → entité (règles TribuZen) → base (unicité d'une complétion par jour/enfant). Fail-fast, violations collectées pour le format.

> **Défère :** l'implémentation NestJS du pipeline et des filtres = **cours 09** ; le SQL/Prisma des repositories et la transaction = **cours 10** ; le cache HTTP, l'ETag et le verrouillage optimiste de l'édition concurrente = **cours 11** ; la déduplication offline et les jobs de synchro = **module 12**. Ici, on a fixé **la forme du contrat et les patterns**, pas une ligne d'implémentation.

---

## 6. Points clés

1. **Ressource, pas fonction :** REST expose des **noms** (ressources) via des **verbes HTTP**, pas une liste de RPC (`createRoutine`). Les URL deviennent prévisibles.
2. **Le contrat d'API** est l'interface publique stable du backend : forme des requêtes/réponses/erreurs, découplée de l'implémentation.
3. **Verbes = sémantique gratuite :** sûr (cachable) et idempotent (réessayable) sont des propriétés offertes par GET/PUT/DELETE — les mettre tous en POST les gaspille.
4. **Codes de retour = instruction au client :** 404 (n'insiste pas) ≠ 409 (réessaie) ≠ 422 (corrige). Le code fait partie du contrat.
5. **Action non-CRUD :** cherche d'abord la **ressource cachée** (compléter = créer une complétion) ; l'endpoint d'action explicite est le dernier recours.
6. **Versioning :** additif = pas de version ; breaking = nouvelle version avec dépréciation. Versionne le moins possible, assume les breaking changes.
7. **Pipeline middleware :** les préoccupations transverses (log, auth, validation, erreurs) sont des étapes **ordonnées** et **court-circuitables** ; l'ordre est une décision.
8. **Accès aux données :** Active Record (couplé, CRUD simple) vs Data Mapper (entité pure) ; **Repository** (interface dans le domaine) pour respecter la règle de dépendance ; **Unit of Work** pour l'écriture atomique.
9. **Validation en 3 couches** (format / règle / persistance) + **fail-fast** ; ne pas confondre format (DTO) et règle métier (domaine).
10. **Erreurs structurées** (Problem Details / RFC 9457, ex-7807), stables, sans fuite d'infra : le front mappe code + champ à un comportement.

---

## 7. Seeds Anki

```
En REST, quelle est la différence entre une ressource et un endpoint ?|Une ressource est un NOM du domaine identifiable (routine, famille). Un endpoint est une URL + un verbe HTTP qui agit sur une ressource. On conçoit un ensemble de ressources + quelques verbes standard, pas une liste de fonctions distantes.
Pourquoi éviter de mettre toutes les opérations en POST ?|POST n'est ni sûr ni idempotent. En mettant tout en POST on jette la sémantique HTTP : plus de cache pour les lectures (GET sûr), plus de rejeu sans risque (PUT/DELETE idempotents) — crucial pour un client offline qui rejoue une file d'actions.
Que veulent dire « sûr » (safe) et « idempotent » pour un verbe HTTP ?|Sûr = ne modifie pas l'état serveur (les lectures, cachables). Idempotent = rejouer la même requête donne le même état final (PUT, DELETE) — ce qui rend l'API réessayable. GET est sûr et idempotent ; POST ni l'un ni l'autre.
Comment modéliser une action non-CRUD comme « compléter une routine » en REST ?|Chercher la ressource cachée : compléter = créer une complétion → POST /routines/{id}/completions (201). L'endpoint d'action explicite (POST /routines/{id}/archive) est le dernier recours, réservé aux vraies transitions d'état, pas au CRUD déguisé.
Quand faut-il créer une nouvelle version d'API ?|Seulement pour un changement CASSANT (retirer/renommer un champ, changer un type, durcir une validation). Un changement additif (champ optionnel, nouvel endpoint) ne casse personne → pas de version. Règle : versionne le moins possible, assume les breaking changes avec dépréciation.
Quelles sont les deux propriétés clés d'un pipeline middleware ?|(1) L'ordre est une décision (authentifier avant d'autoriser, valider après l'auth). (2) Le court-circuit : une étape peut arrêter la chaîne (auth échoue en 401 → validation et handler ne s'exécutent jamais).
Différence entre Active Record et Data Mapper ?|Active Record : l'entité hérite d'un modèle et sait se persister (routine.save()) — couplée à la base, rapide mais peu testable. Data Mapper : l'entité est pure (ignore la base), un mapper séparé traduit entité ↔ ligne — découplée, testable, pour un domaine riche.
Qu'est-ce que le Repository pattern et ses règles ?|Une interface façon collection (findById, save) définie DANS le domaine et implémentée dans l'infra. Règles : interface dans le domaine, retourne des entités (pas des rows), un repo par agrégat (pas par table), encapsule la requête (le domaine ignore SQL/Mongo).
À quoi sert un Unit of Work ?|Regrouper plusieurs modifications (créations, updates, suppressions) et les commit en UNE transaction atomique : tout passe ou rien. Fourni par les ORM (prisma.$transaction, TypeORM/Doctrine EntityManager) — rarement codé à la main.
Quelles sont les 3 couches de validation et le principe qui les gouverne ?|Format (DTO/présentation : bonne forme ?), Règle métier (domaine : action permise ?), Persistance (base : unicité, FK). Principe = fail-fast : rejeter au plus tôt. Exception : le format collecte toutes les violations d'un coup pour les renvoyer ensemble.
Pourquoi structurer les erreurs (Problem Details / RFC 9457, ex-7807) plutôt qu'une chaîne libre ?|Un format stable (type, title, status, detail, instance, violations) permet au front de mapper code + champ à un comportement sans parser une phrase. Et on ne fuit jamais les détails internes (stack, SQL) : message générique côté client, log complet côté serveur.
```

---

## Pont vers le lab

> Lab associé : `labs/lab-11-api-design-et-backend-patterns/README.md`. Concevoir le contrat d'une API TribuZen à partir d'un pêle-mêle d'opérations : modéliser les ressources, choisir verbes et codes, spécifier les erreurs structurées, décider la validation en couches et le pattern d'accès aux données. Exercice de conception, évalué par grille + coach — zéro harnais.
