---
titre: Architecture frontend (composants, état, routing, fetching, rendu)
cours: 13-architecture
notions: ["découpage en composants (boundaries)", "container vs presentational", "composant headless", "atomic design comme vocabulaire", "error boundary comme frontière de résilience", "taxonomie de l'état (local / lifté / URL / serveur / global)", "état serveur vs état client", "data fetching (où fetcher, SWR, waterfall vs parallèle)", "routing comme structure d'application", "code splitting par route", "route guards", "stratégies de rendu CSR / SSR / SSG / ISR", "choix de rendu par type de route"]
outcomes:
  - "sait découper un écran en composants et placer les frontières (container/presentational, headless, error boundary) en justifiant chaque frontière"
  - "sait choisir où vit un morceau d'état (local, lifté, URL, serveur, global) avec la règle du scope minimal"
  - "sait distinguer état serveur et état client et refuser de recopier des données API à la main dans un store global"
  - "sait décider où et comment fetcher (route loader vs composant, SWR, parallèle vs waterfall) au niveau architecture"
  - "sait choisir une stratégie de rendu (CSR / SSR / SSG / ISR) par type de route et justifier l'archi hybride"
prerequis: ["Module 00 — posture d'architecte", "Module 01 — SOLID (SRP, DIP)", "Module 03 — clean code / code smells", "Module 04 — dependency injection / IoC", "Module 05 — architecture en couches", "Modules 06-07 — hexagonale / clean", "Module 11 — API design et backend patterns", "Module 13 — architecture données (cache, staleness)"]
next: 15-frontend-avance-micro-offline
libs: []
tribuzen: "front TribuZen — architecture de l'écran Tableau de bord famille : découpage composants, placement de l'état, data fetching, stratégie de rendu"
last-reviewed: 2026-07
---

# Architecture frontend (composants, état, routing, fetching, rendu)

> **Outcomes — tu sauras FAIRE :** découper un écran en composants avec des frontières justifiées, placer chaque morceau d'état au bon endroit, distinguer état serveur et état client, décider où/comment fetcher, et choisir une stratégie de rendu par type de route.
> **Difficulté :** :star::star::star:
>
> **Portée :** ce module raisonne **architecture frontend** — les **cinq décisions structurantes** d'une app front (composants, état, fetching, routing, rendu). On décide *où* les choses vivent et *pourquoi*, pas *comment* on les code ligne à ligne. L'**implémentation** React (hooks, JSX, composants), Vue (SFC, composables) et React Native est le sujet des **cours 02 / 03 / 04**. Le **HTTP caching, les ETag, le SWR au niveau protocole** relèvent du **cours 11** (ici on ne fait que placer la frontière cache/staleness). Le **design system** (tokens, atomes visuels, theming) est le **cours 21**. Le **frontend avancé** — micro-frontends, offline-first, sync — est le **module suivant (15)**.

## 1. Cas concret d'abord

Tu reprends le front de TribuZen. Un contributeur a livré l'écran **Tableau de bord famille** (`FamilyDashboard`) — l'écran d'accueil où un parent voit sa famille, les routines du jour et les séries (streaks) de chaque enfant. Voici, en pseudo-archi, ce qu'il a fait :

```
FamilyDashboard  (UN seul composant de 600 lignes)
  ├─ au montage : useEffect → fetch /family, PUIS fetch /routines, PUIS fetch /streaks
  ├─ TOUT l'état est poussé dans le store global Zustand :
  │     family, routines, streaks, openMenuId, isFilterOpen, searchText, currentTab
  ├─ le filtre « masquer routines terminées » est stocké global, pas dans l'URL
  ├─ rendu 100 % client (CSR) : page blanche puis spinner puis contenu
  └─ aucune error boundary : si /streaks plante, TOUT l'écran affiche une erreur
```

Ça marche en démo. Mais pose-toi cinq questions d'architecte :

1. **Frontières** — un seul composant de 600 lignes : impossible à tester par morceau, impossible à réutiliser la carte enfant ailleurs. Où sont les frontières de composants ?
2. **État** — pourquoi `openMenuId` (quel menu déroulant est ouvert) vit dans un store **global** partagé par toute l'app ? C'est un détail d'UI purement local.
3. **État serveur vs client** — `family`, `routines`, `streaks` sont des **copies de données serveur** recollées à la main dans Zustand. Qui les invalide ? Qui les rafraîchit ? Que se passe-t-il si deux écrans en ont besoin ?
4. **Fetching** — trois `fetch` **en cascade** (`family` puis `routines` puis `streaks`) alors qu'ils sont indépendants : l'écran attend 3× la latence réseau au lieu de 1×. C'est un **waterfall**.
5. **Rendu** — le tableau de bord est privé (derrière login), mais la page marketing `/` et la page publique `/famille/:invite` (page d'invitation partageable) sont rendues **pareil** : tout en CSR, donc mauvais SEO et premier affichage lent là où ça compte.

Ce contributeur a écrit du code qui **fonctionne** sans prendre **une seule décision d'architecture**. Ce module te donne les cinq décisions et leurs règles.

---

## 2. Théorie complète, concise

### 2.1 Le frontend est une architecture — cinq décisions

On croit souvent que « l'archi » s'arrête au backend. Faux. Un front a **cinq décisions structurantes**, indépendantes du framework (React, Vue, Angular, Svelte, RN) :

| Décision | Question | Mauvais défaut fréquent |
|----------|----------|-------------------------|
| **Composants** | Où sont les frontières ? Qui est réutilisable ? | Un composant géant « fourre-tout » |
| **État** | Où vit chaque morceau d'état ? | Tout dans un store global |
| **Fetching** | Où et comment charger les données ? | `useEffect` + waterfall |
| **Routing** | Comment la navigation structure l'app ? | Routes plates, tout dans le bundle initial |
| **Rendu** | CSR / SSR / SSG / ISR, par route ? | « Tout en CSR », ou « tout en SSR » |

Ces cinq décisions sont **orthogonales** : on les prend séparément, écran par écran. Le reste du module les déroule.

### 2.2 Découpage en composants : les frontières

Un composant est l'unité de **réutilisation** et d'**isolation** du front (c'est SRP à l'échelle UI, module 01). Trois frontières à connaître :

**a) Container vs presentational (conteneur vs présentation).** On sépare le composant qui **sait** (récupère les données, connaît le store, appelle l'API) du composant qui **montre** (reçoit des props, affiche, émet des événements). Le presentational est réutilisable et testable sans réseau ; le container branche tout.

```
FamilyDashboardContainer   ← sait : fetch, store, routing
   └─ passe des props ▼
ChildCard (presentational) ← montre : reçoit { child, streak }, émet onComplete
```

> C'est la version front de la **règle de dépendance** du module 05 : le presentational ne connaît ni l'API ni le store — il ne connaît que ses props.

**b) Headless (composant sans tête).** Un composant/hook **headless** encapsule la **logique** (état, interactions, accessibilité clavier, ARIA) **sans imposer de rendu**. Le consommateur fournit le visuel. Intérêt archi : la même logique (`useToggle`, `useDropdown`, `useDisclosure`) sert un menu, un accordéon, une modale — seul le rendu change. C'est de la **réutilisation par inversion** : la logique est stable, le style varie.

**c) Error boundary (frontière d'erreur).** Une frontière de résilience : si un composant **plante au rendu**, sa boundary affiche un fallback local au lieu de crasher tout l'écran. **Règle d'archi :** chaque **section autonome** (widget streaks, liste routines, menu latéral) a sa propre boundary. Un crash du widget « suggestions » ne doit pas tuer la liste des routines. C'est le pendant front du **bulkhead** (cloisonnement) vu côté distribué.

**Atomic design** (atoms → molecules → organisms → templates → pages) est un **vocabulaire** utile pour nommer les niveaux de composition, pas une loi. Retiens-le comme échelle de granularité ; le détail (les ~27 primitives, les tokens) est du ressort du **design system, cours 21**.

### 2.3 Où vit l'état ? La taxonomie

**La** décision front la plus ratée. Il n'y a pas « local vs global » : il y a **cinq emplacements**, du plus petit scope au plus grand. **Règle d'or : le scope le plus petit qui marche.**

| Emplacement | Pour quoi | Exemple TribuZen |
|-------------|-----------|------------------|
| **Local** (dans le composant) | UI éphémère, ne concerne qu'un composant | menu déroulant ouvert, valeur d'un input |
| **Lifté** (remonté au parent commun) | partagé entre 2-3 composants frères | étape courante d'un formulaire multi-écran |
| **URL** (params / query string) | état qui doit être **partageable, bookmarkable, dans l'historique** | filtre « enfant sélectionné », onglet actif, recherche |
| **Serveur** (voir 2.4) | données qui **appartiennent au serveur** | family, routines, streaks |
| **Global** (store type Zustand/Pinia) | vraiment transverse à l'app, sans propriétaire naturel | utilisateur connecté, thème, locale |

Deux emplacements sont systématiquement oubliés :

- **L'URL est un état.** Un filtre, un onglet, une pagination doivent souvent vivre **dans l'URL** : ainsi la vue est partageable (copier le lien), survit au rafraîchissement, et participe au bouton « précédent ». Mettre ça dans un store global casse tout ça.
- **L'état serveur n'est pas de l'état global** (section suivante).

Le **global** est le **dernier recours**, pas le défaut. `openMenuId` dans un store global (cas concret §1) est une faute : c'est de l'état **local**.

### 2.4 État serveur ≠ état client

Distinction majeure, mal comprise. Les données qui viennent de l'API (`family`, `routines`) ne sont pas « ton état » : ce sont un **cache local d'une vérité qui vit sur le serveur**. Elles ont des propriétés qu'un `useState` ou un store global n'a pas :

- elles peuvent devenir **périmées** (stale) — le serveur a changé depuis ;
- elles doivent être **revalidées**, **dédupliquées** (deux composants demandent `/family` → une seule requête), **mises en cache**, **invalidées** après une mutation ;
- elles ont des états **loading / error / success** intrinsèques.

Recopier ça **à la main** dans Zustand (cas concret §1) = réécrire un mauvais moteur de cache. La bonne décision d'archi : une **couche d'état serveur dédiée** (bibliothèque de type *server-state* : React Query / TanStack Query, SWR, ou les *loaders* du routeur) qui gère cache, dédup, revalidation, invalidation. Le store global ne garde alors **que le vrai état client** (auth, thème, préférences UI).

> **Frontière avec le cours 11 :** *comment* le cache HTTP fonctionne (ETag, `Cache-Control`, `stale-while-revalidate` au sens header, 304) est le **cours 11**. Ici, décision d'archi : **« les données serveur vivent dans la couche server-state, pas dans le store client »**. On place la frontière, on ne recode pas le protocole.

### 2.5 Data fetching : où et comment

Trois décisions d'archi sur le chargement :

**a) Où déclencher le fetch ?**
- **Au niveau de la route (loader)** : le routeur charge les données **avant** d'afficher l'écran. Évite le « spinner en cascade » et le waterfall. Pattern des routeurs modernes (loaders de React Router, `loader`/`load` de Remix/SvelteKit, Server Components de Next).
- **Au niveau du composant** (via la couche server-state) : le composant qui **a besoin** de la donnée la demande ; la dédup évite les doublons. Plus simple, colocalisé, mais peut créer des waterfalls si mal fait.

**b) Parallèle vs waterfall.** Un **waterfall** = des requêtes **séquentielles alors qu'elles sont indépendantes** (cas concret §1 : family → routines → streaks). Coût = somme des latences. La règle : **si A ne dépend pas de B, lance-les en parallèle** (coût = max des latences). On n'enchaîne que les dépendances réelles (il faut l'`id` famille pour charger ses routines).

**c) SWR (stale-while-revalidate), au sens UX.** Servir **immédiatement** la donnée en cache (même périmée) pendant qu'on **revalide en fond**, puis mettre à jour silencieusement. L'écran est instantané à la 2ᵉ visite. Décision : quelles données tolèrent le « brièvement périmé » (streaks : oui) vs lesquelles exigent le frais garanti (solde de paiement : non).

> **Annulation & retry** (AbortController sur démontage/changement de route, backoff exponentiel, ne pas retry les 4xx sauf 429) sont fournis par la couche server-state. Décision d'archi : **déléguer** ça à la lib, ne pas le réécrire à la main dans chaque `useEffect`.

### 2.6 Routing : la structure de l'application

L'arbre de routes **est** la carte de l'application. Trois décisions d'archi :

**a) L'arbre de routes reflète la structure, pas les menus.** Les breadcrumbs (fil d'Ariane) et la hiérarchie se déduisent des **routes** (stables), pas des menus (qui bougent). `/famille/:id/enfant/:childId/routines` porte la hiérarchie réelle.

**b) La route est une frontière de code splitting.** Chaque route charge son code **à la demande** (lazy). Le bundle initial ne contient pas l'écran admin quand on est sur l'accueil. La route est le **point de découpe** naturel du bundle → premier chargement plus léger.

**c) Les guards protègent l'accès, dans l'ordre.** `restaurer session → route authentifiée ? → rôle suffisant (RBAC) ? → autoriser`. L'ordre compte : vérifier le rôle avant d'avoir restauré la session redirige à tort un utilisateur pourtant connecté. La route porte des **métadonnées** (`requiresAuth`, `roles`, `noIndex`, `title`) qui pilotent guards et SEO.

> Certaines infos d'état vivent naturellement **dans la route** (l'`id` de la famille, l'onglet actif). C'est le lien avec 2.3 : l'URL est un emplacement d'état de plein droit.

### 2.7 Stratégies de rendu : CSR / SSR / SSG / ISR

**Où** et **quand** le HTML est produit. Quatre stratégies :

| Stratégie | Où / quand | SEO | 1er affichage | Données |
|-----------|-----------|-----|---------------|---------|
| **CSR** (Client-Side Rendering) | navigateur, au chargement du JS | mauvais | lent (JS d'abord) | temps réel, privé |
| **SSR** (Server-Side Rendering) | serveur, **à chaque requête** | excellent | rapide | temps réel |
| **SSG** (Static Site Generation) | build, **une fois** | excellent | très rapide (CDN) | figées au build |
| **ISR** (Incremental Static Regeneration) | build + **régénération** périodique/à la demande | excellent | très rapide (cache) | quasi temps réel |

**La décision est PAR TYPE DE ROUTE, pas globale.** C'est l'**architecture hybride** : on classe chaque écran.

```
Route TribuZen               Stratégie   Pourquoi
──────────────               ─────────   ───────────────────────────────
/ (landing marketing)        SSG         immuable, SEO, ultra rapide
/famille/:invite (invitation SSR / ISR   SEO + partageable, contenu semi-public
   partageable)
/dashboard (tableau de bord) CSR         privé, derrière login, pas de SEO
/enfant/:id (fiche privée)   CSR         privé, très interactif
/blog/:slug (si blog)        ISR (1h)    SEO, rarement modifié
```

Le **critère** :
- **public + SEO important + contenu stable** → SSG (ou ISR si ça évolue) ;
- **public + SEO + contenu dynamique par requête** → SSR ;
- **privé, derrière auth, très interactif, pas de SEO** → CSR suffit (inutile de payer le coût SSR).

> **Frontière :** l'**hydration** (rendre interactif le HTML serveur), les stratégies d'hydration partielle/islands, la prévention du FOUC, le rendu avancé (streaming, RSC) sont approfondis côté implémentation (**cours 04 Next/Nuxt**) et en partie au **module 15**. Ici : savoir **choisir la stratégie par route** et justifier l'hybride.

---

## 3. Worked examples

### Exemple 1 — Ré-architecturer l'écran `FamilyDashboard` du §1

On reprend le monolithe de 600 lignes et on applique les cinq décisions. **On ne code pas l'impl React/Vue** (cours 02/03/04) : on produit le **plan d'architecture**.

**Décision 1 — Composants (frontières) :**

```
FamilyDashboardContainer            ← container : orchestre données + routing
  ├─ <ErrorBoundary>                ← résilience : isole la section streaks
  │    └─ StreaksWidget             ← organism (server-state : useStreaks)
  ├─ <ErrorBoundary>
  │    └─ RoutineList               ← organism (server-state : useRoutines)
  │         └─ RoutineRow           ← presentational (props: routine, onComplete)
  ├─ ChildSelector                  ← molecule, headless (useSelect) + rendu
  └─ FilterBar                      ← molecule ; état filtre → URL (query string)
```

Justification : `RoutineRow` est **presentational** (réutilisable dans la fiche enfant), chaque widget de données a **sa** boundary (un crash streaks ne tue pas la liste), `ChildSelector` réutilise un hook **headless** partagé.

**Décision 2 — État (placement) :**

| État | Avant | Après | Pourquoi |
|------|-------|-------|----------|
| `openMenuId` | global | **local** au composant menu | UI éphémère, aucun partage |
| `enfant sélectionné` | global | **URL** (`?child=c1`) | partageable, survit au refresh, historique |
| `filtre routines terminées` | global | **URL** (`?done=hidden`) | idem, bookmarkable |
| `family / routines / streaks` | global (copié main) | **server-state** (couche dédiée) | données serveur, cache/dédup/revalidation |
| `utilisateur connecté / thème` | global | **global** (légitime) | transverse, sans propriétaire |

**Décision 3 — Fetching :** family, routines, streaks sont **indépendants une fois l'id famille connu** → **parallèle**, pas waterfall. Chargement via **loader de route** (l'id famille vient de l'URL) + couche server-state pour dédup/cache/SWR. Les streaks tolèrent le « brièvement périmé » → SWR ; on les sert du cache et on revalide en fond.

**Décision 4 — Routing :** `/famille/:familyId/dashboard`, code splitting sur cette route (lazy), guard `requiresAuth` + `restaurer session` d'abord. Le `:familyId` porte l'état « quelle famille ».

**Décision 5 — Rendu :** `/dashboard` est **privé** → **CSR** suffit (aucun SEO à gagner, payer du SSR serait du gâchis). En revanche `/famille/:invite` (page d'invitation partagée par lien) → **SSR/ISR** pour un premier affichage rapide et un aperçu correct quand on colle le lien.

**Ce que le refactor achète :** widgets testables isolément, URL partageable, un seul moteur de cache (la lib), 1× la latence réseau au lieu de 3×, et une stratégie de rendu adaptée à chaque route au lieu d'un « CSR partout » subi.

### Exemple 2 — Table de décision « stratégie de rendu » pour TribuZen

On te demande de trancher le rendu de cinq écrans. Méthode : trois questions — *public ? SEO utile ? contenu stable ?*

| Écran | Public ? | SEO utile ? | Stable ? | Décision | Raison |
|-------|----------|-------------|----------|----------|--------|
| Landing `/` | oui | oui (acquisition) | oui | **SSG** | figé, servi par CDN, rapide |
| Page « fonctionnalités » `/features` | oui | oui | oui | **SSG** | contenu éditorial rare |
| Invitation `/famille/:invite` | semi (avec token) | partiel (aperçu lien) | non (données famille) | **SSR** | rendu frais + partageable |
| Aide `/aide/:article` | oui | oui | change ~mensuel | **ISR (24 h)** | SEO + régénération sans rebuild total |
| Tableau de bord `/dashboard` | non (auth) | non | non | **CSR** | privé, interactif ; SSR = coût inutile |

Verdict : **archi hybride** — trois stratégies coexistent dans la même app. Le piège serait d'imposer une seule stratégie « pour faire simple ».

---

## 4. Pièges & misconceptions

### PIÈGE #1 — « Tout dans le store global, c'est plus simple »

Faux. Un store global pour `openMenuId` ou un filtre d'écran, c'est de l'état local/URL mal placé : ça crée du couplage (n'importe quel composant peut muter n'importe quoi), casse la réutilisation, et rend le débogage infernal (« qui a changé cette valeur ? »). **Règle : scope minimal.** Le global est le dernier recours, réservé au vraiment transverse (auth, thème, locale).

### PIÈGE #2 — Confondre état serveur et état client

Le piège le plus coûteux. Recopier les données API à la main dans Zustand/Pinia, c'est réécrire un moteur de cache — sans invalidation, sans dédup, sans revalidation. Résultat : données périmées, requêtes dupliquées, bugs de synchro. **Correct :** les données serveur vivent dans une **couche server-state** (React Query, SWR, loaders) ; le store client ne garde que le vrai état client.

### PIÈGE #3 — La fausse dichotomie « prop drilling vs store global »

« Passer des props sur 4 niveaux, c'est pénible, donc je mets tout en global. » Faux dilemme. Entre les deux : **l'URL** (pour l'état partageable), la **composition** (passer des composants en `children`/slots plutôt que des props), et le **contexte local** limité à un sous-arbre. Le global n'est pas la seule alternative au prop drilling.

### PIÈGE #4 — Le waterfall de requêtes

Enchaîner des `fetch` séquentiels alors qu'ils sont indépendants (family → routines → streaks) multiplie la latence perçue. **Correct :** identifier les **dépendances réelles** (il faut l'id famille pour ses routines) et paralléliser tout le reste. Un loader de route qui lance les requêtes indépendantes en parallèle règle ça.

### PIÈGE #5 — « SSR partout = plus performant / meilleur »

Non. Le SSR a un coût serveur (rendu à chaque requête) et une complexité (hydration, sérialisation d'état). Sur un écran **privé, derrière login, sans SEO** (un tableau de bord), le SSR n'apporte **rien** que le CSR ne fasse déjà, et coûte plus cher. **Correct :** SSR/SSG/ISR pour le **public à SEO** ; CSR suffit pour le **privé interactif**. La décision est par route.

### PIÈGE #6 — Une seule error boundary tout en haut (ou aucune)

Mettre une unique boundary au sommet de l'app = un crash d'un widget mineur affiche une page d'erreur pleine. Pas de boundary du tout = un crash tue toute l'app. **Correct :** une boundary par **section autonome** (bulkhead front). Le widget « suggestions » qui plante affiche un fallback local ; la liste des routines continue de fonctionner.

### PIÈGE #7 — « Code splitting = ajouter `lazy()` partout »

Le code splitting sans réflexion sur les **frontières** produit soit trop de micro-chunks (surcoût de requêtes), soit des chunks mal découpés. **Correct :** la **route** est la frontière de découpe naturelle (on ne charge un écran que quand on y navigue). Découper plus fin (composant lourd rarement affiché, ex. un éditeur riche) se **décide**, ne se saupoudre pas.

---

## 5. Ancrage TribuZen

TribuZen a un **front web** (Vue/Nuxt côté marketing + app) et une **app mobile React Native** (cœur du produit famille). Les cinq décisions se posent à chaque écran. Le fil rouge de ce module : l'écran **Tableau de bord famille**.

Décisions d'architecture retenues pour TribuZen :

- **Composants :** `RoutineRow` et `ChildCard` sont **presentational** (mêmes composants sur le dashboard web et la fiche enfant) ; `StreaksWidget`, `RoutineList`, `SuggestionsWidget` ont chacun **leur error boundary** (le widget « suggestions IA », le plus fragile, ne doit jamais faire tomber la liste des routines) ; `useDisclosure` headless partagé entre menus, modales et le tiroir de filtres.
- **État :** l'**enfant sélectionné** et le **filtre routines** vivent dans **l'URL** (`/dashboard?child=c1&done=hidden`) — un parent peut envoyer le lien exact à l'autre parent. Le **thème** et l'**utilisateur connecté** sont **globaux**. `family`/`routines`/`streaks` sont en **server-state** (React Query côté RN, avec persistance).
- **Fetching :** au retour dans l'app, on **sert le cache** (SWR) puis on revalide — le tableau de bord est instantané. Les requêtes family/routines/streaks partent **en parallèle** une fois l'id famille connu.
- **Rendu :** landing et pages marketing en **SSG/ISR** (Nuxt) pour le SEO ; l'app et le dashboard en **CSR** (privés) ; la page d'**invitation partageable** en **SSR** pour un aperçu correct du lien.

> **Défère :** l'implémentation Vue/Nuxt (SFC, composables, `<script setup>`) est le **cours 02**, React le **cours 03**, React Native / Next/Nuxt le **cours 04**. Le **cache HTTP** (ETag, `Cache-Control`) qui sous-tend le SWR est le **cours 11**. Les **tokens et atomes visuels** du dashboard sont le **cours 21**. La **sync offline** (MMKV, file de mutations au retour réseau) est le **module 15**. Ici, on a seulement **décidé** où vit chaque chose.

---

## 6. Points clés

1. Le frontend a **cinq décisions d'architecture** orthogonales : composants, état, fetching, routing, rendu — prises écran par écran.
2. **Frontières de composants :** container (sait) vs presentational (montre), headless (logique sans rendu, réutilisable), error boundary par **section autonome** (bulkhead front).
3. **État — cinq emplacements**, règle du **scope minimal** : local < lifté < **URL** < serveur < global. L'URL est un état ; le global est le dernier recours.
4. **État serveur ≠ état client :** les données API sont un cache d'une vérité serveur → **couche server-state** dédiée (cache, dédup, revalidation), jamais recopiées à la main dans le store client.
5. **Fetching :** décider **où** (loader de route vs composant), **paralléliser** ce qui est indépendant (éviter le waterfall), servir en **SWR** ce qui tolère le périmé.
6. **Routing :** l'arbre de routes est la structure de l'app ; la route est la **frontière de code splitting** ; guards **ordonnés** (session → auth → rôle).
7. **Rendu :** CSR / SSR / SSG / ISR se choisissent **par type de route** (public + SEO + stabilité) → **archi hybride**. « Tout SSR » ou « tout CSR » est un anti-choix.
8. On **décide** l'architecture ici ; l'implémentation React/Vue/RN (cours 02/03/04), le cache HTTP (cours 11), le design system (cours 21) et l'offline/micro-front (module 15) sont **déférés**.

---

## 7. Seeds Anki

```
Quelles sont les 5 décisions d'architecture d'un frontend ?|Composants (frontières), état (placement), data fetching (où/comment), routing (structure + code splitting), rendu (CSR/SSR/SSG/ISR). Orthogonales, prises écran par écran.
Différence entre composant container et presentational ?|Le container SAIT (fetch, store, routing) ; le presentational MONTRE (reçoit des props, affiche, émet des événements). Le presentational est réutilisable et testable sans réseau — version front de la règle de dépendance.
Qu'est-ce qu'un composant headless ?|Un composant/hook qui encapsule la logique (état, interactions, accessibilité ARIA/clavier) SANS imposer de rendu. Le consommateur fournit le visuel. Réutilisation par inversion : une logique, plusieurs rendus (menu, accordéon, modale).
Quels sont les 5 emplacements de l'état front et la règle ?|Local < lifté (remonté) < URL < serveur < global. Règle du scope minimal : le plus petit scope qui marche. L'URL est un état (partageable/bookmarkable) ; le global est le dernier recours (auth, thème, locale).
Pourquoi l'état serveur n'est-il pas de l'état client ?|Les données API sont un cache d'une vérité qui vit sur le serveur : elles périment, doivent être revalidées, dédupliquées, invalidées après mutation, et ont des états loading/error. On les met dans une couche server-state (React Query/SWR/loaders), pas recopiées à la main dans un store global.
Qu'est-ce qu'un waterfall de requêtes et comment l'éviter ?|Des requêtes séquentielles alors qu'elles sont indépendantes (family → routines → streaks) : coût = somme des latences. On paralllélise tout ce qui n'a pas de dépendance réelle (coût = max des latences) ; on n'enchaîne que les vraies dépendances.
Comment choisit-on une stratégie de rendu (CSR/SSR/SSG/ISR) ?|Par type de route, selon 3 questions : public ? SEO utile ? contenu stable ? Public+SEO+stable → SSG (ou ISR si ça évolue) ; public+SEO+dynamique → SSR ; privé+interactif+pas de SEO → CSR. Résultat : archi hybride.
Où placer les error boundaries dans un écran ?|Une par section autonome (widget streaks, liste routines, suggestions) — bulkhead front. Une seule au sommet = un crash mineur affiche une page d'erreur pleine ; aucune = un crash tue toute l'app.
Pourquoi mettre un filtre ou l'onglet actif dans l'URL plutôt qu'un store global ?|L'URL rend l'état partageable (copier le lien), bookmarkable, survivant au rafraîchissement, et intégré à l'historique (bouton précédent). Un store global casse tout ça et couple l'app.
```

---

## Pont vers le lab

> Lab associé : `labs/lab-14-architecture-frontend/README.md`. Concevoir l'architecture front d'un écran TribuZen : découpage en composants (frontières), placement de chaque morceau d'état, plan de data fetching, stratégie de rendu — le tout justifié. Exercice de conception, évalué par grille + coach, variante J+30. Zéro harnais.
