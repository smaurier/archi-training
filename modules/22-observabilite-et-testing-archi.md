---
titre: Observabilité et testabilité au niveau architecture
cours: 13-architecture
notions: ["les 3 piliers logs/metrics/traces", "log structuré vs texte libre", "correlation ID (traceId)", "métriques RED et USE", "SLI vs SLO vs SLA", "error budget", "corrélation des 3 signaux", "observabilité by design", "pyramide de tests", "honeycomb (test des frontières)", "contract testing (consumer-driven)", "tester les frontières vs tester le détail", "testabilité comme propriété d'architecture"]
outcomes:
  - "sait concevoir un système observable : décider quels logs structurés, quelles métriques et quelles traces émettre, et pourquoi"
  - "sait définir un SLI, un SLO et l'error budget associé pour un flux métier, et distinguer les trois"
  - "sait expliquer comment un correlation ID corrèle les 3 piliers pour reconstituer un incident"
  - "sait choisir une forme de pyramide de tests (classique vs honeycomb) selon la nature d'un composant"
  - "sait décider où placer un contract test entre deux services et distinguer tester une frontière de tester un détail"
  - "sait diagnostiquer une architecture non observable / non testable et nommer la cause"
prerequis: ["Module 05 — architecture en couches", "Module 06 — architecture hexagonale (ports & adapters)", "Module 08 — monolithe modulaire vs microservices", "Module 16 — communication et intégration", "Module 17 — event-driven et messaging", "Module 21 — performance et scalabilité (SLO/latence)"]
next: 23-decisions-culture-et-capstone
libs: []
tribuzen: "observabilité et stratégie de test du flux « compléter une routine » de TribuZen — des logs structurés côté API jusqu'au contract test entre l'app mobile et le backend"
last-reviewed: 2026-07
---

# Observabilité et testabilité au niveau architecture

> **Outcomes — tu sauras FAIRE :** concevoir un système observable (logs/metrics/traces choisis à dessein), définir SLI/SLO/error budget d'un flux, expliquer la corrélation par `traceId`, choisir la forme de pyramide de tests d'un composant, placer un contract test sur une frontière, et diagnostiquer une archi ni observable ni testable.
> **Difficulté :** :star::star::star:
>
> **Portée :** ce module traite l'observabilité et la testabilité **comme des propriétés d'architecture** — des choix de conception, pas des outils. On décide **quoi** observer, **où** poser une frontière de test, et **pourquoi**. L'**implémentation** concrète (installer OpenTelemetry, écrire un logger, configurer Prometheus/Grafana, brancher Pact, coder des tests Vitest/Playwright) est **déférée** : l'observabilité opérationnelle et le SRE sont le **cours 16**, l'écriture des tests le **cours 06**. Les SLO côté latence/perf ont été introduits au **module 21** ; ici on les relie à l'observabilité. Ici : tu **conçois** un système qu'on peut comprendre en prod et vérifier avant la prod — tu n'écris pas le code d'instrumentation.

## 1. Cas concret d'abord

3h47 du matin. TribuZen est en incident : des familles signalent que « compléter une routine » échoue par intermittence. Le flux traverse trois briques : l'**app mobile** (React Native) appelle l'**API NestJS**, qui écrit en base et publie un événement `routine.completed` consommé par le **service de notifications** (qui prévient le co-référent).

Tu ouvres les logs de production. Voici ce que le contributeur avait laissé :

```ts
// Ce qu'on trouve dans les logs cette nuit-là
console.log('routine completed');
console.log('error');
console.log('ok');
// ... 40 000 lignes identiques, aucun ordre, aucun contexte
```

Impossible d'avancer. Pose-toi les questions qui font mal :

1. **Quelle** routine, **quelle** famille, **quel** enfant a échoué ? Le log ne le dit pas. Tu ne peux ni filtrer ni compter.
2. **Où** ça casse — dans l'API, dans la base, dans le service de notifications ? Les trois briques loguent séparément, **rien ne les relie**. Tu ne peux pas suivre **une** requête de bout en bout.
3. **Combien** de familles sont touchées, depuis **quand**, et est-ce que ça **dépasse le seuil** qu'on s'était fixé ? Personne n'a défini de seuil. On découvre l'incident par un tweet, pas par une alerte.
4. Et la question d'avant l'incident : ce changement qui a cassé la frontière app↔API, **pourquoi aucun test ne l'a attrapé** avant le déploiement ?

Aucune de ces questions n'est un problème d'outil. Ce sont des **décisions d'architecture** qui n'ont pas été prises : quoi loguer, quoi mesurer, quoi corréler, où poser les frontières de test. Un système n'est pas observable ou testable par accident — ça se **conçoit**. C'est l'objet de ce module.

---

## 2. Théorie complète, concise

### 2.1 Observabilité ≠ monitoring

Le **monitoring** répond à des questions **connues d'avance** : « le CPU dépasse-t-il 80 % ? » (tu as posé la sonde parce que tu savais quoi surveiller). L'**observabilité** est la propriété qui te permet de répondre à des questions **que tu ne t'étais pas posées** — comprendre un état interne *inédit* du système depuis l'extérieur, sans redéployer. Un incident nouveau (« pourquoi CETTE famille, sur CE type de routine, à CETTE heure ? ») exige de l'observabilité, pas juste des jauges.

L'observabilité est un **attribut de qualité** de l'architecture (au même titre que la scalabilité ou la sécurité) : elle se décide à la conception, pas après coup.

### 2.2 Les 3 piliers : logs, metrics, traces

Trois signaux complémentaires. Chacun répond à une question différente :

| Pilier | Répond à… | Granularité | Coût |
|--------|-----------|-------------|------|
| **Metrics** | « Combien ? Ça va globalement ? » — tendances agrégées | Numérique, agrégé | Faible (léger, rétention longue) |
| **Traces** | « Où, dans le parcours d'UNE requête, est le problème ? » | Une requête de bout en bout | Moyen (souvent échantillonné) |
| **Logs** | « Qu'est-ce qui s'est passé exactement à cet instant ? » | Un événement précis | Élevé (volumineux, rétention courte) |

La règle mentale : **metrics pour détecter, traces pour localiser, logs pour comprendre**. On part de l'alerte (metric), on descend dans la trace pour trouver l'étape fautive, on lit les logs de cette étape pour la cause exacte. Concevoir l'observabilité, c'est décider ce que chaque pilier doit contenir **avant** l'incident.

### 2.3 Log structuré, pas texte libre

Un log doit être **une donnée**, pas une phrase. `console.log('routine completed')` est illisible par une machine. La forme cible est un objet structuré (typiquement JSON) :

```
// Log structuré : filtrable, agrégeable, alertable
{
  "timestamp": "2026-07-05T03:47:12.004Z",
  "level": "error",
  "event": "routine.completion.failed",   // convention : entity.action
  "service": "tribuzen-api",
  "traceId": "9f2c-...-a1",                // corrèle les 3 piliers (2.5)
  "familyId": "fam_123",
  "routineId": "rtn_88",
  "childHash": "sha256(...)",              // PII-free : jamais le prénom en clair
  "reason": "db_timeout"
}
```

Ce qui rend un log structuré exploitable :
- **Un événement nommé** (`event: "routine.completion.failed"`) — convention `entity.action`, pas une phrase libre.
- **Du contexte métier** (`familyId`, `routineId`) — pour filtrer et compter (« combien d'échecs pour la famille X ? »).
- **PII-free** — jamais d'email, prénom, IP en clair (RGPD) : on hashe ou on pseudonymise. C'est une **contrainte d'architecture**, pas un détail (le module 20 traite la sécurité, mais le principe « pas de PII dans les logs » se décide ici).
- **Un `level`** discipliné : `error` = quelqu'un doit agir (le pager sonne) ; `warn` = anormal mais géré ; `info` = événement métier attendu ; `debug` = dev/staging seulement.

> **Défère :** *comment* implémenter le logger (intercepteur NestJS, middleware, transport stdout→collecteur) est le **cours 16**. Ici on décide **quel événement** émettre et **quel contexte** y mettre.

### 2.4 Métriques : les familles RED et USE

On ne mesure pas « tout ». Deux grilles guident **quelles** métriques choisir :

- **RED** (orienté requêtes/services) : **R**ate (débit — req/s), **E**rrors (taux d'erreur), **D**uration (latence, en percentiles p50/p95/p99). C'est la grille pour un endpoint comme « compléter une routine ».
- **USE** (orienté ressources) : **U**tilization, **S**aturation, **E**rrors — pour une ressource (CPU, pool de connexions, file de messages).

Retiens : pour un **flux métier**, pense RED. Et **mesure des percentiles, pas la moyenne** : la moyenne cache les utilisateurs lents. Un p95 de 300 ms dit « 95 % des requêtes sont sous 300 ms » — bien plus actionnable qu'une moyenne trompeuse.

### 2.5 La corrélation : le `traceId` qui relie tout

C'est **le** point d'architecture qui manquait dans le §1. Un identifiant unique — le **correlation ID** / `traceId` — est généré au **point d'entrée** (l'app mobile ou l'API gateway) et **propagé** à travers **toutes** les briques : dans les headers HTTP entre services, dans les attributs du message d'événement, et injecté dans **chaque log** et **chaque span**.

```
Mobile ──[traceId: T1]──▶ API NestJS ──[traceId: T1]──▶ base
                              │
                              └──[event routine.completed, traceId: T1]──▶ Notifications

  Tous les logs T1  +  tous les spans T1  +  la trace T1  =  UNE requête reconstituée
```

Sans ce fil, les trois piliers sont trois silos. Avec lui, tu passes d'une metric en alerte → à la trace de la requête fautive → aux logs exacts de l'étape qui casse, **sans changer de contexte mental**. La corrélation est **le** choix de conception qui transforme trois signaux isolés en observabilité. Elle doit être décidée et imposée dès le départ (une brique qui « oublie » de propager le `traceId` brise la chaîne).

### 2.6 SLI, SLO, SLA, error budget

Observer ne suffit pas : il faut un **seuil** qui définit « acceptable ». Trois termes à ne jamais confondre :

- **SLI** (*Indicator*) — la **mesure** brute d'un aspect de la qualité de service. Ex : « proportion de complétions de routine réussies (non-5xx) sur le total ».
- **SLO** (*Objective*) — l'**objectif** qu'on se fixe sur ce SLI, en interne. Ex : « ≥ 99,5 % des complétions réussissent sur 30 jours ». C'est une **cible d'ingénierie**.
- **SLA** (*Agreement*) — un **contrat** commercial avec le client, avec pénalités. Souvent plus lâche que le SLO (on se garde une marge). TribuZen en beta n'a pas de SLA ; il a quand même des SLO internes.

L'**error budget** est le complément du SLO : `100 % − SLO`. Un SLO de 99,5 % sur 30 jours autorise 0,5 % d'échecs — soit ~3,6 h d'indisponibilité budgétée par mois. Ce budget est un **outil de décision** : tant qu'il reste du budget, on livre des features ; s'il est **épuisé**, on **gèle les features** et on répare la fiabilité. Le SLO transforme « c'est lent parfois » en une **décision chiffrée**.

> **Rappel module 21 :** les SLO de **latence** (p95 ≤ X ms) ont été posés côté perf. Ici on généralise : un SLO peut porter sur la disponibilité, le taux d'erreur, la fraîcheur d'une donnée. Le mécanisme (SLI → objectif → error budget) est identique.

### 2.7 Observabilité *by design*

Conséquence de tout ce qui précède : l'observabilité est une **contrainte de conception**, pas une couche qu'on ajoute à la fin. Concrètement, à la conception d'un flux, tu décides :

1. Quels **événements métier** méritent un log structuré (les points de décision et d'échec), avec quel contexte.
2. Quelles **métriques RED** exposer sur ce flux, et quel **SLO** on vise.
3. Où le **`traceId`** entre et comment il se **propage** (frontières HTTP, messages d'événements).

Un système qu'on ne peut pas comprendre en prod est un défaut d'architecture — comme un système non testable.

### 2.8 La testabilité est aussi une propriété d'architecture

Bascule vers l'autre moitié du module. Un système **testable** est un système dont l'architecture rend les vérifications **faciles, rapides et fiables**. La testabilité ne vient pas des tests : elle vient de la **structure** (couplage faible, dépendances inversées, frontières explicites — modules 05-06). Un domaine qui dépend de `HttpException` ou d'un ORM concret n'est pas testable en isolation, quel que soit le framework de test.

La question d'architecture n'est pas « comment j'écris ce test » (cours 06) mais **« qu'est-ce qui vaut la peine d'être testé, et à quelle frontière ? »**.

### 2.9 La pyramide de tests — et quand l'inverser

La **pyramide** classe les tests par coût/vitesse/stabilité :

```
        ╱╲
       ╱E2E╲      peu — lents, fragiles, chers — parcours critiques seulement
      ╱──────╲
     ╱ Intégr.╲   moyen — API + base + adaptateurs réels
    ╱──────────╲
   ╱   Unit     ╲  beaucoup — rapides, stables — logique métier pure
  ╱──────────────╲
```

Règle par défaut : **beaucoup d'unit** (la logique du domaine, testable sans I/O grâce à l'hexagonale), **de l'intégration** aux frontières, **peu d'E2E** (uniquement les parcours vitaux). Un test n'est utile que s'il teste **quelque chose qui peut casser** : tester des getters/setters gonfle la couverture sans rien protéger.

Mais la forme n'est pas universelle. Le **honeycomb** (nid d'abeille, Spotify) **inverse** la logique pour un composant **mince** — un adaptateur qui fait surtout de l'I/O et peu de logique pure. Là, un test unitaire qui *mocke tout* ne teste **rien d'utile** ; le gros de la valeur est dans les tests d'**intégration** qui vérifient la vraie frontière. Le choix de la forme est un **choix d'architecture** : il dépend de *où vit la complexité* du composant (logique pure → pyramide ; orchestration/I/O → honeycomb).

### 2.10 Tester les frontières : le contract testing

Dans un système à plusieurs briques (app mobile ↔ API ↔ service notifications), le risque n°1 est le **breaking change de frontière** : l'API renomme un champ `name → title`, le mobile casse en prod, et aucun test unitaire des deux côtés ne l'avait vu — chacun testait son propre côté.

Le **contract testing** (souvent *consumer-driven*) vérifie la **forme** de l'échange à la frontière :

- Le **consumer** (le mobile) déclare ce qu'il attend : « la réponse contient `{ streak: number }` ».
- Ce contrat est partagé.
- Le **provider** (l'API) vérifie **en CI** que sa vraie réponse **respecte** le contrat. Le rename casse la vérification **avant** le merge.

Distinction clé, à l'échelle archi :

| | Contract test | Test d'intégration | Test E2E |
|---|---|---|---|
| **Vérifie** | la **forme** d'une frontière (schéma) | le **comportement** d'un côté avec ses vraies deps | un **parcours** à travers tout |
| **Périmètre** | inter-service | un service + sa base/adaptateurs | de bout en bout |
| **Coût / fragilité** | faible | moyen | élevé |

Le contract testing brille quand des **équipes/briques séparées** évoluent indépendamment (mobile ≠ backend, API publique, microservices). Il est **superflu** pour un monolithe full-stack à un seul consommateur (le churn du contrat coûte plus qu'il ne rapporte). **Décider où poser un contrat** — et où ne PAS en poser — est la vraie compétence d'architecture ici.

> **Défère :** l'écriture concrète des tests (Vitest, Pact, Playwright, MSW, axe-core) est le **cours 06**. Ici on décide la **stratégie** : quelle forme de pyramide, quelles frontières sous contrat, quoi ne pas tester.

### 2.11 Le lien entre les deux moitiés

Observabilité et testabilité sont les **deux faces** de « je maîtrise mon système » : la testabilité te donne confiance **avant** la prod (les frontières tiennent), l'observabilité te donne la vérité **en** prod (ce qui se passe réellement). Les deux se **conçoivent aux mêmes endroits** — aux frontières entre briques : c'est là qu'on pose un `traceId`, un SLO, un contract test. Un flux bien architecturé est observable ET testable aux mêmes coutures.

---

## 3. Worked examples

### Exemple 1 — Concevoir l'observabilité du flux « compléter une routine »

On reprend l'incident du §1 et on **conçoit** (pas on code) ce qui aurait dû exister.

**Étape A — les événements loggés (structurés).** On identifie les points de décision et d'échec du flux, et on décide un log par point :

```
event: "routine.completion.received"   (info) — { traceId, familyId, routineId, childHash }
event: "routine.completion.rejected"   (warn) — { traceId, familyId, routineId, reason: "archived" }
event: "routine.completion.persisted"  (info) — { traceId, familyId, routineId }
event: "routine.completion.failed"     (error)— { traceId, familyId, routineId, reason: "db_timeout" }
event: "notification.dispatch.failed"  (error)— { traceId, familyId, reason: "smtp_unavailable" }
```

Chaque log porte le **même `traceId`** que la requête d'origine. On ne logue **jamais** le prénom de l'enfant en clair (`childHash`).

**Étape B — les métriques RED du flux.** On expose :
- **Rate** : complétions/minute.
- **Errors** : taux de `routine.completion.failed` / total.
- **Duration** : histogramme de latence du endpoint (p95, p99).

**Étape C — le SLO et l'error budget.**
- **SLI** : `1 − (complétions échouées / complétions totales)`.
- **SLO** : ≥ 99,5 % de succès sur 30 jours glissants.
- **Error budget** : 0,5 % ≈ 3,6 h/mois. Une alerte se déclenche quand le **rythme de consommation** du budget est trop rapide (burn-rate) — pas à la première erreur isolée.

**Étape D — la corrélation.** Le `traceId` est généré par l'app mobile, envoyé en header à l'API (`traceparent`), attaché à l'événement `routine.completed` publié vers le service de notifications. Résultat : à 3h47, on part de l'alerte « error rate > SLO » → on ouvre la **trace** d'une requête fautive → on voit le span `db.write` en timeout → on lit le log `routine.completion.failed` avec `reason: db_timeout` et le `familyId`. **Diagnostic en 3 sauts**, plus 40 000 `console.log`.

> On a **conçu** un système observable en décidant *quoi* émettre et *quoi* corréler. L'implémentation (logger, exporteur OTel, dashboards) = cours 16.

### Exemple 2 — Stratégie de test du même flux : formes et frontières

On décide la **stratégie de test architecturale** du flux (on ne code aucun test).

**Composant par composant, quelle forme ?**

| Brique | Nature | Forme choisie | Pourquoi |
|--------|--------|---------------|----------|
| Entité `Routine` (règle « archivée non complétable », calcul de streak) | Logique métier **pure** | **Unit** massif (pyramide) | Aucune I/O, testable en isolation grâce à l'hexagonale — beaucoup de cas, rapides |
| `PrismaRoutineRepository` (adaptateur base) | I/O, **peu** de logique | **Intégration** dominante (honeycomb) | Un unit qui mocke Prisma ne teste rien ; la valeur est de vérifier la vraie requête |
| Endpoint `POST /routines/:id/complete` | Frontière HTTP entrante | **Intégration** (API + base réelle) | Vérifie le câblage couches + codes HTTP |
| Parcours mobile → API → notif | Parcours **critique** | **E2E** — 1 scénario | Le chemin vital ; coûteux, on en met peu |

**Où poser un contrat ?** La frontière **app mobile ↔ API** est tenue par deux briques qui évoluent séparément (l'app est publiée sur les stores, l'API se déploie plusieurs fois par semaine). → **Contract test consumer-driven** : le mobile déclare qu'il attend `{ ok: boolean, streak: number }` ; l'API vérifie ce contrat en CI. Le jour où quelqu'un renomme `streak → currentStreak` côté API, la CI casse **avant** le déploiement — exactement le bug de frontière du §1.

**Où NE PAS poser de contrat ?** Entre l'API et son **propre** repository Prisma : c'est **une seule** brique, une seule équipe, testée en intégration. Un contract test ici serait de la cérémonie inutile.

> Verdict : la forme de la pyramide **varie par composant** (pure → pyramide, I/O → honeycomb) et le contract test se place **uniquement** sur la frontière entre briques indépendantes. C'est un raisonnement d'architecture, pas un choix d'outil.

---

## 4. Pièges & misconceptions

### PIÈGE #1 — « On a des logs, donc c'est observable »

Faux. 40 000 `console.log('ok')` ne sont **pas** de l'observabilité : ni filtrables, ni corrélés, ni actionnables. L'observabilité exige des logs **structurés**, des **métriques**, des **traces**, et surtout un **`traceId` qui les corrèle**. Le critère : *puis-je répondre à une question que je ne m'étais pas posée, sans redéployer ?* Si non, tu as des logs, pas de l'observabilité.

### PIÈGE #2 — Confondre monitoring et observabilité

Le monitoring surveille des questions **connues** (« CPU > 80 % ? »). L'observabilité permet d'explorer des questions **inconnues** (« pourquoi CETTE famille, sur CE type de routine ? »). Le monitoring est un sous-ensemble. Un dashboard plein de jauges ne rend pas un système observable si tu ne peux pas suivre une requête individuelle de bout en bout.

### PIÈGE #3 — Confondre SLI, SLO et SLA

- **SLI** = la mesure (« % de succès »).
- **SLO** = l'objectif interne sur cette mesure (« ≥ 99,5 % »).
- **SLA** = le contrat commercial avec pénalités (souvent plus lâche que le SLO).
Dire « notre SLA est de 300 ms » quand tu parles d'un objectif interne sans contrat client est une erreur de vocabulaire qui trahit une incompréhension. Et un SLO **sans error budget** n'est qu'un vœu : le budget est ce qui rend la cible **actionnable**.

### PIÈGE #4 — Viser 100 % de couverture de tests

La couverture n'est pas un but. 100 % de couverture teste les getters/setters et donne un **faux sentiment de sécurité** tout en coûtant cher à maintenir. Le bon objectif : **couvrir ce qui peut casser** — la logique métier (viser haut), les frontières (contract/intégration). Un test qui ne peut jamais échouer utilement est un test à supprimer.

### PIÈGE #5 — Appliquer la pyramide partout aveuglément

La pyramide (beaucoup d'unit) est le **défaut**, pas une loi. Pour un adaptateur **mince** (surtout de l'I/O, peu de logique), un unit qui mocke tout ne teste rien — le **honeycomb** (plus d'intégration) est adapté. La forme se choisit selon **où vit la complexité** du composant. Inversement, mettre surtout de l'E2E « pour être sûr » donne une suite lente et fragile qui décourage de tester.

### PIÈGE #6 — Contract test = test d'intégration

Non. Un **contract test** vérifie la **forme** d'une frontière (le schéma de l'échange) — rapide, sans les deux services réellement branchés ensemble. Un **test d'intégration** vérifie le **comportement** d'un côté avec ses vraies dépendances. Le contrat attrape les *breaking changes de schéma* entre briques indépendantes ; l'intégration attrape les *bugs de comportement*. Les deux sont utiles, à des endroits différents.

### PIÈGE #7 — Poser des contrats partout

Le contract testing a un coût (maintenance du contrat, churn). Il ne se justifie qu'entre **briques/équipes indépendantes** (mobile ≠ backend, API publique, microservices). Dans un **monolithe full-stack** à un seul consommateur, c'est de la cérémonie : les tests d'intégration suffisent. Poser un contrat entre une classe et sa dépendance interne est un anti-pattern.

### PIÈGE #8 — Traiter observabilité et testabilité comme des « à-côtés »

Ce sont des **attributs de qualité** de l'architecture, au même niveau que la scalabilité. Un système non observable ou non testable est **mal architecturé**, même s'il marche. Les deux se **conçoivent aux frontières**, dès le départ — pas ajoutés « quand on aura le temps ».

---

## 5. Ancrage TribuZen

Le flux **« compléter une routine »** — cœur quotidien de TribuZen — traverse trois briques indépendantes : app mobile React Native, API NestJS, service de notifications (event-driven, cf. module 17). C'est le terrain idéal parce qu'il a **plusieurs frontières** et un **enjeu de fiabilité** (si une complétion échoue silencieusement, l'enfant perd sa série, la confiance dans le produit s'effrite).

**Décisions d'observabilité pour TribuZen :**
- **`traceId` généré par l'app mobile**, propagé en header à l'API puis attaché à l'événement `routine.completed` vers les notifications. Une complétion = une trace unique, du tap de l'enfant à la notif du co-référent.
- **Logs structurés PII-free** : jamais le prénom de l'enfant en clair (`childHash`), contrainte RGPD **et** de l'engagement « vie privée famille » de la spec (Level 1 device-only). Ce que TribuZen chiffre sur l'appareil ne doit **jamais** fuiter dans un log serveur.
- **SLO produit** : ≥ 99,5 % de complétions réussies sur 30 jours. En **beta**, pas de SLA client, mais l'error budget guide la décision « on livre la nouvelle feature de badges ou on stabilise ? ».

**Décisions de testabilité pour TribuZen :**
- **Contract test app↔API** sur la réponse de complétion (`{ ok, streak }`) : l'app mobile est publiée sur les stores (cycle lent), l'API se déploie souvent (cycle rapide). Le contrat empêche un déploiement API de casser une version d'app déjà installée.
- **Pyramide pour le domaine `Routine`** (règle « archivée non complétable », calcul de streak) : logique pure, isolée par l'hexagonale (module 06) → unit tests massifs.
- **Honeycomb pour l'adaptateur de sync offline** : la file de complétions rejouées au retour réseau est surtout de l'I/O et de la coordination → l'essentiel de la valeur est en tests d'intégration, pas en unit mockés.

> **Défère :** l'implémentation de tout ça — instrumenter NestJS avec OpenTelemetry, brancher Grafana/Loki/Tempo, écrire les tests Vitest/Pact — relève du **cours 16 (observabilité/SRE)** et du **cours 06 (tests)**. Ici, on a décidé **quoi** observer, **quel** SLO, **quelles** frontières sous contrat et **quelle** forme de pyramide par composant.

---

## 6. Points clés

1. **Observabilité ≠ monitoring** : le monitoring répond à des questions connues ; l'observabilité permet d'explorer l'inconnu sans redéployer. C'est un attribut de qualité de l'architecture.
2. **3 piliers** : metrics pour **détecter**, traces pour **localiser**, logs pour **comprendre**. Chacun a son coût et sa granularité.
3. **Log structuré, PII-free**, nommé (`entity.action`), avec contexte métier et `level` discipliné — jamais du texte libre.
4. **Métriques RED** (Rate/Errors/Duration en percentiles) pour un flux ; **USE** pour une ressource. Percentiles, pas moyenne.
5. **Le `traceId` corrèle les 3 piliers** : généré au point d'entrée, propagé partout. C'est LE choix qui transforme 3 silos en observabilité.
6. **SLI** (mesure) → **SLO** (objectif interne) → **SLA** (contrat client) ; **error budget = 100 % − SLO**, outil de décision « feature vs fiabilité ».
7. **Testabilité = propriété d'architecture** : elle vient de la structure (couplage faible, dépendances inversées), pas du framework de test.
8. **Forme de pyramide selon le composant** : logique pure → pyramide (unit massif) ; I/O mince → honeycomb (intégration dominante).
9. **Contract testing** = vérifier la **forme** d'une **frontière** entre briques indépendantes ; superflu pour un monolithe à un seul consommateur.
10. **Observabilité et testabilité se conçoivent aux mêmes frontières** — confiance avant la prod (tests) + vérité en prod (observabilité).

---

## 7. Seeds Anki

```
Quelle est la différence entre monitoring et observabilité ?|Le monitoring répond à des questions connues d'avance (seuils, jauges) ; l'observabilité permet de comprendre un état interne inédit du système depuis l'extérieur, sans redéployer — répondre à des questions qu'on ne s'était pas posées.
À quoi sert chacun des 3 piliers de l'observabilité ?|Metrics = détecter (tendances agrégées, « combien ? »). Traces = localiser (où, dans le parcours d'UNE requête, est le problème). Logs = comprendre (ce qui s'est passé exactement à un instant précis).
Qu'est-ce qui transforme 3 signaux isolés (logs/metrics/traces) en observabilité ?|Un correlation ID / traceId unique, généré au point d'entrée et propagé à travers toutes les briques (headers HTTP, attributs d'événements) puis injecté dans chaque log et chaque span. Il permet de reconstituer UNE requête de bout en bout.
Différence entre SLI, SLO et SLA ?|SLI = la mesure brute (ex : % de complétions réussies). SLO = l'objectif interne sur ce SLI (ex : ≥ 99,5 % sur 30j). SLA = le contrat commercial avec le client, avec pénalités, souvent plus lâche que le SLO.
Qu'est-ce qu'un error budget et à quoi sert-il ?|C'est 100 % − SLO (ex : SLO 99,5 % → 0,5 % ≈ 3,6 h/mois d'échecs budgétés). C'est un outil de décision : tant qu'il reste du budget on livre des features ; épuisé, on gèle les features et on répare la fiabilité.
Que mesurent les grilles RED et USE, et laquelle pour un flux métier ?|RED = Rate, Errors, Duration (percentiles) — pour un service/endpoint. USE = Utilization, Saturation, Errors — pour une ressource (CPU, pool, file). Pour un flux métier : RED.
Quand inverser la pyramide de tests en honeycomb ?|Pour un composant mince (surtout de l'I/O, peu de logique pure), où un unit test qui mocke tout ne teste rien d'utile. La valeur passe alors dans les tests d'intégration qui vérifient la vraie frontière. La forme dépend de où vit la complexité.
Qu'est-ce qu'un contract test et quelle frontière protège-t-il ?|Il vérifie la FORME d'un échange entre deux briques (schéma) : le consumer déclare ce qu'il attend, le provider vérifie en CI qu'il le respecte. Il attrape les breaking changes de frontière entre briques indépendantes (ex : mobile ↔ API) AVANT le merge.
Contract test vs test d'intégration : quelle différence ?|Le contract test vérifie la forme d'une frontière (schéma), rapide, sans les deux services réellement branchés. Le test d'intégration vérifie le comportement d'un côté avec ses vraies dépendances. Formes différentes, endroits différents.
Pourquoi viser 100 % de couverture de tests est un piège ?|Ça teste les getters/setters et donne un faux sentiment de sécurité, coûteux à maintenir. Le bon objectif : couvrir ce qui peut casser — logique métier (viser haut) et frontières (contract/intégration).
Pourquoi la testabilité est-elle une propriété d'architecture et non de test ?|Parce qu'elle vient de la structure (couplage faible, dépendances inversées, frontières explicites). Un domaine qui dépend d'un ORM concret ou de HttpException n'est pas testable en isolation, quel que soit le framework de test.
```

---

## Pont vers le lab

> Lab associé : `labs/lab-22-observabilite-et-testing-archi/README.md`. Concevoir l'observabilité d'un flux TribuZen (logs structurés + métriques RED + SLO/error budget + corrélation par `traceId`) **et** définir sa stratégie de test architecturale (forme de pyramide par composant + où poser un contract test). Exercice de conception, évalué par grille + coach — zéro harnais.
