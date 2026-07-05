# Lab 10 — DDD tactique : modéliser un agrégat

> **Outcome :** à la fin, tu sais prendre un pêle-mêle de champs d'un domaine TribuZen, le **modéliser en agrégat** (racine + entités internes + value objects), **lister ses invariants**, **identifier ses domain events**, et **placer chaque règle** dans la bonne brique (entité / domain service / application service).
> **Vrai outil :** papier / tableau blanc / fichier `.md`. C'est un exercice de **conception**, pas d'implémentation. Tu produis un schéma d'agrégat + une liste d'invariants + une liste de domain events + un tableau de placement des règles. Les squelettes TS sont **illustratifs**, rien à exécuter.
> **Feedback :** le coach valide le raisonnement en session (grille ci-dessous). Pas de test-runner.

---

## Énoncé

TribuZen ajoute le domaine **Sortie partagée** : une sortie planifiée (parc, musée, anniversaire) à laquelle des co-référents d'une famille s'inscrivent comme participants ou organisateurs. Un contributeur pressé a livré ça comme un sac de données manipulé de l'extérieur :

```ts
// sortie.ts — TOUT est public et mutable, aucune règle protégée
export class Sortie {
  id: string;
  familyId: string;
  title: string;
  startsAt: Date;
  endsAt: Date;
  status: string;                                   // 'draft' | 'confirmed' | 'cancelled' ... string libre
  participants: { userId: string; role: string }[] = [];   // 'organizer' | 'participant', string libre
  location: string;
  maxParticipants: number;
}

// schedule.service.ts — les règles vivent HORS de l'objet
export class ScheduleService {
  confirm(sortie: Sortie) {
    if (sortie.participants.length === 0) throw new Error('aucun participant');  // règle orpheline
    sortie.status = 'confirmed';                    // mutation directe, aucune garantie
  }
  addParticipant(sortie: Sortie, userId: string, role: string) {
    sortie.participants.push({ userId, role });     // pas de contrôle de doublon, ni de capacité
  }
}
```

Les règles métier connues du produit (spec TribuZen) :

- une sortie **confirmée** doit avoir **au moins 1 participant** ;
- une sortie a **au plus 1 organisateur** (`organizer`) et cet organisateur est **obligatoire** dès la confirmation ;
- on ne peut pas inscrire **deux fois le même** `userId` ;
- on ne dépasse pas `maxParticipants` ;
- l'heure de fin est **après** l'heure de début ;
- une sortie **annulée** (`cancelled`) ne peut plus changer (état terminal) ;
- une sortie ne doit **pas chevaucher une routine** du même co-référent sur le même créneau (règle qui touche **deux** domaines).

**Ta mission (conception uniquement) :**

1. **Nomme les briques.** Pour chaque concept (`Sortie`, `participant`, `role`, `status`, `DateRange`, `familyId`), dis si c'est une **entité racine**, une **entité interne**, un **value object**, ou une **référence à un autre agrégat par ID**. Justifie en une phrase (identité ? immuable ? interchangeable ?).
2. **Délimite l'agrégat et sa racine.** Dessine le schéma : racine, objets internes, références externes par ID. Marque la **frontière**.
3. **Liste les invariants** que la racine doit garantir (reprends les règles ci-dessus et attribue-les).
4. **Identifie les domain events** émis par l'agrégat (nommés **au passé**).
5. **Place chaque règle** dans la bonne brique : entité (invariant), value object, **domain service** (règle inter-agrégats), ou **application service** (orchestration).
6. **Écris le squelette de la racine** (`Sortie`) : constructeur privé, méthodes de commande (`confirm`, `addParticipant`, `cancel`) qui protègent les invariants, aucun champ interne exposé en mutable.

**Contrainte de portée :** on reste en **DDD tactique** (module 10). Ne bascule PAS en **event sourcing** ni **CQRS** (module 18) — les events sont juste des faits émis, l'état reste stocké classiquement. Ne rédige pas non plus le schéma Prisma (cours 10) ni le câblage NestJS (cours 09).

---

## Étapes (en friction)

1. **Inventaire + nature.** Reprends chaque champ du sac de données. Pour chacun : a-t-il une **identité** propre ? est-il **immuable** ? deux exemplaires aux mêmes valeurs sont-ils **interchangeables** ? Déduis entité / VO / référence par ID. Piège : `role` — est-ce une `string` libre ou un **value object** (ensemble fermé de rôles) ? Et `status` ?
2. **Frontière.** Décide ce qui est **dans** l'agrégat `Sortie` (participants internes ?) et ce qui est **dehors** (la `Family`, les `Routine` — par ID). Justifie : un participant existe-t-il **hors** d'une sortie ?
3. **Invariants.** Prends les 7 règles. Lesquelles sont des **invariants d'un seul agrégat** (protégés par la racine `Sortie`) ? Laquelle est **d'une valeur** (le `DateRange`) ? Laquelle touche **deux** agrégats ?
4. **Events au passé.** Quels faits métier émet la sortie ? (`SortieConfirmed`, `ParticipantJoined`, `SortieCancelled`…). Vérifie qu'aucun n'est nommé à l'impératif.
5. **Placement des règles.** Remplis un tableau règle → brique. Le piège : « pas de chevauchement avec une routine » — pourquoi ce n'est **pas** un invariant de `Sortie` seul ?
6. **Squelette racine.** Écris `Sortie` avec constructeur privé, `participants` **non exposé en mutable**, et `confirm`/`addParticipant`/`cancel` qui **lèvent** sur violation d'invariant et **émettent** un event.
7. **Auto-contrôle.** Repasse la grille ci-dessous sur ta copie avant de la montrer au coach.

---

## Corrigé complet commenté

> Le corrigé porte sur la **modélisation** (briques, frontière, invariants, events, placement), pas sur du code exécutable. Les squelettes TS montrent *où* vit chaque responsabilité.

### 1. Nature de chaque brique

| Concept | Nature | Pourquoi |
|---|---|---|
| `Sortie` | **Entité racine** | Identité stable (`SortieId`), cycle de vie (draft → confirmed → cancelled) |
| `participant` (`{ userId, role }`) | **Entité interne** | A une identité *dans* la sortie (`userId`), mais n'existe pas hors d'elle → pas de repository propre |
| `role` (organizer/participant) | **Value object** | Ensemble **fermé** de rôles, immuable, comparé par valeur — pas une `string` libre |
| `status` | **Value object / état** modélisé (idéalement une FSM) | Ensemble fermé d'états ; pas une `string` libre. La transition est gardée par la racine |
| `DateRange` (`startsAt`/`endsAt`) | **Value object** | Immuable, auto-validant (fin > début), comparé par valeur |
| `familyId` | **Référence à un autre agrégat par ID** | La `Family` est un **autre** agrégat → jamais l'objet complet, seulement l'ID |
| `userId` (dans participant) | **Référence à un autre agrégat par ID** | Le `User` est un autre agrégat |

> Le point qui piège : `role` et `status` **ne sont pas** des `string` libres. Un value object (ou une énumération fermée) empêche `role: "n'importe quoi"` d'exister. C'est exactement ce qui manquait au sac de données.

### 2. Schéma de l'agrégat (frontière)

```
AGRÉGAT : Sortie (racine = Sortie)
┌───────────────────────────────────────────────┐        ┌──────────────┐
│  Sortie  (aggregate root)                      │  ID    │  Family      │
│  ───────────────────────────────────────────  │ ─────▶ │  (autre AG)  │
│  id: SortieId                                  │        └──────────────┘
│  familyId: FamilyId        (autre AG, par ID)  │
│  title: string                                 │        ┌──────────────┐
│  dateRange: DateRange      (value object)      │  ID    │  User        │
│  status: SortieStatus      (value object/FSM)  │ ─────▶ │  (autre AG)  │
│  maxParticipants: number                       │        └──────────────┘
│  participants: Participant[]  (entités internes)
│    ├── userId: UserId      (autre AG, par ID)  │        FRONTIÈRE :
│    └── role: ParticipantRole (value object)    │        tout ce qui est
│                                                │        DANS le cadre est
│  INVARIANTS (garantis par la racine) :         │        chargé/sauvé avec
│   • confirmée ⇒ ≥ 1 participant                │        la Sortie.
│   • ≤ 1 organizer, obligatoire si confirmée    │        Family/User/Routine
│   • pas deux fois le même userId               │        = par ID, dehors.
│   • participants ≤ maxParticipants             │
│   • cancelled = terminal                       │
│                                                │
│  confirm() / addParticipant() / cancel()       │  ← seuls points d'entrée
└───────────────────────────────────────────────┘

Le chevauchement Sortie × Routine N'EST PAS dans cette frontière (2 agrégats).
```

### 3. Invariants portés par la racine `Sortie`

- confirmée ⇒ au moins 1 participant ;
- au plus 1 `organizer`, obligatoire dès la confirmation ;
- pas deux fois le même `userId` ;
- `participants.length ≤ maxParticipants` ;
- `cancelled` est un état **terminal** (aucune transition sortante).

Invariant **de valeur** (dans le VO, pas dans la racine) : `DateRange` garantit fin > début — un `DateRange` invalide ne peut pas être construit.

### 4. Domain events (au passé)

- `SortieConfirmed(sortieId, familyId, confirmedAt)`
- `ParticipantJoined(sortieId, userId, role)`
- `ParticipantLeft(sortieId, userId)`
- `SortieCancelled(sortieId, reason)`

Aucun n'est à l'impératif (`ConfirmSortie` serait une **commande**, pas un event). Un event notifie sans que l'émetteur sache qui écoute (ex : un listener enverra une push notif « sortie confirmée », **hors** transaction).

### 5. Placement des règles

| Règle | Brique | Pourquoi |
|---|---|---|
| Confirmée ⇒ ≥ 1 participant | **Entité `Sortie`** (invariant, dans `confirm()`) | Un seul agrégat |
| ≤ 1 organizer, obligatoire à la confirmation | **Entité `Sortie`** (invariant) | Un seul agrégat |
| Pas de doublon `userId` | **Entité `Sortie`** (invariant, dans `addParticipant()`) | Un seul agrégat |
| `participants ≤ maxParticipants` | **Entité `Sortie`** (invariant) | Un seul agrégat |
| Fin après début | **Value object `DateRange`** | Invariant *de la valeur*, garanti à la construction |
| `cancelled` terminal | **Entité `Sortie`** (état/FSM) | Transition gardée par la racine |
| Pas de chevauchement avec une routine | **Domain service `ScheduleClashPolicy`** | Touche **deux** agrégats (`Sortie` × `Routine`) → aucun foyer dans une seule entité |
| Orchestrer confirm : charger, vérifier chevauchement, confirmer, sauver, publier | **Application service `ConfirmSortieUseCase`** | Coordination, **aucune** règle métier |

> Piège clé : « pas de chevauchement avec une routine » n'est **pas** un invariant de `Sortie` seul, car il faut **aussi** consulter les `Routine` (un autre agrégat). C'est un **domain service** : `Sortie` ne peut pas garantir seule une règle qui dépend d'un autre agrégat.

### 6. Squelette de la racine

```ts
export class Sortie {                          // AGGREGATE ROOT
  private constructor(
    readonly id: SortieId,
    readonly familyId: FamilyId,               // autre agrégat, par ID
    private dateRange: DateRange,              // value object auto-validant
    private status: SortieStatus,
    private readonly maxParticipants: number,
    private readonly participants: Participant[],   // interne : jamais exposé en mutable
  ) {}

  // Projection en lecture seule — on N'expose PAS le tableau mutable
  get participantCount(): number { return this.participants.length; }

  addParticipant(userId: UserId, role: ParticipantRole): void {
    if (this.status.isCancelled()) throw new DomainError('Sortie annulée : figée');
    if (this.participants.length >= this.maxParticipants) throw new DomainError('Sortie complète');
    if (this.participants.some(p => p.userId.equals(userId))) throw new DomainError('Déjà inscrit');
    if (role.isOrganizer() && this.participants.some(p => p.role.isOrganizer())) {
      throw new DomainError('Un seul organisateur autorisé');
    }
    this.participants.push(new Participant(userId, role));
    this.record(new ParticipantJoined(this.id, userId, role));   // fait au passé
  }

  confirm(): void {
    if (this.status.isCancelled()) throw new DomainError('Sortie annulée : figée');
    if (this.participants.length === 0) throw new DomainError('Aucun participant');
    if (!this.participants.some(p => p.role.isOrganizer())) {
      throw new DomainError('Un organisateur est requis pour confirmer');
    }
    this.status = SortieStatus.Confirmed;
    this.record(new SortieConfirmed(this.id, this.familyId, new Date()));
  }

  cancel(reason: string): void {
    if (this.status.isCancelled()) throw new DomainError('Déjà annulée');
    this.status = SortieStatus.Cancelled;        // état terminal
    this.record(new SortieCancelled(this.id, reason));
  }
}
```

**Pourquoi ce corrigé est correct :** chaque invariant est **protégé par la racine** (impossible d'atteindre un état invalide), `participants` n'est **jamais** exposé en mutable, `role`/`status` sont des **value objects** (plus de `string` libre), les autres agrégats (`Family`, `User`, `Routine`) sont référencés **par ID**, les faits sont émis **au passé**, et la seule règle inter-agrégats (chevauchement) est **hors** de l'entité, dans un **domain service** orchestré par l'application service.

---

## Grille d'évaluation (coach)

| Critère | Attendu | ✅ / ❌ |
|---|---|---|
| Nature des briques | Chaque concept classé entité racine / entité interne / VO / réf par ID, avec justification (identité ? immuable ? interchangeable ?) | |
| `role` et `status` en VO | Repère que ce ne sont **pas** des `string` libres mais des ensembles fermés (value objects) | |
| Frontière d'agrégat | Racine + internes dans le cadre ; `Family`/`User`/`Routine` **dehors, par ID** | |
| Invariants attribués | Les 5 invariants « mono-agrégat » placés sur la racine ; fin > début sur le VO `DateRange` | |
| Domain events au passé | Events nommés au passé (`SortieConfirmed`…), aucun à l'impératif | |
| Règle inter-agrégats | « Pas de chevauchement » identifiée comme **domain service**, pas invariant de `Sortie` | |
| Orchestration isolée | `ConfirmSortieUseCase` = application service **sans** règle métier | |
| Racine protège l'état | `participants` non exposé en mutable ; mutations seulement via `confirm`/`addParticipant`/`cancel` qui lèvent sur violation | |
| Portée respectée | Reste en DDD tactique ; ne bascule pas en event sourcing / CQRS (module 18) | |

Seuil : **7/9** pour valider. En dessous, reprends la nature des briques (étape 1) et le placement des règles (étape 5) avant de dessiner la frontière.

---

## Variante J+30 (fading)

**Même exercice, contraintes ajoutées :**

1. **En 25 minutes, de mémoire**, sans relire ce corrigé ni le module 10.
2. On te donne un **nouveau** domaine TribuZen en pêle-mêle : l'agrégat **Routine** (`id`, `familyId`, `title`, `assigneeId`, `recurrence`, `status`, `completions: { childId, day }[]`). Règles connues : une routine archivée ne peut plus être complétée ; pas deux complétions le même jour pour le même enfant ; la récurrence a un format fermé (quotidienne / hebdo / jours précis) ; le calcul de série (streak) est une règle métier ; « ne pas chevaucher une sortie » touche deux agrégats. Modélise : briques, frontière, invariants, events, placement.
3. **Contrainte supplémentaire :** identifie **une** règle qui est un **piège d'attribution** et justifie en une phrase (ex : le **streak** — est-ce un invariant de l'entité, un value object calculé, ou une projection de lecture ?).

**Critère de réussite :** schéma d'agrégat + invariants sur la racine + events au passé + tableau de placement, produits en 25 min, avec la règle inter-agrégats correctement placée en **domain service** et `recurrence`/`status` modélisés en **value objects** (pas en `string` libres).

---

## Application TribuZen

Ce lab prépare la modélisation réelle du bounded context **Famille & Sorties** du backend NestJS de TribuZen (repo `smaurier/tribuzen-api`, Clean Architecture — spec §5).

- L'agrégat **`Sortie`** existera vraiment (module produit « sorties partagées ») ; les invariants modélisés ici (capacité, organisateur unique, état terminal) vivront dans `sortie.entity.ts` côté domaine, testables **sans** HTTP ni base.
- Les **domain events** (`SortieConfirmed`, `ParticipantJoined`) alimenteront les **push notifications** natives (Expo) via des listeners, **hors** transaction — première application concrète de la cohérence éventuelle entre agrégats.
- Le **domain service** `ScheduleClashPolicy` (Sortie × Routine) est le terrain d'entraînement avant la vraie règle anti-chevauchement du planning familial.

**Commit cible :**
```
feat(sorties): modélisation tactique de l'agrégat Sortie — racine, invariants, domain events
```
