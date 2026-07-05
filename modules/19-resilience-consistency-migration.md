---
titre: Résilience, cohérence et migration
cours: 13-architecture
notions: ["théorème CAP (C/A/P)", "PACELC", "cohérence forte (linéarisable)", "cohérence éventuelle", "cohérence causale et de session", "timeout (budget décroissant)", "retry (backoff exponentiel + jitter)", "circuit breaker (closed/open/half-open)", "bulkhead (cloisonnement)", "chaos engineering et game day", "disaster recovery (RPO/RTO)", "idempotence des consommateurs", "exactly-once (mythe) vs exactly-once semantics", "résolution de conflit (LWW/merge)", "strangler fig", "anti-corruption layer", "shadow traffic (dark launch)"]
outcomes:
  - "sait énoncer CAP/PACELC et choisir cohérence forte vs éventuelle pour un flux donné en justifiant le compromis"
  - "sait dimensionner un appel réseau résilient : budget de timeout décroissant, retry avec backoff + jitter, circuit breaker, bulkhead"
  - "sait rendre un consommateur idempotent et expliquer pourquoi exactly-once delivery est un mythe (at-least-once + idempotence)"
  - "sait définir un RPO et un RTO et relier chaos engineering / game day à la découverte des faiblesses"
  - "sait planifier une migration incrémentale en strangler fig (proxy, bascule feature par feature, shadow traffic, anti-corruption layer) plutôt qu'un big bang"
prerequis: ["Modules 00-04 — posture, SOLID, patterns, clean code, DI", "Module 08 — monolithe modulaire vs microservices", "Module 12 — jobs, concurrence, async", "Module 13 — architecture des données", "Module 16 — communication et intégration", "Module 17 — event-driven et messaging", "Module 18 — patterns distribués (CQRS, ES, saga)"]
next: 20-securite-architecturale
libs: []
tribuzen: "flux de synchronisation offline-first de TribuZen (mobile → API) et export vers Google Calendar : résilience des appels, modèle de cohérence des routines, migration du legacy de notifications"
last-reviewed: 2026-07
---

# Résilience, cohérence et migration

> **Outcomes — tu sauras FAIRE :** énoncer CAP/PACELC et trancher cohérence forte vs éventuelle ; dimensionner un appel réseau résilient (timeout décroissant, retry + jitter, circuit breaker, bulkhead) ; rendre un consommateur idempotent et démonter le mythe de l'exactly-once ; définir RPO/RTO et relier chaos engineering aux faiblesses ; planifier une migration en strangler fig plutôt qu'un big bang.
> **Difficulté :** :star::star::star:
>
> **Portée :** ce module raisonne **au niveau architecture** sur trois questions liées : *que se passe-t-il quand une partie du système tombe ou ralentit* (résilience), *quelle fraîcheur de donnée je garantis* (cohérence), et *comment je remplace un morceau vivant sans tout casser* (migration). On **survole** la théorie distribuée (CAP, PACELC, consensus, horloges logiques) juste ce qu'il faut pour décider — le **deep** des systèmes distribués (Raft, Lamport, quorums, CRDT) est le **cours 17 dédié** : on y renvoie, on ne le duplique pas. Les **patterns distribués applicatifs** (CQRS, event sourcing, saga) sont le **module 18** ; l'implémentation concrète des jobs/retries/workers, le **module 12**. Ici : les décisions, pas le code d'infrastructure.

## 1. Cas concret d'abord

TribuZen est **offline-first**. Une famille en randonnée coche les routines des enfants sans réseau ; l'app mobile (React Native, stockage local MMKV) accumule les complétions et les **pousse en batch** au retour du réseau. En parallèle, quand un parent publie une sortie, TribuZen l'**exporte vers Google Calendar** (API externe, lente, parfois indisponible).

Un contributeur a livré le service de synchronisation. Voici le cœur de la poussée batch :

```ts
// sync.service.ts — AVANT (naïf, fragile)
async function pushCompletions(batch: Completion[]): Promise<void> {
  for (const c of batch) {
    // 1. Aucun timeout : si l'API pend, le mobile attend indéfiniment
    await api.post('/completions', c);
    // 2. Aucun retry : la moindre coupure réseau perd la complétion
    // 3. Rejoué au prochain sync ? -> l'API recrée un doublon (pas idempotent)
  }
  // 4. Un export Calendar qui échoue fait tout planter, y compris les routines
  await api.post('/calendar/export', { items: batch });
}
```

Ce code « marche » sur un wifi de bureau. En vrai, pose-toi cinq questions :

1. **L'API met 40 s à répondre** (surchargée). Le mobile reste bloqué, l'utilisateur croit l'app plantée. Où est le **timeout** ?
2. **Le réseau coupe à la 3ᵉ complétion sur 10.** Les 7 restantes sont perdues. Où est le **retry** ?
3. **Le sync rejoue le batch** (l'utilisateur relance l'app). L'API recrée les mêmes complétions → **doublons de séries**. Où est l'**idempotence** ?
4. **Google Calendar est down 20 minutes.** Actuellement, ça fait échouer *toute* la synchro des routines — alors que l'export est secondaire. Où est le **cloisonnement** (bulkhead) ?
5. **Deux téléphones de la famille cochent la même routine hors ligne.** Au retour, qui gagne ? Quel **modèle de cohérence** ?

Aucune de ces questions n'est un bug de code : ce sont des **décisions d'architecture** absentes. Ce module te donne le vocabulaire et les patterns pour les prendre.

---

## 2. Théorie complète, concise

### 2.1 CAP et PACELC — le compromis de fond (survol)

Dès qu'une donnée vit sur **plusieurs nœuds** (l'app mobile + le serveur en sont déjà deux), tu tombes sur le **théorème CAP** (Brewer) : en cas de **partition réseau** (P) — coupure entre deux nœuds —, tu ne peux garantir que **l'un** des deux :

- **Cohérence** (C) : tout read renvoie la dernière écriture.
- **Disponibilité** (A) : tout nœud répond, même isolé.

La partition, tu ne la *choisis* pas — tu la **subis** (le mobile hors réseau *est* une partition permanente). Le vrai choix : quand la partition survient, tu sacrifies **C** (refuser d'agir) ou **A** (agir localement, réconcilier plus tard). TribuZen offline-first choisit **A** : l'app coche même sans réseau (AP), puis converge.

**PACELC** (Abadi) complète : *s'il y a Partition → A ou C ; sinon (Else) → Latence ou Consistency*. La plupart du temps il n'y a **pas** de partition, et le choix quotidien est **latence vs cohérence** à chaque requête.

> **Défère :** la preuve de CAP, PACELC en détail, le consensus (Raft), les horloges logiques (Lamport), les quorums et les CRDT sont le **cours 17 (systèmes distribués)**. Ici tu retiens juste : *une partition force un choix C-ou-A ; offline-first = AP + convergence*.

### 2.2 Les modèles de cohérence, du plus fort au plus faible

« Cohérent » n'est pas binaire. Ce que tu garantis à l'utilisateur :

| Modèle | Garantie | Coût | Cas TribuZen |
|--------|----------|------|--------------|
| **Forte** (linéarisable) | tout read voit la dernière écriture, partout | latence élevée (quorum) | rien de vital ici — réservé au critique (solde, stock) |
| **Causale** | si A cause B, tout le monde voit A avant B | moyen | fil de commentaires d'une sortie |
| **Session** | *read-your-own-writes* : dans ma session, je revois mes écritures | bas | le parent revoit **sa** complétion juste cochée |
| **Éventuelle** | les répliques convergent… un jour (ms→s) | très bas | compteur de série affiché aux autres membres |

**Règle de choix :** demande *« que se passe-t-il si l'utilisateur voit une donnée périmée d'une seconde ? »*. Si la réponse est « rien de grave » → **éventuelle** (moins cher, plus dispo). Si c'est « il prend une mauvaise décision irréversible » → **forte**. TribuZen : cohérence **de session** pour l'utilisateur qui coche (il doit revoir son action), **éventuelle** pour ce que voient les autres membres.

### 2.3 Résilience #1 — le budget de timeout décroissant

Sans timeout, une lenteur se **propage en cascade** : le mobile attend le BFF, qui attend l'API, qui attend la base. Un maillon lent gèle toute la chaîne.

La règle : un **budget de temps** qui **décroît** à chaque saut, jamais l'inverse.

```
Mobile (budget 10s) → BFF (8s) → API (5s) → Calendar externe (2s)
Si Calendar dépasse 2s → l'API échoue en 2s → le BFF en 2s → le mobile voit l'erreur en ~3s
```

Un timeout **plus grand** en aval qu'en amont est un bug : l'amont abandonne alors que l'aval travaille encore (travail perdu + ressources gaspillées).

### 2.4 Résilience #2 — retry avec backoff exponentiel + jitter

Une erreur **transitoire** (réseau qui hoquette, 503 momentané) mérite un retry. Mais retenter *immédiatement et tous en même temps* aggrave la panne (**thundering herd**).

- **Backoff exponentiel** : attendre 1 s, 2 s, 4 s, 8 s… (espacer de plus en plus).
- **Jitter** : ajouter un aléa (±50 %) pour que 1000 clients ne retentent pas à la **même** milliseconde.
- **Seulement sur l'idempotent** : ne retente **jamais** en aveugle une opération non idempotente (§2.7), tu créerais des doublons.
- **Plafond + nombre max** : caper le délai (30 s) et abandonner après N essais → sinon retry infini.

### 2.5 Résilience #3 — circuit breaker

Retenter un service **déjà mort** est du gaspillage qui l'achève. Le **circuit breaker** (disjoncteur) coupe court :

```
   succès          échecs > seuil            timer expiré
 ┌────────┐  ───────────────────▶  ┌────────┐  ─────────▶  ┌───────────┐
 │ CLOSED │                        │  OPEN  │              │ HALF-OPEN │
 │ (OK)   │  ◀───────────────────  │ (fail  │  ◀─────────  │  (test)   │
 └────────┘   succès en half-open  │  fast) │   échec test └───────────┘
```

- **Closed** : tout passe, on compte les échecs.
- **Open** : au-delà du seuil, on **échoue immédiatement** (fail fast) sans appeler — le service blessé respire.
- **Half-open** : après un délai, on laisse passer *quelques* requêtes de test. Succès → **closed** ; échec → **open**.

Le breaker transforme une panne lente (timeouts en série) en **échec rapide et lisible**, et permet un **mode dégradé** (ex. « export Calendar mis en attente » plutôt que blocage).

### 2.6 Résilience #4 — bulkhead (cloisonnement)

Nom tiré des **cloisons étanches** d'un navire : une brèche n'inonde qu'un compartiment. En archi : **isoler les ressources** (pools de connexions, threads, files) par dépendance, pour qu'une dépendance lente n'assèche pas les autres.

Dans le §1, l'export Calendar partage tout avec la synchro des routines : Calendar down → routines bloquées. Avec un bulkhead, l'export a **sa propre file** et **son propre budget** ; il peut saturer sans toucher le chemin critique des complétions. Circuit breaker + bulkhead se combinent : le breaker coupe la dépendance morte, le bulkhead confine ce qui déborde encore.

### 2.7 Cohérence #2 — idempotence et le mythe de l'exactly-once

Dès qu'il y a retry ou rejeu (§2.4), le **même message arrive plusieurs fois**. Un consommateur **idempotent** produit le **même effet** qu'on le traite une ou dix fois.

```ts
// Consommateur idempotent : la clé métier protège du doublon
async function handleCompletion(c: Completion): Promise<void> {
  // clé naturelle : (routineId, childId, day) unique -> INSERT ... ON CONFLICT DO NOTHING
  await repo.upsertCompletion(c); // rejouer 10x = 1 seule ligne
}
```

Le **mythe** : croire qu'un broker peut garantir *exactly-once delivery*. C'est **impossible** en distribué (théorème des deux généraux → cours 17). Ce qui existe :

```
at-most-once  : peut perdre le message (pas de retry)
at-least-once : livré ≥ 1 fois (retry -> doublons possibles)   ← ce que garantit le transport
exactly-once  : livré exactement une fois   ← IMPOSSIBLE au niveau transport
```

La recette réelle : **at-least-once delivery + traitement idempotent = exactly-once *semantics*** (le résultat *observable* est comme si c'était une fois). Le transport rejoue ; le consommateur dédoublonne (clé métier, table `processed_events`, ou `upsert`).

### 2.8 Cohérence #3 — résolution de conflit

Deux écritures concurrentes hors ligne (les deux téléphones du §1) → **conflit** au retour. Stratégies :

| Stratégie | Idée | Quand |
|-----------|------|-------|
| **Last-Write-Wins (LWW)** | le timestamp le plus récent gagne | donnée remplaçable (préférence, statut) |
| **Merge** | fusionner les deux | collections (union des complétions du jour) |
| **Application-level** | l'utilisateur tranche | contenu éditable, cas ambigu |

Pour TribuZen, deux complétions de la **même** routine le même jour ne sont **pas** un vrai conflit : la clé `(routineId, childId, day)` les **déduplique** (merge naturel via idempotence). LWW ne servirait que pour un champ *modifiable* (ex. le nom d'une routine édité sur deux appareils).

> **Défère :** distributed locking, leader election, Lamport timestamps, CRDT (résolution automatique de l'éditeur collaboratif) = **cours 17**. Ici tu nommes la stratégie, tu ne l'implémentes pas.

### 2.9 Chaos engineering et disaster recovery

Tu ne **sais pas** que ton système est résilient tant que tu n'as pas **cassé** exprès.

- **Chaos engineering** : injecter des pannes **contrôlées** (tuer un pod, +200 ms de latence, couper la base) et vérifier que le système reste dans ses **SLO**. On formule une **hypothèse** (« si Calendar tombe, les routines continuent »), on injecte, on **observe**, on corrige.
- **Game day** : exercice **planifié** où l'équipe simule une panne majeure en *staging* et mesure la réaction (temps de détection, bascule, recovery).

Pour l'**après-catastrophe** (Disaster Recovery), deux métriques dimensionnent tout :

| Métrique | Définition | Dimensionne |
|----------|------------|-------------|
| **RPO** (Recovery Point Objective) | perte de donnée **maximale** tolérée | la **fréquence des backups** |
| **RTO** (Recovery Time Objective) | temps **maximal** de retour en service | l'**infra de failover** |

Ex TribuZen : RPO 1 h (on tolère de reperdre 1 h de complétions serveur — le mobile les a de toute façon en local et re-sync) ; RTO 4 h (l'API doit repartir en 4 h). Ces deux chiffres sont une **décision produit**, pas une constante technique.

### 2.10 Migration — strangler fig plutôt que big bang

Remplacer un composant **vivant** (le module de notifications legacy de TribuZen, disons) sans tout arrêter. Le **big bang** (tout réécrire, basculer d'un coup) échoue presque toujours : specs incomplètes, edge cases découverts trop tard, risque concentré en un instant.

Le **strangler fig** (figuier étrangleur) enveloppe le legacy et le remplace **feature par feature** :

```
Phase 1        Clients → [Proxy] → Legacy (100%)
Phase 2        Clients → [Proxy] ─┬→ Legacy (features restantes)
                                  └→ Nouveau (features migrées)
Phase 3        Clients → [Proxy] → Nouveau (100%)   -> legacy décommissionné
```

Outils clés :

- **Proxy / façade** en entrée : route chaque requête vers *legacy* ou *nouveau* selon une table de bascule (feature flag).
- **Anti-corruption layer (ACL)** : une couche de traduction entre nouveau et legacy, pour que le **modèle propre** du nouveau ne soit **pas contaminé** par les concepts pourris de l'ancien.
- **Shadow traffic (dark launch)** : envoyer la requête aux **deux** systèmes, servir la réponse du legacy, **comparer** celle du nouveau en arrière-plan. Quand les réponses convergent → bascule en confiance.
- **Bascule réversible** : chaque feature migrée derrière un flag qu'on peut **rabattre** en une commande si régression.

La migration incrémentale est plus **lente** mais **infiniment plus sûre** : le risque est étalé, chaque pas est réversible.

---

## 3. Worked examples

### Exemple 1 — Blinder le `pushCompletions` du §1

On reprend le service naïf et on applique les quatre patterns de résilience + l'idempotence, **au niveau conception** (le code d'infra détaillé = module 12).

```ts
// sync.service.ts — APRÈS (décisions de résilience explicites)
async function pushCompletions(batch: Completion[]): Promise<SyncResult> {
  // Chaque complétion porte une clé d'idempotence stable, calculée AVANT l'envoi.
  // (routineId, childId, day) -> l'API fait un upsert, rejeu = pas de doublon (§2.7)
  const idempotent = batch.map(withIdempotencyKey);

  // Chemin CRITIQUE (routines) : timeout décroissant + retry + circuit breaker
  await routinesBreaker.execute(() =>
    retry(
      () => api.post('/completions/batch', idempotent, { timeoutMs: 5000 }),
      { attempts: 4, backoff: 'exponential', jitter: true, cap: 30_000 },
    ),
  );

  // Chemin SECONDAIRE (Calendar) : bulkhead -> file séparée, N'IMPACTE PAS les routines.
  // Si le breaker Calendar est ouvert, on met en attente au lieu de bloquer (mode dégradé).
  calendarBulkhead.enqueue(() =>
    calendarBreaker.execute(() =>
      retry(() => api.post('/calendar/export', { items: batch }, { timeoutMs: 2000 }),
            { attempts: 3, backoff: 'exponential', jitter: true }),
    ),
  );

  return { pushed: idempotent.length };
}
```

**Ce que chaque décision achète :**
- **Idempotence d'abord** : sans elle, retry et rejeu créent des doublons de séries. C'est le socle qui *autorise* les retries.
- **Timeout 5 s (routines) / 2 s (Calendar)** : budget décroissant, l'utilisateur voit une erreur en ~3 s au lieu de 40 s.
- **Retry + jitter** sur les erreurs transitoires ; **pas** de retry infini (cap + 4 essais).
- **Circuit breaker** par dépendance : Calendar mort → fail fast + mise en attente, pas de timeouts en série.
- **Bulkhead** : l'export vit sur sa propre file. Calendar down 20 min → les routines continuent de se synchroniser. Le §1 question 4 est résolu **par isolation**, pas par un `try/catch`.

### Exemple 2 — Choisir le modèle de cohérence de trois données TribuZen

On te donne trois données. Pour chacune : *que coûte une lecture périmée ?* → modèle.

```
(a) "Ma complétion que je viens de cocher"      -> vue par MOI, sur mon écran
(b) "Le compteur de série affiché aux parents"  -> vu par les AUTRES membres
(c) "Le rôle admin d'un membre (peut supprimer)"-> contrôle une action destructrice
```

Analyse :

- **(a)** Si je coche et que l'écran ne me remontre **pas** mon action, l'app paraît cassée. Coût d'une lecture périmée = **confiance utilisateur**. → **cohérence de session** (read-your-own-writes) : je revois toujours **mes** écritures, même si les autres nœuds ne les ont pas encore.
- **(b)** Si un autre parent voit « 6 » au lieu de « 7 » pendant 2 secondes, personne ne prend de mauvaise décision. Coût ≈ nul. → **cohérence éventuelle** : convergence, latence basse, dispo maximale.
- **(c)** Si un ex-admin garde le droit de supprimer pendant que la révocation se propage, il peut détruire des données **irréversiblement**. Coût = **grave**. → **cohérence forte** (linéarisable) sur le check de droit : on paie le quorum, la sécurité prime.

Verdict : **un même produit mélange trois modèles.** « Cohérent » n'est pas un réglage global — c'est un choix **par donnée**, piloté par le coût du périmé.

---

## 4. Pièges & misconceptions

### PIÈGE #1 — « CAP dit qu'on choisit 2 propriétés sur 3 »

Formulation trompeuse. La **partition (P)** n'est pas une option qu'on *choisit* : sur un réseau réel (et *a fortiori* en offline-first), elle **arrive**. Le seul vrai choix est **C ou A pendant une partition**. Dire « je fais du CA » n'a de sens que pour un système **non distribué** (un seul nœud). Dès qu'il y a deux nœuds, c'est CP **ou** AP.

### PIÈGE #2 — « Je veux de la cohérence forte partout, c'est plus sûr »

La cohérence forte coûte de la **latence** et de la **disponibilité** (il faut un quorum joignable). L'imposer sur un compteur de likes ou une série, c'est payer cher une garantie inutile — et **casser l'offline-first** (impossible de cocher sans quorum). Le bon réflexe : *cohérence forte seulement là où le périmé cause un dégât irréversible*, éventuelle ailleurs.

### PIÈGE #3 — Retenter une opération non idempotente

Le retry est un **multiplicateur**. Sur une opération idempotente (`upsert` par clé métier), rejouer = sans effet. Sur une opération qui **crée** aveuglément (`INSERT` d'une complétion sans clé), chaque retry ajoute un doublon → séries faussées. **L'idempotence est un prérequis du retry**, pas un bonus. Rends idempotent *d'abord*, retente *ensuite*.

### PIÈGE #4 — « Le broker garantit exactly-once, je n'ai rien à faire »

Non. Le transport garantit au mieux **at-least-once**. L'exactly-once *delivery* est mathématiquement impossible (deux généraux). Ce que tu obtiens, c'est l'exactly-once **semantics** = at-least-once **+ idempotence côté consommateur**. Si tu comptes sur le broker pour dédoublonner, tu auras des doublons en prod le jour d'un retry.

### PIÈGE #5 — Timeout plus grand en aval qu'en amont

Si le mobile a un timeout de 10 s mais laisse l'API travailler 30 s, l'API produit un résultat que **personne n'attend plus** (le mobile a déjà abandonné) : ressources gaspillées, effets de bord orphelins. Le budget de timeout doit **décroître** à chaque saut vers l'aval, jamais croître.

### PIÈGE #6 — Confondre RPO et RTO

**RPO** = *combien de données* je peux reperdre (dimensionne la **fréquence des backups**). **RTO** = *combien de temps* d'indispo je tolère (dimensionne le **failover**). Un RPO de 0 (aucune perte) et un RTO de 0 (aucune coupure) coûtent une fortune ; on les fixe **par criticité de donnée**, pas au maximum par défaut.

### PIÈGE #7 — Le big bang « ce sera plus propre de tout réécrire »

La réécriture totale semble séduisante (« on repart sur du sain »). En pratique le legacy contient des **années de règles métier non documentées** ; le big bang les redécouvre en production, tout en même temps, sans filet. Le **strangler fig** migre feature par feature, chaque pas **réversible** et **validé par shadow traffic**. Plus lent, radicalement plus sûr.

### PIÈGE #8 — Migrer sans anti-corruption layer

Brancher le nouveau système **directement** sur les concepts du legacy laisse les **mauvais modèles** (noms pourris, statuts incohérents) contaminer le code neuf. L'**ACL** traduit à la frontière : le nouveau garde son modèle propre, le legacy reste isolé derrière une couche jetable qu'on supprimera à la fin de la migration.

---

## 5. Ancrage TribuZen

Ce module cristallise trois décisions d'archi réelles de TribuZen.

**1. Résilience du flux de synchronisation offline-first.**
Le chemin mobile → API des complétions est **critique** : timeout décroissant (mobile 10 s → BFF 8 s → API 5 s), retry avec backoff + jitter, circuit breaker par dépendance. L'export **Google Calendar** est **secondaire** : isolé dans un **bulkhead** (file + budget propres) avec son propre breaker, pour qu'une panne Calendar **ne bloque jamais** la synchro des routines. Les complétions portent une **clé d'idempotence** `(routineId, childId, day)` → le rejeu au prochain sync ne crée **pas** de doublon (at-least-once + idempotence = exactly-once semantics).

**2. Modèle de cohérence par donnée.**
- Complétion que **je** viens de cocher → **cohérence de session** (je la revois toujours).
- Série et feed vus par les **autres** membres → **cohérence éventuelle** (convergence, dispo max, compatible offline).
- Révocation d'un **rôle admin** (peut supprimer une famille) → **cohérence forte** sur le check de droit.
- Conflit de deux appareils sur la même complétion → **non-conflit** : la clé métier déduplique (merge naturel). LWW réservé aux champs *éditables* (nom d'une routine).

**3. Migration du module de notifications.**
TribuZen a un premier module de notifications « maison » à remplacer par un service propre. On applique le **strangler fig** : un **proxy** route `/notifications/*` vers *legacy* ou *nouveau* selon un feature flag ; un **anti-corruption layer** traduit les vieux types de payload ; on active le **shadow traffic** (envoi aux deux, comparaison en arrière-plan) avant chaque bascule ; chaque type de notification migré est **réversible** en une commande. Jamais de big bang.

> **Défère :** la théorie distribuée sous-jacente (CAP prouvé, PACELC, consensus, Lamport, CRDT) → **cours 17**. Les patterns applicatifs (saga pour un processus long à compensation, CQRS, event sourcing) → **module 18**. Le code concret des workers/retries/DLQ → **module 12**. La config du broker → **cours 12**. Ici on **décide** le niveau de résilience, le modèle de cohérence et le plan de migration.

---

## 6. Points clés

1. **CAP** : une partition force un choix **C ou A** ; on ne choisit pas P, on la subit. Offline-first = **AP + convergence**. **PACELC** : hors partition, choix latence vs cohérence à chaque requête. (Deep → cours 17.)
2. **La cohérence n'est pas globale** : forte / causale / session / éventuelle se choisissent **par donnée**, selon le coût d'une lecture périmée.
3. **Timeout décroissant** : budget qui baisse à chaque saut aval — jamais l'inverse — pour éviter la cascade de lenteur.
4. **Retry** = backoff exponentiel **+ jitter**, plafonné, **uniquement** sur de l'idempotent ; sinon thundering herd et doublons.
5. **Circuit breaker** (closed/open/half-open) : transforme une panne lente en échec rapide et autorise un mode dégradé.
6. **Bulkhead** : cloisonner les ressources par dépendance ; une dépendance morte (Calendar) n'assèche pas le chemin critique (routines).
7. **Idempotence** = socle : **at-least-once delivery + consommateur idempotent = exactly-once *semantics*** ; l'exactly-once *delivery* est un mythe.
8. **Conflit** : LWW (remplaçable), merge (collections), dialogue (critique) ; souvent une clé métier suffit à dédoublonner.
9. **Chaos engineering / game day** : casser exprès pour découvrir les faiblesses avant la prod ; **RPO** (perte tolérée) et **RTO** (indispo tolérée) dimensionnent backups et failover.
10. **Migration** : **strangler fig** (proxy + bascule feature par feature + shadow traffic + ACL, réversible) plutôt que big bang.

---

## 7. Seeds Anki

```
Que force réellement le théorème CAP ?|En cas de partition réseau (subie, pas choisie), on ne peut garantir que Cohérence OU Disponibilité — pas les deux. Le vrai choix est C-ou-A pendant une partition ; offline-first choisit A (AP) puis converge.
Quels sont les 4 modèles de cohérence du plus fort au plus faible, et le critère de choix ?|Forte (linéarisable) > causale > session (read-your-own-writes) > éventuelle. Critère : coût d'une lecture périmée. Rien de grave -> éventuelle (dispo, latence basse) ; dégât irréversible -> forte.
Pourquoi un budget de timeout doit-il décroître vers l'aval ?|Un timeout plus grand en aval qu'en amont laisse le service produire un résultat que personne n'attend plus (l'amont a abandonné) : travail et ressources gaspillés, effets de bord orphelins. Le budget baisse à chaque saut pour couper la cascade de lenteur.
Que faut-il ajouter à un retry pour ne pas aggraver la panne, et sur quoi seulement retenter ?|Backoff exponentiel + jitter (aléa) pour éviter le thundering herd, un plafond et un nombre max d'essais. Et uniquement sur des opérations idempotentes, sinon chaque retry crée un doublon.
Quels sont les 3 états d'un circuit breaker et ce qu'il apporte ?|Closed (tout passe, on compte les échecs), Open (fail fast sans appeler, le service blessé respire), Half-open (quelques requêtes de test : succès -> closed, échec -> open). Il transforme une panne lente en échec rapide et autorise un mode dégradé.
Qu'est-ce que le bulkhead pattern ?|Cloisonner les ressources (pools, files, budgets) par dépendance, comme les compartiments étanches d'un navire, pour qu'une dépendance lente ou morte n'assèche pas les autres. Ex : l'export Calendar isolé n'impacte pas la synchro des routines.
Pourquoi l'exactly-once delivery est-il un mythe, et comment obtient-on l'effet équivalent ?|Il est impossible en distribué (théorème des deux généraux). Le transport garantit au mieux at-least-once. On obtient l'exactly-once semantics avec at-least-once delivery + consommateur idempotent (clé métier, upsert, table processed_events).
Différence entre RPO et RTO ?|RPO (Recovery Point Objective) = perte de donnée maximale tolérée, dimensionne la fréquence des backups. RTO (Recovery Time Objective) = temps maximal d'indisponibilité toléré, dimensionne l'infra de failover. Les deux se fixent par criticité, pas au max par défaut.
Qu'est-ce que le strangler fig et pourquoi le préférer au big bang ?|Migrer un système vivant feature par feature derrière un proxy (bascule par feature flag), avec anti-corruption layer et shadow traffic, chaque pas réversible. Le big bang (tout réécrire d'un coup) redécouvre les règles non documentées en prod, sans filet : plus lent mais radicalement plus sûr.
À quoi sert un anti-corruption layer (ACL) dans une migration ?|C'est une couche de traduction à la frontière entre le nouveau système et le legacy, pour que les mauvais modèles/concepts de l'ancien ne contaminent pas le code neuf. Jetable : on la supprime à la fin de la migration.
```

---

## Pont vers le lab

> Lab associé : `labs/lab-19-resilience-consistency-migration/README.md`. Concevoir la résilience d'un flux TribuZen (timeouts décroissants, retry+jitter, circuit breaker, bulkhead), choisir le modèle de cohérence de chaque donnée, et planifier une migration en strangler fig. Exercice de conception + décision, évalué par grille + coach — zéro harnais.
