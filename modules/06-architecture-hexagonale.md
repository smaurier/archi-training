---
titre: Architecture hexagonale (Ports & Adapters)
cours: 13-architecture
notions: ["hexagonale / ports & adapters", "domaine au centre", "port primaire (driving)", "port secondaire (driven)", "adapter primaire", "adapter secondaire", "inversion des dépendances vers le domaine", "le domaine définit ses interfaces", "adapter de test en mémoire", "testabilité sans infrastructure", "différence avec le modèle en couches"]
outcomes:
  - "sait placer le domaine au centre et faire pointer toutes les dépendances de code vers lui"
  - "sait distinguer un port primaire (entrée, driving) d'un port secondaire (sortie, driven) et dire qui les définit"
  - "sait distinguer un adapter primaire d'un adapter secondaire et le brancher sur le bon port"
  - "sait expliquer comment l'hexagonale inverse la dépendance domaine→infra du modèle en couches, en s'appuyant sur DIP et la DI"
  - "sait justifier l'adapter de test en mémoire comme conséquence directe de l'inversion, et non comme une astuce de test"
prerequis: ["Module 00 — posture d'architecte", "Module 01 — SOLID (surtout DIP)", "Module 02 — design patterns", "Module 03 — clean code / code smells", "Module 04 — dependency injection / IoC", "Module 05 — architecture en couches"]
next: 07-clean-architecture
libs: []
tribuzen: "backend NestJS de TribuZen — le domaine Routines mis en hexagonal : ports (use case + repository) définis par le domaine, adapters REST / Prisma / sync offline branchés autour"
last-reviewed: 2026-07
---

# Architecture hexagonale (Ports & Adapters)

> **Outcomes — tu sauras FAIRE :** placer le domaine au centre, faire pointer toutes les dépendances vers lui, distinguer port/adapter primaire et secondaire, expliquer l'inversion de dépendance par rapport aux couches (module 05), et justifier l'adapter de test en mémoire comme conséquence de cette inversion.
> **Difficulté :** :star::star::star:
>
> **Portée :** ce module couvre l'architecture **hexagonale** (aussi appelée *ports & adapters*) — SEULEMENT. Le modèle en **couches** (strates horizontales, dépendance vers le bas) est le **module 05**, supposé acquis : on part de sa **limite** (le domaine dépend encore de l'infra) et on la corrige. La **clean architecture** (cercles concentriques, distinction fine Entities / Use Cases / Frameworks) est le **module 07** : on la compare **brièvement** en fin de module, sans la traiter. On s'appuie sur le **DIP** (module 01) et la **dependency injection** (module 04) : l'hexagonale n'est que leur application à l'échelle d'un domaine. Le détail NestJS relève du **cours 09**, Prisma du **cours 10** : on raisonne archi, on n'implémente pas ligne à ligne.

## 1. Cas concret d'abord

Tu reprends le module `routines` de TribuZen, déjà rangé en couches au module 05. La couche application appelle un repository pour persister les complétions. Regarde le sens réel de la dépendance dans le code :

```ts
// complete-routine.service.ts — couche application (module 05)
import { PrismaRoutineRepository } from '../infrastructure/prisma-routine.repository';
//        ▲ le domaine/application IMPORTE une classe de la couche infrastructure

export class CompleteRoutineService {
  private readonly repo = new PrismaRoutineRepository(); // couplage direct à Prisma

  async execute(routineId: string, childId: string): Promise<number> {
    const routine = await this.repo.findById(routineId);
    // ... règle métier ...
  }
}
```

Le module 05 rangeait déjà les responsabilités. Mais pose-toi la question qui reste :

1. **Qui dépend de qui, au niveau du code ?** L'application `import` `PrismaRoutineRepository`, une classe **d'infrastructure**. La flèche de dépendance va **du métier vers l'infra**. Le domaine n'est donc **pas** isolé : il connaît Prisma par ricochet.
2. **Peux-tu tester `execute` sans base de données ?** Non. Le service instancie lui-même un repository Prisma. Tester la règle métier oblige à monter une vraie base (ou un mock lourd).
3. **Le jour où TribuZen ajoute la sync offline** (le mobile pousse des complétions en batch depuis un stockage local chiffré), il faut une **autre** implémentation de persistance. Avec le couplage ci-dessus, l'application doit changer.

Le problème n'est pas le rangement — il est **bon**. Le problème est le **sens de la flèche** : le cœur métier dépend d'un détail technique. L'architecture hexagonale renverse cette flèche. Après ce module, `PrismaRoutineRepository` dépendra du domaine, et jamais l'inverse — et l'adapter de test en mémoire tombera gratuitement.

---

## 2. Théorie complète, concise

### 2.1 L'idée : le domaine au centre, tout le reste autour

L'architecture hexagonale (Alistair Cockburn, 2005 ; autre nom : *ports & adapters*) part d'une seule exigence : **le cœur métier ne doit dépendre de rien de technique**. Pas de HTTP, pas d'ORM, pas de framework, pas de réseau. Il ne connaît que **ses propres interfaces**.

On le dessine comme un hexagone : au centre, le **domaine + les cas d'usage** (le cœur applicatif). Autour, des **adapters** qui branchent le monde extérieur. La forme hexagonale n'a rien de magique — elle signifie juste « plusieurs faces », donc **plusieurs points de branchement symétriques** (REST, CLI, job, test…), par opposition au haut/bas du modèle en couches.

```
        REST          CLI            Job sync
         │             │                │
    ┌────▼─────┐  ┌────▼─────┐    ┌─────▼──────┐
    │ Adapter  │  │ Adapter  │    │  Adapter   │   ← adapters PRIMAIRES (driving)
    │ primaire │  │ primaire │    │  primaire  │
    └────┬─────┘  └────┬─────┘    └─────┬──────┘
         └──────────┐  │  ┌─────────────┘
                 ┌──▼──▼──▼──┐
                 │  PORT      │   ← interface d'entrée, définie par le cœur
                 │ PRIMAIRE   │
              ┌──┴────────────┴──┐
              │                  │
              │   DOMAINE +      │   ← le CŒUR : règles pures, zéro import technique
              │   CAS D'USAGE    │
              │                  │
              └──┬────────────┬──┘
                 │  PORT       │   ← interface de sortie, définie par le cœur
                 │ SECONDAIRE  │
                 └──▲──▲──▲────┘
         ┌──────────┘  │  └──────────┐
    ┌────┴─────┐  ┌────┴─────┐  ┌────┴─────┐
    │ Adapter  │  │ Adapter  │  │ Adapter  │   ← adapters SECONDAIRES (driven)
    │ Prisma   │  │ InMemory │  │ Email    │
    └──────────┘  └──────────┘  └──────────┘
```

Retiens la géométrie : **toutes les flèches de dépendance de code pointent vers le centre**. Rien dans le cœur ne pointe vers un adapter.

### 2.2 Ports : les interfaces définies par le domaine

Un **port** est une **interface** — un contrat. Le point non négociable : **c'est le domaine qui définit ses ports**, jamais l'infrastructure. Le cœur déclare « voici ce que j'offre » et « voici ce dont j'ai besoin » ; le monde extérieur s'y conforme.

Il y a deux familles de ports, selon le **sens de l'appel** :

- **Port primaire** (*driving* / pilotant) : l'interface **d'entrée** du cœur. C'est ce que le cœur **offre** au monde. Exemple : `CompleteRoutine` (« je sais compléter une routine »). Le monde extérieur **appelle** le cœur à travers ce port.
- **Port secondaire** (*driven* / piloté) : l'interface **de sortie** du cœur. C'est ce dont le cœur **a besoin** du monde. Exemple : `RoutineRepository` (« j'ai besoin qu'on me stocke/retrouve des routines »). Le cœur **appelle** le monde à travers ce port.

| | Port primaire (driving) | Port secondaire (driven) |
|---|---|---|
| Sens de l'appel | l'extérieur → appelle le cœur | le cœur → appelle l'extérieur |
| Sémantique | ce que le cœur **offre** | ce dont le cœur **a besoin** |
| Défini par | le cœur | le cœur |
| Exemple TribuZen | `CompleteRoutine` (use case) | `RoutineRepository`, `NotificationSender` |

Astuce mnémonique : **primaire = qui pilote le cœur** (l'utilisateur, une requête). **Secondaire = ce que le cœur pilote** (une base, un service d'envoi).

### 2.3 Adapters : les implémentations concrètes autour

Un **adapter** est le code technique qui **branche** un port sur le monde réel. Un adapter **traduit** entre le vocabulaire du cœur et une technologie précise.

- **Adapter primaire** : implémente/consomme un **port primaire** pour transformer une entrée externe en appel au cœur. Un contrôleur REST traduit une requête HTTP en appel `CompleteRoutine`. Une commande CLI, un consumer de queue, un test font pareil.
- **Adapter secondaire** : implémente un **port secondaire** avec une techno concrète. `PrismaRoutineRepository implements RoutineRepository` traduit les appels du cœur en requêtes Prisma. Un adapter email traduit en appels SendGrid.

Le sens des dépendances est ce qui compte : **l'adapter dépend du port** (donc du cœur), **jamais l'inverse**. `PrismaRoutineRepository` importe l'interface `RoutineRepository` du domaine ; le domaine n'importe jamais Prisma.

### 2.4 L'inversion des dépendances vers le domaine (le cœur du sujet)

C'est **la** transformation par rapport au module 05. Dans le modèle en couches, la dépendance de code va **du métier vers l'infra** (le métier appelle la couche données *et* en dépend au niveau des `import`). En hexagonale, on **inverse** cette dépendance grâce au **DIP** (module 01) :

1. Le domaine **définit** l'interface `RoutineRepository` (le port secondaire) **chez lui**, dans le cœur.
2. L'infrastructure **implémente** cette interface : `PrismaRoutineRepository implements RoutineRepository`.
3. Résultat : la flèche de code va maintenant **de l'infra vers le domaine**. Le domaine ne connaît que **son** interface ; il ignore Prisma.

```
Couches (module 05) :        Domaine ───import──▶ PrismaRepository   (le cœur dépend de l'infra)

Hexagonale (module 06) :     Domaine ◀──import─── PrismaRepository   (l'infra dépend du cœur)
                             (le domaine définit RoutineRepository ; Prisma l'implémente)
```

Le flux d'exécution à *runtime* n'a pas changé (le cœur appelle bien le repo pour lire en base). Ce qui a changé, c'est le sens de la dépendance **au niveau du code source** — la seule qui compte pour l'isolation, le remplacement et les tests. On **branche** l'implémentation concrète au démarrage via la **dependency injection** (module 04) : le conteneur injecte `PrismaRoutineRepository` là où le cœur attend un `RoutineRepository`.

> Retiens la formule : **hexagonale = DIP appliqué à la frontière du domaine, câblé par la DI.** Si tu maîtrises DIP (01) et DI (04), l'hexagonale n'est pas un concept nouveau — c'est leur mise à l'échelle d'un domaine entier.

### 2.5 La testabilité tombe gratuitement

Une fois la dépendance inversée, tester le cœur ne demande **aucune infrastructure**. Puisque le cœur ne dépend que d'interfaces, on branche des **adapters de test** :

- un **adapter secondaire en mémoire** (`InMemoryRoutineRepository`) qui stocke dans une `Map` — pas de base, exécution en microsecondes ;
- on appelle le use case directement (l'adapter primaire de test, c'est le test lui-même).

Point important de compréhension : l'adapter de test en mémoire n'est **pas** une astuce ajoutée pour tester. C'est la **conséquence directe** de l'inversion. Dès l'instant où le cœur dépend d'un port et pas d'une classe concrète, *n'importe quelle* implémentation du port est branchable — Prisma en prod, `Map` en test. La testabilité est un **effet de bord** de l'architecture, pas un objectif séparé.

### 2.6 Ce que l'hexagonale ne dit pas (et où ça déraille)

- L'hexagonale **ne prescrit pas** ta structure interne de domaine (entités riches, agrégats, invariants) — ça, c'est le **DDD tactique (module 10)**. Elle dit seulement « le cœur au centre, isolé ».
- Elle **ne double pas** le nombre de tes classes « pour le principe ». Créer un port pour chaque petit CRUD sans règle est du sur-engineering (voir piège #4). L'hexagonale se justifie quand le domaine a **de vraies règles** et/ou **plusieurs points d'entrée/sortie**.
- Elle **n'impose pas** de framework. Ni NestJS ni Prisma ne sont « hexagonaux » ou pas : c'est le **sens de tes imports** qui l'est.

### 2.7 Position dans le parcours (comparaison brève)

Trois modèles, une même préoccupation croissante — le sens des dépendances :

| Modèle | Forme | Sens de la dépendance | Module |
|---|---|---|---|
| Couches | strates horizontales | vers le **bas** (métier → infra) | 05 (acquis) |
| Hexagonale | domaine au centre | vers le **centre** (infra → domaine) | 06 (ici) |
| Clean | cercles concentriques | vers le **centre**, avec distinctions fines (Entities / Use Cases / Adapters / Frameworks) | 07 (à venir) |

L'hexagonale corrige la **limite n°1 du module 05** (le domaine dépend de l'infra) en inversant la dépendance. La **clean architecture (module 07)** part de la même inversion et ajoute une **stratification interne** du cœur (règles d'entreprise vs règles applicatives). Pour l'instant, un seul acquis suffit : **le domaine définit ses ports, tout dépend du centre.**

---

## 3. Worked examples

### Exemple 1 — Passer le module `routines` du §1 en hexagonal

On reprend le service couplé à Prisma du §1 et on inverse la dépendance.

**Le port secondaire — défini DANS le domaine :**

```ts
// domain/ports/routine-repository.port.ts  (côté CŒUR)
// Le domaine DÉCLARE ce dont il a besoin. Il ne sait pas si c'est Prisma, SQLite ou une Map.
export interface RoutineRepository {
  findById(id: string): Promise<Routine | null>;
  hasCompletion(routineId: string, childId: string, day: string): Promise<boolean>;
  saveCompletion(c: Completion): Promise<void>;
  countCompletions(routineId: string, childId: string): Promise<number>;
}
```

**Le port primaire + le use case — le cœur, zéro import technique :**

```ts
// domain/ports/complete-routine.port.ts  (ce que le cœur OFFRE)
export interface CompleteRoutine {
  execute(routineId: string, childId: string): Promise<number>;
}

// application/complete-routine.use-case.ts  (implémentation du cœur)
export class CompleteRoutineUseCase implements CompleteRoutine {
  // Dépend de l'INTERFACE (port secondaire), jamais de Prisma. Injectée (module 04).
  constructor(private readonly repo: RoutineRepository) {}

  async execute(routineId: string, childId: string): Promise<number> {
    const routine = await this.repo.findById(routineId);
    if (!routine) throw new RoutineNotFoundError(routineId);

    const day = new Date().toISOString().slice(0, 10);
    if (await this.repo.hasCompletion(routineId, childId, day)) {
      throw new AlreadyCompletedError();
    }
    const completion = routine.complete(childId, day); // règle dans l'entité (domaine riche)
    await this.repo.saveCompletion(completion);
    return this.repo.countCompletions(routineId, childId);
  }
}
```

**Les adapters — autour, ils dépendent du cœur :**

```ts
// adapters/primary/routines.controller.ts  (adapter PRIMAIRE : HTTP → cœur)
@Controller('routines')
export class RoutinesController {
  constructor(private readonly complete: CompleteRoutine) {} // dépend du PORT primaire

  @Post(':id/complete')
  async completeRoute(@Param('id') id: string, @Body() dto: CompleteRoutineDto) {
    const streak = await this.complete.execute(id, dto.childId);
    return { ok: true, streak };
  }
}

// adapters/secondary/prisma-routine.repository.ts  (adapter SECONDAIRE : cœur → Prisma)
export class PrismaRoutineRepository implements RoutineRepository {
  constructor(private readonly prisma: PrismaService) {}
  findById(id: string) { /* ... requête Prisma ... */ }
  // ... implémente chaque méthode du port avec Prisma
}
```

**Ce que l'inversion achète, concrètement :**
- Le dossier `domain/` **n'importe plus rien** de Prisma ni de NestJS-HTTP. Sa flèche de dépendance ne sort pas du cœur.
- Ajouter la **sync offline** = écrire un nouvel adapter primaire (un consumer) + éventuellement un adapter secondaire de stockage local. Le use case ne bouge pas.
- Changer d'ORM = réécrire un seul fichier (`PrismaRoutineRepository`). Le cœur ne le remarque pas.

### Exemple 2 — L'adapter de test en mémoire, sans base ni réseau

Conséquence directe de l'inversion : on branche une `Map` à la place de Prisma.

```ts
// adapters/secondary/in-memory-routine.repository.ts
// Même contrat (RoutineRepository), autre implémentation. Aucune base.
export class InMemoryRoutineRepository implements RoutineRepository {
  private completions: Completion[] = [];
  private routines = new Map<string, Routine>();

  seed(routine: Routine) { this.routines.set(routine.id, routine); } // helper de test

  async findById(id: string) { return this.routines.get(id) ?? null; }
  async hasCompletion(rId: string, cId: string, day: string) {
    return this.completions.some(c => c.routineId === rId && c.childId === cId && c.day === day);
  }
  async saveCompletion(c: Completion) { this.completions.push(c); }
  async countCompletions(rId: string, cId: string) {
    return this.completions.filter(c => c.routineId === rId && c.childId === cId).length;
  }
}
```

```ts
// complete-routine.use-case.spec.ts — le use case testé SANS infra
const repo = new InMemoryRoutineRepository();
repo.seed(Routine.createActive('r1'));
const useCase = new CompleteRoutineUseCase(repo); // on injecte l'adapter de test

const streak = await useCase.execute('r1', 'child-42');
// assertion : streak === 1, et une 2e complétion le même jour lève AlreadyCompletedError
```

Aucun NestJS monté, aucune base, aucun réseau. On teste **la vraie règle métier** avec **le vrai code du cœur** — seul l'adapter secondaire change. C'est exactement ça, le « super-pouvoir » de l'hexagonale : il n'est pas offert par un outil de test, il est offert par **le sens des dépendances**.

---

## 4. Pièges & misconceptions

### PIÈGE #1 — « Hexagonale = j'ai des dossiers `ports/` et `adapters/` »

Faux, comme au module 05 avec les couches. Créer un dossier `ports/` ne garantit rien. Ce qui compte, c'est **le sens des imports** : si un fichier de `domain/` `import` quoi que ce soit de `adapters/` ou de Prisma, tu n'es **pas** en hexagonal, quel que soit ton arborescence. Vérifie la flèche, pas le nom du dossier.

### PIÈGE #2 — Croire que le port secondaire est défini par l'infrastructure

L'erreur la plus fréquente. On place l'interface `RoutineRepository` **dans** la couche infra (« c'est le repo, ça va avec la base »). Résultat : le domaine importe l'interface depuis l'infra → la dépendance **repart** vers l'infra → tu as recréé le modèle en couches. La règle absolue : **le port est défini par le cœur, chez le cœur.** L'infra ne fait qu'`implements`.

### PIÈGE #3 — Confondre le sens du **flux d'exécution** et le sens de la **dépendance de code**

À l'exécution, le cœur appelle bien le repository pour lire la base : le flux va « vers l'infra ». On en conclut à tort que « le domaine dépend de l'infra ». Non : **le flux d'exécution et la dépendance de code sont deux choses différentes.** L'inversion (DIP) ne change **pas** le flux runtime ; elle change qui `import` qui dans le code source. C'est cette dernière — et elle seule — qui détermine l'isolation et la testabilité.

### PIÈGE #4 — Mettre de l'hexagonal partout

L'hexagonale a un coût : plus d'interfaces, plus d'indirection. Pour un CRUD sans règle (une table de config, une liste de référence), un contrôleur qui parle à un repository suffit — l'inversion n'achète rien. L'hexagonale se **mérite** : un domaine à vraies règles, ou plusieurs points d'entrée/sortie (REST + CLI + sync, SQL + cache + email). Sinon c'est du sur-engineering. Le critère : *ai-je des règles à protéger et/ou plusieurs adapters plausibles ?*

### PIÈGE #5 — « Primaire = important, secondaire = accessoire »

Les mots trompent. **Primaire (driving)** = ce qui **pilote** le cœur (l'entrée : requête, commande). **Secondaire (driven)** = ce que le cœur **pilote** (la sortie : base, email). Ce n'est pas une échelle d'importance mais une **direction d'appel** : l'extérieur appelle le cœur (primaire) vs le cœur appelle l'extérieur (secondaire). Un port secondaire mal conçu casse autant qu'un primaire.

### PIÈGE #6 — Confondre hexagonale et clean architecture

Les deux inversent la dépendance vers le centre et se ressemblent. Différence : l'hexagonale dit « **un** cœur isolé, des ports/adapters autour » — un seul anneau. La **clean (module 07)** **stratifie** ce cœur en cercles (Entities = règles d'entreprise, Use Cases = règles applicatives) avec une règle de dépendance interne. Toute clean est hexagonale dans l'esprit ; l'inverse n'est pas vrai. Ne dis pas « hexagonale » quand tu décris des cercles concentriques — garde ça pour le module 07.

---

## 5. Ancrage TribuZen

Le backend NestJS de TribuZen, rangé en couches au module 05, passe le domaine **Routines** en hexagonal — parce que c'est le domaine à **vraies règles** (archivée non complétable, série, unicité par jour) **et** à plusieurs points d'entrée/sortie prévus (REST maintenant, sync offline plus tard).

Structure cible du module `routines` :

```
tribuzen-api/
  src/
    routines/
      domain/                          ← le CŒUR : aucun import technique
        routine.entity.ts              ← règles + invariants (série, archivage)
        ports/
          complete-routine.port.ts     ← PORT PRIMAIRE (ce que le cœur offre)
          routine-repository.port.ts   ← PORT SECONDAIRE (ce dont le cœur a besoin)
      application/
        complete-routine.use-case.ts   ← implémente le port primaire, dépend des ports
      adapters/
        primary/
          routines.controller.ts       ← REST → cœur (adapter primaire)
        secondary/
          prisma-routine.repository.ts  ← cœur → Prisma (adapter secondaire, prod)
          in-memory-routine.repository.ts ← cœur → Map (adapter secondaire, test)
```

Décisions d'archi concrètes pour TribuZen :

- **Le port `RoutineRepository` vit dans `domain/ports/`**, pas dans `adapters/`. C'est le domaine qui dicte le contrat de persistance ; Prisma s'y plie. C'est ce qui rend le domaine des routines **rejouable hors serveur**.
- **La sync offline sera un nouvel adapter primaire.** Le mobile (React Query + stockage local chiffré) poussera des complétions en batch au retour réseau ; un consumer les traduira en appels `CompleteRoutine.execute(...)`. **Le use case ne change pas** — c'est tout l'intérêt de l'hexagone symétrique.
- **Le passage éventuel de certaines données en Level 1** (device-only, chiffré) = un adapter secondaire différent (`RoutineRepository` implémenté sur du stockage local) branché par DI. Le cœur ne bouge pas.
- **Les tests du cœur** (série, archivage, unicité) tournent sur `InMemoryRoutineRepository` : aucune base, feedback en millisecondes, exécutés à chaque commit.

> **Défère :** le câblage NestJS concret (providers, tokens `@Inject`, modules) est le **cours 09** ; le schéma et les requêtes Prisma, le **cours 10** ; la modélisation riche de `Routine` (entité/agrégat/invariants), le **module 10 (DDD tactique)**. Ici on décide **où vivent les ports** et **dans quel sens pointent les dépendances**, pas comment on l'écrit ligne à ligne.

---

## 6. Points clés

1. **Hexagonale (ports & adapters) = le domaine au centre, isolé de tout ce qui est technique** ; il ne connaît que ses propres interfaces.
2. **Un port est une interface définie par le domaine** — jamais par l'infrastructure. C'est le point non négociable.
3. **Port primaire (driving)** = entrée, ce que le cœur **offre** (l'extérieur appelle le cœur). **Port secondaire (driven)** = sortie, ce dont le cœur **a besoin** (le cœur appelle l'extérieur).
4. **Un adapter branche un port sur une techno** et **dépend du port** (donc du cœur), jamais l'inverse : REST/CLI/test = adapters primaires ; Prisma/email/InMemory = adapters secondaires.
5. **L'hexagonale inverse la dépendance domaine→infra du modèle en couches** : le domaine définit l'interface, l'infra l'implémente. C'est du **DIP (01)** câblé par la **DI (04)**.
6. **Sens du flux d'exécution ≠ sens de la dépendance de code.** L'inversion change les `import`, pas le flux runtime — et seuls les `import` déterminent l'isolation.
7. **L'adapter de test en mémoire est une conséquence de l'inversion**, pas une astuce : tout port a une implémentation `Map` branchable, d'où des tests sans infra.
8. **L'hexagonale se mérite** : domaine à vraies règles et/ou plusieurs adapters. Sinon (CRUD trivial) c'est du sur-engineering.
9. **Position :** couches (05, dépendance vers le bas) → hexagonale (06, dépendance vers le centre) → clean (07, mêmes cercles + stratification interne du cœur).

---

## 7. Seeds Anki

```
En architecture hexagonale, où vit le domaine et de quoi dépend-il ?|Le domaine est au centre et ne dépend de rien de technique : il ne connaît que ses propres interfaces (ports). Toutes les dépendances de code pointent vers lui.
Qui définit les ports en hexagonale ?|Le domaine (le cœur), toujours — jamais l'infrastructure. Le cœur déclare ce qu'il offre (port primaire) et ce dont il a besoin (port secondaire) ; l'extérieur s'y conforme.
Port primaire vs port secondaire ?|Primaire (driving) = interface d'entrée, ce que le cœur offre, l'extérieur appelle le cœur (ex : CompleteRoutine). Secondaire (driven) = interface de sortie, ce dont le cœur a besoin, le cœur appelle l'extérieur (ex : RoutineRepository).
Adapter primaire vs adapter secondaire ?|Primaire : traduit une entrée externe en appel au cœur (REST controller, CLI, test). Secondaire : implémente un port de sortie avec une techno (PrismaRepository, adapter email). L'adapter dépend toujours du port, jamais l'inverse.
Comment l'hexagonale corrige-t-elle la limite du modèle en couches ?|En couches, le domaine dépend de l'infra (il l'importe vers le bas). L'hexagonale inverse : le domaine définit l'interface (port secondaire), l'infra l'implémente. La flèche de code va désormais de l'infra vers le domaine (DIP appliqué, câblé par la DI).
Le flux d'exécution et la dépendance de code, même chose ?|Non. À l'exécution le cœur appelle bien le repo (flux vers l'infra). L'inversion (DIP) ne change pas le flux runtime, elle change qui importe qui dans le code source — et c'est cela seul qui détermine l'isolation et la testabilité.
Pourquoi l'adapter de test en mémoire est-il « gratuit » en hexagonale ?|Parce que le cœur dépend d'un port (interface), pas d'une classe concrète. N'importe quelle implémentation du port est branchable : Prisma en prod, une Map en test. La testabilité sans infra est une conséquence de l'inversion, pas une astuce ajoutée.
Quand NE PAS utiliser l'hexagonale ?|Pour un CRUD sans règle métier et à un seul point d'entrée/sortie : l'indirection des ports/adapters n'achète rien, c'est du sur-engineering. Elle se justifie avec de vraies règles et/ou plusieurs adapters plausibles.
Différence entre hexagonale et clean architecture ?|Hexagonale = un cœur isolé + ports/adapters autour (un seul anneau). Clean (module 07) reprend l'inversion et stratifie le cœur en cercles (Entities = règles d'entreprise, Use Cases = règles applicatives) avec une règle de dépendance interne.
```

---

## Pont vers le lab

> Lab associé : `labs/lab-06-architecture-hexagonale/README.md`. Concevoir l'hexagone d'un domaine TribuZen (Notifications) : dessiner les ports primaires/secondaires, placer les adapters, tracer le sens des dépendances et repérer les inversions manquées. Exercice de conception, évalué par grille + coach — zéro harnais.
