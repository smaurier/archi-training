---
titre: Jobs, concurrence et asynchronisme
cours: 13-architecture
notions: ["travail synchrone vs asynchrone", "background job", "producteur / file / worker", "types de jobs (immédiat, différé, planifié, récurrent)", "retry et backoff (fixe, exponentiel, jitter)", "dead letter queue", "idempotence d'un job", "clé d'idempotence", "at-least-once vs exactly-once", "race condition", "verrou optimiste vs pessimiste", "verrou distribué", "backpressure", "isolation multi-tenant (survol)"]
outcomes:
  - "sait décider si une opération doit être synchrone ou déportée en background job, et justifier la frontière"
  - "sait dessiner l'anatomie producteur / file / worker et placer retry, backoff et dead letter queue"
  - "sait rendre un job idempotent avec une clé d'idempotence et raisonner at-least-once vs exactly-once"
  - "sait repérer une race condition et choisir entre verrou optimiste, pessimiste ou distribué selon le contexte"
  - "sait nommer l'enjeu d'isolation multi-tenant d'un système de jobs sans le confondre avec le messaging distribué"
prerequis: ["Module 00 — posture d'architecte", "Module 01 — SOLID (SRP)", "Module 04 — dependency injection", "Module 05 — architecture en couches", "Module 10 — DDD tactique (invariants, agrégats)", "Module 11 — API design et backend patterns (Unit of Work, erreurs structurées)"]
next: 13-architecture-donnees
libs: []
tribuzen: "backend NestJS de TribuZen — traitement asynchrone du module Routines : rappels programmés, génération du récap hebdomadaire, idempotence et retry des envois"
last-reviewed: 2026-07
---

# Jobs, concurrence et asynchronisme

> **Outcomes — tu sauras FAIRE :** décider sync vs background job, dessiner l'anatomie producteur/file/worker avec retry, backoff et dead letter queue, rendre un job idempotent, repérer une race condition et choisir la bonne stratégie de verrouillage, et nommer l'enjeu d'isolation multi-tenant.
> **Difficulté :** :star::star::star:
>
> **Portée :** ce module raisonne **archi du travail asynchrone** — *où* placer un job, *comment* garantir qu'il se rejoue sans dégât, *comment* protéger un état partagé de la concurrence. On décide et on dessine, on n'implémente pas. Les frontières fermes :
> - L'**implémentation BullMQ / NestJS** (`@nestjs/bullmq`, `Processor`, `WorkerHost`, config Redis) = **cours 09**. Ici, pas de code de framework lourd — on parle du *pattern* file/worker, pas de l'API.
> - Le **messaging distribué** (brokers, topics, event-driven, exactly-once inter-services, sagas) = **modules 16-17**. On distingue « job en arrière-plan dans **mon** service » de « message entre **plusieurs** services », et on **défère** le second.
> - Le **SQL fin des verrous** (`SELECT FOR UPDATE`, isolation levels PostgreSQL, `VersionColumn`) = **cours 10**. Ici on choisit *optimiste vs pessimiste*, on ne déroule pas la requête.
> - L'**isolation multi-tenant** n'est vue qu'en **survol** (pourquoi un job doit porter le tenant) ; la stratégie complète (schema-per-tenant, filtre SQL, prefix S3) relève de la sécurité archi (**module 20**) et du **cours 10**.

## 1. Cas concret d'abord

TribuZen doit envoyer, chaque soir à 19h, un **rappel** aux enfants dont la routine du jour n'est pas encore complétée (« Il te reste "Ranger ta chambre" à faire ! »). Un contributeur a livré ça dans le controller HTTP qui crée une routine :

```ts
// routines.controller.ts — AVANT (tout synchrone, tout dans la requête HTTP)
@Post()
async create(@Body() dto: CreateRoutineDto) {
  const routine = await this.repo.save(/* ... */);

  // On envoie tout de suite les rappels aux membres de la famille...
  const members = await this.repo.findFamilyMembers(routine.familyId);
  for (const member of members) {
    await this.mailer.send(member.email, buildReminder(routine)); // 500ms–2s chacun
    await this.push.notify(member.deviceToken, buildPush(routine)); // réseau externe
  }

  return routine; // Le client attend que TOUT soit parti avant d'avoir sa réponse
}
```

Ça marche… tant qu'une famille a deux membres et que le serveur mail répond. Pose-toi quatre questions :

1. **Combien de temps le client attend-il ?** La réponse HTTP est bloquée jusqu'à ce que tous les emails et push soient partis. Une famille de 6 membres = 6 × 2s = **12 secondes** de spinner pour créer une routine. L'utilisateur n'a **pas besoin** que le mail soit parti pour voir sa routine créée.
2. **Que se passe-t-il si le serveur mail est down** au moment du 3ᵉ membre ? La requête `create` **échoue** — alors que la routine, elle, a bien été créée. L'utilisateur voit une erreur pour une action qui a réussi.
3. **Le rappel de 19h**, lui, n'est même pas déclenché par une requête HTTP : c'est une tâche **planifiée**. Où vit-elle ? Il n'y a pas de « requête » pour la porter.
4. **Si on rejoue l'envoi** (l'utilisateur clique deux fois, ou le serveur redémarre en plein milieu), la famille reçoit **deux fois** le même rappel.

Ce controller confond « faire l'action » et « notifier ». La notification est un **travail de fond** (*background job*) : différable, faillible, à réessayer, et surtout **à ne pas exécuter deux fois**. Ce module te donne le vocabulaire et les patterns pour ranger ça — et pour gérer ce qui se passe quand plusieurs de ces jobs touchent le **même état** en même temps.

---

## 2. Théorie complète, concise

### 2.1 Synchrone vs asynchrone : la question de la frontière

Une opération est **synchrone** quand l'appelant a besoin de son résultat **pour continuer** : lire une routine, valider un mot de passe, calculer un total à afficher. Elle est **asynchrone / background** quand l'appelant **n'a pas besoin du résultat immédiatement** : envoyer un email, générer un PDF, redimensionner une image, indexer, notifier.

La règle de décision :

> **Si l'utilisateur n'a pas besoin du résultat dans la réponse en cours, c'est un background job.**

Critères concrets pour porter en background :

| Signal | Exemple TribuZen |
|--------|------------------|
| Long (> ~1s) | générer le récap PDF hebdomadaire d'une famille |
| Dépend d'un système externe faillible | envoyer un email / push (serveur tiers) |
| Différé dans le temps | rappel à 19h, relance à J+3 |
| Récurrent | nettoyer les tokens expirés chaque nuit |
| Pic de charge | 10 000 rappels du soir à envoyer d'un coup |

Porter en background **découple** la réussite de l'action (créer la routine) de la réussite de l'effet de bord (notifier). L'action répond vite ; la notification part « quand elle peut », avec ses propres réessais.

### 2.2 Anatomie d'un système de jobs : producteur / file / worker

Le pattern universel a trois rôles :

```
  ┌────────────┐   push job   ┌──────────────┐   pull job   ┌──────────────┐
  │ PRODUCTEUR │ ───────────▶ │     FILE      │ ───────────▶ │    WORKER     │
  │  (l'API)   │              │  (queue)     │              │  (consommateur)│
  └────────────┘              └──────┬───────┘              └──────┬────────┘
                                     │                             │
                          ┌──────────┴─────────┐          succès ? │
                          │  PLANIFICATEUR      │          oui → done
                          │  (cron : "19h")     │          non → retry ↺
                          └────────────────────┘                   │
                                                     max retries atteint
                                                                   ▼
                                                        ┌────────────────────┐
                                                        │ DEAD LETTER QUEUE   │
                                                        │ → alerte + humain   │
                                                        └────────────────────┘
```

- **Producteur** : place un *job* (une description de travail à faire + ses données) dans la file. Il ne fait **pas** le travail. Dans le §1, l'API produit un job « envoyer rappel » et **répond aussitôt**.
- **File (queue)** : stocke les jobs en attente, durablement (souvent Redis en pratique — détail cours 09). Elle absorbe les pics : 10 000 rappels entrent d'un coup, sortent au rythme des workers.
- **Worker (consommateur)** : un **processus séparé** qui tire les jobs et les exécute. On peut en lancer plusieurs pour paralléliser. Le worker ne partage pas le cycle de vie de la requête HTTP — il tourne en continu.
- **Planificateur (scheduler)** : injecte des jobs sur une base temporelle (cron). C'est lui qui porte le « rappel de 19h » qui n'a pas de requête HTTP d'origine (question 3 du §1).

Le point archi clé : **producteur et worker sont découplés par la file**. Le producteur peut planter, le worker peut redémarrer : le job survit dans la file.

### 2.3 Les types de jobs

| Type | Déclencheur | Exemple TribuZen |
|------|-------------|------------------|
| **Immédiat** | dès qu'un worker est libre | envoyer le mail de bienvenue à l'inscription |
| **Différé** (delayed) | après un délai | relance « routine pas complétée » 3h après |
| **Planifié** (scheduled) | à une date précise | notifier le lancement d'un défi familial le 1er du mois |
| **Récurrent** (recurring / cron) | périodiquement | rappel quotidien de 19h ; nettoyage nocturne |
| **Prioritaire** | passe devant | reset de mot de passe (l'utilisateur attend) devant un récap |

Un même système gère les cinq via des options (délai, cron, priorité). Le choix du type est une **décision d'archi**, pas de code.

### 2.4 Retry et backoff : réessayer sans aggraver

Un job échoue (serveur mail momentanément down). On **réessaie** — mais pas n'importe comment. Le **backoff** est la stratégie d'espacement des tentatives :

| Stratégie | Délais | Quand |
|-----------|--------|-------|
| **Fixe** | 5s, 5s, 5s | service qui redémarre vite, panne courte |
| **Exponentiel** | 1s, 2s, 4s, 8s | service externe temporairement saturé — on lui laisse le temps de récupérer |
| **Exponentiel + jitter** | 1s±, 2s±, 4s± | quand **beaucoup** de jobs retryent en même temps |

Le **jitter** (bruit aléatoire ajouté au délai) évite le **thundering herd** : si 10 000 rappels échouent à cause d'une coupure mail et retryent tous à `t+2s` **pile**, ils réachèvent le serveur mail au même instant. Le jitter les étale.

Après **N** tentatives, on arrête : le job part en **dead letter queue** (2.5). Le nombre de tentatives et la stratégie sont des **paramètres du job**, décidés selon la criticité.

### 2.5 Dead letter queue : ne jamais perdre un échec en silence

La **dead letter queue** (DLQ, « file des lettres mortes ») recueille les jobs qui ont **définitivement** échoué (N retries épuisés). Son rôle :

- **ne pas bloquer la file** : un job empoisonné (données corrompues qui échoueront *toujours*) ne doit pas retenir les 9 999 autres ;
- **rendre l'échec visible** : chaque entrée en DLQ = un bug potentiel **ou** un système externe en panne. On **alerte** (monitoring) et un humain investigue.

> **Règle :** une DLQ qui se remplit sans que personne ne la regarde = des erreurs silencieuses en production. La DLQ se **surveille**, sinon elle ne sert à rien.

### 2.6 Idempotence : le cœur du sujet

Un job peut s'exécuter **plusieurs fois** : retry après échec partiel, worker qui redémarre après avoir fait le travail mais avant d'avoir confirmé « done ». La plupart des files garantissent **at-least-once** (« au moins une fois »), pas **exactly-once**. Conséquence directe :

> **Un job DOIT être idempotent : l'exécuter 1 fois ou 5 fois produit le même état final.**

Un job **non idempotent** cause des doublons :

```ts
// NON idempotent — un retry = un second rappel envoyé à l'enfant
async sendReminder(job) {
  await this.push.notify(job.deviceToken, job.message); // rejoué => 2 notifications
}
```

Le correctif : une **clé d'idempotence** — un identifiant **stable et déterministe** de « ce travail précis ». On enregistre qu'on l'a fait, et on **court-circuite** si c'est déjà fait :

```ts
// Idempotent — la clé identifie CE rappel (ce membre, cette routine, ce jour)
async sendReminder(job) {
  const key = `reminder:${job.routineId}:${job.memberId}:${job.day}`;
  if (await this.sent.has(key)) return;          // déjà envoyé -> on skip
  await this.push.notify(job.deviceToken, job.message);
  await this.sent.mark(key);                      // on trace APRÈS l'effet
}
```

Deux nuances d'archi importantes :

- La clé doit être **déterministe** : `reminder:r1:m1:2026-07-05`, pas un `uuid()` tiré à chaque exécution (qui serait différent à chaque retry). La clé encode l'**intention**, pas l'exécution.
- L'ordre `agir puis marquer` laisse une fenêtre (crash entre les deux → renvoi). Pour un email/push, un doublon rare est tolérable. Pour un **paiement**, il faut lier le marquage à la transaction (Unit of Work, module 11) ou s'appuyer sur une contrainte d'unicité en base. **Exactly-once** de bout en bout n'existe pas gratuitement ; on l'**approche** avec at-least-once + idempotence.

### 2.7 Concurrence : quand plusieurs exécutions touchent le même état

Dès qu'on a **plusieurs workers** (ou plusieurs requêtes), deux exécutions peuvent lire et écrire le **même état** en même temps. C'est la **race condition** : le résultat dépend de l'ordre d'exécution et devient incohérent.

```
Worker A : LIT compteur_défi = 10
Worker B : LIT compteur_défi = 10      ← même valeur, aucun n'a vu l'autre
Worker A : ÉCRIT 10 + 1 = 11
Worker B : ÉCRIT 10 + 1 = 11           ← devrait être 12 ! une incrémentation perdue
```

Deux autres pathologies de concurrence à nommer :
- **Deadlock** : A tient la ressource 1 et attend la 2 ; B tient la 2 et attend la 1 → blocage mutuel infini.
- **Starvation** (famine) : une exécution n'obtient jamais son tour car d'autres passent toujours devant.

Les stratégies de protection (le **choix** est archi, la mécanique SQL est cours 10) :

| Stratégie | Principe | Quand |
|-----------|----------|-------|
| **Verrou optimiste** | « je suppose pas de conflit, je vérifie une **version** au moment d'écrire ; si elle a changé → conflit → je relis et rejoue » | 95% du web : conflits **rares** |
| **Verrou pessimiste** | « je **verrouille** la donnée avant de la lire, personne d'autre ne peut la toucher jusqu'à mon commit » | conflits **fréquents**, opération non rejouable, section critique courte |
| **Verrou distribué** | un verrou **partagé entre plusieurs machines** (ex. clé Redis avec TTL + token unique) | l'app tourne sur **plusieurs nœuds** et un verrou base ne suffit pas |

- **Optimiste** : pas de blocage, excellent en scalabilité, mais nécessite une **logique de retry** (relire + réessayer sur conflit). C'est le défaut raisonnable du web.
- **Pessimiste** : sûr mais sérialise les accès → goulot d'étranglement. Réservé aux cas critiques (stock, solde).
- **Distribué** : indispensable quand « un seul worker à la fois » doit être garanti **entre machines** (ex. « un seul import par famille à la fois »). Toujours avec un **TTL** (sinon un worker mort garde le verrou pour toujours) et un **token** (ne relâcher que **son** verrou).

### 2.8 Backpressure : ne pas se noyer soi-même

Traiter un lot en lançant **tout** en parallèle sature la mémoire et les connexions :

```ts
// MAUVAIS — 10 000 envois lancés d'un coup : mémoire et connexions explosent
await Promise.all(reminders.map(r => send(r)));
```

La **backpressure** (contre-pression) limite le débit à ce que le système **encaisse** : traiter par **lots** (batch de 50), ou plafonner le nombre de workers concurrents. C'est un réglage de **concurrence contrôlée** : la file protège l'**entrée** (elle absorbe le pic) ; la backpressure protège la **sortie** (le worker ne se surcharge pas).

### 2.9 Isolation multi-tenant (survol)

TribuZen sert **plusieurs familles** (tenants). Un job « générer le récap » ne doit **jamais** mélanger les données de deux familles. Enjeux à **nommer** ici :

- **Le job porte le tenant** : le contexte tenant (famille) voyage **dans les données du job**, il n'est pas implicite. Un worker anonyme qui traite un job doit savoir « pour quelle famille ».
- **Isolation de la charge** : une famille très active (« noisy neighbor ») ne doit pas affamer les jobs des autres (priorités, files séparées).

> **Défère :** la stratégie d'isolation complète (schema-per-tenant, `SET search_path`, filtre SQL automatique, prefix de stockage, défense en profondeur) relève de la **sécurité architecturale (module 20)** et de l'**architecture données (cours 10)**. Ici, retiens seulement : **un job asynchrone doit transporter son contexte tenant explicitement**, car il s'exécute hors de la requête qui connaissait le tenant.

---

## 3. Worked examples

### Exemple 1 — Refondre l'envoi de rappels du §1 en job idempotent

On reprend le controller obèse et on sépare **l'action** (créer la routine, synchrone) de **la notification** (background, faillible, idempotente).

**Étape 1 — le producteur : l'API répond vite, produit un job, n'attend rien.**

```ts
// routines.controller.ts — APRÈS (le controller ne notifie plus lui-même)
@Post()
async create(@Body() dto: CreateRoutineDto) {
  const routine = await this.repo.save(/* ... */);

  // On PRODUIT un job par membre — retour immédiat, l'envoi partira côté worker.
  // clé déterministe = (routine, membre, jour) : rejouer le job ne double pas l'envoi.
  for (const member of await this.repo.findFamilyMembers(routine.familyId)) {
    await this.reminders.enqueue({
      routineId: routine.id,
      memberId: member.id,
      day: today(),
      familyId: routine.familyId, // le tenant voyage DANS le job (§2.9)
    }, { attempts: 4, backoff: 'exponential-jitter' });
  }

  return routine; // réponse en ~50ms, plus de spinner de 12s
}
```

**Étape 2 — le worker : idempotent, avec garde de court-circuit.**

```ts
// reminder.worker.ts — exécuté par un processus séparé, potentiellement rejoué
async process(job: ReminderJob) {
  // Clé d'idempotence : encode l'INTENTION (ce rappel précis), pas l'exécution.
  const key = `reminder:${job.routineId}:${job.memberId}:${job.day}`;
  if (await this.sent.has(key)) return; // déjà parti (retry / redémarrage) -> skip

  // Règle métier : ne rappeler que si la routine n'est PAS déjà complétée aujourd'hui.
  if (await this.repo.isCompleted(job.routineId, job.memberId, job.day)) return;

  const member = await this.repo.findMember(job.memberId); // scopé famille = job.familyId
  await this.push.notify(member.deviceToken, buildReminder(job));
  await this.sent.mark(key); // on trace l'effet -> le prochain retry court-circuite
}
```

**Ce que le refactor achète :**
- La création de routine répond en ~50ms ; les envois partent en fond, avec **4 tentatives** et backoff+jitter en cas de panne mail.
- Un serveur mail down ne fait **plus** échouer la création de routine (question 2 du §1 réglée) — le job reste dans la file et retryera.
- Un double clic ou un redémarrage de worker ne produit **pas** de doublon (idempotence).
- Après 4 échecs, le job part en **DLQ** avec alerte : un humain voit « les push échouent pour la famille X » au lieu d'un silence.

### Exemple 2 — Choisir la stratégie de concurrence pour un compteur de défi

TribuZen a un « défi familial » : chaque routine complétée **incrémente** un compteur partagé par toute la famille. Deux enfants complètent leur routine **à la même seconde**. On veut compteur = 12, pas 11 (race condition du §2.7).

On raisonne le choix, on ne code pas le SQL :

- **Sans protection** → incrémentation perdue (lost update). Exclu.
- **Verrou pessimiste** (verrouiller la ligne du défi avant de lire/écrire) : correct, mais si toute une famille active complète en rafale, chaque écriture **attend** la précédente → sérialisation. Acceptable ici (une famille = peu de membres), lourd si le compteur était global.
- **Verrou optimiste** (champ `version` : on incrémente `WHERE version = lu` ; si 0 ligne modifiée → quelqu'un est passé avant → on relit et on réessaie) : conflits **rares** (deux complétions à la même seconde, c'est l'exception), donc la voie du web. Coût : prévoir le **retry** sur conflit.
- **Verrou distribué** : inutile ici — la base arbitre déjà. On le garderait pour « un seul job d'import par famille à la fois » (unicité **inter-workers**), pas pour un compteur.

**Décision :** verrou **optimiste** avec retry (max 3), car le conflit est rare et on veut la scalabilité. On documente la décision : « compteur de défi = optimistic lock + retry ; si un jour le compteur devient global très contendu, réévaluer vers pessimiste ». La **mécanique** (`VersionColumn`, `SELECT ... FOR UPDATE`, isolation level) est déroulée au **cours 10** — ici on a **choisi** et **justifié**.

---

## 4. Pièges & misconceptions

### PIÈGE #1 — « Async, c'est juste mettre `await` / `Promise.all` »

Non. `async/await` gère la **non-bloquance** d'une opération I/O **dans une requête**. Un **background job**, c'est autre chose : un travail **sorti** de la requête, porté par une file, exécuté par un **autre processus**, qui **survit** au redémarrage et **retryera**. `await mailer.send()` reste dans la requête (le §1 est 100% `await` et pourtant faux). Le critère : *le travail doit-il survivre à la fin de la requête et pouvoir être réessayé ?* → alors c'est un job, pas un `await`.

### PIÈGE #2 — Croire que la file garantit « exactly-once »

La plupart des files sont **at-least-once** : en cas de doute (crash entre l'exécution et l'accusé de réception), elles **rejouent**. Compter sur « ça ne s'exécutera qu'une fois » mène au double débit / double email. La bonne posture : **suppose que ton job sera rejoué**, et rends-le **idempotent**. Exactly-once « apparent » = at-least-once + idempotence, jamais une propriété magique de la file.

### PIÈGE #3 — Une clé d'idempotence non déterministe

Générer la clé avec `uuid()` **à l'intérieur** du job la rend différente à chaque exécution → le court-circuit ne se déclenche jamais → doublons quand même. La clé doit encoder l'**intention** de façon **stable** (`reminder:routine:membre:jour`, ou une clé fournie par le **producteur** au moment d'enfiler). Règle : *deux exécutions du même travail doivent produire la même clé.*

### PIÈGE #4 — Choisir le verrou pessimiste « pour être sûr »

Le pessimiste **sérialise** : chaque accès attend le précédent. Sur un état peu contendu (le cas courant du web), c'est un goulot d'étranglement gratuit qui plombe la scalabilité. Le défaut raisonnable est l'**optimiste** (conflits rares → on vérifie une version, on retry sur l'exception). Le pessimiste se **mérite** : conflits fréquents, opération non rejouable, section critique très courte. « Pour être sûr » n'est pas une justification.

### PIÈGE #5 — Oublier TTL et token sur un verrou distribué

Un verrou distribué **sans TTL** : le worker qui le tient meurt → le verrou n'est **jamais** relâché → tout le monde est bloqué pour toujours. Un verrou **sans token** : le worker B relâche par erreur le verrou **du** worker A (qui l'avait repris après expiration) → deux exécutions concurrentes. Toujours : **TTL** (le verrou s'auto-libère) **+ token unique** (on ne relâche que le sien, via une vérification atomique).

### PIÈGE #6 — Confondre « background job » et « message entre services »

Un **job** est du travail **différé dans mon propre service** (je produis, mes workers consomment, même base de code, même base de données). Un **message / événement distribué** relie **plusieurs services** indépendants via un broker (contrats, ordre, exactly-once inter-services, sagas). Les patterns se ressemblent (file, consommateur), mais les problèmes diffèrent radicalement. Ce module traite le **job intra-service** ; le messaging distribué est **modules 16-17**. Ne transpose pas aveuglément l'un vers l'autre.

### PIÈGE #7 — Un job qui « oublie » son tenant

Un job s'exécute **hors** de la requête HTTP qui connaissait la famille courante. Si le contexte tenant n'est **pas** mis explicitement dans les données du job, le worker n'a **aucun** moyen fiable de savoir pour quelle famille il travaille — risque de fuite entre tenants. Règle : le tenant **voyage dans le payload du job**, jamais via un état global implicite.

---

## 5. Ancrage TribuZen

Le backend NestJS de TribuZen a plusieurs traitements qui **n'ont rien à faire dans le cycle d'une requête HTTP**. Ce module décide **lesquels**, et **comment** les rendre robustes.

Cartographie des jobs TribuZen :

| Job | Type | Idempotence | Concurrence |
|-----|------|-------------|-------------|
| Rappel du soir (routine non complétée) | récurrent (cron 19h) + différé | clé `reminder:routine:membre:jour` | — |
| Envoi email/push d'invitation famille | immédiat | clé `invite:familyId:email` | — |
| Récap hebdomadaire (agrégat + PDF) | planifié (dimanche soir) | clé `recap:familyId:semaine` | lecture seule |
| Incrément du compteur de défi familial | déclenché par complétion | — | **optimistic lock + retry** |
| Nettoyage des tokens expirés | récurrent (nuit) | naturellement idempotent (DELETE WHERE expiré) | — |
| Sync offline des complétions (mobile en batch au retour réseau) | immédiat, par lot | clé par complétion | idempotence côté serveur |

Décisions d'archi concrètes :

- **La création de routine est synchrone ; la notification est un job.** On ne bloque jamais l'utilisateur sur un envoi (§1). Le service `CompleteRoutineService` (module 05) **produit** un job, il ne notifie pas lui-même.
- **Chaque job porte `familyId`** (le tenant) dans son payload. Un worker ne devine jamais la famille : elle est dans les données (§2.9, PIÈGE #7).
- **Le compteur de défi = verrou optimiste + retry.** Conflits rares (deux complétions simultanées dans une même famille), scalabilité privilégiée (worked example 2).
- **La sync offline s'appuie sur l'idempotence, pas sur l'ordre.** Le mobile (React Query + MMKV) pousse un **batch** de complétions au retour réseau ; certaines ont peut-être déjà été enregistrées → clé d'idempotence par complétion, le serveur **absorbe** les doublons sans erreur.
- **Une DLQ surveillée** pour les envois : si les push d'une famille échouent 4 fois (token invalide), on veut une **alerte**, pas un silence.

> **Défère :** la config BullMQ/Redis concrète, les décorateurs `@Processor`/`WorkerHost`, le branchement NestJS = **cours 09**. Le SQL des verrous et l'isolation level = **cours 10**. La stratégie multi-tenant complète = **module 20 / cours 10**. Le passage à une communication **inter-services** (broker, événements) = **modules 16-17**. Ici, on a décidé **quoi** rendre asynchrone, **comment** le rendre rejouable, et **comment** protéger l'état partagé.

---

## 6. Points clés

1. **Frontière sync/async :** si l'utilisateur n'a pas besoin du résultat dans la réponse en cours, c'est un **background job**. Porter en background découple la réussite de l'action de celle de l'effet de bord.
2. **Anatomie :** producteur (produit le job, répond vite) → file (absorbe le pic, durable) → worker (processus séparé, exécute, retry). Le planificateur injecte les jobs récurrents/planifiés.
3. **Retry + backoff :** réessayer avec un espacement croissant (exponentiel) et du **jitter** pour éviter le thundering herd. Après N échecs → **dead letter queue**.
4. **DLQ :** recueille les échecs définitifs, ne bloque pas la file, **doit être surveillée** (alerte + humain), sinon erreurs silencieuses.
5. **Idempotence = cœur du sujet :** les files sont **at-least-once** ; suppose le job rejoué. Une **clé d'idempotence déterministe** (l'intention, pas l'exécution) + court-circuit garantit un état final unique.
6. **Exactly-once n'existe pas gratuitement :** on l'approche par at-least-once + idempotence (+ transaction/unicité pour les cas critiques comme le paiement).
7. **Concurrence :** race condition = résultat dépendant de l'ordre. **Optimiste** (version + retry) par défaut sur le web ; **pessimiste** (verrou) pour conflits fréquents / opération non rejouable ; **distribué** (TTL + token) entre plusieurs machines.
8. **Backpressure :** limiter le débit (lots, workers plafonnés) pour ne pas se saturer soi-même. La file protège l'entrée, la backpressure protège la sortie.
9. **Multi-tenant (survol) :** un job **transporte son tenant** dans son payload, car il s'exécute hors de la requête qui le connaissait. Stratégie d'isolation complète déférée (module 20 / cours 10).
10. **Job ≠ message distribué :** job = travail différé **intra-service** ; messaging = **inter-services** (modules 16-17). Patterns proches, problèmes différents.

---

## 7. Seeds Anki

```
Quand une opération doit-elle devenir un background job ?|Quand l'utilisateur n'a pas besoin de son résultat dans la réponse en cours : long, faillible (système externe), différé, récurrent, ou pic de charge. On découple la réussite de l'action de celle de l'effet de bord.
Quels sont les trois rôles de l'anatomie d'un système de jobs ?|Producteur (place le job dans la file et répond vite), File/queue (stocke durablement, absorbe les pics), Worker (processus séparé qui tire et exécute, avec retry). + un planificateur pour les jobs récurrents/planifiés.
Qu'est-ce que le jitter et à quoi sert-il dans un backoff ?|Un bruit aléatoire ajouté au délai entre deux tentatives. Il évite le thundering herd : sans lui, tous les jobs qui ont échoué en même temps retryent au même instant et réachèvent le service. Le jitter les étale.
Qu'est-ce qu'une dead letter queue et pourquoi ne pas l'ignorer ?|La file où atterrissent les jobs définitivement échoués (N retries épuisés). Elle évite qu'un job empoisonné bloque la file. Chaque entrée = un bug ou un système externe en panne : on alerte et on investigue. Non surveillée = erreurs silencieuses en prod.
Pourquoi un job doit-il être idempotent ?|Parce que les files sont at-least-once : un job peut être rejoué (retry, redémarrage du worker). Sans idempotence, on obtient des doublons (double email, double débit). L'idempotence garantit le même état final qu'on l'exécute 1 ou N fois.
Qu'est-ce qu'une clé d'idempotence et quelle propriété doit-elle avoir ?|Un identifiant stable de « ce travail précis » qu'on enregistre pour court-circuiter les rejeux. Elle doit être déterministe : encoder l'intention (routine:membre:jour), pas l'exécution (pas un uuid() tiré à chaque run, qui serait différent à chaque retry).
Exactly-once existe-t-il gratuitement avec une file de jobs ?|Non. Les files garantissent at-least-once. On approche l'exactly-once avec at-least-once + idempotence (+ transaction ou contrainte d'unicité pour les cas critiques comme le paiement). Ce n'est jamais une propriété magique de la file.
Qu'est-ce qu'une race condition ?|Deux exécutions lisent et écrivent le même état en même temps ; le résultat dépend de l'ordre et devient incohérent (ex. deux incréments à partir de la même valeur lue = une incrémentation perdue / lost update).
Verrou optimiste vs pessimiste : lequel par défaut sur le web et pourquoi ?|Optimiste par défaut : conflits rares, on vérifie une version au moment d'écrire et on retry sur conflit — pas de blocage, scalable. Le pessimiste verrouille et sérialise les accès (goulot) : réservé aux conflits fréquents ou opérations non rejouables.
Que faut-il toujours ajouter à un verrou distribué et pourquoi ?|Un TTL (sinon un worker mort garde le verrou pour toujours) et un token unique vérifié atomiquement (pour ne relâcher que son propre verrou, jamais celui d'un autre worker qui l'a repris après expiration).
Pourquoi un background job doit-il transporter son tenant dans son payload ?|Parce qu'il s'exécute hors de la requête HTTP qui connaissait le tenant. Sans contexte tenant explicite dans les données du job, le worker ne peut pas savoir de façon fiable pour quelle famille il travaille — risque de fuite entre tenants.
Différence entre un background job et un message distribué ?|Un job = travail différé dans mon propre service (producteur + workers, même code, même base). Un message = communication entre plusieurs services via un broker (contrats, ordre, exactly-once inter-services, sagas). Patterns proches, problèmes différents (modules 16-17).
```

---

## Pont vers le lab

> Lab associé : `labs/lab-12-jobs-concurrence-async/README.md`. Concevoir le système de jobs d'une feature TribuZen : décider sync vs async, dessiner producteur/file/worker avec retry/backoff/DLQ, écrire les clés d'idempotence, et choisir la stratégie de concurrence pour un état partagé — avec justification. Exercice de conception, évalué par grille + coach — zéro harnais.
