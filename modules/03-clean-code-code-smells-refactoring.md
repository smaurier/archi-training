---
titre: Clean code, code smells et refactoring — diagnostiquer et soigner
cours: 13-architecture
notions: [nommage révélateur d'intention, fonctions courtes à un seul niveau, DRY, KISS, YAGNI, séparation des préoccupations, loi de Demeter, composition plutôt qu'héritage, fail fast et guard clauses, code smell comme symptôme, "familles de smells Bloaters OO-Abusers Change-Preventers Dispensables Couplers", couplage smell vers refactoring, refactoring à comportement constant, petits pas et tests verts, une casquette à la fois, "règle de trois", dette technique, quand refactorer et quand s'abstenir]
outcomes:
  - sait nommer précisément les code smells d'un extrait et les ranger dans leurs familles
  - sait associer à chaque smell la ou les techniques de refactoring appropriées
  - sait planifier un refactoring en petits pas sûrs à comportement constant
  - sait décider quand refactorer et quand laisser le code tel quel
prerequis: [00-quest-ce-que-architecture-et-posture, 01-principes-solid, 02-design-patterns-essentiels]
next: 04-dependency-injection-ioc
libs: []
tribuzen: le module streak/points de TribuZen part d'une fonction fourre-tout qui pue et se fait nettoyer en pas nommés
last-reviewed: 2026-07
---

# Clean code, code smells et refactoring — diagnostiquer et soigner

> **Outcomes — tu sauras FAIRE :** nommer les smells d'un extrait et les ranger par famille, associer chaque smell à sa technique de refactoring, planifier un nettoyage en petits pas sûrs à comportement constant, décider quand refactorer et quand t'abstenir.
> **Difficulté :** :star::star::star:
>
> **Portée :** ce module couvre le **clean code** (nommage, fonctions courtes, DRY/KISS/YAGNI/SoC/Demeter, composition, fail fast), le **catalogue de code smells** (les 5 familles) et les **techniques de refactoring sûres** (les 6 groupes, vue-carte), plus la décision **quand refactorer**. Les **principes SOLID** eux-mêmes sont le sujet du **module 01** (on s'y réfère sans les redémontrer). Les **design patterns** cités comme remèdes (State, Strategy, Template Method) sont détaillés au **module 02**. Le **filet de sécurité par tests** (Red-Green-Refactor, golden master) est approfondi au **cours 06 — testing** : ici on l'utilise, on ne le construit pas. L'**injection de dépendances** est le **module 04**.

## 1. Cas concret d'abord

TribuZen récompense l'assiduité familiale : chaque membre a un **streak** (jours consécutifs d'activité) et des **points**. Un dev pressé a livré ce calcul dans le service de gamification. Ça marche en prod, mais chaque nouvelle règle métier prend une demi-journée et casse quelque chose d'autre.

```typescript
// gamification.service.ts — le code qui pue (il FONCTIONNE, mais il fait mal à toucher)
function process(u: any, evts: any[]): any {
  let s = 0;         // streak
  let p = 0;         // points
  let last: any = null;
  for (let i = 0; i < evts.length; i++) {
    if (evts[i].t === 1) {                       // 1 = check-in
      if (last && (evts[i].ts - last) < 86400000 * 2) {
        s = s + 1;
        if (s > 6) { p = p + 50; } else { p = p + 10; }   // bonus semaine
      } else {
        s = 1;
        p = p + 10;
      }
      last = evts[i].ts;
    } else if (evts[i].t === 2) {                // 2 = photo partagée
      p = p + 5;
    } else if (evts[i].t === 3) {                // 3 = réaction
      p = p + 1;
    }
  }
  if (u.premium == true) { p = Math.floor(p * 1.5); }
  return { streak: s, points: p, tier: p > 500 ? 'gold' : p > 100 ? 'silver' : 'bronze' };
}
```

Sans même connaître le vocabulaire, tu **sens** que c'est malade : les `t === 1`, les `86400000 * 2`, le `any` partout, la fonction qui fait cinq choses. Ce module te donne les **noms précis** de ces malaises (les *code smells*) et les **gestes nommés** pour les soigner (les *refactorings*) — sans jamais changer ce que la fonction produit. On reprend ce même exemple au fil du module.

---

## 2. Théorie complète, concise

### 2.1 Clean code : rendre l'intention lisible

Le clean code n'est pas de l'esthétique. C'est réduire la **charge cognitive** du prochain lecteur (souvent toi, dans six mois). Trois leviers de base.

**Nommage révélateur d'intention.** Un nom doit répondre à *pourquoi ça existe, ce que ça fait, comment l'utiliser* — sans commentaire. `process`, `s`, `p`, `evts[i].t === 1` ne disent rien ; `computeGamification`, `streak`, `points`, `event.type === EventType.CheckIn` disent tout. Le renommage est le refactoring le plus fréquent et le plus rentable.

**Fonctions courtes, un seul niveau d'abstraction.** Une fonction devrait faire *une* chose et se lire comme un paragraphe. Le symptôme d'échec : tu ne peux pas la nommer sans « et ». Découper (Extract Method) n'est pas cosmétique — chaque fragment nommé devient une unité qu'on lit, teste et déplace indépendamment.

**Guard clauses / Fail Fast.** Valide les préconditions en premier et sors tôt (`if (!x) throw ...`), au lieu d'imbriquer des `if` sur le chemin heureux. On aplatit l'indentation et on échoue clairement plutôt que de continuer dans un état corrompu.

### 2.2 Les principes-boussole (et leurs contre-indications)

Ces principes disent *quand* nettoyer. Chacun a un revers : appliqué à l'excès, il produit son propre smell.

| Principe | Dit de | Excès inverse |
|---|---|---|
| **DRY** (*Don't Repeat Yourself*) | Une connaissance métier = une source unique de vérité | Abstraire deux bouts qui se ressemblent par hasard → couplage faux |
| **KISS** (*Keep It Simple*) | La solution la plus simple qui marche est la bonne | Simpliste au point de ne plus modéliser le domaine |
| **YAGNI** (*You Ain't Gonna Need It*) | Ne code pas pour un futur hypothétique | Zéro extensibilité là où l'évolution est certaine |
| **SoC** (séparation des préoccupations) | Un module = une raison de changer | Émiettement en micro-fichiers illisibles |
| **Loi de Demeter** | Ne parle qu'à tes voisins directs, pas `a.b.c.d()` | Multiplier les passe-plats (Middle Man) |

Point clé sur DRY : ce qu'on déduplique, c'est la **connaissance** (une règle de prix, une validation), pas la *ressemblance syntaxique*. Deux boucles jumelles qui évolueront pour des raisons différentes doivent rester séparées. D'où la **règle de trois** : attends la troisième occurrence de la *même* connaissance avant de factoriser. Une mauvaise abstraction coûte plus cher que la duplication.

**Composition plutôt qu'héritage.** L'héritage crée un couplage fort et permanent parent→enfant ; on hérite parfois de ce dont on n'a pas besoin. Assembler des comportements via des interfaces injectées (`Formatter`, `Strategy`) reste remplaçable et testable isolément. (Le *comment injecter* est le module 04.)

### 2.3 Code smells : un symptôme, pas un verdict

Un **code smell** est une odeur : il t'invite à *regarder*, il ne prouve pas un bug. Une méthode de 200 lignes ne plante pas forcément — mais elle signale une conception probablement fragile. La taxonomie de référence (Fowler / refactoring.guru) range 22 smells en **5 familles**. Retiens les familles, pas la liste par cœur.

**Famille 1 — Bloaters (les obèses).** Du code qui a grossi jusqu'à devenir ingérable : *Long Method*, *Large Class* (God Class), *Primitive Obsession* (`string`/`number` pour un email, un montant, un type), *Long Parameter List*, *Data Clumps* (les mêmes variables voyagent toujours ensemble).

**Famille 2 — OO Abusers (mauvais usage de l'objet).** *Switch Statements* dupliqués sur un type, *Temporary Field* (champ souvent `null`), *Refused Bequest* (une sous-classe hérite de ce qu'elle n'utilise pas), *Alternative Classes with Different Interfaces*.

**Famille 3 — Change Preventers (les bloqueurs de changement).** Le pire type : *Divergent Change* (une classe modifiée pour des raisons **différentes**) et son miroir *Shotgun Surgery* (une **seule** raison métier oblige à modifier plein de classes), plus *Parallel Inheritance Hierarchies*.

**Famille 4 — Dispensables (le superflu).** *Duplicate Code*, *Dead Code*, *Lazy Class*, *Data Class* (que des getters/setters), *Speculative Generality* (abstraction « au cas où », YAGNI violé), *Comments* qui rustinent un mauvais code.

**Famille 5 — Couplers (le couplage).** *Feature Envy* (une méthode utilise surtout les données d'une **autre** classe), *Inappropriate Intimacy*, *Message Chains* (`a.getB().getC().getD()`, Demeter violée), *Middle Man* (une classe qui ne fait que déléguer).

> Deux couples-miroirs à mémoriser : **Divergent Change / Shotgun Surgery** (une classe→plusieurs raisons  vs  une raison→plusieurs classes) et **Message Chains / Middle Man** (trop de chaînes  vs  trop de passe-plats). Le bon design est l'équilibre entre les deux extrêmes.

### 2.4 Le refactoring : définition stricte

**Refactoring** = modifier la **structure interne** du code pour le rendre plus lisible/modifiable **sans changer son comportement observable**. Mêmes entrées, mêmes sorties, avant et après.

Ce que le refactoring **n'est pas** : ajouter une feature, corriger un bug (le comportement change par définition), réécrire de zéro. **Les deux casquettes** (Fowler) : à tout instant tu portes soit la casquette *feature* (le comportement change, les tests évoluent) soit la casquette *refactoring* (le comportement est figé, les tests restent verts). **Jamais les deux ensemble** — sinon, quand un test casse, tu ne sais pas si c'est ta feature ou ta restructuration.

Le **filet de sécurité** : petits pas + tests verts.

```
CYCLE DE REFACTORING SÛR
1. Tests verts au départ    (sinon pas de filet → stop, écris d'abord un test/golden master)
2. UN petit changement      (une seule technique nommée)
3. Relance les tests
   ├─ verts → commit, retour à l'étape 2
   └─ rouges → revert : le pas était trop gros
```

### 2.5 Les 6 groupes de techniques (vue-carte)

Chaque technique porte un nom précis et un geste reproductible. Retiens les **6 groupes** et le **couplage smell → refactoring** ; le pas-à-pas mécanique de chacune vit sur [refactoring.guru/refactoring/techniques](https://refactoring.guru/refactoring/techniques).

1. **Composing Methods** — découper/clarifier le flux local : *Extract Method*, *Inline Method*, *Extract Variable*, *Replace Temp with Query*, *Split Temporary Variable*, *Substitute Algorithm*.
2. **Moving Features** — mettre chaque chose dans la bonne classe : *Move Method*, *Move Field*, *Extract Class*, *Inline Class*, *Hide Delegate*, *Remove Middle Man*.
3. **Organizing Data** — données plus sûres/expressives (sortie de Primitive Obsession) : *Replace Data Value with Object*, *Replace Magic Number with Symbolic Constant*, *Replace Type Code with Class/State/Strategy*, *Encapsulate Field/Collection*.
4. **Simplifying Conditionals** — aplatir les `if` : *Decompose Conditional*, *Consolidate Conditional*, *Replace Nested Conditional with Guard Clauses*, *Replace Conditional with Polymorphism*, *Introduce Null Object*.
5. **Simplifying Method Calls** — interfaces plus simples/sûres : *Rename Method*, *Add/Remove Parameter*, *Introduce Parameter Object*, *Separate Query from Modifier*, *Replace Error Code with Exception*.
6. **Dealing with Generalization** — organiser les hiérarchies : *Pull Up/Push Down*, *Extract Superclass/Interface*, *Collapse Hierarchy*, *Form Template Method*, *Replace Inheritance with Delegation*.

La plupart vont **par paires inverses** (Extract/Inline, Pull Up/Push Down, Hide Delegate/Remove Middle Man) : le bon design est un équilibre choisi, pas un extrême poussé à fond.

### 2.6 Quand refactorer — et quand s'abstenir

**Refactore quand :** c'est la **troisième** fois que tu touches le même code sale (règle de trois) ; **avant** d'ajouter une feature (range la cuisine avant de cuisiner) ; **pendant** une code review ; **pour comprendre** un code obscur (refactorer, c'est le lire).

**Ne refactore PAS quand :** le code doit être **réécrit** de zéro (trop cassé) ; tu es **près d'une deadline** (un refactoring inachevé est une dette cachée) ; le code **ne sera plus jamais touché** (moche mais stable et isolé = ROI nul). La **dette technique** (métaphore de Ward Cunningham) : livrer vite avec du code imparfait, c'est emprunter ; les *intérêts* = le surcoût de chaque future modif ; refactorer, c'est **rembourser le capital**. Une dette *choisie et tracée* est saine ; subie et ignorée, elle immobilise l'équipe.

---

## 3. Worked examples

### Exemple A — Diagnostiquer le `process` de la §1

On nomme les smells **avant** de toucher au code. C'est l'étape que tout le monde saute et qui fait rater la moitié du travail.

| # | Symptôme observé | Smell (famille) | Refactoring visé |
|---|---|---|---|
| 1 | `process`, `s`, `p`, `evts` | mauvais nommage (Dispensables — le code force à commenter) | *Rename Method/Variable* |
| 2 | fait streak + points + tier + premium | **Long Method** (Bloaters) | *Extract Method* ×3 |
| 3 | `u: any`, `evts: any[]` | **Primitive Obsession** (Bloaters) | *Replace Data Value with Object* / typer |
| 4 | `t === 1/2/3`, `86400000 * 2`, `6`, `500` | **Magic Numbers** | *Replace Magic Number with Symbolic Constant* |
| 5 | chaîne `else if` sur `evts[i].t` | **Switch Statements** (OO Abusers) | *Replace Conditional with Polymorphism* (ou table) |
| 6 | `if premium { p = p*1.5 }` mêlé au calcul | **Divergent Change** (une fonction, plusieurs raisons de changer) | *Extract Method* / SRP (module 01) |

Ce tableau **est** le plan. Chaque ligne = un pas nommé, réversible, testable.

### Exemple B — Exécuter le refactoring en petits pas sûrs

On suppose un test qui fige la sortie actuelle (golden master, cours 06). À **chaque** pas, on relance : vert → commit.

```typescript
// PAS 0 — figer le comportement (avant de toucher à quoi que ce soit)
// expect(process(user, events)).toEqual({ streak: 3, points: 240, tier: 'silver' })

// PAS 1 — Rename + typer les entrées (Primitive Obsession → types)
enum EventType { CheckIn = 1, PhotoShared = 2, Reaction = 3 }
interface ActivityEvent { type: EventType; ts: number; }
interface Member { premium: boolean; }

// PAS 2 — Replace Magic Number with Symbolic Constant
const DAY_MS = 86_400_000;
const STREAK_GRACE_MS = 2 * DAY_MS;   // fenêtre pour ne pas casser le streak
const WEEK_STREAK = 7;
const POINTS = { checkIn: 10, weekBonus: 50, photo: 5, reaction: 1 } as const;
const PREMIUM_MULTIPLIER = 1.5;
const TIERS = [ { min: 500, name: 'gold' }, { min: 100, name: 'silver' }, { min: 0, name: 'bronze' } ];

// PAS 3 — Extract Method : une responsabilité par fonction, un seul niveau d'abstraction
function computeStreakAndCheckInPoints(events: ActivityEvent[]): { streak: number; points: number } {
  let streak = 0;
  let points = 0;
  let lastCheckIn: number | null = null;
  for (const event of events) {
    if (event.type !== EventType.CheckIn) continue;          // guard clause
    const continuesStreak = lastCheckIn !== null && event.ts - lastCheckIn < STREAK_GRACE_MS;
    streak = continuesStreak ? streak + 1 : 1;
    points += streak >= WEEK_STREAK ? POINTS.weekBonus : POINTS.checkIn;
    lastCheckIn = event.ts;
  }
  return { streak, points };
}

function computeEngagementPoints(events: ActivityEvent[]): number {
  const perType: Partial<Record<EventType, number>> = {   // table > chaîne de else-if
    [EventType.PhotoShared]: POINTS.photo,
    [EventType.Reaction]: POINTS.reaction,
  };
  return events.reduce((sum, e) => sum + (perType[e.type] ?? 0), 0);
}

function tierFor(points: number): string {
  return TIERS.find(t => points > t.min)?.name ?? 'bronze';
}

// PAS 4 — recomposer la fonction publique : elle se lit comme une phrase
function computeGamification(member: Member, events: ActivityEvent[]) {
  const { streak, points: checkInPoints } = computeStreakAndCheckInPoints(events);
  const raw = checkInPoints + computeEngagementPoints(events);
  const points = member.premium ? Math.floor(raw * PREMIUM_MULTIPLIER) : raw;
  return { streak, points, tier: tierFor(points) };
}
// Le golden master du PAS 0 est TOUJOURS vert : comportement inchangé, structure soignée.
```

Cinq smells éliminés en quatre pas nommés. Ajouter un type d'événement = une entrée dans `POINTS` + une dans la table, sans toucher au reste (proche d'OCP, module 01).

---

## 4. Pièges & misconceptions

- **« Refactorer = améliorer le code pendant que je corrige le bug / ajoute la feature. »** Non : une casquette à la fois. Si tu changes le comportement, ce n'est plus du refactoring. Mélanger les deux rend un test rouge indéchiffrable (feature ou restructuration ?). Fais le refactoring **puis** la feature, en commits séparés.
- **« Refactorer sans tests, je suis prudent. »** Sans filet, ce n'est pas un refactoring, c'est un pari. Le prérequis absolu est un test vert (au pire un golden master qui fige la sortie actuelle) — sinon tu ne sais pas si tu as préservé le comportement.
- **« Deux lignes qui se ressemblent = violation DRY, je factorise tout de suite. »** DRY porte sur la **connaissance métier**, pas la ressemblance. Factoriser trop tôt crée une abstraction fausse (Speculative Generality) plus coûteuse que la duplication. Règle de trois.
- **« Un smell, c'est un bug à corriger. »** Un smell est un **symptôme**, une invitation à regarder — pas une preuve. Du code moche, stable, isolé et jamais retouché peut légitimement rester tel quel : le refactoring a un coût, il lui faut un ROI.
- **Divergent Change vs Shotgun Surgery.** Faciles à confondre. *Divergent Change* = **une** classe changée pour **plusieurs** raisons (découpe-la). *Shotgun Surgery* = **une** raison qui force à changer **plusieurs** classes (regroupe-les). Symptômes opposés, remèdes opposés.
- **« Un gros commentaire sauve un code obscur. »** Le smell *Comments* : un commentaire qui **paraphrase le quoi** signale que le code n'est pas assez expressif. Le remède n'est pas de garder le commentaire, c'est *Extract Method* + *Rename* jusqu'à s'en passer. Garde les commentaires qui expliquent le **pourquoi** (une décision, un contexte non déductible).
- **Guard clause mal placée.** Sortir tôt est bon, mais un `return` au milieu d'une logique qui doit *toujours* exécuter un nettoyage (fermeture, log) casse le comportement. Le guard clause vaut pour les **préconditions**, pas pour court-circuiter un flux à effet de bord.

---

## 5. Ancrage TribuZen

Le module de gamification (streak + points + tier) est le premier morceau de TribuZen qu'on assainit. Dans le vrai repo `smaurier/tribuzen`, ce nettoyage se matérialise ainsi :

- `api/src/gamification/gamification.service.ts` — la fonction fourre-tout `process` devient `computeGamification`, orchestrant trois fonctions à responsabilité unique (streak, engagement, tier).
- `api/src/gamification/events.ts` — les `t === 1/2/3` deviennent un `enum EventType` typé (fin de la Primitive Obsession) ; les seuils/points deviennent des constantes nommées.
- `api/test/gamification.golden.spec.ts` — un golden master fige la sortie observée **avant** le refactoring et reste vert à chaque pas : preuve du comportement constant.

C'est l'application directe de la ligne fil-rouge « couches clean (domain/app/infra) — refactor réel TribuZen » : on nettoie la logique métier *avant* de la ranger dans sa couche (module 05) et de lui injecter ses dépendances (module 04).

---

## 6. Points clés

1. **Nommer d'abord.** Diagnostiquer les smells (et leur famille) précède tout geste : le tableau smell→refactoring **est** le plan.
2. **Fonctions courtes, un seul niveau d'abstraction**, guard clauses pour les préconditions : la lisibilité réduit la charge cognitive du prochain lecteur.
3. **DRY porte sur la connaissance**, pas la ressemblance — règle de trois avant d'abstraire ; sinon Speculative Generality.
4. **5 familles de smells** : Bloaters, OO Abusers, Change Preventers, Dispensables, Couplers. Retiens les couples-miroirs Divergent Change/Shotgun Surgery et Message Chains/Middle Man.
5. **Refactoring = structure changée, comportement constant.** Une casquette à la fois ; jamais feature et refactoring dans le même commit.
6. **Filet obligatoire** : petits pas + tests verts (golden master au minimum) ; un pas qui rougit se revert.
7. **6 groupes de techniques**, la plupart par paires inverses. Mémorise les groupes et le couplage smell→technique, pas les 66 noms.
8. **Refactore** à la 3ᵉ touche, avant une feature, en review, pour comprendre. **Abstiens-toi** près d'une deadline, sur du code à réécrire, ou sur du code figé isolé : le refactoring a un coût, il lui faut un ROI.

---

## 7. Seeds Anki

```
Qu'est-ce qu'un code smell (une odeur de code) ?|Un symptôme qui invite à regarder une possible faiblesse de conception — pas une preuve de bug ni un verdict
Quelles sont les 5 familles de code smells ?|Bloaters, OO Abusers, Change Preventers, Dispensables, Couplers
Différence Divergent Change vs Shotgun Surgery ?|Divergent Change = une classe changée pour plusieurs raisons (découpe-la) ; Shotgun Surgery = une raison qui force à changer plusieurs classes (regroupe-les)
Définition stricte du refactoring ?|Changer la structure interne sans changer le comportement observable : mêmes entrées → mêmes sorties avant/après
Que dit la règle des deux casquettes (Fowler) ?|À tout instant on est soit en mode feature (comportement change) soit en mode refactoring (comportement figé, tests verts) — jamais les deux ensemble
Quel est le filet de sécurité d'un refactoring ?|Petits pas + tests verts : un seul changement nommé à la fois, revert si un test rouge apparaît ; golden master au minimum
Sur quoi porte réellement DRY, et que dit la règle de trois ?|Sur la connaissance métier (pas la ressemblance syntaxique) ; attendre la 3e occurrence de la même connaissance avant d'abstraire
Quel refactoring pour un Switch Statements sur un type ?|Replace Conditional with Polymorphism (State/Strategy) ou une table de correspondance
Quand NE PAS refactorer ?|Près d'une deadline, quand le code doit être réécrit de zéro, ou quand il est stable/isolé et ne sera plus touché (ROI nul)
Remède au smell Primitive Obsession ?|Replace Data Value with Object / typer : un Value Object ou un enum au lieu de string/number nus
```

## Pont vers le lab

> Lab associé : `13-architecture/labs/lab-03-clean-code-code-smells-refactoring/README.md`. Exercice de diagnostic + plan : sur un extrait TribuZen fourni, tu nommes les smells par famille et tu écris le plan de refactoring en petits pas sûrs. Évalué par grille + coach, avec variante J+30. Zéro harnais : le refactoring se **raisonne** ici, il ne s'exécute pas.
