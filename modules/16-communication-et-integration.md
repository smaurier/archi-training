---
titre: Communication et intégration (styles synchrones + temps réel)
cours: 13-architecture
notions: ["communication synchrone request/response", "REST (ressources + verbes HTTP)", "over-fetching et under-fetching", "GraphQL (single endpoint, client-driven)", "gRPC (Protobuf + HTTP/2)", "trade-offs REST vs GraphQL vs gRPC", "temps réel : WebSocket vs SSE vs polling", "chattiness et round-trips réseau", "contrat d'API", "couplage temporel et couplage de format", "versioning et compatibilité ascendante"]
outcomes:
  - "sait distinguer communication synchrone request/response et les styles temps réel, au niveau architecture"
  - "sait choisir entre REST, GraphQL et gRPC pour un besoin donné et justifier le trade-off"
  - "sait diagnostiquer un over-fetching / under-fetching et une API trop bavarde (chatty)"
  - "sait choisir entre WebSocket, SSE et polling pour un besoin temps réel"
  - "sait raisonner sur le contrat d'API et le couplage (temporel, format) entre deux systèmes"
prerequis: ["Module 00 — posture d'architecte", "Module 05 — architecture en couches (frontière présentation)", "Module 08 — monolithe modulaire vs microservices (frontières de service)", "Module 11 — API design et backend patterns", "Modules 12-15 (jobs/async, données, frontend)"]
next: 17-event-driven-et-messaging
libs: []
tribuzen: "communication de TribuZen — choix REST/GraphQL/gRPC/WebSocket entre l'app mobile React Native, le backend NestJS et les services internes"
last-reviewed: 2026-07
---

# Communication et intégration (styles synchrones + temps réel)

> **Outcomes — tu sauras FAIRE :** distinguer les styles de communication synchrone et temps réel, choisir entre REST / GraphQL / gRPC et le justifier, diagnostiquer un over/under-fetching et une API bavarde, choisir entre WebSocket / SSE / polling, et raisonner sur le contrat et le couplage entre deux systèmes.
> **Difficulté :** :star::star::star:
>
> **Portée :** ce module traite les styles de communication **synchrone** (un appelant attend une réponse : REST, GraphQL, gRPC) et le **temps réel** au niveau architecture (WebSocket, SSE, polling). On raisonne **choix et trade-offs**, pas implémentation ligne à ligne. La communication **asynchrone découplée** (événements, files de messages, webhooks, at-least-once) est le **module 17 (event-driven & messaging)** — on la mentionne pour la frontière, on ne la traite pas ici. Le **HTTP en profondeur** (cache HTTP, ETag, HTTP/2 vs HTTP/3, handshakes TLS, pooling) est le **cours 11** : on s'appuie sur ses résultats sans les réexpliquer. Le détail NestJS/GraphQL/gRPC d'implémentation relève des **cours 09/11**.

## 1. Cas concret d'abord

Tu reprends TribuZen. L'écran d'accueil de l'app mobile (React Native) doit afficher, pour la famille connectée : le nom de la famille, la liste des membres, et pour chaque enfant ses routines du jour avec leur série (*streak*). Un contributeur a câblé ça sur l'API REST existante du backend NestJS :

```
# Ce que fait l'écran d'accueil au démarrage (React Native)
GET /families/f_42                       -> { id, name, memberIds: [...] }
GET /members/m_1                         -> { id, name, role }
GET /members/m_2                         -> { id, name, role }
GET /members/m_3                         -> { id, name, role }
GET /children/m_2/routines?day=today     -> [ { id, title, ... }, ... ]
GET /children/m_3/routines?day=today     -> [ { id, title, ... }, ... ]
GET /routines/r_10/streak                -> { current: 5 }
GET /routines/r_11/streak                -> { current: 2 }
# ... un appel de série par routine
```

Au total : **une douzaine d'allers-retours réseau** pour peindre un seul écran. Sur un mobile en 4G avec 120 ms de latence, l'écran met deux secondes à se remplir. Pire, chaque réponse `GET /members/:id` renvoie **tout** le membre (email, préférences, dates) alors que l'écran n'affiche qu'un prénom.

Pose-toi trois questions d'architecte :

1. **Le problème est-il REST ?** Ou est-ce la *façon* dont on l'utilise (une ressource = un appel, sans agrégation) ?
2. **Le client demande-t-il trop, ou trop peu ?** Chaque appel renvoie trop de champs (over-fetching), mais il en faut beaucoup pour un écran (under-fetching sur la collection). Les deux à la fois.
3. **Faut-il changer de style de communication** (passer à GraphQL pour que le mobile demande l'arbre entier en un appel), **ajouter un endpoint d'agrégation REST**, ou **garder REST** et corriger l'usage ?

Ce module te donne le vocabulaire et la grille pour trancher — sans réflexe « GraphQL c'est mieux » ni « REST partout ».

---

## 2. Théorie complète, concise

### 2.1 Le cadre : synchrone request/response vs temps réel

Toute intégration entre deux systèmes se range d'abord sur un axe **qui attend quoi** :

- **Synchrone (request/response)** : l'appelant envoie une requête et **bloque** (logiquement) jusqu'à la réponse. Le résultat est immédiat et corrélé à la demande. REST, GraphQL, gRPC vivent ici. C'est le mode par défaut d'un client qui a besoin d'une donnée *maintenant*.
- **Temps réel (push serveur)** : le serveur **pousse** des données vers le client sans que celui-ci redemande à chaque fois (WebSocket, SSE). Utile quand l'information naît côté serveur (un autre parent complète une routine) et doit remonter sans que le client sonde en boucle.
- **Asynchrone découplé** : l'émetteur envoie un message et **n'attend pas** ; un autre système le traite plus tard (files, événements). C'est le **module 17** — hors de ce module.

Retiens la distinction clé : **synchrone = couplage temporel** (les deux systèmes doivent être vivants en même temps), **asynchrone = découplé dans le temps**. Le temps réel est synchrone dans l'établissement (la connexion doit être ouverte) mais pousse ensuite sans requête.

### 2.2 REST — ressources et verbes

REST modélise le domaine en **ressources** (`/families/f_42`, `/routines/r_10`) manipulées par les **verbes HTTP** (`GET` lire, `POST` créer, `PATCH` modifier, `DELETE` supprimer). Un endpoint = une ressource ou une collection.

Forces : universel, cacheable (le cache HTTP est *gratuit* — cours 11), lisible par un humain, outillage massif (OpenAPI/Swagger), sans état côté serveur. C'est le **choix par défaut d'une API publique ou d'un CRUD**.

Faiblesses structurelles, visibles au §1 :

- **Over-fetching** : l'endpoint renvoie un objet complet là où le client n'a besoin que de deux champs. On transporte du gras.
- **Under-fetching** : un écran a besoin de plusieurs ressources → plusieurs appels. On multiplie les allers-retours (*chattiness*).

Ces deux défauts ne condamnent pas REST : ils se corrigent souvent avec des **endpoints d'agrégation** taillés pour l'écran (parfois appelés *Backend-for-Frontend*, BFF — voir module 11) ou de la projection de champs (`?fields=name`). Change de style seulement si le besoin le justifie vraiment.

### 2.3 GraphQL — un seul endpoint, piloté par le client

GraphQL expose **un endpoint unique** et un **schéma typé**. Le client envoie une **requête décrivant exactement l'arbre de données voulu** ; le serveur répond avec cette forme précise, ni plus ni moins.

```graphql
# Le mobile demande TOUT l'écran d'accueil en UN appel
query HomeScreen {
  family(id: "f_42") {
    name
    members {
      name
      routinesToday { title streak }   # l'arbre entier, une seule requête
    }
  }
}
```

Forces : **tue l'over/under-fetching** (le client cadre la donnée), un seul aller-retour pour un écran composite, schéma introspectable, excellent pour des **fronts hétérogènes** (mobile ≠ desktop, besoins différents sur les mêmes données).

Coûts réels, à connaître pour arbitrer :

- **Problème N+1** : résoudre `members { routinesToday }` peut déclencher une requête base par membre. Se corrige avec un *DataLoader* (batching) — mais c'est du travail serveur qui n'existe pas en REST plat.
- **Cache moins trivial** : les requêtes passent en `POST` sur un endpoint unique → le cache HTTP standard ne s'applique plus tel quel (il faut un cache applicatif / persisted queries). Tu **perds** la gratuité du cache REST.
- **Surface d'attaque** : une requête profonde ou coûteuse peut faire tomber le serveur → il **faut** brider (limite de profondeur, analyse de coût). Sécurité à la charge de l'équipe.

GraphQL n'est pas « REST en mieux » : c'est un **déplacement de complexité** du réseau (moins d'appels) vers le serveur (résolution, batching, sécurité, cache).

### 2.4 gRPC — binaire, contrat-first, orienté service-à-service

gRPC sérialise les messages en **Protocol Buffers** (Protobuf, format **binaire** compact) et transporte sur **HTTP/2** (multiplexé, obligatoire). Le contrat est un fichier `.proto` d'où on **génère** le code client et serveur.

```protobuf
// routine.proto — le contrat EST le code source de vérité
service RoutineService {
  rpc GetStreak(StreakRequest) returns (StreakReply);          // unary
  rpc WatchStreaks(WatchRequest) returns (stream StreakReply); // server streaming
}
```

Forces : **overhead minimal** (binaire, 5-10× plus compact que JSON pour des payloads structurés), latence basse, **streaming natif** (4 formes : unary, server-stream, client-stream, bidirectionnel), contrat fort et versionnable. C'est le choix privilégié pour la communication **inter-services** interne où la performance compte.

Limites décisives :

- **Pas natif dans le navigateur** : un front web ne parle pas gRPC directement, il faut **gRPC-Web** + un proxy de traduction. Donc rarement le bon choix pour une **API destinée à un front** ou publique.
- **Pas lisible par un humain** (binaire) : debug plus dur, moins « curl-able ».
- **Courbe** : toolchain protobuf, génération de code, HTTP/2 obligatoire côté infra.

### 2.5 Trade-offs : quand choisir quoi (synchrone)

| Critère | REST | GraphQL | gRPC |
|---|---|---|---|
| Format | JSON (texte) | JSON (texte) | Protobuf (binaire) |
| Transport | HTTP/1.1 ou 2 | HTTP/1.1 ou 2 | HTTP/2 obligatoire |
| Contrat / découverte | OpenAPI | schéma introspectable | fichier `.proto` |
| Over/under-fetching | possible (à corriger) | résolu nativement | ciblé par méthode |
| Cache HTTP | natif (gratuit) | à reconstruire | non applicable |
| Navigateur | natif | natif | via gRPC-Web + proxy |
| Overhead réseau | moyen | moyen | très faible |
| Cas idéal | API publique, CRUD | front riche/hétérogène | inter-services, perf |

Règle de décision par défaut :

- **REST** — API publique, CRUD, quand le cache HTTP et la lisibilité comptent. **Commence ici** sauf raison contraire.
- **GraphQL** — quand plusieurs clients aux besoins différents lisent le même domaine et souffrent d'over/under-fetching (dashboards, mobile vs desktop).
- **gRPC** — communication interne service-à-service, performance/streaming critiques, pas de navigateur en bout de chaîne.

Les trois **coexistent** légitimement dans un même système (gRPC entre services internes, REST/GraphQL en bordure vers les clients).

### 2.6 Temps réel : WebSocket, SSE, polling

Quand l'information naît côté serveur et doit remonter *sans* que le client redemande, trois options — à choisir par un arbre simple :

- **A-t-on vraiment besoin de temps réel ?** Sinon, du **polling** court (REST toutes les 5-15 s) suffit : simple, sans état, cacheable. Ne paie pas une connexion persistante pour un statut qui bouge une fois par heure.
- **Le flux est-il unidirectionnel (serveur → client) ?** Alors **SSE** (Server-Sent Events) : un flux HTTP `text/event-stream`, **reconnexion automatique native**, passe les proxies/CDN sans souci. Idéal pour notifications, flux d'événements, logs.
- **Le client doit-il aussi émettre, à haute fréquence ?** Alors **WebSocket** : connexion **full-duplex** persistante, overhead par message minimal. Idéal pour chat, édition collaborative, présence.

| Critère | Polling | SSE | WebSocket |
|---|---|---|---|
| Direction | client tire | serveur → client | bidirectionnel |
| Transport | HTTP standard | HTTP (`text/event-stream`) | protocole WS (upgrade HTTP) |
| Reconnexion | trivial (nouvelle requête) | automatique (native) | manuelle (code) |
| Overhead | élevé (requêtes répétées) | faible | très faible par message |
| Cache/CDN | oui | oui | non |
| Cas d'usage | statut peu changeant | notifications, flux | chat, collaboration |

Au niveau **archi**, retiens surtout que **WebSocket a un coût de scaling** : la connexion est **avec état** (*stateful*), collée à un serveur → il faut des *sticky sessions* et un bus (type Redis pub/sub) pour diffuser entre plusieurs instances. Le détail de scaling est un sujet d'implémentation (cours dédiés) ; la décision d'archi est : *ai-je besoin du bidirectionnel, ou SSE/polling suffit-il ?*

### 2.7 Fondamentaux réseau utiles à l'archi

Deux notions suffisent pour arbitrer les choix ci-dessus ; le reste (handshakes, HTTP/2 vs HTTP/3, TLS, pooling) est le **cours 11** :

1. **Le round-trip coûte.** Chaque aller-retour paie la latence réseau (souvent 20-150 ms). Une API **bavarde** (*chatty*) qui exige 12 appels pour un écran paie 12 fois la latence. Réduire le **nombre d'appels** (agrégation, GraphQL, batch) bat souvent l'optimisation de chaque appel.
2. **La réutilisation de connexion compte.** Rouvrir une connexion (TCP + TLS) à chaque appel ajoute des allers-retours. HTTP/2 multiplexe plusieurs requêtes sur une connexion — ce qui atténue (sans annuler) le coût de la chattiness. C'est pourquoi gRPC **impose** HTTP/2. (Deep dive : cours 11.)

L'implication archi : **compte les allers-retours** dans la latence perçue avant de choisir un style. Le §1 était un problème de chattiness, pas de « mauvais protocole ».

### 2.8 Contrat et couplage

Quel que soit le style, deux systèmes qui communiquent partagent un **contrat** : la forme des messages, les endpoints/méthodes, les codes d'erreur. Le contrat est ce qui **couple** l'émetteur et le récepteur.

- **Contrat explicite** (OpenAPI pour REST, schéma GraphQL, `.proto` pour gRPC) : versionnable, testable, génère du code. **Un contrat implicite** (« le mobile sait que ce champ existe ») est une dette qui casse en silence.
- **Couplage temporel** : en synchrone, appelé et appelant doivent être **vivants en même temps**. Si le service de streaks est down, l'écran d'accueil échoue. Réduire ce couplage = passer à l'asynchrone (module 17) ou dégrader proprement (timeout + valeur par défaut).
- **Couplage de format** : si le producteur **renomme ou supprime** un champ, tout consommateur casse. La discipline : **compatibilité ascendante** — on **ajoute** des champs (optionnels), on ne **retire/renomme** pas sans version. Le versioning (`/v1`, `/v2`, champ Protobuf jamais réutilisé) et le **contract testing** (vérifier en CI que le schéma consommé n'a pas dérivé) protègent contre les ruptures silencieuses.

Principe directeur : **une API est un contrat, pas un détail d'implémentation.** Le choix de style (REST/GraphQL/gRPC) est secondaire face à la question « qui dépend de quoi, et que se passe-t-il quand ça change ? ».

---

## 3. Worked examples

### Exemple 1 — Choisir le style pour trois besoins TribuZen

On te donne trois besoins réels. Pour chacun : style + justification.

**Besoin A — L'app mobile peint l'écran d'accueil (le §1).**
Plusieurs ressources imbriquées (famille → membres → routines → streaks), un seul client mais un arbre composite, souffrance nette d'under-fetching (12 appels). 
→ **Deux options défendables.** *(1)* Rester **REST** + ajouter **un endpoint d'agrégation** `GET /families/f_42/home` taillé pour l'écran : simple, garde le cache HTTP, une seule requête. *(2)* **GraphQL** si d'autres écrans/clients ont des besoins de forme différents sur le même domaine. 
→ **Verdict :** comme il n'y a qu'un client (mobile) et un écran, l'**endpoint d'agrégation REST** est le choix le plus économique. On passera à GraphQL le jour où un second front (web admin) réclame une forme différente. *On ne change pas de style pour un seul écran.*

**Besoin B — Le backend NestJS doit appeler un futur service interne « scoring » (calcul d'un indice de régularité) à chaque complétion.**
Communication **interne**, service-à-service, appelée souvent, pas de navigateur en bout de chaîne, payloads structurés, latence importante (dans le chemin d'une requête utilisateur). 
→ **gRPC.** Binaire compact, HTTP/2, contrat `.proto` fort, streaming disponible si le scoring devient un flux. REST interne resterait acceptable, mais gRPC est le choix « inter-services perf » canonique.

**Besoin C — Afficher en direct qu'un autre parent vient de valider une routine.**
Information née **côté serveur**, à pousser vers les clients connectés. Le client n'a (pour ce besoin) rien à émettre. 
→ **SSE.** Unidirectionnel serveur → client, reconnexion automatique, passe les CDN. On ne prend **pas** WebSocket : pas de flux montant haute fréquence ici, donc pas la peine de payer le coût stateful/scaling du full-duplex. Si demain on ajoute de l'**édition collaborative** de routine (plusieurs parents éditent le même objet en même temps), *là* WebSocket se justifie.

### Exemple 2 — Diagnostiquer un contrat cassé

Le mobile crashe après un déploiement backend. Log réseau :

```
# AVANT déploiement — réponse du backend
GET /routines/r_10/streak  ->  { "current": 5, "best": 12 }

# APRÈS déploiement — réponse du backend
GET /routines/r_10/streak  ->  { "streakCurrent": 5, "streakBest": 12 }
```

Analyse :

- Le backend a **renommé** `current` → `streakCurrent`. Le mobile lit toujours `current` → il reçoit `undefined` → crash à l'affichage.
- C'est une **rupture de couplage de format** : un changement **non rétrocompatible** livré sans version. Renommer un champ = *breaking change*, exactement comme le supprimer.
- **Ce qui aurait dû se passer :** soit *ajouter* `streakCurrent` en gardant `current` le temps de la migration (compatibilité ascendante), soit versionner (`/v2/.../streak`) et migrer le mobile, soit — mieux — un **contract test** en CI qui aurait détecté que le schéma consommé par le mobile ne contenait plus `current` **avant** le déploiement.

Verdict : le style (REST) n'est pas en cause. Le défaut est **contractuel** : on a modifié un contrat public sans discipline de compatibilité. La leçon du module en une phrase : *le choix de protocole ne te sauve pas d'un contrat mal géré.*

---

## 4. Pièges & misconceptions

### PIÈGE #1 — « GraphQL remplace REST, c'est plus moderne »

Faux cadrage. GraphQL **déplace** la complexité (moins d'appels réseau, mais N+1, sécurité de requête, cache applicatif à reconstruire). Tu **perds** la gratuité du cache HTTP et gagnes une surface d'attaque à brider. GraphQL brille quand plusieurs clients souffrent d'over/under-fetching sur un domaine riche ; sur un CRUD à un seul client, REST + un endpoint d'agrégation est plus simple *et* plus rapide à cacher.

### PIÈGE #2 — Confondre « problème de protocole » et « problème d'usage »

Le §1 (12 appels pour un écran) donne l'impression qu'« il faut GraphQL ». En réalité c'est de la **chattiness** : un endpoint d'agrégation REST la corrige aussi. Avant de changer de style, demande-toi si c'est le protocole ou la *granularité* de tes endpoints qui est en cause. Changer de techno pour un défaut de conception, c'est déménager pour ne pas ranger sa chambre.

### PIÈGE #3 — Prendre WebSocket par défaut dès qu'on entend « temps réel »

WebSocket est **stateful** : sticky sessions, bus pub/sub pour scaler, reconnexion à coder à la main. Pour un flux **unidirectionnel** (notifications), **SSE** offre 90 % du bénéfice pour une fraction du coût (reconnexion native, cache/CDN-friendly). Et pour une donnée qui bouge rarement, **le polling court suffit**. Prends WebSocket seulement quand tu as besoin du **bidirectionnel à haute fréquence**.

### PIÈGE #4 — Croire que gRPC est un bon choix pour parler à un front web

gRPC n'est **pas natif dans le navigateur** : il faut gRPC-Web *et* un proxy de traduction. Pour une API consommée par un front (web ou même mobile via HTTP classique), REST ou GraphQL sont bien plus simples. gRPC est fait pour le **service-à-service interne**, pas pour la bordure client.

### PIÈGE #5 — Traiter le contrat comme un détail d'implémentation

« On ajustera les champs au fil de l'eau. » Non : dès qu'un autre système lit ta réponse, sa forme est un **contrat**. Renommer/supprimer un champ casse le consommateur en silence (Exemple 2). Discipline non négociable : ajouter est sûr, retirer/renommer exige version + compatibilité ascendante, et un **contract test** en CI vaut mieux qu'un hotfix en prod.

### PIÈGE #6 — Oublier le couplage temporel du synchrone

En synchrone, si le service appelé est down, ton appel échoue — l'appelant **dépend de la disponibilité** de l'appelé, ici et maintenant. Ce n'est pas un défaut à masquer mais un fait à assumer : soit tu dégrades proprement (timeout court + valeur par défaut/cache), soit, si le besoin le permet, tu passes en **asynchrone découplé** (module 17). Choisir « synchrone » = accepter ce couplage temporel en connaissance de cause.

---

## 5. Ancrage TribuZen

TribuZen fait cohabiter **trois styles**, chacun choisi pour une frontière précise :

```
┌────────────────┐   REST + endpoint      ┌──────────────────┐   gRPC (interne)   ┌───────────────┐
│  App mobile RN │◀──d'agrégation /home──▶│  Backend NestJS  │◀──────────────────▶│ Service scoring│
│  (front)       │                        │  (bordure/API)   │                     │ (interne)     │
└──────┬─────────┘                        └────────┬─────────┘                     └───────────────┘
       │  SSE (serveur → client)                   │
       └───────────────────────────────────────────┘
          « une routine vient d'être validée »
```

Décisions concrètes :

- **Mobile ↔ backend : REST**, avec un **endpoint d'agrégation** `GET /families/:id/home` pour l'écran d'accueil (une requête au lieu de douze). Le cache HTTP (cours 11) reste exploitable. On garde REST tant qu'il n'y a qu'un client ; GraphQL sera reconsidéré si un **front web admin** aux besoins différents apparaît.
- **Backend ↔ service interne « scoring » : gRPC.** Communication service-à-service, dans le chemin d'une requête utilisateur, payloads structurés — le binaire + HTTP/2 y gagnent. Aucun navigateur en bout : pas de contrainte gRPC-Web.
- **Notifications « routine validée » : SSE.** Unidirectionnel, reconnexion native, économe. On réserve **WebSocket** au jour où l'**édition collaborative** d'une routine à plusieurs parents arrivera (bidirectionnel haute fréquence).
- **Couplage & offline :** l'app mobile fonctionne **hors-ligne** (sync différée au retour réseau). Ce chemin-là n'est **pas** synchrone : il pousse des complétions en **batch** — c'est du ressort du **module 17** (messaging/async), pas de ce module. Ici, on gère la communication *quand le réseau est là*, et on assume le couplage temporel avec des timeouts + états de repli côté UI.

> **Défère :** le cache HTTP, HTTP/2/3 et les handshakes → **cours 11** ; la sync offline batchée, les webhooks et les files → **module 17** ; l'implémentation NestJS (contrôleurs, resolvers, microservices gRPC) → **cours 09/11**. Ici on décide **quel style pour quelle frontière**, et **quel contrat**.

---

## 6. Points clés

1. Trois régimes : **synchrone** (request/response — REST/GraphQL/gRPC), **temps réel** (push — WebSocket/SSE), **asynchrone découplé** (module 17). Synchrone = couplage temporel assumé.
2. **REST** = ressources + verbes, cache HTTP gratuit, choix par défaut ; ses défauts (over/under-fetching, chattiness) se corrigent souvent par un **endpoint d'agrégation**, pas par un changement de techno.
3. **GraphQL** = un endpoint, requête pilotée par le client → tue l'over/under-fetching, mais **déplace** la complexité (N+1, cache à reconstruire, sécurité de requête).
4. **gRPC** = Protobuf binaire sur HTTP/2, contrat `.proto`, streaming natif → **inter-services** performants ; **pas** pour un navigateur (gRPC-Web + proxy requis).
5. **Temps réel** : polling si peu de fraîcheur, **SSE** si unidirectionnel, **WebSocket** si bidirectionnel haute fréquence (et stateful → coût de scaling).
6. **Compte les allers-retours** : la latence perçue vient souvent de la *chattiness*, pas du protocole. Réduire le nombre d'appels bat l'optimisation de chaque appel.
7. **Le contrat couple les systèmes** : ajouter est sûr, renommer/supprimer casse. Compatibilité ascendante + versioning + contract testing. Une API est un contrat, pas un détail d'implémentation.

---

## 7. Seeds Anki

```
Quelle est la différence entre over-fetching et under-fetching ?|Over-fetching : l'endpoint renvoie plus de champs que nécessaire (on transporte du gras). Under-fetching : un besoin exige plusieurs appels car aucun endpoint ne renvoie tout (chattiness). REST plat souffre souvent des deux.
Quand choisir REST plutôt que GraphQL ou gRPC ?|Par défaut : API publique/CRUD, un seul type de client, quand le cache HTTP et la lisibilité comptent. Ses défauts (over/under-fetching) se corrigent souvent par un endpoint d'agrégation sans changer de style.
Que déplace GraphQL par rapport à REST, concrètement ?|Il supprime l'over/under-fetching (le client cadre la donnée, un seul appel) mais déplace la complexité vers le serveur : problème N+1 (DataLoader), cache HTTP perdu à reconstruire, sécurité de requête à brider (profondeur/coût).
Pourquoi gRPC est-il rarement le bon choix pour un front web ?|gRPC n'est pas natif dans le navigateur : il faut gRPC-Web plus un proxy de traduction. C'est un protocole binaire sur HTTP/2 fait pour la communication inter-services interne, pas pour la bordure client.
WebSocket vs SSE : comment choisir ?|SSE si le flux est unidirectionnel serveur→client (notifications) : reconnexion native, CDN-friendly, léger. WebSocket si le client doit aussi émettre à haute fréquence (chat, collaboration) : full-duplex, mais stateful donc coûteux à scaler (sticky sessions + bus pub/sub).
Pourquoi une API bavarde (chatty) est-elle un problème d'architecture ?|Chaque aller-retour paie la latence réseau (20-150 ms). 12 appels pour un écran = 12 fois la latence. Réduire le nombre d'appels (agrégation, batch, GraphQL) bat souvent l'optimisation de chaque appel isolé.
Qu'est-ce que le couplage temporel d'une communication synchrone ?|Appelant et appelé doivent être vivants en même temps : si le service appelé est down, l'appel échoue. On l'assume (timeout + repli) ou on le réduit en passant à l'asynchrone découplé (files/événements, module 17).
Renommer un champ dans une réponse d'API, est-ce un breaking change ?|Oui, autant que le supprimer : tout consommateur qui lit l'ancien nom casse en silence. Discipline : ajouter des champs est sûr, renommer/supprimer exige version + compatibilité ascendante, protégé par un contract test en CI.
```

---

## Pont vers le lab

> Lab associé : `labs/lab-16-communication-et-integration/README.md`. Pour plusieurs besoins de communication de TribuZen, choisir le style (REST / GraphQL / gRPC / WebSocket / SSE / polling), justifier le trade-off, et repérer les pièges de contrat/couplage. Exercice de décision, évalué par grille + coach — zéro harnais.
