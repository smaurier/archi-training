---
titre: Architecture en couches (Layered Architecture)
cours: 13-architecture
notions: ["couche présentation", "couche métier / domaine", "couche accès aux données", "règle de dépendance vers le bas", "séparation des responsabilités", "layering strict vs relâché", "fat controller", "anemic domain model", "limites du modèle en couches"]
outcomes:
  - "sait découper un système en couches présentation / métier / données et justifier la frontière de chaque couche"
  - "sait énoncer et appliquer la règle de dépendance (les dépendances ne pointent que vers le bas)"
  - "sait repérer une violation de dépendance (couche qui saute une couche ou pointe vers le haut)"
  - "sait diagnostiquer un fat controller et un anemic domain model, et nommer la dérive"
  - "connaît les limites du modèle en couches et sait quand il ne suffit plus"
prerequis: ["Module 00 — posture d'architecte", "Module 01 — principes SOLID (surtout SRP et DIP)", "Module 02 — design patterns", "Module 03 — clean code / code smells", "Module 04 — dependency injection / IoC"]
next: 06-architecture-hexagonale
libs: []
tribuzen: "backend NestJS de TribuZen — découpage du module Routines en couches présentation / application / domaine / infrastructure"
last-reviewed: 2026-07
---

# Architecture en couches (Layered Architecture)

> **Outcomes — tu sauras FAIRE :** découper un système en couches, appliquer la règle de dépendance vers le bas, repérer les violations (couche qui saute ou remonte), diagnostiquer fat controller et anemic domain, et dire quand le modèle en couches atteint ses limites.
> **Difficulté :** :star::star:
>
> **Portée :** ce module pose les **bases** du bloc « patterns architecturaux ». On couvre le découpage en couches et sa règle de dépendance — SEULEMENT. L'**architecture hexagonale** (ports & adapters, inversion du sens des dépendances) est le **module 06**, et la **clean architecture** (cercles concentriques, règle de dépendance vers le centre) le **module 07**. Ici, on reste sur le modèle en couches horizontal classique. Le détail de l'implémentation NestJS relève du **cours 09**, la persistance du **cours 10** : on raisonne archi, on n'implémente pas.

## 1. Cas concret d'abord

Tu reprends le backend NestJS de TribuZen. Un contributeur a livré le endpoint « compléter une routine ». Tout est dans un seul fichier `routines.controller.ts` :

```ts
// routines.controller.ts — AVANT (tout empilé dans le controller)
@Controller('routines')
export class RoutinesController {
  constructor(private readonly prisma: PrismaService) {}

  @Post(':id/complete')
  async complete(@Param('id') id: string, @Body() body: { childId: string }) {
    // 1. Accès direct à la base depuis le controller HTTP
    const routine = await this.prisma.routine.findUnique({ where: { id } });
    if (!routine) throw new NotFoundException();

    // 2. Règle métier écrite en dur dans le controller
    if (routine.status === 'archived') {
      throw new BadRequestException('routine archivée');
    }
    const today = new Date().toISOString().slice(0, 10);
    const already = await this.prisma.completion.findFirst({
      where: { routineId: id, childId: body.childId, day: today },
    });
    if (already) throw new BadRequestException('déjà complétée aujourd’hui');

    // 3. Persistance + calcul de série (streak) mélangés
    await this.prisma.completion.create({
      data: { routineId: id, childId: body.childId, day: today },
    });
    const streak = await this.prisma.completion.count({
      where: { routineId: id, childId: body.childId },
    });
    return { ok: true, streak };
  }
}
```

Ce code marche. Mais pose-toi trois questions :

1. **Où est la règle métier** « une routine archivée ne peut pas être complétée » ? Noyée dans une méthode HTTP. Impossible à tester sans monter un contrôleur et une requête HTTP.
2. **Qui parle à la base ?** Le controller HTTP lui-même. Si demain TribuZen expose la même action via une commande CLI ou un job de synchronisation offline, il faut **réécrire** la logique.
3. **Que se passe-t-il si on change d'ORM** (Prisma → autre) ? Il faut toucher au controller, à la couche qui n'a rien à voir avec le stockage.

Ce controller fait **trois métiers** : parler HTTP, décider des règles, et lire/écrire la base. C'est un **fat controller**. Ce module te donne le vocabulaire et la règle pour ranger ça en couches.

---

## 2. Théorie complète, concise

### 2.1 L'idée : empiler des responsabilités par niveau

L'architecture en couches (*layered architecture*) organise le code en **strates horizontales superposées**, chacune avec **une responsabilité unique** et un rôle connu. Une requête traverse les couches de haut en bas ; la réponse remonte.

Le découpage canonique à **trois couches** (le socle minimal à connaître) :

```
┌─────────────────────────────────────────┐
│   COUCHE PRÉSENTATION                    │
│   Controllers, routes, DTO, validation   │
│   Parle : HTTP / WebSocket / CLI         │
└─────────────────────────────────────────┘
                  │ appelle
                  ▼
┌─────────────────────────────────────────┐
│   COUCHE MÉTIER / DOMAINE                 │
│   Services, règles, entités              │
│   Parle : le langage du problème         │
└─────────────────────────────────────────┘
                  │ appelle
                  ▼
┌─────────────────────────────────────────┐
│   COUCHE ACCÈS AUX DONNÉES               │
│   Repositories, ORM, requêtes SQL        │
│   Parle : persistance / I/O              │
└─────────────────────────────────────────┘
```

Beaucoup de projets scindent la couche métier en **deux** (application vs domaine) pour obtenir **quatre** couches : présentation / application (orchestration, transactions) / domaine (règles pures) / infrastructure (persistance, I/O). Trois ou quatre, le principe est identique. Retiens les **trois** fondamentales ; le passage à quatre est une raffinement, pas un modèle différent.

### 2.2 La règle d'or : les dépendances ne pointent que vers le bas

C'est **le** point à retenir. Chaque couche ne connaît que la couche **directement en dessous** (ou plus bas). Aucune couche ne connaît la couche **au-dessus** d'elle.

- La présentation connaît le métier. Le métier **ignore** qu'il existe une couche HTTP.
- Le métier connaît l'accès aux données. La couche données **ignore** les règles métier.

Concrètement, dans le code : `routines.controller.ts` **importe** `RoutinesService`, mais `RoutinesService` n'importe **jamais** le controller. Le domaine ne doit pas contenir `import ... from '@nestjs/common'` lié au HTTP.

Cette contrainte de sens unique est ce qui rend le système **compréhensible** (le flux va toujours dans le même sens) et **testable** (on peut tester une couche en simulant/mockant la couche du dessous).

### 2.3 Séparation des responsabilités (SoC)

Chaque couche isole **une raison de changer** (c'est SRP appliqué à l'échelle architecturale, vu au module 01) :

| Couche | Change quand… |
|--------|---------------|
| Présentation | le contrat d'API change (nouveau champ HTTP, nouveau format) |
| Métier / domaine | une **règle** change (« routine archivée non complétable ») |
| Données | on change d'ORM, de schéma de stockage, de base |

Ranger le code par « raison de changer » garantit qu'un changement de base de données ne touche pas aux règles, et qu'un changement de règle ne touche pas au format HTTP. C'est l'intérêt principal du modèle.

### 2.4 Layering strict vs relâché

Deux variantes de la règle de dépendance :

- **Strict** : une couche ne parle **qu'à** la couche immédiatement en dessous. La présentation ne peut pas appeler directement la couche données ; elle **doit** passer par le métier. Flux limpide, mais parfois beaucoup de code « passe-plat ».
- **Relâché** (*relaxed*) : une couche peut **sauter** une couche intermédiaire pour un cas trivial. Exemple : lire une liste de référence en lecture seule (pays, fuseaux horaires) directement depuis la couche données sans passer par le métier.

Le relâché se **choisit consciemment** pour éviter la verbosité sur les cas sans règle. Le danger : glisser vers le relâché **par accident**, jusqu'à ce que plus personne ne sache quelle couche parle à quelle couche. Décide, documente, tiens la ligne.

### 2.5 Dérive n°1 : le fat controller

Un **fat controller** (controller obèse) est une couche présentation qui absorbe des responsabilités des couches du dessous : règles métier, accès direct à la base, calculs. C'est exactement le cas concret du §1.

Symptômes :
- le controller `import` l'ORM / le client de base ;
- des `if` de règle métier (`if (status === 'archived')`) vivent dans une méthode HTTP ;
- impossible de tester la règle sans simuler une requête HTTP.

Le fat controller **viole la règle de dépendance** (la présentation saute le métier pour parler aux données) **et** la séparation des responsabilités.

### 2.6 Dérive n°2 : l'anemic domain model

L'**anemic domain model** (domaine anémique) est le symptôme **miroir**. Ici les objets métier sont des **sacs de données** sans comportement — juste des champs publics — et **toute** la logique migre dans les services.

```ts
// Domaine anémique : Routine ne sait rien faire, c'est une structure vide
class Routine {
  id: string;
  status: string;   // aucune règle : n'importe qui peut écrire status = 'n’importe quoi'
  archivedAt: Date | null;
}

// La règle vit hors de l'objet qu'elle concerne (dans le service)
class RoutineService {
  complete(routine: Routine) {
    if (routine.status === 'archived') throw new Error('...'); // règle orpheline
    // ...
  }
}
```

Le problème : la règle « une routine archivée n'est pas complétable » n'est **pas** protégée par l'objet `Routine`. N'importe quel service peut oublier de la vérifier. Le domaine n'encapsule pas ses invariants.

Le correctif : donner le **comportement** à l'entité, qui garde ses invariants.

```ts
// Domaine riche : Routine protège ses propres règles
class Routine {
  private constructor(
    readonly id: string,
    private status: RoutineStatus,
  ) {}

  complete(childId: string, day: string): Completion {
    if (this.status === RoutineStatus.Archived) {
      throw new DomainError('Une routine archivée ne peut pas être complétée');
    }
    return Completion.create(this.id, childId, day);
  }
}
```

> **Nuance importante :** anémique n'est pas *toujours* un défaut. Pour un CRUD sans règles (une table de configuration), un modèle anémique + service est parfaitement acceptable. Ça devient une **dérive** quand un domaine à **vraies règles** se retrouve vidé de son comportement. La modélisation riche du domaine (entités, agrégats, invariants) est approfondie au **module 10 (DDD tactique)** — ici on nomme juste la dérive.

### 2.7 Limites du modèle en couches

Le layering horizontal est un excellent point de départ, mais il montre ses limites :

1. **Le domaine dépend encore de l'infrastructure.** Dans le modèle en couches classique, le métier appelle *vers le bas* la couche données — il en **dépend** donc au niveau du code. Changer de base peut faire remonter des contraintes techniques jusqu'au métier. C'est précisément ce que l'**hexagonale (module 06)** corrige en **inversant** cette dépendance (le domaine définit une interface, l'infrastructure l'implémente).
2. **Découpage horizontal ≠ découpage par fonctionnalité.** Ajouter la feature « routines » touche la présentation *et* le métier *et* les données : trois couches, trois dossiers. Le découpage **vertical par fonctionnalité** (vertical slice, vu plus loin dans le parcours) répond à ce reproche.
3. **La couche du milieu enfle.** Sans discipline, la couche service devient un fourre-tout d'orchestration (le pendant du fat controller, un cran plus bas).
4. **Passe-plats.** En strict, beaucoup de code ne fait que transmettre. Pour un CRUD trivial, 3-4 couches c'est du sur-engineering (over-engineering).

Le modèle en couches est le **socle** : simple, universel, enseignable. Les modules 06 et 07 en corrigent la principale faiblesse (le sens des dépendances) — mais il faut d'abord maîtriser le socle.

---

## 3. Worked examples

### Exemple 1 — Refactorer le fat controller du §1 en trois couches

On reprend le controller obèse et on le range. But : la règle métier vit dans le métier, la base est parlée par un repository, le controller ne fait plus que du HTTP.

**Couche présentation — ne parle que HTTP, délègue tout :**

```ts
// routines.controller.ts — APRÈS
@Controller('routines')
export class RoutinesController {
  constructor(private readonly routines: CompleteRoutineService) {}

  @Post(':id/complete')
  async complete(@Param('id') id: string, @Body() dto: CompleteRoutineDto) {
    // Aucune règle, aucune base : on traduit HTTP -> appel métier -> HTTP
    const streak = await this.routines.execute(id, dto.childId);
    return { ok: true, streak };
  }
}
```

**Couche métier — orchestre et porte la règle :**

```ts
// complete-routine.service.ts
export class CompleteRoutineService {
  // Dépend de l'INTERFACE du repository, pas de Prisma directement (DI, module 04)
  constructor(private readonly repo: RoutineRepository) {}

  async execute(routineId: string, childId: string): Promise<number> {
    const routine = await this.repo.findById(routineId);
    if (!routine) throw new RoutineNotFoundError(routineId);

    const day = new Date().toISOString().slice(0, 10);
    if (await this.repo.hasCompletion(routineId, childId, day)) {
      throw new AlreadyCompletedError();
    }

    // La règle « archivée non complétable » vit dans l'entité (domaine riche)
    const completion = routine.complete(childId, day);

    await this.repo.saveCompletion(completion);
    return this.repo.countCompletions(routineId, childId);
  }
}
```

**Couche accès aux données — ne parle que persistance :**

```ts
// routine.repository.ts (interface, côté métier) + prisma.routine.repository.ts (impl)
export interface RoutineRepository {
  findById(id: string): Promise<Routine | null>;
  hasCompletion(routineId: string, childId: string, day: string): Promise<boolean>;
  saveCompletion(c: Completion): Promise<void>;
  countCompletions(routineId: string, childId: string): Promise<number>;
}
```

**Ce que le refactor achète :**
- La règle est testable **sans HTTP ni base** : `routine.complete(...)` est une fonction pure sur l'entité.
- Exposer la même action en CLI/job réutilise `CompleteRoutineService` tel quel — seule la présentation change.
- Changer d'ORM ne touche que l'implémentation du repository ; le métier et la présentation ne bougent pas.
- Le sens des dépendances est respecté : controller → service → repository. Rien ne remonte.

### Exemple 2 — Repérer les violations de dépendance dans un schéma

On te donne le graphe d'imports d'un module. Flèche = « importe / appelle ». Trouve les violations.

```
PaymentController  ──▶ StripeGateway        (A)
PaymentController  ──▶ SubscriptionService  (B)
SubscriptionService ──▶ SubscriptionRepo    (C)
SubscriptionRepo   ──▶ PaymentController     (D)
Subscription (entité) ──▶ HttpException      (E)
```

Analyse couche par couche :

- **(B)** présentation → métier : **OK**, sens descendant normal.
- **(C)** métier → données : **OK**, sens descendant normal.
- **(A)** présentation → **données/infra** en sautant le métier : **violation** en layering strict (le controller parle directement à la passerelle de paiement). Tolérable seulement si tu as *consciemment* choisi le relâché — ce qui n'est pas le cas ici, car il y a une vraie règle d'abonnement derrière.
- **(D)** données → **présentation** : **violation grave**. Une dépendance qui **remonte**. Le repository ne doit jamais connaître un controller. Symptôme classique d'un couplage circulaire.
- **(E)** entité domaine → `HttpException` : **violation**. Le domaine dépend d'un détail de la couche présentation (HTTP). Le domaine doit lever une erreur **métier** (`DomainError`), traduite en `HttpException` par la présentation.

Verdict : trois flèches à corriger (A, D, E). Seul le squelette B-C respecte la règle.

---

## 4. Pièges & misconceptions

### PIÈGE #1 — « Trois couches = trois dossiers, donc j'ai une bonne architecture »

Faux. Créer des dossiers `presentation/`, `domain/`, `data/` ne garantit rien. Ce qui compte, c'est le **sens des imports**. Un dossier `domain/` qui `import` l'ORM ou lève une `HttpException` est en couches *de nom seulement*. La structure de dossiers est cosmétique ; la **règle de dépendance** est réelle. Vérifie les imports, pas l'arborescence.

### PIÈGE #2 — Confondre « couche » et « tier »

*Layer* (couche) et *tier* (palier) ne sont pas synonymes. Une **couche** est une séparation **logique** dans le code. Un **tier** est une séparation **physique** (processus/machine différents : navigateur, serveur d'app, serveur de base). Une application 3-couches peut tourner sur 1 seul tier (un monolithe). Découper en couches ne veut **pas** dire déployer sur des machines séparées.

### PIÈGE #3 — Prendre le fat controller pour de la « simplicité »

« Tout dans le controller, c'est plus simple, moins de fichiers. » À court terme oui. Mais la logique devient non testable sans HTTP, non réutilisable hors HTTP, et le controller mélange trois raisons de changer. La simplicité apparente cache un couplage fort. Le vrai critère de simplicité : *puis-je tester la règle sans monter une requête ?*

### PIÈGE #4 — Croire que « anemic domain » est toujours un anti-pattern

Non. Pour un CRUD sans règles (table de config, données de référence), un modèle de données passif + service est adéquat et sans surcoût. L'anémie devient une **dérive** uniquement quand un domaine à **vraies invariants** est vidé de son comportement, laissant des règles orphelines éparpillées dans les services (avec le risque qu'un service oublie de les appliquer). Le critère : *y a-t-il des règles qui devraient être protégées par l'objet ?*

### PIÈGE #5 — Croire que le modèle en couches classique isole le domaine de l'infra

Piège subtil et important pour la suite. Dans le layering **horizontal classique**, le domaine dépend de la couche données *au niveau du code* (il l'appelle vers le bas). Il n'est donc **pas** totalement isolé de l'infrastructure. C'est une **limite du modèle**, pas une propriété acquise. L'isolation réelle du domaine demande d'**inverser** la dépendance — c'est l'objet des modules 06 (hexagonale) et 07 (clean). Ne dis pas « couches = domaine isolé » : dis « couches = flux descendant discipliné ».

### PIÈGE #6 — Layering relâché « par flemme » vs « par décision »

Sauter une couche pour une lecture triviale peut être légitime (relaxed layering assumé). Mais si tu sautes une couche parce que « c'était plus rapide », sans décision documentée, tu ouvres la porte au chaos : bientôt personne ne sait qui parle à qui. Le relâché est un **choix explicite**, jamais un défaut par facilité.

---

## 5. Ancrage TribuZen

Le backend de TribuZen est un NestJS structuré en couches (c'est la base sur laquelle les modules 06-07 ajouteront l'hexagonale/clean). Le module **Routines** — cœur du produit (créer, compléter, calculer les séries) — est le terrain de ce module.

Découpage cible du module `routines` :

```
tribuzen-api/
  src/
    routines/
      presentation/
        routines.controller.ts      ← HTTP uniquement, DTO + validation
        complete-routine.dto.ts
      application/
        complete-routine.service.ts ← orchestration + transaction
      domain/
        routine.entity.ts           ← règles : archivée non complétable, série
        routine.repository.ts        ← interface (contrat), pas d'impl
      infrastructure/
        prisma-routine.repository.ts ← implémente l'interface avec Prisma
```

Décisions de couches concrètes pour TribuZen :

- **La règle « une routine archivée ne peut pas être complétée »** vit dans `routine.entity.ts` (domaine), pas dans le controller. Testable en isolation, réutilisable par le futur job de **sync offline** (React Query/MMKV côté mobile poussera des complétions en batch au retour réseau — même service, autre présentation).
- **Le calcul de série (streak)** est une règle métier : couche domaine/application, pas une requête SQL ad hoc dans le controller.
- **Prisma est un détail d'infrastructure.** Le domaine parle à l'interface `RoutineRepository`. Le jour où une partie des données passe en Level 1 (device-only, chiffré) au lieu du serveur, on change l'implémentation du repository — le domaine des routines ne bouge pas.

> **Défère :** le détail NestJS (modules, providers, injection concrète) est le **cours 09** ; le schéma Prisma et les requêtes, le **cours 10**. Ici on décide **où** vit chaque responsabilité, pas comment on l'écrit ligne à ligne.

---

## 6. Points clés

1. L'architecture en couches empile des strates horizontales (présentation / métier / données), chacune à responsabilité unique.
2. **Règle d'or :** les dépendances ne pointent **que vers le bas** — aucune couche ne connaît celle du dessus.
3. Chaque couche isole **une raison de changer** (SoC / SRP à l'échelle archi) : HTTP, règles, stockage évoluent indépendamment.
4. Layering **strict** = ne parler qu'à la couche juste en dessous ; **relâché** = sauter une couche, mais seulement par **décision** assumée.
5. **Fat controller** = la présentation absorbe règles + accès données → viole la règle de dépendance et SoC.
6. **Anemic domain model** = objets sans comportement, règles orphelines dans les services — dérive seulement si le domaine a de vraies invariants.
7. **Limite majeure :** le domaine dépend encore de l'infra (appel vers le bas). L'isolation réelle passe par l'**inversion** de dépendance → modules 06 (hexagonale) et 07 (clean).
8. Couche (logique) ≠ tier (physique) : découper en couches ne dit rien du déploiement.

---

## 7. Seeds Anki

```
Quelle est la règle d'or de l'architecture en couches ?|Les dépendances ne pointent que vers le bas : chaque couche ne connaît que la couche directement en dessous, jamais celle au-dessus.
Quelles sont les 3 couches fondamentales du modèle en couches ?|Présentation (HTTP/UI/DTO), Métier/Domaine (règles, entités), Accès aux données (repositories, ORM). Souvent scindé en 4 : présentation / application / domaine / infrastructure.
Qu'est-ce qu'un fat controller ?|Une couche présentation qui absorbe des responsabilités des couches du dessous (règles métier, accès direct à la base). Il viole la règle de dépendance (saute le métier) et la séparation des responsabilités.
Qu'est-ce qu'un anemic domain model, et est-ce toujours un défaut ?|Des objets métier sans comportement (sacs de données), toute la logique migrant dans les services. Ce n'est une dérive que si le domaine a de vraies invariants ; pour un CRUD sans règles, un modèle anémique est acceptable.
Différence entre layering strict et relâché ?|Strict : une couche ne parle qu'à celle juste en dessous. Relâché : une couche peut sauter une couche intermédiaire — mais uniquement par décision assumée, jamais par facilité.
Quelle est la principale limite du modèle en couches classique ?|Le domaine dépend encore de l'infrastructure (il l'appelle vers le bas). Il n'est pas isolé des détails techniques ; l'isolation réelle demande d'inverser la dépendance (hexagonale/clean).
Couche (layer) vs tier : quelle différence ?|Une couche est une séparation logique dans le code ; un tier est une séparation physique (processus/machine). Une app 3-couches peut tourner sur un seul tier (monolithe).
Comment repérer une violation de la règle de dépendance ?|Une flèche d'import qui remonte (couche basse important une couche haute) ou qui saute une couche sans décision de relâché. Ex : un repository qui importe un controller, ou une entité domaine qui lève une HttpException.
Où doit vivre la règle « une routine archivée ne peut pas être complétée » ?|Dans l'entité du domaine (routine.entity.ts), pas dans le controller. Ainsi elle est testable sans HTTP et réutilisable par un autre point d'entrée (CLI, job de sync).
```

---

## Pont vers le lab

> Lab associé : `labs/lab-05-architecture-en-couches/README.md`. Organiser un système TribuZen en couches à partir d'un pêle-mêle de responsabilités, tracer le graphe de dépendances, repérer les violations et proposer le rangement. Exercice de conception, évalué par grille + coach — zéro harnais.
