# Lab 07 — Clean Architecture

> **Outcome :** à la fin, tu sais prendre un feature TribuZen, le **mapper sur les 4 cercles** de la clean architecture, placer chaque règle dans le bon anneau (**entity vs use case**), **tracer la dependency rule** et repérer les violations, puis **décider si la clean vaut son coût** ici (ou si couches/hexagonale suffisent).
> **Vrai outil :** papier / tableau blanc / fichier `.md`. C'est un exercice de **conception**, pas d'implémentation. Tu produis un schéma en cercles + une table de placement + un graphe de dépendances annoté + une décision (mini-ADR). Aucun code à exécuter.
> **Feedback :** le coach valide le raisonnement en session (grille ci-dessous). Pas de test-runner.

---

## Énoncé

TribuZen ajoute un feature : **« récompenser une séquence parfaite de semaine »**. Un contributeur a tout empilé dans un service NestJS. Tu le lis (pas à l'exécuter), tu ne le refactores pas ligne à ligne — tu le **remappes sur les cercles**.

```ts
// weekly-reward.service.ts — TOUT est empilé ici
@Injectable()
export class WeeklyRewardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly push: PushNotificationService,
  ) {}

  async rewardIfPerfectWeek(childId: string, weekStart: string) {
    // a. Lecture directe de la base
    const days = await this.prisma.completion.findMany({
      where: { childId, day: { gte: weekStart } },
    });

    // b. Règle « une semaine parfaite = 7 jours consécutifs complétés »
    const uniqueDays = new Set(days.map((d) => d.day));
    let streak = 0;
    const cursor = new Date(weekStart);
    for (let i = 0; i < 7; i++) {
      const key = cursor.toISOString().slice(0, 10);
      if (uniqueDays.has(key)) streak++;
      else break; // une série se casse dès qu'un jour saute
      cursor.setDate(cursor.getDate() + 1);
    }
    const perfect = streak === 7;

    // c. Scénario applicatif : si parfait, créer une récompense + notifier + logguer
    if (perfect) {
      // c1. Règle « une récompense hebdo ne peut être attribuée qu'une fois par semaine »
      const existing = await this.prisma.reward.findFirst({
        where: { childId, weekStart, kind: 'perfect-week' },
      });
      if (existing) throw new BadRequestException('déjà récompensé cette semaine');

      const reward = await this.prisma.reward.create({
        data: { childId, weekStart, kind: 'perfect-week' },
      });
      await this.push.send(childId, 'Semaine parfaite ! 🎉');
      // d. Formatage de la réponse renvoyée au controller HTTP
      return { rewarded: true, rewardId: reward.id, message: 'Semaine parfaite !' };
    }
    return { rewarded: false, message: `${streak}/7 jours` };
  }
}
```

**Ta mission (conception uniquement) :**

1. **Mappe chaque responsabilité** (a, b, c, c1, d) sur le **bon cercle** : Entities (c1), Use Cases (c2), Interface Adapters (c3), Frameworks & Drivers (c4).
2. Pour les **règles** (b, c1), tranche : **entity** ou **use case** ? Applique le test *« vrai sans ce logiciel ? »* et justifie en une phrase chacune.
3. **Dessine le schéma en cercles cible** du feature (arborescence `core/entities`, `core/use-cases`, `core/use-cases/ports`, `adapters`, `infrastructure`, une phrase de rôle par fichier).
4. **Trace le graphe de dépendances** de la version *actuelle* et **entoure les violations** de la dependency rule (import qui pointe vers l'extérieur).
5. **Écris un mini-ADR (5-8 lignes)** : quelle règle vit dans quel cercle, **et** la décision *« clean vaut-elle son coût ici, ou couches/hexagonale suffiraient ? »* avec justification. Tranche aussi : **presenters/output boundaries — oui ou non ?**

**Contrainte de portée :** on raisonne **clean architecture (module 07)**. Tu peux t'appuyer sur l'inversion de dépendance (acquise au **06**) et la règle de dépendance vers le bas (**05**), mais l'apport à démontrer ici est la **distinction entity/use case** + la **dependency rule vers l'intérieur**. Ne réimplémente pas NestJS/Prisma (cours 09/10).

---

## Étapes (en friction)

1. **Inventaire.** Relis le service et liste chaque chose qu'il fait (lire les complétions, calculer la série, décider « parfait », vérifier l'unicité hebdo, créer la récompense, notifier, formater la réponse). Pour chacune : **quelle est sa raison de changer ?**
2. **Entity ou Use Case ?** Pour la règle b (semaine parfaite = 7 consécutifs) et la règle c1 (une récompense/semaine max), applique le test du §2.6 du module. Piège : l'une est une propriété de la **notion** (série), l'autre est une **politique d'attribution** propre au produit. Ne les mets pas dans le même cercle par réflexe.
3. **Ports.** Identifie ce dont le use case a besoin de l'extérieur (lire les complétions, persister une récompense, notifier) et déclare une **interface** par besoin, **dans le cœur** (cercle 2). Le use case ne nommera jamais Prisma ni Push directement.
4. **Schéma en cercles.** Écris l'arborescence cible avec un fichier par responsabilité et une phrase de rôle. Marque le cercle de chaque fichier.
5. **Graphe actuel + violations.** Dessine les flèches d'import de la version livrée. Pour chaque flèche : pointe-t-elle vers l'**intérieur** (OK) ou l'**extérieur** (violation) ? Compte les violations.
6. **Décision de coût.** Ce domaine (séries, récompenses, science comportementale) est-il assez riche pour justifier la clean, ou l'hexagonale/les couches suffiraient ? Tranche et justifie. Décide aussi pour les presenters.
7. **Mini-ADR + auto-contrôle.** Rédige l'ADR, puis repasse la grille ci-dessous sur ta copie avant de la montrer au coach.

---

## Corrigé complet commenté

> Le corrigé porte sur le **placement et les dépendances**, pas sur du code exécutable. Les extraits sont des squelettes montrant *dans quel cercle* vit chaque responsabilité.

### 1. Mapping des responsabilités sur les cercles

| Responsabilité (code) | Cercle | Pourquoi |
|---|---|---|
| `prisma.completion.findMany`, `reward.findFirst/create` | **c4 Frameworks & Drivers** (via port) | Détail de persistance, change si on change d'ORM |
| `push.send(...)` | **c4** (via port) | Effet de bord I/O externe |
| (b) « semaine parfaite = 7 jours **consécutifs** » | **c1 Entity** | Propriété de la notion « série » — vraie sur papier, sans TribuZen |
| (c1) « une récompense hebdo max par semaine » | **c2 Use Case** | **Politique d'attribution** propre à ce produit (choix TribuZen, pas définition d'une série) |
| (c) orchestrer : calculer → vérifier unicité → créer → notifier | **c2 Use Case** | Scénario applicatif, coordination d'un cas d'usage |
| (d) formater `{ rewarded, message }` pour HTTP | **c3 Interface Adapter** (controller/presenter) | Format de sortie, change si l'API change |
| Recevoir `childId`/`weekStart` depuis HTTP | **c3** (controller) | Traduction HTTP → appel de use case |

> Le point qui piège : **(b) et (c1) sont toutes deux des « règles », mais pas du même cercle.** « 7 jours consécutifs » définit ce qu'**est** une semaine parfaite (entity). « Une seule récompense par semaine » est une **décision produit** sur l'attribution (use case). Test : *« serait-ce vrai sans ce logiciel ? »* — oui pour (b), non pour (c1).

### 2. Schéma en cercles cible

```
weekly-reward/
  core/
    entities/
      streak.ts               ← c1 : série = jours consécutifs, cassée si un jour saute
      perfect-week.ts         ← c1 : "parfaite" = 7 consécutifs sur la semaine (règle b)
    use-cases/
      reward-perfect-week.ts  ← c2 : orchestre calcul → unicité hebdo → récompense → notif (règles c/c1)
      ports/
        completion.repository.ts ← interface (contrat), définie DANS le cœur
        reward.repository.ts     ← interface : findByWeek, save
        reward-notifier.ts       ← interface : notify(childId, message)
  adapters/
    weekly-reward.controller.ts  ← c3 : HTTP → use case, DomainError → HttpException, formate la réponse
  infrastructure/
    prisma-completion.repository.ts ← c4 : implémente completion.repository.ts
    prisma-reward.repository.ts     ← c4 : implémente reward.repository.ts
    push-reward-notifier.ts         ← c4 : implémente reward-notifier.ts avec PushNotificationService
```

> Les `ports/` sont des **interfaces définies dans le cercle 2** ; l'infra (c4) les implémente. L'import va de l'infra **vers** le port (vers l'intérieur) → dependency rule respectée, alors que l'appel runtime va du use case vers la base (module 07, §2.4).

### 3. Où vit chaque règle (squelettes)

```ts
// core/entities/perfect-week.ts — c1, AUCUN import framework
export class PerfectWeek {
  // Règle d'ENTREPRISE (b) : 7 jours consécutifs à partir de weekStart
  static evaluate(weekStart: string, completedDays: Set<string>): { streak: number; perfect: boolean } {
    let streak = 0;
    const cursor = new Date(weekStart);
    for (let i = 0; i < 7; i++) {
      const key = cursor.toISOString().slice(0, 10);
      if (!completedDays.has(key)) break; // une série se casse dès qu'un jour saute
      streak++;
      cursor.setDate(cursor.getDate() + 1);
    }
    return { streak, perfect: streak === 7 };
  }
}
```

```ts
// core/use-cases/reward-perfect-week.ts — c2, dépend d'INTERFACES seulement
export class RewardPerfectWeek {
  constructor(
    private readonly completions: CompletionRepository, // port (c2)
    private readonly rewards: RewardRepository,          // port (c2)
    private readonly notifier: RewardNotifier,           // port (c2)
  ) {}

  async execute(childId: string, weekStart: string): Promise<RewardResult> {
    const days = await this.completions.completedDays(childId, weekStart); // via port
    const { streak, perfect } = PerfectWeek.evaluate(weekStart, days);     // règle en c1
    if (!perfect) return { rewarded: false, message: `${streak}/7 jours` };

    // Politique d'attribution (c1 du code) = décision applicative → use case
    if (await this.rewards.findByWeek(childId, weekStart, 'perfect-week')) {
      throw new DomainError('Déjà récompensé cette semaine');
    }
    const reward = await this.rewards.save({ childId, weekStart, kind: 'perfect-week' });
    await this.notifier.notify(childId, 'Semaine parfaite !');
    return { rewarded: true, rewardId: reward.id, message: 'Semaine parfaite !' };
  }
}
```

> Note : le use case renvoie un **DTO simple** (`RewardResult`), **pas** via un presenter/output boundary — voir la décision de coût en §5. La `DomainError` sera traduite en `HttpException` par le controller (c3), jamais levée par le use case en type NestJS.

### 4. Graphe de dépendances — version LIVRÉE (violations)

```
WeeklyRewardService (c2, prétendu) ──▶ PrismaService  (V1) c2 → c4 : le use case importe l'ORM concret
WeeklyRewardService                ──▶ PushNotifService (V2) c2 → c4 : le use case importe l'infra push
WeeklyRewardService  ── lève BadRequestException (NestJS) (V3) c2 → c4 : dépend d'un détail HTTP
WeeklyRewardService  ── porte la règle « 7 consécutifs »   (V4) règle d'entité noyée dans le use case (pas de cercle 1)
```

**Quatre problèmes.** V1/V2/V3 = dépendances **vers l'extérieur** (le use case nomme Prisma, Push, une exception HTTP). V4 = la règle d'entité (b) n'est pas isolée dans un cercle 1 → la distinction entity/use case est perdue.

### Graphe CIBLE (conforme)

```
WeeklyRewardController      ──▶ RewardPerfectWeek        (c3 → c2, vers l'intérieur, OK)
RewardPerfectWeek          ──▶ PerfectWeek (entité)      (c2 → c1, vers l'intérieur, OK)
RewardPerfectWeek          ──▶ CompletionRepository (port) (c2 → c2, OK)
RewardPerfectWeek          ──▶ RewardRepository / RewardNotifier (ports) (c2, OK)
PrismaCompletionRepository ──▶ CompletionRepository (implémente) (c4 → c2, vers l'intérieur, OK)
PushRewardNotifier         ──▶ RewardNotifier (implémente)        (c4 → c2, vers l'intérieur, OK)
```

Toutes les flèches pointent vers l'intérieur ou implémentent un port. Aucune vers l'extérieur.

### 5. Mini-ADR (exemple attendu)

```
ADR-07 — Clean architecture pour le feature « récompense de semaine parfaite »
Contexte : le service empile lecture BDD, règle de série, politique d'attribution, notif et HTTP.
Décision :
  - « 7 jours consécutifs » = définition d'une série → Entity (cercle 1, PerfectWeek).
  - « une récompense/semaine max » + orchestration → Use Case (cercle 2, RewardPerfectWeek).
  - Prisma + Push → infrastructure (cercle 4), derrière des ports définis dans le cœur.
  - Controller = adapter (cercle 3) : HTTP + traduction DomainError -> HttpException.
Coût : clean JUSTIFIÉE ici — le domaine séries/récompenses est riche, durable, et réutilisé
  par le job de sync offline (même entité, autre point d'entrée). Le module Routines l'est déjà.
  Presenters / output boundaries : NON — une seule sortie (JSON), le use case renvoie un DTO simple.
Conséquence : la règle « 7 consécutifs » est testable sans HTTP ni base, réutilisable en batch offline.
```

**Pourquoi ce corrigé est correct :** chaque règle est dans le bon cercle (b en entity, c1 en use case) ; toutes les dépendances pointent vers l'intérieur ; le cœur ne nomme ni Prisma, ni Push, ni HTTP ; et la décision de coût est **explicite** (clean oui, mais presenters non — on ne paie que l'indirection utile).

---

## Grille d'évaluation (coach)

| Critère | Attendu | ✅ / ❌ |
|---|---|---|
| Mapping des cercles | Chaque responsabilité (a→d) placée dans le bon cercle, justifiée par « raison de changer » | |
| Entity vs Use Case | (b) « 7 consécutifs » en **entity**, (c1) « 1 récompense/semaine » en **use case**, chacune justifiée par le test « vrai sans le logiciel ? » | |
| Ports dans le cœur | Les interfaces (completion/reward/notifier) sont **définies dans le cercle 2**, pas dans l'infra | |
| Dependency rule | Trace le graphe et identifie les **violations** livrées (imports vers l'extérieur + règle d'entité noyée) | |
| Graphe cible correct | Toutes les flèches pointent vers l'intérieur ou implémentent un port ; aucune vers l'extérieur | |
| Cœur propre | Ni entité ni use case ne nomment Prisma / Push / HttpException ; DomainError traduite par l'adapter | |
| Décision de coût | Tranche « clean vs hexagonale/couches » **et** « presenters oui/non » avec justification (pas de cérémonie subie) | |
| Portée respectée | Reste en raisonnement clean ; ne réimplémente pas NestJS/Prisma | |

Seuil : **6/8** pour valider. En dessous, refais le mapping entity/use case (étapes 1-2) avant de retracer le graphe — c'est là que se joue l'apport de la clean.

---

## Variante J+30 (fading)

**Même exercice, contraintes ajoutées :**

1. **En 25 minutes, de mémoire**, sans relire ce corrigé ni le module 07.
2. On te donne un **nouveau** feature en pêle-mêle : *« clôturer un défi de groupe »* — le service lit les participations en base, calcule le classement, applique la règle « un défi ne se clôture qu'après sa date de fin », attribue des points à chaque membre selon son rang, notifie les parents, et renvoie le podium au front. Mappe-le sur les 4 cercles, place chaque règle (entity vs use case), trace le graphe, liste les violations.
3. **Contrainte supplémentaire :** identifie **une** règle qui est un **piège de placement** (ex : « le classement » — définition d'un défi (entity) ou politique d'attribution de points (use case) ?) et tranche en une phrase. Et décide **explicitement** : pour ce feature précis, la clean ou l'hexagonale suffit-elle ?

**Critère de réussite :** schéma en cercles + graphe sans flèche vers l'extérieur + ADR de 5 lignes, produits en 25 min, avec au moins une règle correctement placée en **entity** et une décision de coût assumée (clean vs hexagonale).

---

## Application TribuZen

Ce lab prépare un vrai feature du backend NestJS de TribuZen (repo `smaurier/tribuzen-api`).

- Le module **Routines/Rewards** est le domaine le plus riche du produit (séries, récompenses, renforcement comportemental) : c'est **là** que la clean se justifie, pas partout.
- Les entités `Streak`/`PerfectWeek` seront **réutilisées** par le job de **sync offline** (le mobile pousse des complétions en batch au retour réseau — même règle, autre point d'entrée) : preuve concrète que la règle appartient à l'entité, pas à un scénario.
- Prisma et le service push restent au **cercle 4**, derrière des ports. Le passage éventuel de certaines données en **Level 1** (device-only chiffré, spec §8) ne touchera que l'implémentation des repositories — entités et use cases ne bougent pas.
- Pour les modules pauvres en règles (préférences, config), on **reste en couches (05)** : décision d'ADR, pas de clean par défaut.

**Commit cible :**
```
feat(rewards): use case « semaine parfaite » en clean — règle série en entity, attribution en use case
```
