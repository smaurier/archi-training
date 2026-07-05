# Lab 16 — Communication et intégration (choisir le style)

> **Outcome :** à la fin, tu sais **choisir et justifier** le style de communication (REST / GraphQL / gRPC / WebSocket / SSE / polling) pour cinq besoins réels de TribuZen, et repérer les défauts de contrat/couplage — le tout en raisonnant trade-offs, pas en codant.
> **Vrai outil :** une fiche de décision écrite (Markdown ou papier) + un schéma d'intégration. Pas de harnais, pas de test-runner : c'est un exercice de **conception**.
> **Feedback :** le coach valide en session (grille ci-dessous). Aucune réponse « auto-corrigée ».

---

## Énoncé

TribuZen grandit. On te donne **cinq besoins de communication** entre les composants du système :

- **App mobile** (React Native) — le front des parents.
- **Backend NestJS** — la bordure/API et les règles métier.
- **Service interne « scoring »** — calcule un indice de régularité (composant interne, pas exposé au public).
- Des **familles** connectées simultanément.

Les cinq besoins :

| # | Besoin | Contexte |
|---|--------|----------|
| **B1** | L'écran d'accueil mobile affiche famille + membres + routines du jour + streak de chacune | 1 seul client (mobile), aujourd'hui ~12 appels REST pour peindre l'écran |
| **B2** | Le backend appelle le service « scoring » à chaque complétion de routine | interne, dans le chemin d'une requête utilisateur, appelé très souvent, payload structuré |
| **B3** | Afficher en direct « un autre parent vient de valider une routine » | l'info naît côté serveur, le client n'a rien à émettre pour ce besoin |
| **B4** | Un futur **back-office web admin** doit lister/filtrer familles, membres, routines, paiements — avec des écrans de formes très variées | plusieurs vues, besoins de champs différents sur le même domaine, un second type de client apparaît |
| **B5** | Afficher le statut d'un export mensuel PDF (« en attente / prêt ») que l'utilisateur a lancé | change au plus une fois, quelques minutes plus tard |

**Ta mission :** pour chaque besoin, produis une **fiche de décision** (voir gabarit) et un **schéma d'intégration global** qui montre quel style relie quels composants.

**Pas de code d'implémentation.** On veut le **raisonnement d'architecte** : style choisi, alternative écartée, trade-off, contrat, couplage.

### Gabarit de fiche (un par besoin)

```
Besoin : B_
Style retenu : (REST | REST+endpoint d'agrégation | GraphQL | gRPC | WebSocket | SSE | polling)
Alternative sérieuse écartée : ...
Justification (trade-off) : ... (over/under-fetching ? chattiness ? navigateur ? bidirectionnel ? perf interne ? fraîcheur réelle ?)
Contrat : où est-il défini ? (OpenAPI / schéma GraphQL / .proto / event shape)
Couplage : temporel (que se passe-t-il si l'autre côté est down ?) et format (que casse un renommage de champ ?)
Défère à un autre module/cours ? : (async→17, cache/HTTP→11, impl→09/11)
```

---

## Étapes (en friction)

1. **B1 — piège de la chattiness.** Avant de choisir un style, **compte les allers-retours** actuels et estime la latence perçue (suppose 100 ms/appel). Décide : changer de protocole, ou changer la *granularité* des endpoints ? Justifie pourquoi tu **ne** prends **pas** GraphQL ici (indice : combien de clients ?).
2. **B2 — inter-services.** Choisis le style pour une communication interne, chaude, sans navigateur. Nomme explicitement pourquoi ce choix, et pourquoi le navigateur ne contraint rien ici.
3. **B3 — temps réel.** Applique l'arbre de décision temps réel. Le client émet-il ? À quelle fréquence ? Choisis SSE vs WebSocket vs polling et justifie le coût que tu évites.
4. **B4 — le second client change la donne.** Rejoue B1 *avec* ce nouveau front admin aux besoins hétérogènes. Est-ce que ta réponse à B1 change ? Est-ce le moment où GraphQL devient défendable ? Explique le basculement.
5. **B5 — ne pas sur-ingénierer.** Résiste au réflexe « temps réel ». Quelle est la *vraie* fréquence de changement ? Choisis le style le plus simple qui marche.
6. **Contrat & couplage.** Pour B1 et B2, écris **une phrase** sur ce qui casse si un champ est renommé, et **comment** tu t'en protèges (compat ascendante / versioning / contract test).
7. **Schéma global.** Dessine (ASCII ou papier) les 4 composants et étiquette chaque lien avec son style. Vérifie la cohérence : un même lien ne doit pas avoir deux styles contradictoires sans raison.

---

## Corrigé complet commenté

> À ne consulter **qu'après** avoir produit tes cinq fiches.

**B1 — Écran d'accueil mobile → REST + endpoint d'agrégation.**
- Le problème n'est **pas** REST, c'est la **chattiness** : ~12 appels × 100 ms ≈ 1,2 s rien qu'en latence, plus l'over-fetching (chaque membre renvoie tous ses champs pour n'afficher qu'un prénom).
- **Choix :** garder REST et ajouter `GET /families/:id/home` taillé pour l'écran → **1 appel**. Le cache HTTP (cours 11) reste exploitable.
- **Alternative écartée : GraphQL.** Il résoudrait aussi le problème, mais avec **un seul client** et **un seul écran**, il ne se rentabilise pas (N+1 à gérer, cache HTTP perdu, sécurité de requête à brider). On ne change pas de techno pour un défaut de granularité.
- **Contrat :** OpenAPI. **Couplage :** temporel (si le backend est down, l'écran échoue → timeout + état de repli UI) ; format (renommer un champ casse le mobile → compat ascendante).

**B2 — Backend → service scoring → gRPC.**
- Communication **interne**, service-à-service, appelée à chaque complétion (chaude), dans le chemin d'une requête utilisateur, payload structuré, **aucun navigateur** en bout.
- **Choix :** gRPC — Protobuf binaire compact, HTTP/2 multiplexé, contrat `.proto` fort et versionnable, streaming disponible si le scoring devient un flux.
- **Alternative écartée : REST interne** — acceptable, mais plus verbeux/lent ; gRPC est le choix canonique « inter-services perf ». (gRPC-Web serait nécessaire *seulement* si un navigateur parlait à ce service — ce n'est pas le cas.)
- **Contrat :** fichier `.proto` (source de vérité, génère client + serveur). **Couplage :** on ne **réutilise jamais** un numéro de champ Protobuf supprimé (règle de compat).

**B3 — Notification « routine validée » → SSE.**
- L'info naît **côté serveur**, flux **unidirectionnel** serveur → client, le client n'émet rien pour ce besoin.
- **Choix :** SSE — reconnexion automatique native, passe les proxies/CDN, léger.
- **Alternative écartée : WebSocket** — inutilement **stateful** (sticky sessions + bus pub/sub pour scaler, reconnexion à coder) alors qu'il n'y a pas de flux montant haute fréquence. On garde WebSocket pour le jour où l'**édition collaborative** (plusieurs parents éditent la même routine) arrivera.
- **Contrat :** forme de l'event (`type`, `data`). **Couplage :** temporel faible (SSE se reconnecte seul).

**B4 — Back-office web admin → GraphQL (bascule assumée).**
- **Nouveauté :** un **second type de client** avec des écrans de formes **très variées** sur le même domaine (familles, membres, routines, paiements). C'est exactement le terrain où l'over/under-fetching devient structurel et où multiplier les endpoints d'agrégation REST (un par écran) devient ingérable.
- **Choix :** GraphQL — chaque écran demande sa forme, un endpoint, schéma introspectable.
- **Ce qui a changé depuis B1 :** en B1, un seul client → agrégation REST suffisait. En B4, **plusieurs vues hétérogènes** → GraphQL se rentabilise (on paie N+1/cache/sécurité, mais on l'amortit sur beaucoup d'écrans). C'est le **critère de bascule** : *nombre de clients/formes différents sur le même domaine*.
- **Contrat :** schéma GraphQL. **Couplage :** sécurité de requête à brider (profondeur + coût) — sinon un admin peut faire tomber le serveur.

**B5 — Statut d'export PDF → polling court.**
- La donnée change **au plus une fois**, quelques minutes plus tard. Pas de besoin réel de temps réel.
- **Choix :** polling REST (ex. toutes les 5-10 s tant que « en attente ») — simple, sans état, cacheable.
- **Alternative écartée : SSE/WebSocket** — sur-ingénierie pour un événement unique et rare. Payer une connexion persistante ici est un gaspillage.
- **Contrat :** OpenAPI (`GET /exports/:id -> { status }`).

**Schéma global :**

```
                REST + /home (B1)              gRPC interne (B2)
  ┌──────────┐  polling export (B5)   ┌──────────────┐  ─────────────▶ ┌──────────────┐
  │  Mobile  │◀──────────────────────▶│   Backend    │◀───────────────│   Scoring    │
  │   (RN)   │                        │   NestJS     │                 │  (interne)   │
  └────┬─────┘   SSE (B3)             └──────┬───────┘                 └──────────────┘
       └────────────────────────────────────┘
                                             ▲
                        GraphQL (B4)         │
  ┌──────────────┐──────────────────────────┘
  │ Web admin    │
  └──────────────┘
```

**Pourquoi ce corrigé tient :**
- Les cinq besoins ne prennent **pas** le même style : le style suit la **frontière** et le **besoin**, pas une mode.
- Deux besoins de lecture composite (B1, B4) reçoivent des réponses **différentes** — parce que le **nombre de clients/formes** diffère. C'est le cœur de l'arbitrage REST↔GraphQL.
- Les besoins temps réel (B3, B5) sont dégradés au style **le moins cher qui marche** (SSE, puis polling), pas à WebSocket par réflexe.
- L'async (sync offline, files) et le cache HTTP sont **déférés** (modules 17 / cours 11) : le lab reste dans le périmètre « styles synchrones + temps réel ».

---

## Grille d'évaluation (coach)

Le coach note chaque fiche sur ces axes (barème indicatif) :

| Axe | Ce qu'on attend | ✓ / ✗ |
|-----|-----------------|-------|
| **Style adapté** | Le style choisi correspond au besoin (pas de WebSocket réflexe, pas de gRPC vers navigateur) | |
| **Alternative écartée** | Une alternative sérieuse est nommée **et** rejetée avec un motif, pas ignorée | |
| **Trade-off explicite** | Le raisonnement cite le vrai levier (chattiness, over/under-fetching, bidirectionnel, perf interne, fraîcheur réelle) | |
| **Chattiness (B1)** | A compté les allers-retours et distingué « problème de protocole » vs « problème de granularité » | |
| **Bascule REST↔GraphQL (B1 vs B4)** | A identifié que le **nombre de clients/formes** justifie GraphQL en B4 mais pas en B1 | |
| **Anti sur-ingénierie (B5)** | A choisi le style le plus simple qui marche pour une donnée rarement changeante | |
| **Contrat & couplage** | Sait dire où vit le contrat et ce que casse un renommage + comment s'en protéger | |
| **Périmètre** | A déféré l'async/offline → module 17 et le HTTP deep → cours 11 au lieu de les traiter | |

**Seuil de réussite :** 6 axes sur 8 validés, dont obligatoirement « Style adapté » et « Trade-off explicite ».

---

## Coach — relances si blocage

- *« Tu prends GraphQL pour B1 : combien de clients consomment cet écran aujourd'hui ? Un endpoint d'agrégation REST ne suffirait-il pas ? »*
- *« Pour B3, le client a-t-il quelque chose à **envoyer** ? Si non, pourquoi payer le coût stateful de WebSocket ? »*
- *« B2 parle à un service **interne**. Un navigateur intervient-il quelque part sur ce lien ? Sinon, qu'est-ce qui t'empêche de prendre gRPC ? »*
- *« B5 : à quelle **fréquence réelle** cette donnée change-t-elle ? Un flux persistant est-il proportionné ? »*
- *« Renomme mentalement un champ de la réponse B1. Qui casse ? Comment l'aurais-tu détecté **avant** la prod ? »*
- *« Ton schéma global : y a-t-il un lien qui mélange deux styles sans raison ? »*

---

## Variante J+30 (fading)

**Même exercice, contraintes ajoutées — de mémoire, en 30 minutes, sans rouvrir le module :**

1. **Nouveau besoin B6 :** un dashboard interne d'observabilité doit recevoir **en continu** les métriques de complétion (flux serveur → client, plusieurs écrans admin ouverts). Choisis le style et justifie face à SSE **et** WebSocket.
2. **Contrainte de panne :** pour **chaque** besoin, écris en une ligne le **comportement de repli** si l'autre côté est indisponible (couplage temporel assumé). Distingue les cas où une valeur en cache/défaut suffit de ceux où l'échec doit remonter à l'utilisateur.
3. **Contrainte de contrat :** propose une **stratégie de versioning** unique et cohérente pour toutes les API REST de TribuZen (chemin ? header ? politique de dépréciation ?), en une ligne.

**Critère de réussite :** les six styles sont cohérents entre eux, chaque choix tient en une justification par trade-off, et aucune décision ne déborde sur l'async (module 17) ou le HTTP deep (cours 11).

---

## Application TribuZen

Dans le repo `smaurier/tribuzen`, ce lab ne produit **pas** de code mais un **ADR** (Architecture Decision Record) versionné :

```
tribuzen/
  docs/
    adr/
      0007-styles-de-communication.md   ← la synthèse des 5 (ou 6) décisions
```

**Ce que l'ADR consigne :**
- Le tableau besoin → style → justification (le résultat de tes fiches).
- La règle par défaut de l'équipe : « REST + endpoint d'agrégation en bordure, gRPC en interne perf-critique, SSE pour le push unidirectionnel, GraphQL réévalué quand un 2ᵉ front hétérogène apparaît ».
- La politique de **contrat** : compat ascendante obligatoire, versioning `/v1`→`/v2`, contract test en CI.

**Commit cible :**
```
docs(adr): 0007 styles de communication — REST/gRPC/SSE, bascule GraphQL, politique de contrat
```
