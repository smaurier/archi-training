---
titre: Clean Architecture (cercles concentriques)
cours: 13-architecture
notions: ["cercles concentriques", "entities / enterprise business rules", "use cases / application business rules", "interface adapters", "frameworks & drivers", "la dependency rule", "dépendances vers l'intérieur", "inversion de dépendance pour sortir du cercle", "distinction entity vs use case", "comparaison avec hexagonale et couches", "sur-coût / quand ne PAS l'appliquer"]
outcomes:
  - "sait nommer les 4 cercles de la clean architecture et dire ce que chacun contient"
  - "sait énoncer la dependency rule et vérifier qu'un import ne pointe que vers l'intérieur"
  - "sait distinguer une règle d'entité (enterprise) d'une règle de use case (application)"
  - "sait expliquer comment le cœur appelle l'extérieur sans violer la règle (inversion de dépendance)"
  - "sait situer la clean architecture par rapport à l'hexagonale (06) et aux couches (05)"
  - "sait décider quand la clean architecture est un sur-coût et choisir plus simple"
prerequis: ["Module 00 — posture d'architecte", "Module 01 — SOLID (surtout DIP)", "Module 02 — design patterns", "Module 03 — clean code / code smells", "Module 04 — dependency injection / IoC", "Module 05 — architecture en couches (règle de dépendance vers le bas)", "Module 06 — architecture hexagonale (ports & adapters, inversion du sens des dépendances)"]
next: 08-monolithe-modulaire-vs-microservices
libs: []
tribuzen: "backend NestJS de TribuZen — le use case « compléter une routine » modélisé en cercles (entité Routine, use case CompleteRoutine, adapters HTTP/Prisma)"
last-reviewed: 2026-07
---

# Clean Architecture (cercles concentriques)

> **Outcomes — tu sauras FAIRE :** nommer les 4 cercles, énoncer et vérifier la dependency rule, distinguer une règle d'entité d'une règle de use case, expliquer l'inversion qui permet au cœur d'appeler l'extérieur, situer la clean par rapport à l'hexagonale (06) et aux couches (05), et décider quand elle est un sur-coût.
> **Difficulté :** :star::star::star:
>
> **Portée :** ce module couvre la **clean architecture SEULEMENT** — les cercles concentriques de Robert C. Martin et sa dependency rule. Tu arrives avec deux acquis : la **règle de dépendance vers le bas** du modèle en couches (**module 05**) et l'**inversion du sens des dépendances** de l'hexagonale (ports & adapters, **module 06**). La clean **reprend** l'inversion de l'hexagonale et **raffine** le cœur en deux anneaux (entités vs use cases). On ne réexplique donc pas l'inversion de dépendance en détail (c'est le 06) ni le découpage horizontal (c'est le 05) : on montre ce que la clean **ajoute**. Le détail NestJS relève du **cours 09**, la persistance du **cours 10** : on raisonne archi, on n'implémente pas ligne à ligne.

## 1. Cas concret d'abord

Tu reprends le use case « compléter une routine » de TribuZen. Aux modules 05/06 tu l'as déjà rangé : le controller est un passe-plat, la règle « routine archivée non complétable » vit dans une entité, et l'accès Prisma passe par une interface `RoutineRepository`. Bien.

Maintenant une **nouvelle règle produit** arrive : *« quand un enfant complète une routine, sa série (streak) augmente ; à 7 jours d'affilée, il gagne un badge »*. Et une question de conception se pose : **où** poser chacune de ces deux règles ?

- Règle A : *« une série est un nombre de jours consécutifs ; elle se casse dès qu'un jour est sauté. »*
- Règle B : *« l'action "compléter une routine" enregistre la complétion du jour, recalcule la série, et si elle atteint 7, déclenche l'attribution d'un badge. »*

En couches (05) comme en hexagonale (06), les deux finiraient dans le même sac « métier » ou « cœur ». Mais elles n'ont pas la même **nature** :

1. La règle A décrit **ce qu'est une série** — elle serait vraie même sur papier, même sans TribuZen. C'est une règle qui appartient à la **notion métier** elle-même.
2. La règle B décrit **un scénario applicatif** — l'enchaînement précis « compléter → recalculer → peut-être badge » n'existe que parce que *cette application* le propose. Change le produit, ce scénario change ; la définition d'une série, non.

La clean architecture donne un nom et un **anneau distinct** à chacune : la règle A va dans une **Entity**, la règle B dans un **Use Case**. Ce module te donne cette distinction, la loi qui la protège (la dependency rule), et le critère pour savoir quand ce niveau de détail vaut son coût.

---

## 2. Théorie complète, concise

### 2.1 L'idée : des cercles concentriques, pas des couches horizontales

Le modèle en couches (05) empile des strates horizontales ; l'hexagonale (06) met un cœur au centre entouré d'adapters. La **clean architecture** (Robert C. Martin, 2012) reprend l'idée du cœur au centre et la dessine en **cercles concentriques** — comme les pellicules d'un oignon.

```
+===========================================================+
|  FRAMEWORKS & DRIVERS  (cercle 4)                         |
|  Web, UI, DB, devices, NestJS, Prisma, React             |
|  +=====================================================+  |
|  |  INTERFACE ADAPTERS  (cercle 3)                    |  |
|  |  Controllers, Presenters, Gateways/Repositories    |  |
|  |  +=============================================+   |  |
|  |  |  USE CASES  (cercle 2)                      |  |  |
|  |  |  Application business rules (interactors)   |  |  |
|  |  |  +---------------------------------------+  |  |  |
|  |  |  |  ENTITIES  (cercle 1)                 |  |  |  |
|  |  |  |  Enterprise business rules (le cœur)  |  |  |  |
|  |  |  +---------------------------------------+  |  |  |
|  |  +=============================================+   |  |
|  +=====================================================+  |
+===========================================================+

Flèches de dépendance du code source : toujours vers l'INTÉRIEUR -->
```

Plus tu vas vers le centre, plus c'est **stable et abstrait** (des règles). Plus tu vas vers l'extérieur, plus c'est **volatil et concret** (des outils). L'extérieur est jetable ; le centre, non.

### 2.2 Les quatre cercles

**Cercle 1 — Entities (Enterprise Business Rules).** Les règles métier qui existeraient **même sans ce logiciel**, valables au-delà de cette seule application. Dans TribuZen : *« une série se casse dès qu'un jour est sauté »*, *« une routine archivée ne peut pas être complétée »*. Ce sont des invariants de la **notion** elle-même, pas d'un écran.

**Cercle 2 — Use Cases (Application Business Rules).** L'orchestration **spécifique à cette application** : un scénario, un flux. *« Compléter une routine : charger la routine, enregistrer la complétion du jour, recalculer la série via l'entité, déclencher un badge à 7. »* Ce flux existe parce que TribuZen l'a décidé ; il manipule les entités mais ne contient pas leurs règles internes.

**Cercle 3 — Interface Adapters.** La **traduction** entre le format du cœur et celui de l'extérieur. Controllers (HTTP → appel de use case), Presenters (résultat de use case → view model), Gateways/Repositories (interface du cœur → requête concrète). Aucune règle métier ici : que de la conversion de formats.

**Cercle 4 — Frameworks & Drivers.** Les **détails** : NestJS, Prisma, PostgreSQL, React, le mailer. La clean les traite comme remplaçables. Idéalement, presque pas de code « à toi » ici — surtout de la glue et de la configuration.

### 2.3 La dependency rule — la loi absolue

C'est **le** point du module. Un seul énoncé :

> **« Source code dependencies must point only inward. »** — Robert C. Martin

Une dépendance de **code source** (un `import`) ne peut pointer que vers un cercle **plus intérieur** (ou le même). Jamais vers l'extérieur.

```
Autorisé (vers l'intérieur) :        Interdit (vers l'extérieur) :
  Use Case  --> Entity                 Entity   --> Use Case
  Controller --> Use Case              Use Case --> Controller
  PrismaRepo --> IRepository (cercle 2) Entity   --> Prisma / @nestjs/common
```

Corollaire pratique : **rien de ce qui est nommé dans un cercle intérieur ne doit apparaître dans le code d'un cercle plus intérieur.** Une entité n'importe pas un use case ; un use case n'importe pas un controller ni le nom d'un framework. Concrètement, un fichier du cercle 1 ou 2 ne contient **aucun** `import ... from '@nestjs/...'`, `from '@prisma/...'`, ni référence à HTTP.

Conséquence : si un cercle **externe** change (on passe de Prisma à autre chose, d'Express à Fastify), **aucun** cercle interne n'est modifié. Si une **entité** change, tout peut bouger — c'est normal, c'est le cœur du métier.

### 2.4 Comment le cœur appelle l'extérieur sans violer la règle

Le use case (cercle 2) a besoin de lire/écrire en base (cercle 4). Mais il n'a **pas le droit** de dépendre de l'extérieur. Contradiction ? Non — c'est réglé par l'**inversion de dépendance**, exactement le mécanisme vu à l'hexagonale (module 06, ne pas le réexpliquer ici) :

1. Le use case **définit une interface** dans son propre cercle : `RoutineRepository` (le contrat de ce dont il a besoin).
2. L'infrastructure (cercle 4/3) **implémente** cette interface : `PrismaRoutineRepository`.
3. Le use case n'appelle **que l'interface**. Il ignore qui est derrière.

La flèche d'`import` va alors de `PrismaRoutineRepository` **vers** `RoutineRepository` (de l'extérieur vers l'intérieur) : la dependency rule est respectée, alors même que l'exécution, elle, va du cœur vers la base. **Le sens du code source est inversé par rapport au sens de l'appel runtime.** C'est le même « inversion » que l'hexagonale ; la clean l'applique entre chaque paire de cercles.

### 2.5 Le flux de données (et le rôle du presenter)

Un scénario type traverse les cercles dans un sens à l'aller, remonte dans l'autre :

```
HTTP → [Controller c3] → [Use Case c2] → [Entity c1] → retour au Use Case
     → [Presenter c3] → View Model → [Response c4]
```

Détail propre à la clean, plus poussé que l'hexagonale de base : le use case **ne retourne pas** directement au controller. Il pousse son résultat dans une **output boundary** (une interface) qu'un **Presenter** implémente. Le use case ignore ainsi totalement si la sortie sera du JSON, du HTML ou un email. C'est le niveau d'isolation maximal — et, on le verra, une part de son sur-coût.

### 2.6 Entity vs Use Case : le test de discrimination

La distinction est **l'apport central** de la clean par rapport à 05/06. Le critère :

| Question | Si oui → | Cercle |
|---|---|---|
| Cette règle serait-elle vraie **sans ce logiciel**, sur papier, pour toute app du domaine ? | c'est une règle **d'entité** | 1 |
| Cette règle décrit-elle **un scénario/flux propre à cette application** ? | c'est un **use case** | 2 |

TribuZen :
- *« une série se casse si un jour est sauté »* → vrai sur papier → **Entity** `Streak`/`Routine`.
- *« compléter = enregistrer + recalculer + badge à 7 »* → scénario de l'app → **Use Case** `CompleteRoutine`.

Règle d'or de placement : **une entité ne connaît aucun use case** ; **un use case orchestre des entités** mais ne réimplémente pas leurs invariants.

### 2.7 Clean vs hexagonale vs couches — situer sans confondre

| Aspect | Couches (05) | Hexagonale (06) | Clean (07) |
|---|---|---|---|
| Métaphore | strates horizontales | cœur + ports/adapters | cercles concentriques |
| Sens des dépendances code | vers le **bas** | vers le **cœur** (inversé) | vers l'**intérieur** (inversé) |
| Domaine isolé de l'infra ? | **non** (dépend vers le bas) | **oui** (inversion) | **oui** (inversion) |
| Granularité du cœur | 1 bloc « métier » | 1 cœur | **2 anneaux** : entities + use cases |
| Presenters / output boundary | absent | implicite | **explicite** |
| Coût / cérémonie | faible | moyen | **élevé** |

À retenir : la clean **n'invente pas** l'isolation du domaine (c'est déjà l'hexagonale). Son ajout propre = **séparer explicitement enterprise (entities) et application (use cases)**, plus les presenters. Vois-la comme *« une hexagonale plus détaillée, avec le cœur coupé en deux »*.

### 2.8 Le sur-coût : quand ne PAS l'appliquer

La clean a un **prix** : plus de fichiers, plus d'interfaces, plus d'indirection, des DTO à chaque frontière, parfois des presenters/output boundaries. Ce coût n'est justifié que si le **domaine est riche et durable**. Signaux pour **ne pas** l'appliquer :

- **CRUD sans règles** (table de config, admin, blog) : les cercles ne protègent rien → sur-engineering. Reste en **couches (05)**.
- **Prototype / MVP / spike** : la cérémonie ralentit le time-to-learn. Flat ou MVC.
- **Petite équipe / petit périmètre** sans logique d'entreprise distincte de l'app : l'**hexagonale (06)** suffit souvent — tu gardes l'isolation sans le coût des deux anneaux + presenters.
- **Domaine anémique par nature** : s'il n'y a pas de vraie règle d'*entreprise* à distinguer de l'application, l'anneau « entities » séparé n'apporte rien.

Signaux **pour** l'appliquer : règles métier riches indépendantes de l'app, plusieurs points d'entrée (REST + CLI + job) sur la même logique, durée de vie longue, besoin de tester la logique sans aucune infra. La bonne posture (module 00) : **la clean est un curseur, pas un dogme** — on peut n'en prendre que l'inversion + les use cases, sans les presenters, si le contexte ne les justifie pas.

---

## 3. Worked examples

### Exemple 1 — Placer les deux règles du §1 dans les bons cercles

On reprend les règles A (série) et B (compléter + badge). But : montrer *où* vit chaque bout, sans écrire une implémentation complète.

**Cercle 1 — Entity : la règle A (ce qu'est une série).**

```ts
// core/entities/routine.entity.ts — AUCUN import framework/ORM
export class Routine {
  private constructor(
    readonly id: string,
    private readonly status: 'active' | 'archived',
  ) {}

  // Règle d'ENTREPRISE : une routine archivée n'est pas complétable (vraie sur papier)
  complete(day: string, previousDays: string[]): CompletionResult {
    if (this.status === 'archived') {
      throw new DomainError('Une routine archivée ne peut pas être complétée');
    }
    // Règle d'ENTREPRISE : la série = jours consécutifs, cassée si un jour saute
    const streak = Streak.from(previousDays).extend(day); // logique pure
    return { day, streak: streak.length };
  }
}
```

**Cercle 2 — Use Case : la règle B (le scénario applicatif).**

```ts
// core/use-cases/complete-routine.use-case.ts — dépend d'INTERFACES, pas de Prisma
export class CompleteRoutine {
  constructor(
    private readonly routines: RoutineRepository,   // interface (cercle 2)
    private readonly badges: BadgeGranter,           // interface (cercle 2)
  ) {}

  async execute(routineId: string, day: string): Promise<CompleteRoutineResult> {
    const routine = await this.routines.findById(routineId);      // via interface
    const history = await this.routines.completionDays(routineId); // via interface

    // Orchestration SPÉCIFIQUE à l'app : compléter, puis peut-être un badge
    const result = routine.complete(day, history); // la RÈGLE vit dans l'entité
    await this.routines.saveCompletion(routineId, day);

    if (result.streak === 7) {
      await this.badges.grant(routineId, 'seven-day-streak'); // flux applicatif
    }
    return { streak: result.streak, badgeAwarded: result.streak === 7 };
  }
}
```

**Ce que ça achète :**
- La définition d'une série (entité) ne connaît **rien** du badge : change la règle de badge, l'entité ne bouge pas.
- Le scénario « badge à 7 » (use case) n'est **pas** dans l'entité : une autre app du même domaine réutiliserait `Routine` sans hériter du badge.
- Ni l'entité ni le use case n'importent Prisma ou NestJS → testables sans infra (stubs d'interfaces).

### Exemple 2 — Tracer la dependency rule sur un graphe et trouver les violations

On te donne les imports d'un module. Flèche = « importe ». Valide chaque flèche contre la dependency rule (doit pointer vers l'intérieur).

```
CompleteRoutineController (c3) ──▶ CompleteRoutine (c2)        (A)
CompleteRoutine (c2)           ──▶ Routine (c1)                (B)
PrismaRoutineRepository (c4)   ──▶ RoutineRepository (c2)      (C)
Routine (c1)                   ──▶ PrismaClient (c4)           (D)
CompleteRoutine (c2)           ──▶ HttpException (c4, NestJS)  (E)
Routine (c1)                   ──▶ CompleteRoutine (c2)        (F)
```

- **(A)** c3 → c2, vers l'intérieur : **OK**.
- **(B)** c2 → c1, vers l'intérieur : **OK**.
- **(C)** c4 → c2 : l'infra importe l'**interface** définie dans le cœur (inversion, §2.4). Vers l'intérieur : **OK**.
- **(D)** c1 → c4 : une **entité importe l'ORM**. Vers l'extérieur : **violation grave**. Le cœur est pollué par un détail. Correctif : l'entité ne parle qu'à des interfaces/valeurs ; la base reste dans l'infra.
- **(E)** c2 → c4 (NestJS `HttpException`) : le use case dépend d'un **détail du framework HTTP**. Vers l'extérieur : **violation**. Le use case doit lever une erreur **métier** (`DomainError`), que l'adapter (c3) traduira en `HttpException`.
- **(F)** c1 → c2 : une **entité importe un use case**. Vers l'extérieur : **violation** (et inversion de la distinction du §2.6). L'entité doit tout ignorer des scénarios applicatifs.

Verdict : **3 violations (D, E, F)**. Seules A, B, C respectent la règle. Le test mental est toujours le même : *« cet import va-t-il vers un cercle plus intérieur ? »*

---

## 4. Pièges & misconceptions

### PIÈGE #1 — Confondre le sens du code source et le sens de l'appel runtime

La dependency rule parle des **imports** (code source), pas de l'exécution. À l'exécution, le use case appelle bien la base (cœur → extérieur). Mais l'`import` va de l'infra **vers** l'interface du cœur (extérieur → intérieur). Les deux sens sont **opposés**, et c'est voulu : c'est l'inversion de dépendance. Dire « le use case ne peut pas appeler la base » est faux ; c'est *« le use case ne peut pas **importer** la classe concrète de la base »* qui est vrai.

### PIÈGE #2 — Ranger toute la logique métier dans les use cases (cercle 2)

Erreur fréquente en venant de l'hexagonale : mettre *toutes* les règles dans les use cases et laisser des entités anémiques. La clean **distingue** : les invariants de la notion (série, statut archivé) vont dans l'**entité**. Le critère du §2.6 : *« vrai sans ce logiciel ? »* → entité. Sinon → use case. Un use case gras + entités vides, c'est la clean « de nom seulement ».

### PIÈGE #3 — « Clean = hexagonale + un dessin plus joli »

Non. L'apport réel et testable de la clean, c'est **deux choses concrètes** : (1) séparer *enterprise rules* (entities) et *application rules* (use cases), (2) les presenters/output boundaries qui isolent le use case du format de sortie. Si tu n'as ni domaine d'entreprise distinct de l'app, ni besoin d'output boundaries, tu fais en réalité de l'hexagonale — appelle-la ainsi, n'ajoute pas de cérémonie pour le nom.

### PIÈGE #4 — Croire que la structure de dossiers *fait* la clean

`core/`, `adapters/`, `frameworks/` ne garantissent rien (déjà vu au module 05, piège #1). Ce qui prouve la clean, c'est le **sens des imports** : un fichier de `core/entities/` qui `import`-e `@prisma/client` est dans le cercle 1 *de nom seulement*. Vérifie les dépendances, jamais l'arborescence.

### PIÈGE #5 — Appliquer les 4 cercles + presenters à un CRUD

Le sur-coût (§2.8). Sur une table de config sans règle, les entités ne protègent aucun invariant, les use cases sont des passe-plats, les presenters recopient des champs. Tu payes l'indirection sans rien acheter. Critère : *« ai-je de vraies règles d'entreprise, durables, indépendantes de l'app ? »* Si non → couches (05) ou hexagonale (06). La clean n'est pas « la version pro » du reste ; c'est un outil pour **domaines riches**.

### PIÈGE #6 — Prendre les presenters/output boundaries pour obligatoires

Ils sont l'élément le plus coûteux et le plus souvent inutile de la clean. Retourner un DTO simple depuis le use case suffit dans l'immense majorité des cas web. Les output boundaries se justifient quand un même use case doit alimenter plusieurs sorties très différentes (JSON + HTML serveur + email) sans les connaître. Sinon, garde-les hors du tableau — prendre l'inversion et les deux anneaux sans les presenters reste « assez clean ».

---

## 5. Ancrage TribuZen

Le backend NestJS de TribuZen a été rangé en couches (05) puis inversé côté domaine↔infra (06). La clean s'applique **là où le domaine est le plus riche** : le module **Routines** (créer, compléter, séries, badges) — cœur du produit et de sa science comportementale (renforcement, habitudes).

Cartographie cible du use case « compléter une routine » :

```
tribuzen-api/src/routines/
  core/
    entities/
      routine.entity.ts        ← cercle 1 : archivée non complétable
      streak.ts                 ← cercle 1 : définition d'une série (jours consécutifs)
    use-cases/
      complete-routine.ts       ← cercle 2 : compléter → recalculer → badge à 7
      ports/
        routine.repository.ts    ← interface (contrat), définie DANS le cœur
        badge-granter.ts         ← interface (contrat)
  adapters/
    routines.controller.ts      ← cercle 3 : HTTP → use case, DomainError → HttpException
  infrastructure/
    prisma-routine.repository.ts ← cercle 4/3 : implémente routine.repository.ts
```

Décisions concrètes pour TribuZen :

- **Où vit « série cassée si jour sauté » ?** Dans `streak.ts` (entité, cercle 1). Elle est vraie sur papier et sera **réutilisée telle quelle** par le futur job de **sync offline** (le mobile pousse des complétions en batch au retour réseau — même entité, autre point d'entrée).
- **Où vit « badge à 7 jours » ?** Dans le use case `complete-routine.ts` (cercle 2) : c'est un choix produit, pas une propriété de la notion « série ».
- **Prisma reste au cercle 4**, derrière `routine.repository.ts`. Le jour où une partie des données passe en **Level 1** (device-only, chiffré, cf. spec §8) au lieu du serveur, on change l'implémentation du repository — entités et use cases ne bougent pas.
- **Sur-coût assumé où ?** On applique la clean au module Routines (domaine riche). Pour un module CRUD comme **Préférences de notification** (peu de règles), on **reste en couches (05)** : décision documentée en ADR, pas de cérémonie inutile. Pas d'output boundaries/presenters pour l'instant — le use case renvoie un DTO simple (piège #6).

> **Défère :** le détail NestJS (modules, providers, tokens d'injection) est le **cours 09** ; le schéma Prisma et les requêtes, le **cours 10** ; les tests d'un use case sans infra, le **cours 06**. Ici on décide **dans quel cercle** vit chaque responsabilité, pas comment on l'écrit ligne à ligne.

---

## 6. Points clés

1. La clean architecture organise le code en **4 cercles concentriques** : Entities (c1), Use Cases (c2), Interface Adapters (c3), Frameworks & Drivers (c4).
2. **La dependency rule** est la loi absolue : les dépendances du **code source** (imports) ne pointent que vers l'**intérieur** ; jamais vers l'extérieur.
3. Le cœur appelle l'extérieur **sans violer la règle** grâce à l'**inversion de dépendance** (héritée de l'hexagonale) : le cœur définit une interface, l'infra l'implémente.
4. **Entity vs Use Case** = l'apport central : entité = règle vraie sans le logiciel (enterprise) ; use case = scénario propre à l'application.
5. Sens **code source** ≠ sens **runtime** : à l'exécution le cœur appelle la base, mais l'import va de l'infra vers l'interface du cœur.
6. **Presenters / output boundaries** isolent le use case du format de sortie — puissant mais coûteux, souvent optionnel.
7. Clean = « hexagonale (06) plus détaillée, cœur coupé en deux » ; elle n'invente pas l'isolation du domaine, elle la **raffine**.
8. **Sur-coût** : à réserver aux domaines riches et durables. Pour un CRUD, un MVP ou un petit périmètre → couches (05) ou hexagonale (06). La clean est un curseur, pas un dogme.

---

## 7. Seeds Anki

```
Quels sont les 4 cercles de la clean architecture, du centre vers l'extérieur ?|1. Entities (enterprise business rules), 2. Use Cases (application business rules), 3. Interface Adapters (controllers/presenters/gateways), 4. Frameworks & Drivers (Web, DB, UI, NestJS, Prisma).
Énonce la dependency rule.|Les dépendances du code source (imports) ne doivent pointer que vers l'intérieur : un cercle ne peut jamais importer/nommer un élément d'un cercle plus externe.
Comment le cœur (use case) appelle-t-il la base sans violer la dependency rule ?|Par inversion de dépendance : le use case définit une interface (ex. RoutineRepository) dans son cercle ; l'infra l'implémente. L'import va de l'infra vers l'interface (vers l'intérieur), même si l'appel runtime va du cœur vers la base.
Différence entre une Entity et un Use Case en clean architecture ?|Entity = règle vraie même sans ce logiciel, valable pour tout le domaine (ex. « une série se casse si un jour est sauté »). Use Case = scénario/flux propre à cette application (ex. « compléter → recalculer série → badge à 7 »).
Sens du code source vs sens de l'appel runtime : quel est le piège ?|Ils sont opposés et c'est voulu. Runtime : le use case appelle la base. Code source : l'import va de l'infra vers l'interface du cœur (vers l'intérieur). Interdit = importer la classe concrète, pas appeler la base.
Qu'apporte la clean architecture par rapport à l'hexagonale ?|Elle raffine le cœur en deux anneaux (entities vs use cases) et ajoute des presenters/output boundaries. Elle n'invente pas l'isolation du domaine (déjà dans l'hexagonale) ; elle la détaille. Coût plus élevé.
Quand NE PAS appliquer la clean architecture ?|CRUD sans règles, prototype/MVP, petit périmètre sans logique d'entreprise distincte de l'app, domaine anémique. Dans ces cas → couches (05) ou hexagonale (06). Réservée aux domaines riches et durables.
Une entité qui importe @prisma/client ou lève une HttpException : verdict ?|Violation de la dependency rule (dépendance vers l'extérieur). L'entité doit ignorer ORM et HTTP ; elle lève une DomainError, traduite en HttpException par l'adapter (cercle 3).
Les presenters/output boundaries sont-ils obligatoires en clean ?|Non. C'est l'élément le plus coûteux et souvent inutile. Retourner un DTO simple depuis le use case suffit dans la plupart des cas web ; les output boundaries se justifient pour alimenter plusieurs sorties très différentes sans les connaître.
```

---

## Pont vers le lab

> Lab associé : `labs/lab-07-clean-architecture/README.md`. Mapper un feature TribuZen sur les 4 cercles, placer chaque règle dans le bon anneau (entity vs use case), tracer la dependency rule et repérer les violations, puis décider si la clean vaut son coût ici. Exercice de conception, évalué par grille + coach — zéro harnais.
