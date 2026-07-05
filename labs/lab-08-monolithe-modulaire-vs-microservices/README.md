# Lab 08 — Monolithe modulaire vs microservices

> **Outcome :** à la fin, tu sais **décider** un style de déploiement (monolithe modulaire vs microservices) pour TribuZen avec une **justification écrite** défendable, **découper** le backend en modules à frontières nettes, et **repérer + corriger** les violations de frontière.
> **Vrai outil :** papier / tableau blanc / fichier `.md` — c'est un exercice de **conception et de décision**, pas d'implémentation. Tu produis une décision motivée + un schéma de modules + un graphe d'imports annoté + un mini-ADR. Aucun code à faire tourner.
> **Feedback :** le coach valide le raisonnement en session (grille ci-dessous). Pas de test-runner.

---

## Énoncé

TribuZen a levé un peu d'argent. Le fondateur (toi) recrute un·e deuxième dev. Un consultant de passage laisse une note :

> « Avant de grossir, découpez tout de suite le backend en microservices : `routines`, `family`, `notifications`, `sync`, `identity`, `billing`. Chaque service sa base, chaque service son déploiement. C'est comme ça que font les grosses boîtes. »

Voici ce que tu sais du produit **aujourd'hui** :

- Équipe : **2 développeurs**, même fuseau, pas d'équipes séparées.
- Domaine : le modèle des **routines** bouge encore (règles de série, catégories) ; `family` et `identity` sont stables.
- Charge : quelques centaines de familles, pas de pic. Le scaling n'est **pas** un problème.
- Feature critique : « **compléter une routine** » → met à jour la **série** → déclenche une **notification** aux co-référents. Doit être fiable.
- Contrainte réseau réelle : le **mobile** (React Native) fonctionne **offline** et pousse des complétions **en batch** au retour réseau — les retries sont inévitables.
- Ambition : dans 18 mois peut-être, l'envoi de push devient volumineux et pourrait passer à une équipe dédiée.

**Ta mission (conception + décision uniquement) :**

1. **Applique le cadre de décision** (module 08, §2.6) point par point à TribuZen et **tranche** : monolithe modulaire ou microservices ? Écris la **justification** (le livrable qui compte — pas juste le verdict).
2. **Dessine le schéma de modules cible** du backend (arborescence + une phrase de responsabilité par module + ce que chaque `index.ts` expose vs cache).
3. **Traite la feature « compléter → série → notifier »** : comment `notifications` apprend-il qu'une routine est complétée **sans** que `routines` dépende de lui ? Justifie le mécanisme.
4. **Identifie LE candidat d'extraction** futur (le premier module qui deviendrait un service **si** une contrainte réelle apparaissait) et **le signal** qui déclencherait cette extraction.
5. **Trace un graphe d'imports** volontairement bancal (fourni ci-dessous), **annote chaque flèche** (OK / violation) et propose le correctif.
6. **Écris un mini-ADR** (6-10 lignes) actant la décision.

**Graphe d'imports à auditer (étape 5) :**

```
routines/application   ──▶ family/index.ts                         (1)
routines/application   ──▶ family/infrastructure/prisma-family.repo  (2)
notifications/app      ──▶ shared/event-bus (écoute RoutineCompleted) (3)
billing/application    ──▶ routines/domain/routine.entity            (4)
sync/infrastructure    ──▶ SELECT ... FROM routines_table (SQL direct) (5)
family/application     ──▶ routines/application/complete.service      (6)
```

**Contrainte de portée :** on décide **le style de déploiement et le découpage macro**. On ne conçoit **PAS** la mécanique distribuée (saga, cohérence éventuelle, event sourcing, message broker) — c'est déféré aux modules 16-19. Reste sur : mono vs micro, frontières de modules, événement interne vs appel réseau, idempotence *nommée* là où le réseau l'impose.

---

## Étapes (en friction)

1. **Le cadre, point par point.** Pour chacune des 4 questions du cadre (§2.6), écris la réponse TribuZen **et** sa conséquence. Ne saute aucune question : c'est la justification qui compte, pas le verdict.
2. **Nomme le piège du consultant.** `billing` et `identity` apparaissent dans sa liste — sont-ils justifiés aujourd'hui ? Qu'est-ce qu'un découpage à 6 services provoquerait pour 2 devs ? (mot-clé attendu : overhead / nano-services / monolithe distribué).
3. **Schéma de modules.** Écris l'arborescence `modules/<nom>/index.ts + presentation|application|domain|infrastructure`. Pour chaque module, une phrase : ce qu'il **expose** vs ce qu'il **cache**.
4. **La feature transverse.** « Compléter → série → notifier » : décide où vit la série (quel module) et **par quel mécanisme** `notifications` réagit. Appel direct ? Événement interne ? Justifie en une phrase pourquoi ton choix garde `notifications` extractible plus tard.
5. **Idempotence.** Repère le **seul** endroit où l'idempotence est non négociable dès la v1 et explique pourquoi (indice : où y a-t-il du réseau non fiable ?). Nomme l'outil (clé d'idempotence / `Idempotency-Key`).
6. **Audit du graphe.** Pour chacune des 6 flèches : descendante/publique OK, ou violation (accès aux internals, SQL direct dans la table d'un autre module, dépendance circulaire). Compte les violations et donne le correctif de chacune.
7. **Candidat d'extraction.** Choisis LE module qu'on extrairait en premier et **le signal mesurable** (pas « quand ce sera moderne ») qui déclencherait la décision.
8. **Mini-ADR.** Rédige la décision finale (contexte / décision / conséquence). Puis repasse la grille ci-dessous sur ta copie avant de la montrer au coach.

---

## Corrigé complet commenté

> Le corrigé porte sur **la décision, les frontières et le raisonnement** — pas sur du code exécutable. Les extraits sont des squelettes montrant *où* vit chaque responsabilité et *par quelle porte* les modules communiquent.

### 1. Le cadre de décision appliqué

| Question (§2.6) | Réponse TribuZen | Conséquence |
|---|---|---|
| > 15-20 devs en équipes séparées ? | Non — 2 devs, même équipe | → monolithe |
| Domaine stable et figé ? | Non — les routines bougent encore | → monolithe (frontières internes réversibles, gratuites) |
| Besoins de scaling franchement divergents ? | Non — charge modeste, uniforme | → monolithe (scale l'artefact entier, trivial) |
| Prêt à payer K8s + tracing + saga ? | Non, et rien ne l'exige | → monolithe |

**Verdict : monolithe modulaire.** Zéro condition d'extraction remplie.

### 2. Le piège du consultant

Six services pour 2 devs = **nano-services** + risque de **monolithe distribué**. `billing` n'a même pas de logique aujourd'hui (paiement à peine cadré) : l'extraire, c'est un service vide à déployer, monitorer, tracer. Découper `routines`/`family` maintenant transforme la transaction locale « compléter + notifier » en appel réseau à gérer (panne, retry, double notif). On paierait **tout** le coût opérationnel des microservices **sans** aucun de leurs bénéfices (aucune équipe séparée à autonomiser, aucun scaling divergent). C'est exactement le pire des deux mondes.

### 3. Schéma de modules cible

```
tribuzen-api/
  src/
    modules/
      routines/
        index.ts          ← expose : CompleteRoutineService, RoutineSummary
                             cache  : routine.entity, prisma-routine.repo, calcul de série
        presentation/ application/ domain/ infrastructure/
      family/
        index.ts          ← expose : GetFamilyService, FamilySummary (co-référents, max 8)
                             cache  : family.entity, prisma-family.repo
      notifications/
        index.ts          ← expose : (rien de public métier)
                             s'abonne à RoutineCompleted via shared/event-bus
      sync/
        index.ts          ← expose : SyncBatchService (réconciliation offline mobile)
                             cache  : logique de dédup, clés d'idempotence
      identity/
        index.ts          ← expose : AuthService, CurrentUser (stable)
    shared/
      event-bus.ts        ← communication interne PAR MESSAGE entre modules
```

> Pas de module `billing` : hors périmètre tant que le paiement n'a pas de vraie logique. On ne crée pas un module (ni a fortiori un service) « au cas où ».

### 4. La feature « compléter → série → notifier »

- La **série (streak)** est une **règle métier** : elle vit dans le **domaine `routines`** (calculée à la complétion), pas dans une requête SQL ad hoc ni dans `notifications`.
- `notifications` apprend la complétion via un **événement interne** `RoutineCompleted` publié sur `shared/event-bus` et consommé par un handler dans `notifications`.

```ts
// routines/application/complete-routine.service.ts (squelette)
async execute(routineId: string, childId: string) {
  const routine = await this.repo.findById(routineId);
  const completion = routine.complete(childId, today); // série mise à jour dans le domaine
  await this.repo.save(completion);
  // Couplage PAR MESSAGE, pas par appel direct : routines ne connaît pas notifications
  this.eventBus.publish(new RoutineCompletedEvent(routineId, childId));
  return completion.streak;
}
```

**Pourquoi ce choix :** l'événement interne rend `routines` **ignorant** de `notifications`. Aujourd'hui c'est un appel local (transaction/bus en process, fiable). Demain, si `notifications` devient un service, on remplace le bus interne par un vrai broker **sans toucher `routines`** — le couplage est déjà par message. C'est ça, « soigner la frontière pour garder l'option ouverte ».

### 5. Idempotence — le seul point non négociable v1

Le module **`sync`**. Le mobile pousse des complétions **en batch** au retour réseau ; un timeout/tunnel fait **rejouer** le batch. Sans idempotence → complétions doublées, séries fausses. Chaque complétion porte une **clé d'idempotence** (UUID généré **sur le device** avant l'envoi, header `Idempotency-Key`) ; l'API mémorise le résultat par clé et **renvoie le résultat mémorisé** sur un rejeu, sans re-traiter. C'est le seul endroit où il y a du **réseau non fiable dès la v1**, donc le seul où l'idempotence est obligatoire immédiatement.

### 6. Audit du graphe

| Flèche | Verdict | Raison / correctif |
|---|---|---|
| (1) `routines` → `family/index.ts` | ✅ OK | Passe par la porte publique |
| (2) `routines` → `family/infrastructure/prisma-family.repo` | ❌ Violation | Import d'un **internal** d'un autre module. Correctif : passer par `family/index.ts` |
| (3) `notifications` → event-bus (`RoutineCompleted`) | ✅ OK | Couplage par message ; design exemplaire, garde `notifications` extractible |
| (4) `billing` → `routines/domain/routine.entity` | ❌ Violation | Import de l'**entité interne** d'un autre module (et `billing` ne devrait même pas exister). Correctif : supprimer le module `billing` pour l'instant ; sinon passer par l'API publique de `routines` |
| (5) `sync` → `SELECT ... FROM routines_table` | ❌ Violation | **SQL direct dans la table d'un autre module** = data-per-module violé ; rend l'extraction impossible. Correctif : passer par `routines/index.ts` (service public) |
| (6) `family` → `routines/application/complete.service` | ❌ Violation | **Dépendance circulaire** (`routines`→`family` en (1) + `family`→`routines` ici). Correctif : repenser la frontière ou inverser via un événement |

**Quatre violations : (2), (4), (5), (6).** (1) et (3) sont exemplaires.

### 7. Candidat d'extraction

**`notifications`.** C'est un effet de bord asynchrone, déjà couplé **par événement** (donc découplé du reste), avec un cycle de vie propre. **Signal déclencheur (mesurable) :** l'envoi de push devient un goulot (latence/volume qui pénalise les requêtes principales) **ou** passe à une équipe dédiée. Tant que ce signal n'apparaît pas, `notifications` reste un module. On note la porte, on ne la franchit pas.

### 8. Mini-ADR attendu

```
ADR-08 — Style de déploiement du backend TribuZen
Contexte : 2 devs, domaine routines mouvant, charge modeste, feature transverse
  "compléter + notifier", mobile offline avec batch au retour réseau.
Décision :
  - Monolithe modulaire NestJS (un déployable). Aucune condition d'extraction
    du cadre n'est remplie (équipe, stabilité, scaling, appétit opérationnel).
  - Modules : routines, family, notifications, sync, identity — chacun avec index.ts
    public ; frontières imposées par lint (no-restricted-imports) + test de frontière.
  - "Compléter → série → notifier" reste local : série dans le domaine routines,
    notification via événement interne RoutineCompleted (couplage par message).
  - Idempotence obligatoire dès la v1 sur le module sync (batch mobile rejouable).
  - Pas de module billing tant que le paiement n'a pas de logique réelle.
Conséquence :
  - Extraction future possible ; premier candidat = notifications, déclenché SI
    l'envoi de push devient un goulot ou passe à une équipe dédiée.
  - On garde transactions ACID, débogage simple, un seul déploiement, aujourd'hui.
```

**Pourquoi ce corrigé est correct :** la décision découle du **cadre** appliqué (pas d'un goût), les frontières sont **imposées** (barrel + lint + data-per-module) et non espérées, la feature transverse est couplée **par message** (extractible sans réécriture), l'idempotence est placée **exactement** là où le réseau l'impose, et l'extraction future est **conditionnée à un signal mesurable** — pas à une mode.

---

## Grille d'évaluation (coach)

| Critère | Attendu | ✅ / ❌ |
|---|---|---|
| Cadre appliqué | Les 4 questions du cadre traitées **une par une** avec réponse + conséquence, pas juste un verdict | |
| Décision justifiée | Verdict « monolithe modulaire » **argumenté** (le raisonnement, pas l'étiquette) | |
| Piège du consultant nommé | Identifie nano-services / monolithe distribué / overhead pour 2 devs ; rejette `billing`/6 services | |
| Frontières imposées | Chaque module a un `index.ts` (expose vs cache) ; frontière **outillée** (lint/test), pas seulement rangée | |
| Feature transverse | Série dans le domaine `routines` ; `notifications` réagit par **événement interne**, pas appel direct | |
| Idempotence bien placée | Identifie `sync` comme seul point v1 non négociable + nomme la clé d'idempotence + explique le réseau non fiable | |
| Audit du graphe | Identifie les **4** violations (2, 4, 5, 6) avec correctif ; reconnaît (1) et (3) comme corrects | |
| Candidat + signal | `notifications` + un **signal mesurable** de déclenchement (pas « quand ce sera mûr ») | |
| Portée respectée | Reste sur mono/micro + frontières ; ne conçoit pas la saga/cohérence (modules 18-19) | |

Seuil : **7/9** pour valider. En dessous, reprends le cadre de décision (étape 1) et l'audit du graphe (étape 6) avant de rédiger l'ADR.

---

## Variante J+30 (fading)

**Même exercice, contraintes ajoutées :**

1. **En 25 minutes, de mémoire**, sans relire ce corrigé ni le module 08.
2. **Contexte modifié :** TribuZen a grossi — **12 développeurs répartis en 3 squads**, le domaine des routines est désormais **stable**, et le module `sync` (réconciliation offline) subit des **pics de charge** 10× supérieurs au reste lors des retours de vacances scolaires. Refais la décision avec le cadre.
3. **Contrainte supplémentaire :** identifie **le premier service à extraire** dans ce nouveau contexte, justifie par **quel(s) axe(s) du cadre** (organisationnel ? scaling ? stabilité ?) et nomme **une** difficulté distribuée que l'extraction va créer (que tu devras traiter aux modules 18-19).

**Critère de réussite :** une décision qui **change** par rapport au contexte initial **et** qui reste justifiée par le cadre (ici, l'extraction de `sync` devient défendable : scaling divergent réel + squads séparées), avec au moins une conséquence distribuée nommée (ex : la réconciliation offline devra gérer la cohérence éventuelle entre le service `sync` et le domaine `routines`).

---

## Application TribuZen

Ce lab acte le **style d'architecture** du backend réel de TribuZen (repo `smaurier/tribuzen-api`).

- Le backend **est** un monolithe modulaire NestJS ; ce lab produit le découpage en modules et les **règles de frontière** (barrel files + `no-restricted-imports` + test de frontière) qui seront réellement mises en place.
- L'événement interne `RoutineCompleted` et le couplage `routines → notifications` par message sont le design cible du cœur produit (compléter une routine).
- La **clé d'idempotence** sur le module `sync` est une exigence réelle du mobile offline (React Native + MMKV, batch au retour réseau) : sans elle, les séries seraient corrompues au premier tunnel.

**Commit cible :**
```
docs(architecture): ADR-08 — monolithe modulaire, frontières de modules, idempotence sync
```
