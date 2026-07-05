---
titre: Architecture événementielle & messaging
cours: 13-architecture
notions: ["architecture événementielle (event-driven)", "message broker", "queue (point-à-point)", "topic / pub-sub", "fan-out", "événement vs commande", "choreography vs orchestration", "delivery guarantees (at-most-once / at-least-once / exactly-once)", "idempotence du consommateur", "dead letter queue", "API Gateway", "Backend-for-Frontend (BFF)"]
outcomes:
  - "sait décrire un flux event-driven (producteur, broker, consommateur) et dire ce qu'il découple"
  - "sait choisir entre une queue (point-à-point) et un topic (pub-sub) selon le besoin de fan-out"
  - "sait distinguer un événement (fait passé) d'une commande (intention) et nommer chacun correctement"
  - "sait opposer choreography et orchestration et énoncer le compromis de chacune"
  - "sait raisonner sur les garanties de livraison et rendre un consommateur idempotent"
  - "sait placer un API Gateway et un BFF dans une architecture et dire ce que chacun résout"
prerequis: ["Module 00 — posture d'architecte", "Module 05 — architecture en couches", "Module 08 — monolithe modulaire vs microservices", "Module 09/10 — DDD (bounded context, langage ubiquitaire)", "Module 12 — jobs, concurrence, async", "Module 16 — communication et intégration (sync vs async, REST/gRPC)"]
next: 18-patterns-distribues-cqrs-es-saga
libs: []
tribuzen: "backend TribuZen — bus d'événements interne : SortieCréée déclenche en fan-out notifications, feed familial et suggestions, sans coupler le module Sorties à ses consommateurs"
last-reviewed: 2026-07
---

# Architecture événementielle & messaging

> **Outcomes — tu sauras FAIRE :** décrire un flux event-driven et ce qu'il découple, choisir queue vs topic selon le fan-out, distinguer événement et commande, opposer choreography et orchestration, raisonner sur les garanties de livraison et rendre un consommateur idempotent, placer un API Gateway et un BFF.
> **Difficulté :** :star::star::star:
>
> **Portée :** ce module raisonne au niveau **architecture**. On pose le vocabulaire du messaging (broker, queue, topic, garanties de livraison) et deux patterns d'edge (API Gateway, BFF). On **ne** couvre **pas** ici : **CQRS, event sourcing et saga** — ce sont des patterns distribués bâtis PAR-DESSUS l'event-driven, traités au **module 18 (next)**. Le **détail d'implémentation** d'un broker managé (AWS SQS/SNS, config, IAM) relève du **cours 12** ; la mécanique des **jobs/workers** (BullMQ, backoff) du **module 12**. Ici on décide **quel message va où, avec quelle garantie**, pas comment on branche le SDK.

## 1. Cas concret d'abord

Tu reprends le backend de TribuZen. Un parent crée une **sortie** (« Parc de la Tête d'Or, samedi 14h »). Aujourd'hui, le service qui gère la création fait tout, à la chaîne, dans la même requête HTTP :

```ts
// sorties.service.ts — AVANT (tout couplé dans le handler de création)
async createSortie(input: CreateSortieInput): Promise<Sortie> {
  const sortie = await this.repo.save(Sortie.create(input));

  // Le service Sorties connaît — et attend — TOUS ses consommateurs :
  await this.notifications.pushToFamily(sortie.familyId, sortie);   // 1
  await this.feed.appendActivity(sortie.familyId, sortie);          // 2
  await this.suggestions.recomputeForFamily(sortie.familyId);       // 3
  await this.calendarSync.export(sortie);                           // 4 (appel réseau lent)

  return sortie;
}
```

Ça marche. Mais pose-toi les questions qui font mal :

1. **Qui décide de la liste des étapes ?** Le module Sorties. Il **importe** Notifications, Feed, Suggestions, CalendarSync. Ajouter demain « prévenir les grands-parents » = **rouvrir** ce fichier. Le module cœur grossit à chaque nouveau consommateur.
2. **Que se passe-t-il si `calendarSync.export` (appel réseau externe) est lent ou tombe ?** Le parent attend, et si ça throw, la création **entière** échoue alors que la sortie est déjà en base. Un détail secondaire fait planter l'action principale.
3. **Et si deux consommateurs pouvaient travailler en parallèle**, pendant que le parent reçoit déjà son `201 Created` ?

Le problème n'est pas le code : c'est le **couplage**. Sorties connaît par leur nom quatre modules qui n'ont rien à voir avec « créer une sortie ». On veut **inverser** ça : Sorties annonce un **fait** — « une sortie a été créée » — et se désintéresse de qui écoute. C'est l'**architecture événementielle**. Ce module te donne le vocabulaire (événement, broker, queue vs topic, garanties de livraison) pour la concevoir sans te tirer une balle dans le pied.

---

## 2. Théorie complète, concise

### 2.1 L'idée : communiquer par faits, pas par appels nommés

Dans un style **impératif classique**, A appelle B : A **sait** que B existe, connaît sa signature, et **attend** sa réponse. Couplage fort, dans le temps (A bloque) et dans l'espace (A cite B).

Dans le style **événementiel** (*event-driven*), A **publie un événement** — un fait passé, « SortieCréée » — sur un **intermédiaire** (le *message broker*). A ne sait pas qui consomme, ni combien de consommateurs il y a, ni même s'il y en a. Les consommateurs **s'abonnent** et réagissent à leur rythme.

```
IMPÉRATIF (couplé)              ÉVÉNEMENTIEL (découplé)

 Sorties ─▶ Notifications        Sorties ─▶[ SortieCréée ]─▶ broker
 Sorties ─▶ Feed                                              │ fan-out
 Sorties ─▶ Suggestions                          ┌────────────┼────────────┐
 Sorties ─▶ CalendarSync                         ▼            ▼            ▼
 (Sorties cite ses 4 cibles)              Notifications    Feed      Suggestions
                                          (Sorties ne les connaît pas)
```

Ce que ça **découple** :
- **Dans l'espace** : le producteur ne cite plus ses consommateurs. Ajouter un abonné ne touche pas le producteur.
- **Dans le temps** : le producteur n'attend pas les consommateurs (traitement asynchrone).
- **En panne** : si un consommateur est down, l'événement l'attend dans le broker ; le producteur, lui, a déjà rendu la main.

Le prix à payer (rien n'est gratuit) : **complexité opérationnelle** (un broker à opérer), **débogage plus dur** (le flux n'est plus une pile d'appels lisible), et **cohérence différée** (*eventual consistency* — le feed n'est pas à jour à la milliseconde où la sortie est créée). On y revient en §4.

### 2.2 Événement vs commande — deux messages, deux intentions

C'est **la** distinction à ne pas rater, car elle change qui décide.

| | **Événement** | **Commande** |
|---|---|---|
| Sémantique | un **fait passé**, immuable | une **intention**, une demande d'agir |
| Nom | participe passé : `SortieCréée`, `RoutineComplétée` | impératif : `EnvoyerNotification`, `ExporterCalendrier` |
| Destinataires | 0..N abonnés (le producteur ignore qui) | **1** destinataire connu et visé |
| Couplage | le producteur **ne sait pas** ce qui va se passer | l'émetteur **veut** que ça se passe |
| Peut être refusé ? | non — c'est déjà arrivé | oui — le destinataire peut rejeter |

Règle mentale : un **événement raconte**, une **commande ordonne**. `SortieCréée` (événement) est neutre : Notifications décide d'envoyer un push, ce n'est pas Sorties qui le lui ordonne. Si Sorties émettait `EnvoyerPushSortie` (commande), il redeviendrait couplé à l'existence d'un service de push. Préférer l'événement quand tu veux du découplage et du fan-out ; la commande quand un émetteur veut délibérément déclencher une action précise chez un destinataire précis.

### 2.3 Le broker : queue (point-à-point) vs topic (pub-sub)

Le **message broker** est l'intermédiaire qui reçoit, stocke et distribue les messages. Deux primitives de distribution, à ne surtout pas confondre :

**Queue — point-à-point.** Un message → **un seul** consommateur le traite. S'il y a plusieurs workers derrière la queue, ils se **répartissent** la charge (chaque message va à un seul d'entre eux). C'est le modèle du **travail à faire** : « envoyer cet email », un seul worker doit le faire, pas trois.

```
Producteur ─▶ [ QUEUE ]  msg1 msg2 msg3
                          │    │    │      chaque msg -> UN worker
                    ┌─────┘    │    └─────┐
                 workerA    workerB    workerA   (répartition de charge)
```

**Topic — publish/subscribe.** Un message → **tous** les abonnés en reçoivent **chacun une copie**. C'est le modèle du **fait à diffuser** : « SortieCréée », et Notifications, Feed et Suggestions veulent **tous** le savoir. C'est le **fan-out**.

```
Producteur ─▶ [ TOPIC "SortieCréée" ]
                    │ copie   │ copie   │ copie
                    ▼         ▼         ▼
              Notifications  Feed   Suggestions   (chacun reçoit tout)
```

> Beaucoup de systèmes réels combinent les deux : un **topic** diffuse l'événement en fan-out, et **derrière chaque abonné** il y a une **queue** propre (sa boîte aux lettres) pour lisser sa charge et retenter en cas d'échec. C'est le modèle « topic → queue par consommateur » (ex. SNS→SQS ; l'implémentation concrète = cours 12).

Choix : besoin qu'**un seul** traite → **queue**. Besoin que **plusieurs, indépendants** réagissent → **topic**. Le §1 (une sortie créée intéresse 3+ modules) appelle un **topic**.

### 2.4 Choreography vs orchestration — qui tient le fil ?

Quand un processus enchaîne plusieurs étapes (créer sortie → notifier → mettre à jour feed → suggérer), **qui coordonne** ?

**Choreography (chorégraphie) — pas de chef.** Chaque service réagit aux événements et en émet d'autres. Le flux **émerge** de la réaction en chaîne. Sorties émet `SortieCréée` ; Feed y réagit et émet `FeedMisÀJour` ; etc. Personne ne détient la vue d'ensemble.
- **+** découplage maximal, aucun point central, facile d'ajouter un abonné.
- **−** le flux global n'est écrit **nulle part** — il est « dans les têtes ». Débogage et compréhension du bout-en-bout difficiles ; risque de boucles d'événements.

**Orchestration — un chef d'orchestre.** Un composant dédié (l'*orchestrateur*) **connaît** la séquence et **commande** chaque étape : « fais ça, puis ça ». Souvent via des **commandes** (pas des événements).
- **+** le processus est **explicite** en un seul endroit, lisible, facile à modifier ou à compenser en cas d'échec.
- **−** l'orchestrateur (re)devient un point de couplage et un possible goulot ; il connaît tout le monde.

Règle : **choreography** pour des réactions simples, indépendantes, où le découplage prime (ex. le fan-out du §1). **Orchestration** pour un processus **métier long avec étapes ordonnées, conditions et compensations** (ex. un paiement en plusieurs phases). Le pattern **saga**, qui structure ces processus longs et leur compensation, est le **module 18** — on ne fait ici que planter le mot.

### 2.5 Garanties de livraison — le message arrive-t-il, et combien de fois ?

Un réseau perd des paquets, un consommateur crashe entre « traiter » et « accuser réception ». D'où trois garanties, à choisir **consciemment** :

- **At-most-once (au plus une fois)** : livré 0 ou 1 fois, **jamais de doublon**, mais **perte possible**. Acceptable pour un signal jetable (une métrique, un log best-effort).
- **At-least-once (au moins une fois)** : **jamais perdu**, mais **doublons possibles** (si l'accusé de réception se perd, le broker renvoie). **C'est le défaut de la quasi-totalité des brokers**, et le cas à gérer par défaut.
- **Exactly-once (exactement une fois)** : ni perte ni doublon. Idéal… mais **très coûteux et souvent illusoire** de bout en bout dans un système distribué. En pratique on l'**approxime** = at-least-once **+ idempotence** côté consommateur.

**Corollaire capital : conçois tes consommateurs pour être idempotents.** Un consommateur **idempotent** traite deux fois le **même** message avec le **même effet** qu'une fois. Recettes :
- porter un **identifiant de message** unique (`eventId`) et **stocker les IDs déjà traités** (table de déduplication) ; ignorer un ID déjà vu.
- écrire des opérations **naturellement idempotentes** : `SET statut = complété` (rejouable) plutôt que `incrémenter compteur` (double si rejoué).

Sans idempotence, at-least-once = un email envoyé deux fois, une notif en double. C'est l'erreur la plus fréquente des débutants en messaging.

**Dead Letter Queue (DLQ).** Un message qui échoue N fois (poison message) ne doit pas boucler à l'infini ni bloquer la queue. Après N tentatives, le broker le déplace dans une **dead letter queue** : une queue de côté, inspectée par un humain/une alerte. On isole le poison sans perdre l'information.

### 2.6 Deux patterns d'edge : API Gateway & BFF

Le messaging structure l'**intérieur** du système. Aux **frontières** (côté clients), deux patterns récurrents — souvent confondus, à séparer nettement.

**API Gateway — le point d'entrée unique.** Un composant d'**infrastructure** placé devant les services. Il centralise les préoccupations **transverses (cross-cutting)** : routing (`/sorties` → service Sorties), authentification/validation du token, **rate limiting**, cache de réponses, journalisation. **Un** gateway pour toute l'infra. **Zéro logique métier** — il aiguille et protège, il ne décide pas de règles.

**Backend-for-Frontend (BFF) — un backend par type de client.** Un backend **applicatif** dédié à **un** type de client (un BFF web, un BFF mobile). Il résout des problèmes **spécifiques au client** :
- **agrégation** : le mobile veut la home en **une** requête → le BFF appelle 3 services en parallèle et compose une réponse taillée pour lui.
- **sécurité des tokens** : le BFF garde le JWT **côté serveur** (cookie `httpOnly`), le client ne le manipule jamais (défense anti-XSS).
- **forme des données** : chaque client a des besoins différents ; le BFF adapte, évitant de polluer les services cœur avec des vues spécifiques.

| | **API Gateway** | **BFF** |
|---|---|---|
| Nature | infrastructure | applicatif |
| Nombre | 1 pour toute l'infra | 1 **par type de client** (web, mobile…) |
| Rôle | transverse : routing, auth, rate limit, cache | spécifique client : agrégation, tokens, forme |
| Logique métier | aucune | légère (composition, adaptation) |

Ils sont **complémentaires** : un client parle à son **BFF**, qui parle aux services **via** l'API Gateway. Le lien avec ce module : un BFF est un excellent endroit pour **agréger** des données que le back a construites en réagissant à des événements (ex. un feed alimenté en fan-out). La **sécurité en profondeur** (OAuth, mTLS, service mesh) est déférée au **module 20** ; on ne pose ici que les deux patterns structurants.

---

## 3. Worked examples

### Exemple 1 — Concevoir le flux « SortieCréée » du §1 en event-driven

But : découpler Sorties de ses consommateurs, sans casser la garantie que rien n'est perdu.

**Étape 1 — nommer le message.** C'est un **fait passé** → un **événement**, `SortieCréée`, pas une commande. Payload minimal et **stable** : `{ eventId, sortieId, familyId, occurredAt }`. On met un `eventId` (UUID) **exprès**, pour l'idempotence en aval. On ne met **pas** l'objet Sortie entier (couplage au schéma interne) — juste de quoi que chaque consommateur aille chercher ce qu'il lui faut.

**Étape 2 — queue ou topic ?** Trois modules indépendants doivent **tous** réagir → **topic** (pub-sub, fan-out). Derrière chaque abonné, sa **propre queue** pour lisser et retenter.

**Étape 3 — choreography ou orchestration ?** Les trois réactions (notif, feed, suggestions) sont **indépendantes**, sans ordre imposé ni compensation → **choreography**. Pas besoin d'orchestrateur ici ; ce serait du couplage gratuit.

**Étape 4 — le producteur, réduit à l'essentiel :**

```ts
// sorties.service.ts — APRÈS
async createSortie(input: CreateSortieInput): Promise<Sortie> {
  const sortie = await this.repo.save(Sortie.create(input));

  // Sorties émet un FAIT et rend la main. Il ne cite AUCUN consommateur.
  await this.bus.publish('SortieCréée', {
    eventId: randomUUID(),
    sortieId: sortie.id,
    familyId: sortie.familyId,
    occurredAt: new Date().toISOString(),
  });

  return sortie; // le parent a son 201 sans attendre notif/feed/calendar
}
```

**Étape 5 — un consommateur idempotent** (le broker garantit *at-least-once* → doublons possibles) :

```ts
// notifications.consumer.ts
async on(event: SortieCréée): Promise<void> {
  // Dédup : si on a DÉJÀ traité cet eventId, on ignore (idempotence)
  if (await this.seen.has(event.eventId)) return;

  await this.pushToFamily(event.familyId, event.sortieId);
  await this.seen.add(event.eventId); // marque comme traité
}
```

**Ce que le design achète :** ajouter « prévenir les grands-parents » = **un nouvel abonné**, zéro ligne touchée dans Sorties. Un consommateur down n'empêche pas la création : son message l'attend dans sa queue. Après N échecs, le poison part en **DLQ** au lieu de bloquer. Reste à assumer : le feed est en cohérence **différée** (quelques ms/s), ce qui est acceptable pour ce cas.

### Exemple 2 — Queue ou topic ? Quatre besoins, quatre verdicts

Pour chaque besoin TribuZen, choisis la primitive et justifie.

1. **« Envoyer l'email de rappel du soir à un parent. »** Un seul worker doit l'envoyer, pas trois. → **Queue** (point-à-point, répartition de charge). Idempotence : dédup sur `eventId` pour ne pas doubler l'email si rejeu.
2. **« RoutineComplétée doit mettre à jour la série ET le feed ET les stats. »** Trois consommateurs indépendants veulent le même fait. → **Topic** (fan-out).
3. **« Exporter la sortie vers Google Calendar (API externe lente et faillible). »** Une intention visant un destinataire précis, susceptible d'échouer/retenter. → **Queue** dédiée avec retries + **DLQ** ; sémantiquement plutôt une **commande** (`ExporterSortieCalendrier`) qu'un événement, car on **veut** cette action précise.
4. **« Une métrique “sortie vue” best-effort pour un dashboard. »** Perdre un point de mesure de temps en temps est sans conséquence. → **At-most-once** assumé, sur un topic léger ; inutile de payer l'idempotence ici.

Le fil conducteur : **un seul acteur doit agir → queue ; plusieurs doivent savoir → topic ; l'action est cruciale et faillible → retries + DLQ ; l'info est jetable → at-most-once**.

---

## 4. Pièges & misconceptions

### PIÈGE #1 — Confondre queue et topic

« C'est pareil, ça transporte des messages. » Non, et le choix a des **conséquences fonctionnelles**. Queue = **un** consommateur traite (travail réparti). Topic = **tous** les abonnés reçoivent une copie (diffusion). Mettre un fan-out sur une queue → un seul des trois modules réagit, les deux autres ne voient **jamais** le message. Le critère : *un seul doit agir, ou plusieurs doivent savoir ?*

### PIÈGE #2 — Nommer un événement comme une commande (et vice-versa)

`EnvoyerNotificationSortie` publié par Sorties **recouple** Sorties à l'existence d'un service de notif : c'est une **commande** déguisée. Un événement se nomme au **passé** et reste neutre (`SortieCréée`) : il **raconte**, il n'**ordonne** pas. Le nom trahit l'intention et le couplage. Événement = fait passé, 0..N abonnés ; commande = intention, 1 destinataire visé.

### PIÈGE #3 — Croire que le broker garantit « exactly-once »

C'est le mythe le plus tenace. La quasi-totalité des brokers offrent **at-least-once** : en cas d'accusé de réception perdu, ils **renvoient** → **doublons**. L'exactly-once de bout en bout est coûteux et souvent illusoire. La vraie parade n'est pas d'exiger l'exactly-once du broker, c'est de rendre **le consommateur idempotent** (dédup par `eventId`, opérations rejouables). Conçois **toujours** pour le doublon.

### PIÈGE #4 — Oublier l'idempotence « parce que ça n'arrivera pas »

« Un doublon, c'est rare, je verrai plus tard. » En at-least-once, le doublon est **normal**, pas exceptionnel — un simple redéploiement pendant un ack peut le déclencher. Résultat sans idempotence : email double, notif double, compteur faussé. La dédup (`eventId` + table des IDs vus) ou l'opération naturellement idempotente (`SET` plutôt que `+= 1`) n'est pas une option, c'est le socle.

### PIÈGE #5 — Choisir la choreography « parce que c'est plus découplé », pour un processus long

Le découplage total de la choreography devient un piège quand le processus a des **étapes ordonnées, des conditions et des compensations** (annuler l'étape 2 si l'étape 4 échoue). Là, le flux « émergent » n'est écrit nulle part et devient impossible à suivre/débugger. Un processus métier long veut un **orchestrateur** explicite (→ saga, module 18). Choreography pour des réactions simples et indépendantes ; orchestration pour un workflow métier.

### PIÈGE #6 — Confondre API Gateway et BFF

Ce ne sont **pas** deux noms pour la même chose. Le **Gateway** est de l'**infrastructure**, unique, transverse (routing/auth/rate limit), **sans** métier. Le **BFF** est **applicatif**, **un par type de client**, et porte une **logique légère spécifique client** (agrégation, garde des tokens). Mettre de l'agrégation métier dans le Gateway le transforme en fourre-tout ; croire qu'un seul BFF « pour tous les clients » suffit tue son intérêt (adapter à CHAQUE client).

### PIÈGE #7 — Croire que « event-driven » est toujours mieux

Non. L'asynchrone ajoute un broker à opérer, un débogage plus dur (plus de pile d'appels lisible) et de la **cohérence différée**. Pour un appel synchrone simple, avec une seule cible et une réponse immédiate attendue (ex. lire un profil), un appel direct/REST reste le bon choix (→ module 16). L'event-driven se justifie par le **découplage** et le **fan-out**, pas par principe.

---

## 5. Ancrage TribuZen

TribuZen a un cœur (Sorties, Routines, Famille) et une périphérie qui **réagit** (Notifications, Feed familial, Suggestions, Sync calendrier). C'est le terrain type de l'event-driven : le cœur émet des faits, la périphérie s'abonne.

**Bus d'événements interne — le fan-out `SortieCréée` :**

```
Module Sorties ──▶ [ TOPIC "SortieCréée" ]
                        │ fan-out (copie à chacun)
        ┌───────────────┼───────────────┬───────────────┐
        ▼               ▼               ▼               ▼
  Notifications      Feed familial   Suggestions   (grands-parents…
  (push aux         (ajoute une      (recalcule     nouvel abonné,
   membres)          activité)        les idées)     zéro impact cœur)
   [queue+dedup]     [queue+dedup]    [queue+dedup]
```

Décisions d'archi concrètes pour TribuZen :

- **`SortieCréée` et `RoutineComplétée` sont des événements** (faits passés, fan-out sur topic). **`ExporterSortieCalendrier` est une commande** (intention visant le seul module Sync, sur une queue dédiée avec retries + DLQ car l'API Google est externe et faillible).
- **Garantie assumée : at-least-once + idempotence.** Chaque consommateur dédup sur `eventId`. Concrètement : une notif de sortie n'est **jamais** envoyée deux fois même si le message est rejoué (crucial — spammer un parent est un bug produit visible).
- **Choreography, pas d'orchestrateur**, pour ce fan-out : les trois réactions sont indépendantes. Le jour où un vrai processus long apparaît (ex. inviter une autre famille avec validation en plusieurs étapes), on introduira une **saga** — mais c'est le module 18.
- **Edge :** l'app mobile React Native passe par un **BFF mobile** qui agrège « home famille » (sorties à venir + feed + routines du jour) en **une** requête et garde le token côté serveur ; le **BFF web** compose autrement. Derrière, un **API Gateway** unique fait le routing, l'auth et le rate limiting vers les services.

> **Défère :** le broker concret (SQS/SNS, RabbitMQ) et sa config = **cours 12** ; la mécanique worker/retry/backoff (BullMQ) = **module 12** ; CQRS/event sourcing/saga bâtis là-dessus = **module 18 (next)** ; la sécurité edge (OAuth, mTLS, service mesh) = **module 20**. Ici on a décidé **quel message, quelle primitive, quelle garantie** — pas l'implémentation.

---

## 6. Points clés

1. **Event-driven** = communiquer par **faits publiés** sur un broker, pas par appels nommés. Ça découple dans l'espace (le producteur ignore ses consommateurs), dans le temps (async) et en panne (le message attend). Prix : broker à opérer, débogage plus dur, cohérence différée.
2. **Événement** = fait passé (`SortieCréée`), 0..N abonnés, le producteur ne sait pas ce qui suit. **Commande** = intention (`ExporterCalendrier`), 1 destinataire visé, qui peut refuser. Le nom trahit l'intention.
3. **Queue** = point-à-point, **un** consommateur traite (travail réparti). **Topic** = pub-sub, **tous** les abonnés reçoivent une copie (**fan-out**). Un seul doit agir → queue ; plusieurs doivent savoir → topic.
4. **Choreography** = pas de chef, le flux émerge des réactions (découplé mais flux écrit nulle part). **Orchestration** = un chef commande la séquence (explicite mais recouple). Réactions simples → choreography ; processus long → orchestration (saga = module 18).
5. **Garanties :** at-most-once (perte possible, pas de doublon), **at-least-once** (jamais perdu, doublons possibles — **le défaut**), exactly-once (idéal, illusoire de bout en bout).
6. **Conçois idempotent** : at-least-once + idempotence (dédup par `eventId`, opérations rejouables) est la vraie parade au doublon. Un message poison va en **DLQ** après N échecs.
7. **API Gateway** = infra unique, transverse (routing/auth/rate limit), zéro métier. **BFF** = applicatif, **un par type de client**, agrège et garde les tokens. Complémentaires, pas synonymes.

---

## 7. Seeds Anki

```
Qu'est-ce qu'une architecture event-driven, et qu'est-ce qu'elle découple ?|Un style où un producteur publie un fait (événement) sur un broker sans connaître ses consommateurs, qui réagissent à leur rythme. Découple dans l'espace (producteur ignore les consommateurs), dans le temps (async) et en panne (le message attend dans le broker).
Différence entre un événement et une commande ?|Un événement est un fait passé (SortieCréée), immuable, adressé à 0..N abonnés que le producteur ignore. Une commande est une intention (ExporterCalendrier) adressée à 1 destinataire précis, qui peut la refuser. Événement = raconte ; commande = ordonne.
Différence entre une queue et un topic (pub-sub) ?|Queue = point-à-point : un message est traité par UN seul consommateur (travail réparti entre workers). Topic = publish/subscribe : chaque abonné reçoit sa COPIE du message (fan-out). Un seul doit agir → queue ; plusieurs doivent savoir → topic.
Choreography vs orchestration ?|Choreography : pas de chef, chaque service réagit aux événements et le flux global émerge (découplé, mais écrit nulle part). Orchestration : un composant dédié connaît et commande la séquence (explicite, mais recouple). Simple/indépendant → choreography ; processus long avec compensation → orchestration.
Quelles sont les trois garanties de livraison, et laquelle est le défaut ?|At-most-once (perte possible, jamais de doublon), at-least-once (jamais perdu, doublons possibles — c'est le DÉFAUT de la plupart des brokers), exactly-once (idéal mais coûteux/illusoire de bout en bout).
Pourquoi et comment rendre un consommateur idempotent ?|Parce qu'en at-least-once les doublons sont normaux. On rend le traitement rejouable sans effet supplémentaire : dédup via un eventId unique + table des IDs déjà traités, ou opérations naturellement idempotentes (SET plutôt que incrémenter). C'est la vraie approximation de l'exactly-once.
À quoi sert une dead letter queue (DLQ) ?|À isoler un message qui échoue N fois (poison message) : après N tentatives, le broker le déplace dans une queue de côté pour inspection humaine/alerte, au lieu de le faire boucler à l'infini et bloquer la queue.
Différence entre API Gateway et BFF ?|API Gateway = infrastructure unique, transverse (routing, auth, rate limit, cache), sans logique métier. BFF (Backend-for-Frontend) = applicatif, un par type de client (web, mobile), avec logique légère spécifique : agrégation, garde des tokens côté serveur, adaptation de la forme. Complémentaires, pas synonymes.
```

---

## Pont vers le lab

> Lab associé : `labs/lab-17-event-driven-et-messaging/README.md`. Concevoir de bout en bout un flux event-driven pour un scénario TribuZen : nommer les messages (événement vs commande), choisir queue vs topic, trancher choreography vs orchestration, poser la garantie de livraison et l'idempotence, et placer un BFF. Exercice de conception évalué par grille + coach, avec variante J+30 — zéro harnais.
