---
titre: DDD tactique (entités, value objects, agrégats, events, services, repositories)
cours: 13-architecture
notions: ["entité (identité + cycle de vie)", "value object (immuable, comparé par valeur)", "agrégat", "racine d'agrégat (aggregate root)", "invariant métier", "frontière de cohérence transactionnelle", "référence entre agrégats par ID", "domain event (fait métier au passé)", "domain service (règle sans foyer)", "application service vs domain service", "repository (abstraction d'accès à l'agrégat)", "specification (critère composable)"]
outcomes:
  - "sait distinguer une entité (identité) d'un value object (valeur immuable) et justifier le choix pour un concept donné"
  - "sait délimiter un agrégat, désigner sa racine et lister les invariants qu'elle protège"
  - "sait appliquer les règles d'or de l'agrégat (modification via la racine, référence aux autres agrégats par ID, une frontière transactionnelle par agrégat)"
  - "sait identifier les domain events d'un agrégat et les nommer au passé"
  - "sait placer une règle métier dans l'entité, le domain service ou l'application service selon son foyer"
  - "sait définir une interface de repository côté domaine et composer des critères avec le specification pattern"
prerequis: ["Modules 00-08 du cours 13-architecture (posture, SOLID, patterns, clean code, DI, couches, hexagonale, clean archi)", "Module 09 — DDD stratégique (bounded contexts, ubiquitous language, context map)"]
next: 11-api-design-et-backend-patterns
libs: []
tribuzen: "backend NestJS de TribuZen — modélisation tactique de l'agrégat Famille (co-référents, invariant max 8) et de l'agrégat Sortie du domaine sorties partagées"
last-reviewed: 2026-07
---

# DDD tactique (entités, value objects, agrégats, events, services, repositories)

> **Outcomes — tu sauras FAIRE :** distinguer entité et value object, délimiter un agrégat et sa racine, lister ses invariants, appliquer les règles d'or de l'agrégat, nommer les domain events, placer une règle dans le bon service, et définir un repository + des specifications côté domaine.
> **Difficulté :** :star::star::star:
>
> **Portée :** ce module est le versant **tactique** du DDD — les briques de modélisation *dans* un bounded context. Il **s'appuie** sur le module 09 (DDD **stratégique** : bounded contexts, ubiquitous language, context map) : on suppose ici qu'on a **déjà** délimité un contexte et son langage. On couvre entités, value objects, agrégats + racine/invariants, domain events, domain services, repositories, specifications — SEULEMENT. L'**event sourcing** (reconstruire l'état depuis le flux d'events) et **CQRS** (séparer lecture/écriture) sont le **module 18**, on les **défère**. L'implémentation NestJS ligne à ligne relève du **cours 09**, le schéma Prisma et les requêtes SQL du **cours 10** : ici on décide **où** vit chaque responsabilité et **comment on modélise**, pas comment on branche l'ORM.

## 1. Cas concret d'abord

Tu reprends le backend NestJS de TribuZen. Le domaine **Famille** gère les co-référents (les adultes qui co-gèrent une tribu — jusqu'à 8, cf. offre « Famille »). Un contributeur a livré la gestion des membres comme un sac de données manipulé de l'extérieur :

```ts
// family.ts — AVANT : un sac de données sans protection
export class Family {
  id: string;
  members: { email: string; role: string }[] = [];   // public, mutable par n'importe qui
  ownerId: string;
}

// invite-coreferent.service.ts — la règle vit HORS de l'objet qu'elle concerne
export class InviteCoReferentService {
  invite(family: Family, email: string, role: string) {
    // Règle « max 8 » orpheline dans le service : un AUTRE service peut l'oublier
    if (family.members.length >= 8) throw new Error('famille pleine');
    family.members.push({ email, role });   // mutation directe, aucune garantie
  }
}
```

Ce code marche. Mais pose-toi quatre questions :

1. **Qui garantit qu'une famille n'a jamais 9 membres ?** Personne. `family.members.push(...)` est accessible partout. La règle « max 8 » vit dans *un* service ; le prochain contributeur qui ajoute un membre ailleurs l'oubliera. La règle est **orpheline**.
2. **Un `role` est une `string` libre.** Rien n'empêche `role: "n'importe quoi"`. Le concept « rôle d'un co-référent » n'est protégé nulle part.
3. **Deux membres avec le même email ?** Autorisé — l'unicité n'est garantie par aucun objet.
4. **`members` est modifiable de l'extérieur** sans passer par un point d'entrée contrôlé. Impossible de raisonner sur l'état d'une famille : n'importe quel code peut l'avoir changé.

Ces quatre problèmes ont **un** nom en DDD tactique : l'objet `Family` n'est pas un **agrégat** qui protège ses **invariants**. Ce module te donne le vocabulaire (entité, value object, agrégat, racine, invariant, event, repository) et les règles pour transformer ce sac de données en un modèle de domaine qui **ne peut pas** entrer dans un état invalide.

---

## 2. Théorie complète, concise

Le DDD tactique fournit un petit jeu de **briques de modélisation**. On les prend dans l'ordre : d'abord ce qui a une identité (entité) vs ce qui n'en a pas (value object), puis comment on regroupe pour protéger la cohérence (agrégat), puis ce qui se passe (event), qui porte les règles sans foyer (service), et comment on récupère/persiste (repository, specification).

### 2.1 Entité — définie par son identité

Une **entité** est un objet défini par une **identité stable** qui persiste à travers les changements d'état. Deux entités sont « la même » si elles ont le **même identifiant**, même si tous leurs autres attributs diffèrent.

- Possède un identifiant unique (souvent un UUID).
- Change d'état au fil du temps (une routine passe d'active à archivée).
- Comparaison par **ID**, jamais par valeur : `family.id === other.id`, pas `family.name === other.name`.
- A un **cycle de vie** : créée, modifiée, éventuellement archivée/supprimée.

Exemples TribuZen : `Family`, `Routine`, `Sortie` (une sortie planifiée). Chacune a une identité propre qui ne change jamais.

> Détail sécurité (approfondi au **cours 14**) : générer les IDs en **UUID v4** plutôt qu'en entiers séquentiels évite l'énumération (IDOR) — on ne devine pas `/families/551` à partir de `/families/550`.

### 2.2 Value object — défini par sa valeur, immuable

Un **value object (VO)** est défini par ses **attributs**, sans identité propre. Deux VO avec les mêmes valeurs sont **interchangeables** (deux `TimeWindow` « 7h-21h » sont égaux). Propriétés :

- **Pas d'ID.**
- **Immuable** : toute « modification » retourne un **nouvel** objet (`readonly` partout).
- **Comparé par valeur**, pas par référence.
- **Auto-validant** : il garantit ses invariants à la construction (un `Email` invalide ne peut pas exister).
- Souvent **riche en comportement** (un `Recurrence` sait dire si une routine tombe aujourd'hui).

| | Entité | Value object |
|---|---|---|
| Identité | Oui (UUID) | Non |
| Mutabilité | Oui (l'état change) | Non (immuable) |
| Comparaison | Par ID | Par valeur |
| Exemples TribuZen | `Family`, `Routine`, `Sortie` | `Email`, `Recurrence`, `TimeWindow`, `NeedsTag`, `DateRange` |

```ts
// value-object : immuable, auto-validant, comparé par valeur
export class TimeWindow {
  private constructor(readonly startHour: number, readonly endHour: number) {}

  static of(startHour: number, endHour: number): TimeWindow {
    if (startHour < 0 || endHour > 24 || startHour >= endHour) {
      throw new DomainError('Fenêtre horaire invalide');   // un TimeWindow invalide N'EXISTE PAS
    }
    return new TimeWindow(startHour, endHour);
  }

  contains(hour: number): boolean { return hour >= this.startHour && hour < this.endHour; }
  equals(other: TimeWindow): boolean {
    return this.startHour === other.startHour && this.endHour === other.endHour;
  }
}
```

**Règle de décision entité vs VO :** « Deux exemplaires aux mêmes valeurs sont-ils interchangeables ? » Oui → value object. « Ai-je besoin de suivre *cet* objet précis dans le temps ? » Oui → entité. La fenêtre de notification « 7h-21h » est un VO ; la famille qui l'a configurée est une entité.

### 2.3 Agrégat — une frontière de cohérence

Un **agrégat** est un **groupe d'objets** (une entité racine + des entités/VO internes) traité comme **une seule unité de cohérence**. Il a une **racine d'agrégat** (*aggregate root*) qui est le **seul point d'entrée** pour toute modification.

Les **règles d'or** de l'agrégat (à connaître par cœur) :

1. **Toute modification passe par la racine.** On n'atteint jamais un objet interne pour le muter directement.
2. **Les objets externes ne référencent que la racine**, et par son **ID** — pas par une référence objet directe.
3. **Un agrégat se charge et se sauvegarde en entier** : c'est l'unité de chargement et de persistance.
4. **Les invariants sont garantis à l'intérieur de la frontière** de l'agrégat, à chaque opération.
5. **Un agrégat ne référence pas un autre agrégat directement** : seulement par ID (`ownerId`, `familyId`), jamais par une référence à l'objet complet.

Un **invariant** est une règle métier qui doit être vraie **à tout instant observable** de l'agrégat (ex : « une famille a au plus 8 co-référents », « une sortie confirmée a au moins un participant »). La racine est **garante** de ses invariants : elle refuse toute opération qui les briserait.

```
AGRÉGAT : Family (racine = Family)
┌──────────────────────────────────────────────┐        ┌─────────────┐
│  Family  (aggregate root)                     │  ID    │  Routine    │
│  ─────────────────────────────────────────── │ ─────▶ │ (autre AG)  │
│  id: FamilyId                                 │        └─────────────┘
│  ownerId: UserId          (autre AG, par ID)  │
│  members: CoReferent[]    (entités internes)  │        RÈGLES D'OR
│    ├── userId: UserId                         │        - modif via Family
│    └── role: MemberRole   (value object)      │        - autres AG par ID
│                                               │        - invariants garantis
│  INVARIANTS protégés par la racine :          │          dans la frontière
│   • au plus 8 co-référents                    │
│   • pas deux fois le même userId              │
│   • toujours au moins 1 owner                 │
│                                               │
│  invite(userId, role) / revoke(userId)        │  ← seuls points d'entrée
└──────────────────────────────────────────────┘

INTERDIT : family.members.push(...)         (mutation directe d'un objet interne)
CORRECT  : family.invite(userId, role)      (via la racine, qui vérifie les invariants)
```

**Frontière de cohérence transactionnelle :** un agrégat = une transaction. On modifie **un** agrégat par transaction. Si une opération doit toucher deux agrégats (ex : accepter une invitation → modifier `Family` ET créer une `Notification`), on ne les met **pas** dans la même transaction atomique : on modifie le premier, on émet un **domain event**, et le second réagit (cohérence *éventuelle*). Garder les agrégats **petits** est un objectif de conception : plus la frontière est petite, moins il y a de contention.

### 2.4 Domain event — un fait métier au passé

Un **domain event** représente **quelque chose qui s'est produit** dans le domaine et qui intéresse le métier. Propriétés :

- **Nommé au passé** : `CoReferentInvited`, `SortieConfirmed`, `RoutineCompleted` — jamais à l'impératif (`InviteCoReferent`, ça c'est une *commande*).
- **Immuable** : un fait ne s'annule pas ; on le **compense** par un autre event (`InvitationRevoked`).
- **Horodaté** (`occurredAt`) et auto-identifié (`eventId`).
- Porte **assez de données** pour que les abonnés agissent sans re-requêter.

L'émetteur **ne sait pas** qui écoute ni ce qu'ils feront (envoyer un email, mettre à jour une stat, invalider un cache). C'est ce découplage qui permet la cohérence éventuelle entre agrégats (§2.3). La racine **accumule** ses events pendant l'opération ; l'application service les **récupère et publie** après persistance.

```ts
// L'agrégat émet un fait métier ; il ignore qui écoute
invite(userId: UserId, role: MemberRole): void {
  if (this.members.length >= 8) throw new DomainError('Famille pleine (max 8 co-référents)');
  if (this.members.some(m => m.userId.equals(userId))) throw new DomainError('Déjà membre');
  this.members.push(new CoReferent(userId, role));
  this.record(new CoReferentInvited(this.id, userId, role));   // fait au passé
}
```

> **Défère :** *stocker* l'état comme un flux d'events (**event sourcing**) et séparer le modèle d'écriture du modèle de lecture (**CQRS**) sont traités au **module 18**. Ici, un domain event est juste un **fait émis** par l'agrégat ; l'état reste stocké de façon classique (une ligne par famille).

### 2.5 Domain service vs application service

Toute règle ne trouve pas de foyer naturel dans **une** entité. Quand une règle métier implique **plusieurs agrégats** ou n'appartient à aucun objet en particulier, on la met dans un **domain service** : un objet **sans état**, en langage du domaine, **sans dépendance à l'infrastructure**.

Ne pas confondre avec l'**application service** (aussi appelé *use case*), qui **orchestre** un cas d'usage : charger l'agrégat via le repository, invoquer domaine/domain services, sauvegarder, publier les events. L'application service **coordonne** ; il ne **contient pas** de règle métier.

| | Domain service | Application service (use case) |
|---|---|---|
| Rôle | Règle métier sans foyer dans une entité | Orchestration d'un cas d'usage |
| Dépendances | Autres agrégats / interfaces domaine, **pas** d'infra | Repositories, domain services, event bus |
| Contient des règles ? | **Oui** (métier) | **Non** (coordination seulement) |
| Exemple TribuZen | `SortieSchedulingPolicy` (vérifie que la sortie ne chevauche pas une routine sur le même créneau — 2 agrégats) | `ConfirmSortieUseCase` (charge, applique, persiste, publie) |

**Test mental :** si tu écris une règle et qu'aucune entité ne semble être « la bonne » à l'héberger (parce qu'elle parle de deux agrégats à la fois), c'est un **domain service** — pas une excuse pour vider les entités dans des services (ça, c'est le retour de l'*anemic domain model* du module 05).

### 2.6 Repository — abstraction d'accès à l'agrégat

Un **repository** abstrait le stockage d'un agrégat derrière une **interface définie dans le domaine**. Le domaine demande « donne-moi la famille X » ou « sauvegarde cette famille » sans savoir si c'est Prisma, Postgres ou un `Map` en mémoire.

- **Un repository par agrégat racine** (pas par table) : `FamilyRepository`, pas `MemberRepository`.
- **L'interface vit dans le domaine** ; l'implémentation dans l'infrastructure. C'est la *dependency rule* (modules 06-07) : le domaine ne dépend pas de l'infra.
- Pense en **agrégats métier** (`findById`, `save`), pas en CRUD SQL par colonne.

À distinguer du **DAO** (orienté table/colonnes, CRUD SQL) et de l'**Active Record** (l'objet sait se sauvegarder lui-même, `family.save()` — couplage fort au stockage). Le repository pense **agrégat** et respecte la règle de dépendance.

```ts
// DANS LE DOMAINE — aucune trace de Prisma/SQL ici
export interface FamilyRepository {
  findById(id: FamilyId): Promise<Family | null>;
  save(family: Family): Promise<void>;                 // insert ou update de l'agrégat entier
  findMatching(spec: FamilySpecification): Promise<Family[]>;
}
```

L'implémentation en mémoire (`InMemoryFamilyRepository` avec un `Map`) rend les tests du domaine **sans base ni réseau**, en millisecondes.

### 2.7 Specification — un critère composable

Le **specification pattern** encapsule un **critère métier** dans un objet **réutilisable et composable** (`and`, `or`, `not`). Il évite l'explosion combinatoire des méthodes `findByXAndYAndZ` et donne un nom métier à chaque critère.

```ts
// Un critère = un objet ; on compose au lieu de multiplier les méthodes de repo
export abstract class FamilySpecification {
  abstract isSatisfiedBy(family: Family): boolean;
  and(other: FamilySpecification): FamilySpecification { return new AndSpec(this, other); }
}

class HasFreeSlotSpec extends FamilySpecification {
  isSatisfiedBy(f: Family): boolean { return f.memberCount < 8; }
}
class OnPremiumSpec extends FamilySpecification {
  isSatisfiedBy(f: Family): boolean { return f.plan === 'premium'; }
}

// Composition métier lisible : familles premium avec une place libre
const invitable = new HasFreeSlotSpec().and(new OnPremiumSpec());
```

Un même objet specification peut servir **en mémoire** (`isSatisfiedBy`) pour les tests **et** être traduit en requête par le repository en prod. C'est un critère de domaine, pas une clause SQL.

---

## 3. Worked examples

### Exemple 1 — Transformer le sac de données du §1 en agrégat

On reprend le `Family` du §1 et on le modélise en agrégat qui protège ses invariants.

**Étape 1 — nommer les briques.**
- `Family` = **entité** (identité `FamilyId`, cycle de vie) → **racine d'agrégat**.
- `CoReferent` = **entité interne** (a une identité `userId` dans la famille, mais n'existe que *dans* la famille — pas de repository propre).
- `MemberRole` = **value object** (une énumération de rôles autorisés, immuable, comparé par valeur).
- `UserId` = référence à un **autre agrégat** (l'utilisateur) → **par ID seulement**.

**Étape 2 — lister les invariants** que la racine doit garantir :
- au plus 8 co-référents ;
- pas deux fois le même `userId` ;
- toujours au moins un membre `owner`.

**Étape 3 — donner le comportement à la racine.**

```ts
export class Family {                       // AGGREGATE ROOT
  private constructor(
    readonly id: FamilyId,
    private readonly members: CoReferent[],  // interne : jamais exposé en mutable
  ) {}

  get memberCount(): number { return this.members.length; }

  // SEUL point d'entrée pour ajouter un membre → invariants garantis ici
  invite(userId: UserId, role: MemberRole): void {
    if (this.members.length >= 8) throw new DomainError('Famille pleine (max 8 co-référents)');
    if (this.members.some(m => m.userId.equals(userId))) throw new DomainError('Déjà membre');
    this.members.push(new CoReferent(userId, role));
    this.record(new CoReferentInvited(this.id, userId, role));   // domain event au passé
  }

  revoke(userId: UserId): void {
    const target = this.members.find(m => m.userId.equals(userId));
    if (!target) throw new DomainError('Pas membre de cette famille');
    if (target.role.isOwner() && this.owners().length === 1) {
      throw new DomainError('Impossible de retirer le dernier owner');  // invariant protégé
    }
    this.members.splice(this.members.indexOf(target), 1);
    this.record(new CoReferentRevoked(this.id, userId));
  }

  private owners(): CoReferent[] { return this.members.filter(m => m.role.isOwner()); }
}
```

**Ce que le refactor achète :**
- La famille **ne peut pas** atteindre 9 membres ni un doublon : l'invariant est **dans la frontière**, plus jamais orphelin dans un service.
- `members` n'est **plus** mutable de l'extérieur — toute modification passe par `invite`/`revoke`.
- `MemberRole` value object interdit un rôle inventé (`"n'importe quoi"` ne compile même pas).
- Les autres agrégats (`User`) sont référencés par `UserId`, jamais par une référence objet.
- Chaque changement émet un **fait au passé** (`CoReferentInvited`) qu'un listener pourra traiter (email, notif) **hors** de la transaction.

### Exemple 2 — Placer trois règles dans la bonne brique

TribuZen ajoute le domaine **Sortie** (une sortie planifiée à laquelle des co-référents participent). Trois règles arrivent. Où va chacune ?

| Règle | Brique | Pourquoi |
|---|---|---|
| « Une sortie confirmée doit avoir au moins 1 participant » | **Entité `Sortie`** (invariant) | Concerne *un* agrégat, protégée par sa racine dans `confirm()` |
| « L'heure de fin est après l'heure de début » | **Value object `DateRange`** | Invariant *de la valeur* : un `DateRange` invalide ne doit pas exister |
| « La sortie ne doit pas chevaucher une routine du même co-référent sur le même créneau » | **Domain service `ScheduleClashPolicy`** | Implique **deux** agrégats (`Sortie` **et** `Routine`) → aucun foyer dans une seule entité |

Et l'orchestration ? « Charger la sortie, vérifier la politique de chevauchement, confirmer, sauvegarder, publier `SortieConfirmed` » = **application service** `ConfirmSortieUseCase`. Il ne **contient** aucune règle : il **coordonne** l'entité, le domain service et le repository.

```ts
// application service : orchestration PURE, zéro règle métier
export class ConfirmSortieUseCase {
  constructor(
    private readonly sorties: SortieRepository,
    private readonly clashPolicy: ScheduleClashPolicy,   // domain service
    private readonly events: EventBus,
  ) {}

  async execute(sortieId: SortieId): Promise<void> {
    const sortie = await this.sorties.findById(sortieId);
    if (!sortie) throw new SortieNotFoundError(sortieId);

    await this.clashPolicy.assertNoClash(sortie);   // règle inter-agrégats déléguée
    sortie.confirm();                               // invariant « ≥ 1 participant » dans l'entité
    await this.sorties.save(sortie);                // persistance de l'agrégat entier

    for (const e of sortie.pullEvents()) await this.events.publish(e);  // publie après persistance
  }
}
```

Résultat : chaque règle est à **un seul** endroit, testable en isolation, et l'orchestration ne pollue pas le domaine.

---

## 4. Pièges & misconceptions

### PIÈGE #1 — Confondre value object et entité « parce que c'est une classe »

Le critère n'est pas syntaxique. `Email`, `Money`, `TimeWindow` sont des **classes** mais des **value objects** : pas d'ID, immuables, comparés par valeur. Le test : *deux exemplaires aux mêmes valeurs sont-ils interchangeables ?* Oui → VO. *Dois-je suivre CET objet précis dans le temps ?* Oui → entité. Modéliser un `Email` en entité (avec un ID) est du sur-engineering ; modéliser une `Family` en VO fait perdre son identité.

### PIÈGE #2 — Exposer les objets internes de l'agrégat en mutable

`get members(): CoReferent[]` qui rend le tableau **modifiable** casse toute la protection : `family.members.push(...)` contourne les invariants. La racine doit exposer une **copie en lecture seule** (`readonly CoReferent[]`) ou juste des **projections** (`memberCount`), et n'offrir que des **méthodes de commande** (`invite`, `revoke`) comme points de mutation. Une frontière d'agrégat percée n'est plus une frontière.

### PIÈGE #3 — Référencer un autre agrégat par objet plutôt que par ID

Mettre `owner: User` (l'objet complet) dans `Family` au lieu de `ownerId: UserId` viole la règle d'or n°5. Conséquences : on charge des graphes objet énormes, on ne sait plus quelle est la frontière transactionnelle, et deux agrégats se modifient « ensemble » par accident. **Toujours par ID** entre agrégats ; la résolution se fait via un repository quand on en a besoin.

### PIÈGE #4 — L'agrégat fourre-tout (« god aggregate »)

Tenter de mettre `Family`, ses `Routines`, ses `Sorties`, son `Journal` dans **un seul** agrégat parce que « tout se tient » crée une frontière transactionnelle énorme : chaque petite modif verrouille tout, la contention explose. Règle : **agrégats petits**, reliés par **ID** et **domain events**. Une routine et une famille sont **deux** agrégats, pas un.

### PIÈGE #5 — Domain event nommé à l'impératif

`InviteCoReferent`, `CreateSortie` sont des **commandes** (une intention, qui peut échouer), pas des events. Un domain event est un **fait accompli**, donc **au passé** : `CoReferentInvited`, `SortieCreated`. Si tu peux encore dire « non » à la chose, ce n'est pas un event. Ce n'est pas cosmétique : commandes et events circulent dans des sens opposés et n'ont pas les mêmes garanties.

### PIÈGE #6 — Vider les entités dans des « services » (retour de l'anémie)

Le DDD tactique **n'est pas** « mettre toute la logique dans des `*Service` ». Une règle qui concerne **une** entité doit vivre **dans** cette entité (§05, anemic domain model). Le **domain service** est réservé aux règles **sans foyer** (plusieurs agrégats). Si `FamilyService.invite(family, ...)` contient la règle « max 8 » alors que `Family` pourrait la porter, tu as recréé l'anémie que l'agrégat devait tuer.

### PIÈGE #7 — Confondre repository et DAO

Un repository expose des opérations **orientées agrégat** (`findById`, `save`, `findMatching(spec)`), pas un CRUD par colonne SQL (`findByStatusColumn`, `updateEmailField`). Si ton « repository » a une méthode par colonne et pense en tables, c'est un **DAO**. Le repository pense **agrégat métier** et son interface vit **dans le domaine**, pas dans l'infra.

---

## 5. Ancrage TribuZen

Le backend NestJS de TribuZen (Clean Architecture, cf. spec §5) applique ce module dans le bounded context **Famille & Sorties** délimité au module 09.

**Agrégat `Family` (racine) :**
- **Invariants portés par la racine** : au plus 8 co-référents (offre « Famille », spec §11), pas de doublon de `userId`, toujours au moins un `owner`.
- **Value objects** : `MemberRole` (owner / coreferent / reader), `NeedsTag` (tags génériques Level 2 comme `"routine_intensive"`, **sans** terme médical — cf. architecture confidentialité spec §6).
- **Domain events** : `CoReferentInvited`, `CoReferentRevoked`. La révocation d'un co-référent (séparation → rotation de clé partagée, spec §8) sera **déclenchée** par l'event `CoReferentRevoked` — le re-chiffrement écoute, hors transaction.
- **Référence par ID** : `Family` ne contient pas les `Routine` ni les `Sortie` en objet ; elle les référence par `familyId` côté ces agrégats.

**Agrégat `Sortie` :**
- **Invariant** : une sortie confirmée a ≥ 1 participant.
- **Value object** `DateRange` (fin après début, auto-validant).
- **Domain service** `ScheduleClashPolicy` : la sortie ne chevauche pas une routine du même co-référent (règle inter-agrégats `Sortie` × `Routine`).

**Repository & specification :**
- `FamilyRepository` interface **dans le domaine** ; impl Prisma dans l'infra (détail **cours 10**). Une impl `InMemory` teste le domaine sans base.
- `HasFreeSlotSpec().and(new OnPremiumSpec())` sélectionne les familles éligibles à une invitation — critère métier composable, réutilisé en test (en mémoire) et en prod (traduit en requête).

> **Défère :** le branchement NestJS (modules, providers, injection) est le **cours 09** ; le schéma Prisma et les requêtes, le **cours 10** ; event sourcing / CQRS sur ces agrégats, le **module 18**. Ici on a décidé **quelles briques** modélisent le domaine et **quels invariants** chaque racine protège.

---

## 6. Points clés

1. **Entité** = identité stable + cycle de vie, comparée par ID. **Value object** = valeur immuable, auto-validante, comparée par valeur.
2. Critère de choix : *interchangeables aux mêmes valeurs ?* → VO ; *à suivre dans le temps ?* → entité.
3. Un **agrégat** est une **frontière de cohérence** ; sa **racine** est le seul point d'entrée et garantit les **invariants**.
4. Règles d'or : modification **via la racine**, autres agrégats **par ID**, **charger/sauver en entier**, **une** frontière transactionnelle par agrégat, agrégats **petits**.
5. Un **domain event** est un **fait au passé**, immuable ; il découple les agrégats (cohérence éventuelle) et l'émetteur ignore qui écoute.
6. **Domain service** = règle métier **sans foyer** (plusieurs agrégats). **Application service** = **orchestration** sans règle. Ne pas vider les entités dans des services (anémie).
7. Un **repository** (un par racine, interface **dans le domaine**) abstrait le stockage de l'agrégat ; il pense **agrégat**, pas colonnes SQL (≠ DAO / Active Record).
8. Le **specification pattern** encapsule un critère métier **composable** (`and`/`or`/`not`), réutilisable en mémoire (test) et en prod (requête).

---

## 7. Seeds Anki

```
Quelle est la différence fondamentale entre une entité et un value object ?|Une entité a une identité stable (UUID) et un cycle de vie, comparée par ID. Un value object n'a pas d'identité : immuable, auto-validant, comparé par valeur. Critère : deux exemplaires aux mêmes valeurs sont-ils interchangeables ? Oui → VO.
Qu'est-ce qu'un agrégat et sa racine (aggregate root) ?|Un agrégat est un groupe d'objets traité comme une seule unité de cohérence, avec une racine qui est le seul point d'entrée pour toute modification et qui garantit les invariants dans sa frontière.
Cite les règles d'or de l'agrégat.|1) Toute modif passe par la racine. 2) Les objets externes ne référencent que la racine, par ID. 3) On charge/sauve l'agrégat en entier. 4) Les invariants sont garantis dans la frontière. 5) Un agrégat référence un autre agrégat par ID seulement. Bonus : garder les agrégats petits (une frontière transactionnelle chacun).
Qu'est-ce qu'un invariant métier ?|Une règle qui doit être vraie à tout instant observable de l'agrégat (ex : au plus 8 co-référents). La racine refuse toute opération qui la briserait.
Comment nomme-t-on un domain event, et pourquoi ?|Au passé (CoReferentInvited, SortieConfirmed) car c'est un fait accompli et immuable. Nommé à l'impératif (InviteCoReferent), c'est une commande, pas un event. Un fait ne s'annule pas, il se compense.
Domain service vs application service : quelle différence ?|Domain service = règle métier sans foyer dans une seule entité (plusieurs agrégats), sans infra. Application service (use case) = orchestration d'un cas d'usage (charger, appliquer, sauver, publier events), sans règle métier.
Pourquoi référencer un autre agrégat par ID plutôt que par objet ?|Pour garder les frontières transactionnelles claires, éviter de charger des graphes objet énormes, et empêcher que deux agrégats se modifient ensemble par accident. Un agrégat = une transaction.
À quoi sert le specification pattern ?|À encapsuler un critère métier dans un objet composable (and/or/not), évitant l'explosion des findByXAndYAndZ. Réutilisable en mémoire (isSatisfiedBy, tests) et traduit en requête en prod.
Où placer la règle « une famille a au plus 8 co-référents » ?|Dans l'entité racine Family (invariant protégé par sa méthode invite), pas dans un service. Une règle orpheline dans un service peut être oubliée par un autre appel ; l'agrégat garantit qu'elle est toujours vérifiée.
Repository vs DAO : quelle distinction ?|Le repository pense en agrégats métier (findById, save, findMatching) et son interface vit dans le domaine. Le DAO pense en tables/colonnes (CRUD SQL). Un repository par racine d'agrégat, pas par table.
```

---

## Pont vers le lab

> Lab associé : `labs/lab-10-ddd-tactique/README.md`. Modéliser un agrégat TribuZen (racine + invariants + value objects) à partir d'un pêle-mêle de champs, identifier les domain events, et placer chaque règle dans la bonne brique. Exercice de conception, évalué par grille + coach + variante J+30 — zéro harnais.
