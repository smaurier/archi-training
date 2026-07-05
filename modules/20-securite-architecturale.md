---
titre: Sécurité architecturale (threat modeling, zero-trust, privacy by design)
cours: 13-architecture
notions: ["threat modeling", "STRIDE (Spoofing, Tampering, Repudiation, Information Disclosure, DoS, Elevation of Privilege)", "data flow diagram", "trust boundary (frontière de confiance)", "zero-trust (never trust, always verify)", "assume breach", "least privilege (moindre privilège)", "defense in depth (défense en profondeur)", "placement des contrôles de sécurité", "privacy by design (Cavoukian)", "minimisation des données", "privacy par défaut (opt-in)"]
outcomes:
  - "sait dérouler un threat model STRIDE sur une feature à partir d'un data flow diagram et de ses trust boundaries"
  - "sait décider OÙ placer un contrôle de sécurité dans l'architecture (à quelle couche, à quelle frontière)"
  - "sait appliquer les principes zero-trust (never trust always verify, least privilege, assume breach) au niveau architectural"
  - "sait raisonner en défense en profondeur (plusieurs contrôles indépendants) plutôt qu'en périmètre unique"
  - "sait intégrer la privacy by design dès la conception (minimisation, privacy par défaut) sur des données sensibles"
prerequis: ["Modules 00-19 du cours 13", "Module 05 — architecture en couches (placement des responsabilités)", "Module 06/07 — hexagonale/clean (frontières)", "Module 08 — monolithe modulaire vs microservices (frontières réseau)", "Module 16/17 — communication et event-driven (points d'intégration à protéger)"]
next: 21-performance-scalabilite
libs: []
tribuzen: "sécurité transverse de TribuZen — threat model de la feature Journal familial, placement des contrôles d'accès Level 1/2, privacy by design sur les données d'enfants"
last-reviewed: 2026-07
---

<!-- FLAG-REVIEW: SÉCURITÉ (archi) — à valider par Sylvain -->

# Sécurité architecturale (threat modeling, zero-trust, privacy by design)

> **Outcomes — tu sauras FAIRE :** dérouler un threat model STRIDE sur une feature, décider où placer chaque contrôle de sécurité dans l'archi, appliquer zero-trust et défense en profondeur, et intégrer la privacy by design dès la conception.
> **Difficulté :** :star::star::star:
>
> **Portée :** ce module traite la sécurité **au niveau architecture** — *où* placer les contrôles, *quelles* menaces modéliser, *quelles* frontières de confiance tracer. Il **ne** traite **pas** l'implémentation défensive détaillée (XSS, CSRF, injection SQL, headers de sécurité, CSP, crypto, hachage de mots de passe, configuration OAuth) : tout ce **deep applicatif est déféré au cours 14 (sécurité)**. Ici on raisonne threat modeling, zero-trust, défense en profondeur, privacy by design et **placement**. On ne durcit pas une ligne de code : on décide de la topologie des contrôles.

## 1. Cas concret d'abord

TribuZen ajoute le **Journal familial** : chaque membre (parents, ados, enfants) poste des notes, photos et humeurs partagées dans la famille. Un contributeur propose l'archi suivante, « on sécurisera après » :

```
Navigateur / mobile ──▶ API NestJS ──▶ PostgreSQL
                         (une route POST /journal, une route GET /journal/:familyId)
```

Le code marche en démo. Mais pose-toi les questions d'un attaquant, feature par feature :

1. **Qui prouve son identité ?** Rien dans le schéma ne dit que l'appelant est bien un membre de *cette* famille. `GET /journal/42` — et `GET /journal/43` renvoie le journal d'une **autre** famille (donc des notes d'enfants inconnus). C'est une menace d'**Information Disclosure**.
2. **Où sont les données sensibles ?** Des notes et photos **d'enfants**. C'est la donnée la plus sensible du produit. Est-elle chiffrée ? Qui peut la lire côté ops ? Combien de temps est-elle conservée ? Le schéma ne répond à rien.
3. **Où placer le contrôle d'accès ?** Dans le controller ? Dans le service ? À la frontière réseau ? Dans la base ? « On mettra un `if` quelque part » n'est pas une décision d'architecture.
4. **Que se passe-t-il si un composant est compromis ?** Si l'API est piratée, l'attaquant atteint-il **toute** la base, ou seulement un périmètre réduit ?

« Sécuriser après » est une illusion : la sécurité n'est pas une fonctionnalité qu'on ajoute, c'est une **propriété de l'architecture**. Ce module te donne trois outils pour la concevoir *avant* : le **threat modeling STRIDE** (quelles menaces ?), le **zero-trust + la défense en profondeur** (où placer les contrôles ?), et la **privacy by design** (comment traiter la donnée sensible dès le départ ?).

---

## 2. Théorie complète, concise

### 2.1 Trois questions, trois outils

La sécurité architecturale répond à trois questions distinctes. Ne les confonds pas :

| Question | Outil | Section |
|----------|-------|---------|
| **Contre quoi** dois-je me défendre ? | Threat modeling (STRIDE) | 2.2-2.4 |
| **Où** je place mes contrôles ? | Zero-trust + défense en profondeur | 2.5-2.7 |
| **Comment** je traite la donnée sensible ? | Privacy by design | 2.8 |

### 2.2 Threat modeling : penser en attaquant, tôt

Le **threat modeling** (modélisation des menaces) est un exercice de conception : avant de coder, on liste **systématiquement** ce qui peut mal tourner, et on décide d'une parade pour chaque menace crédible. Quatre questions guides (cadre de Shostack) :

1. **Sur quoi je travaille ?** → un schéma du système (le data flow diagram, §2.4).
2. **Qu'est-ce qui peut mal tourner ?** → l'énumération des menaces (STRIDE, §2.3).
3. **Qu'est-ce que je fais contre ?** → les contrôles / mitigations.
4. **Est-ce que j'ai bien fait ?** → la revue.

Le but n'est pas la paranoïa exhaustive : c'est de rendre les menaces **explicites et priorisées** au moment où corriger coûte le moins cher — sur le tableau blanc, pas en production.

### 2.3 STRIDE : une taxonomie de menaces

**STRIDE** est un modèle de **Microsoft** (pas OWASP) qui donne six catégories de menaces. À chaque catégorie correspond une **propriété de sécurité** violée, ce qui aide à ne rien oublier :

| Lettre | Menace | Propriété violée | Question à se poser |
|--------|--------|------------------|---------------------|
| **S** | Spoofing (usurpation d'identité) | Authentification | Qui prouve être qui il prétend ? |
| **T** | Tampering (falsification) | Intégrité | Les données peuvent-elles être altérées en transit ou au repos ? |
| **R** | Repudiation (déni) | Non-répudiation | Peut-on nier avoir fait une action ? |
| **I** | Information Disclosure (fuite) | Confidentialité | Des données sensibles peuvent-elles fuir ? |
| **D** | Denial of Service (déni de service) | Disponibilité | Le service peut-il être saturé / rendu indisponible ? |
| **E** | Elevation of Privilege (escalade) | Autorisation | Un utilisateur peut-il obtenir plus de droits que prévu ? |

STRIDE se déroule **par élément** du schéma (chaque processus, chaque flux, chaque stockage) et surtout **à chaque frontière de confiance** (§2.4). C'est une checklist de créativité, pas une preuve : elle t'oblige à te poser les six questions au lieu d'oublier celles auxquelles tu ne penses pas naturellement.

> **Lien avec OWASP :** STRIDE catégorise les *menaces* ; l'**OWASP Top 10** classe les *vulnérabilités web les plus répandues*. La catégorie architecturale la plus liée à ce module est **A04:2021 – Insecure Design** (les failles nées d'un manque de threat modeling, pas d'un bug d'implémentation) ainsi que **A01:2021 – Broken Access Control**. Le **détail** de chaque vulnérabilité OWASP et sa parade code relèvent du **cours 14**.

### 2.4 Data flow diagram et trust boundaries

Tu ne peux modéliser les menaces que sur un **schéma**. Le support canonique est le **data flow diagram (DFD)** : les *processus* (services), les *flux de données* (flèches), les *stockages* (bases), les *entités externes* (utilisateur, tiers) — et surtout les **trust boundaries**.

Une **trust boundary** (frontière de confiance) est une ligne franchie par une donnée qui **change de niveau de confiance** : Internet → ton API, ton API → ta base, ton service → un service tiers. **Chaque traversée de frontière est un point d'inspection obligatoire** : c'est là qu'on authentifie, valide, autorise, journalise.

```
┌─ ZONE NON FIABLE (client / Internet) ─────────────────┐
│   Navigateur, app mobile — code hors de ton contrôle   │
└───────────────────────────┬───────────────────────────┘
============ TRUST BOUNDARY (bord réseau) ================
┌───────────────────────────▼───────────────────────────┐
│   ZONE APPLICATIVE : API NestJS                         │
│   authN + validation d'entrée + authZ + rate limiting   │
└───────────────────────────┬───────────────────────────┘
============ TRUST BOUNDARY (réseau interne) =============
┌───────────────────────────▼───────────────────────────┐
│   ZONE DONNÉES : PostgreSQL (chiffré au repos)          │
└───────────────────────────────────────────────────────┘
```

Retiens la règle : **le contrôle se place à la frontière, pas à l'intérieur de la zone**. Un `if` de sécurité enfoui dans une fonction utilitaire, loin de la frontière, est facile à contourner par un autre chemin d'appel.

### 2.5 Zero-trust : « never trust, always verify »

Le modèle historique est **périmétrique** (château fort) : un mur (firewall) sépare le « dehors hostile » du « dedans fiable ». Défaut fatal : dès qu'un attaquant franchit le mur, il se déplace **latéralement** (lateral movement) et atteint tout, parce que l'intérieur se fait confiance implicitement.

Le **zero-trust** inverse le principe : **aucun réseau, appareil ou appelant n'est fiable par défaut, même en interne**. Trois piliers architecturaux (le détail crypto/mTLS/OAuth = cours 14) :

- **Never trust, always verify** : chaque requête est authentifiée **et** autorisée, y compris entre deux services internes. Être « dans le réseau » ne prouve rien.
- **Least privilege** (moindre privilège) : chaque acteur (utilisateur, service, token) reçoit le **minimum** de droits nécessaires. Pas de « super-compte peut tout ». Un service qui ne fait que lire n'a pas le droit d'écrire.
- **Assume breach** (présumer la compromission) : conçois comme si l'attaquant était **déjà** dedans. Objectif : minimiser le **blast radius** (rayon d'impact) d'un composant compromis via des frontières internes (segmentation).

Zero-trust est une **posture architecturale**, pas un produit qu'on achète : elle dicte *où* placer les vérifications d'identité et de droits (à **chaque** frontière), pas seulement à l'entrée.

### 2.6 Défense en profondeur (defense in depth)

La **défense en profondeur** empile **plusieurs contrôles indépendants**, de sorte que la défaillance d'un seul ne compromet pas le système. Aucune couche n'est supposée parfaite ; c'est leur **superposition** qui protège.

Exemple sur « lire le journal d'une famille » — quatre contrôles indépendants :

1. **Bord réseau** : rate limiting (contre le DoS / l'énumération).
2. **Entrée API** : authentification (le token est-il valide ?).
3. **Couche application** : autorisation (ce membre appartient-il à *cette* famille ?).
4. **Couche données** : chiffrement au repos + moindre privilège du compte DB (une fuite de la base seule ne donne pas le clair).

Si l'autorisation (3) a un bug, le chiffrement (4) limite encore les dégâts. **Un seul contrôle = un seul point de défaillance.** C'est le pendant sécurité du principe de redondance.

### 2.7 Où placer les contrôles : la carte de décision

La question la plus « archi » du module : **à quelle couche / frontière vit chaque type de contrôle ?** Réponse par défaut :

| Contrôle | Où le placer | Pourquoi |
|----------|--------------|----------|
| **Authentification** (qui es-tu ?) | À la **frontière d'entrée** (bord réseau / guard API) | Point de passage unique, avant tout traitement |
| **Validation d'entrée** (format bien formé ?) | Couche **présentation** (DTO) | Rejeter tôt les entrées malformées |
| **Autorisation** (as-tu le droit sur *cette* ressource ?) | Couche **application/domaine** | Dépend de la **règle métier** (appartenance famille, rôle) — pas un détail HTTP |
| **Rate limiting** | **Bord réseau** / gateway | Absorber avant que le coût atteigne l'app |
| **Chiffrement au repos** | Couche **infrastructure/données** | Détail de stockage, transparent pour le domaine |
| **Journalisation d'audit** (qui a fait quoi) | Couche **application** | Capturer l'intention métier, pas le bruit HTTP |

Le piège classique (§4) : mettre l'**autorisation** au mauvais endroit. L'authentification est générique et vit à l'entrée ; l'**autorisation fine** (« ce parent peut-il lire le journal de CET enfant ? ») est une **règle métier** et vit dans le domaine/application — jamais dispersée dans des `if` de controller. On rejoint le module 05 : ranger le contrôle à la couche dont c'est la responsabilité.

### 2.8 Privacy by design (et la donnée sensible)

La sécurité protège le système ; la **privacy** protège la **personne**. Sur des données d'enfants, c'est central. La **privacy by design** (Ann Cavoukian) dit : la vie privée s'**intègre dès la conception**, pas en rustine (« bolt-on ») après coup. Les principes architecturalement actionnables :

- **Proactif, pas réactif** : le threat model inclut les risques *vie privée* (une fuite de journal d'enfant est un risque privacy majeur), pas seulement les risques techniques.
- **Privacy par défaut (opt-in)** : la configuration la plus protectrice est la valeur par défaut. On ne collecte / partage rien sans action explicite de l'utilisateur (opt-in), jamais l'inverse (opt-out).
- **Minimisation des données** : on ne collecte et ne conserve que le **strict nécessaire**. Pas de « on garde tout au cas où ». Moins de données = moins de surface de fuite (ça réduit directement le « I » de STRIDE).
- **Sécurité de bout en bout** : chiffrement au repos et en transit, pseudonymisation quand l'identité n'est pas nécessaire (ex. analytics sans PII).
- **Visibilité / transparence + respect de l'utilisateur** : droit d'accès et droit à l'effacement pensés comme des **capacités d'architecture** (pouvoir vraiment purger une donnée, y compris chez les sous-traitants), pas comme une promesse juridique.

> Le **détail réglementaire** (RGPD article par article, rétention exacte, CMP/consentement, droit à l'oubli technique) et l'**implémentation** relèvent du **cours 14**. Ici : la privacy est une **contrainte de conception** qui influence la topologie (où vit la donnée sensible, qui peut la lire, combien de temps).

---

## 3. Worked examples

### Exemple 1 — Threat model STRIDE de « lire le journal familial »

On reprend le cas du §1. **Étape 1 — le DFD** avec sa frontière de confiance :

```
[Membre] --(1) GET /journal/:familyId--> || TRUST BOUNDARY || --> [API journal] --(2)--> [DB journal]
```

**Étape 2 — STRIDE, catégorie par catégorie, à la frontière :**

| Menace | Scénario concret TribuZen | Contrôle (et OÙ) |
|--------|---------------------------|------------------|
| **S** Spoofing | Un inconnu se fait passer pour un membre | AuthN à la **frontière d'entrée** (token vérifié avant tout) |
| **T** Tampering | Un membre modifie l'`authorId` d'une note pour l'attribuer à un autre | Autorité côté serveur : l'`authorId` vient du token, **jamais** du body → règle **domaine** |
| **R** Repudiation | Un ado nie avoir supprimé une note partagée | **Audit log** applicatif (qui, quoi, quand) |
| **I** Information Disclosure | `GET /journal/43` renvoie le journal d'une **autre** famille | **Autorisation** : vérifier appartenance à *cette* famille → couche **application/domaine** ; + chiffrement au repos (couche données) |
| **D** Denial of Service | Énumération massive de `familyId` | **Rate limiting** au bord réseau |
| **E** Elevation of Privilege | Un enfant (rôle `reader`) réussit à poster/supprimer | Contrôle de **rôle** (least privilege) en couche application |

**Étape 3 — priorisation.** La menace la plus grave ici est **I (Information Disclosure)** : c'est un accès à des données d'enfants d'autres familles (Broken Access Control, A01). Elle se corrige par un contrôle d'**autorisation** placé en couche application — exactement le défaut du §1 (aucune vérification d'appartenance).

**Étape 4 — revue.** On note explicitement que le contrôle d'`authorId` (T) et le contrôle d'appartenance (I) vivent dans le **domaine**, pas le controller : réutilisables, testables sans HTTP, contournement impossible par un autre point d'entrée (le futur job de sync offline).

### Exemple 2 — Placer les contrôles en défense en profondeur

On te demande : « où mets-tu la sécurité pour la lecture du journal ? ». Mauvaise réponse : « un `if` dans le controller ». Bonne réponse = **une carte de contrôles superposés**, chacun à sa frontière :

```
Requête GET /journal/:familyId
  │
  ├─[bord réseau]        rate limiting            ← contre D (énumération / DoS)
  │
  ├─[entrée API / guard] authentification token   ← contre S (le token est-il valide ?)
  │
  ├─[application/domaine] autorisation :
  │                       user ∈ membres(familyId) ← contre I / A01 (appartenance)
  │                       rôle autorise la lecture ← contre E (least privilege)
  │
  └─[données]            chiffrement au repos +    ← contre I si la base fuit
                         compte DB en lecture seule   (assume breach)
```

**Pourquoi c'est robuste :** quatre contrôles **indépendants**. Un bug dans l'autorisation (couche 3) laisse encore le chiffrement (couche 4) limiter la casse. Aucun contrôle n'est le point de défaillance unique — c'est la **défense en profondeur**. Et chaque contrôle est **à la couche dont c'est la responsabilité** (module 05) : l'authZ métier n'est pas au bord réseau, le rate limiting n'est pas dans le domaine.

---

## 4. Pièges & misconceptions

### PIÈGE #1 — « On sécurisera après »

La sécurité n'est pas une feature qu'on branche à la fin : c'est une **propriété structurelle**. Rajouter l'autorisation « après » signifie souvent la disperser dans des `if` de controllers, sans frontière claire, avec des trous. Le threat model se fait **au tableau blanc**, avant le code, quand corriger est gratuit. C'est précisément le sens d'**A04 – Insecure Design** : une faille de conception, pas un bug.

### PIÈGE #2 — Confondre authentification et autorisation

**AuthN** = « qui es-tu ? » (prouver l'identité). **AuthZ** = « as-tu le droit de faire *ça* sur *cette* ressource ? ». Elles ne vivent **pas** au même endroit : l'authN est générique, à la **frontière d'entrée** ; l'autorisation fine dépend de la **règle métier** et vit dans le **domaine/application**. Un système qui authentifie bien mais autorise mal (« tout utilisateur connecté voit tout ») est la faille n°1 du web (Broken Access Control).

### PIÈGE #3 — Croire que le périmètre suffit (sécurité château fort)

« Il y a un firewall, l'intérieur est sûr. » Faux dès qu'un composant est compromis : l'attaquant se déplace latéralement dans une zone qui se fait confiance. Le **zero-trust** (never trust, always verify) et l'**assume breach** répondent à ça : on vérifie **à chaque frontière**, y compris interne, et on segmente pour réduire le blast radius. Le périmètre est **une** couche, pas **la** sécurité.

### PIÈGE #4 — Un seul contrôle « fort » plutôt que plusieurs

Miser tout sur un contrôle réputé parfait (« notre auth est béton ») viole la défense en profondeur. Tout contrôle peut échouer (bug, mauvaise config, contournement). La robustesse vient de la **superposition de contrôles indépendants**, pas de la perfection illusoire d'un seul. Question test : *si CE contrôle tombe, que se passe-t-il ?* Si la réponse est « catastrophe », il manque une couche.

### PIÈGE #5 — Faire confiance aux données du client

Tout ce qui vient du client est **hostile par défaut** (zone non fiable). Dériver l'identité ou les droits d'un champ du body (`authorId`, `role`, `isAdmin` envoyés par le client) est une porte ouverte au Tampering et à l'Elevation of Privilege. L'identité et les droits se dérivent **côté serveur**, du token vérifié à la frontière — **jamais** du payload.

### PIÈGE #6 — La privacy comme rustine juridique

Croire que la privacy est « une case RGPD qu'on cochera avec un bandeau cookies » rate le point. La **privacy by design** est une contrainte d'**architecture** : minimiser la donnée collectée réduit la surface de fuite (moins de « I » dans STRIDE) ; pouvoir vraiment **purger** une donnée est une **capacité technique** à concevoir tôt (y compris chez les sous-traitants), pas une promesse. Opt-in par défaut, pas opt-out.

### PIÈGE #7 — Confondre STRIDE (menaces) et OWASP Top 10 (vulnérabilités)

STRIDE est une **taxonomie de menaces** (de Microsoft) pour *énumérer* ce qui peut mal tourner sur un schéma. L'**OWASP Top 10** est un **classement de vulnérabilités** web répandues. On utilise STRIDE pour **modéliser** en conception, et le Top 10 comme **checklist de vulnérabilités connues** à l'implémentation (cours 14). Ce sont deux outils complémentaires, pas deux versions du même.

---

## 5. Ancrage TribuZen

TribuZen manipule la donnée la plus sensible qui soit : **des informations sur des enfants**, dans un cercle familial. La sécurité et la privacy ne sont pas optionnelles ; elles pilotent des décisions d'architecture concrètes.

**Threat model par feature.** Chaque feature sensible (Journal familial, Routines partagées, Invitations de co-référents) passe un mini-STRIDE en conception. La menace dominante est presque toujours **I (Information Disclosure)** via **Broken Access Control** : voir les données d'une autre famille. Le contrôle : autorisation d'**appartenance à la famille** en couche application/domaine, dérivée du token, testable sans HTTP.

**Placement des contrôles (rappel de la spec §8 — modèle de confidentialité par niveaux) :**

- **Level 1 (device-only, chiffré côté appareil)** : certaines données ultra-sensibles ne quittent jamais le téléphone. Le contrôle est **physiquement** à la frontière la plus haute possible : la donnée n'atteint jamais le serveur → surface de fuite quasi nulle (minimisation poussée à l'extrême).
- **Level 2 (partagé famille, serveur)** : chiffré au repos, autorisation d'appartenance à chaque accès, audit log. Défense en profondeur : rate limiting (bord), authN (guard), authZ appartenance + rôle (application), chiffrement + compte DB à moindre privilège (données).

**Privacy by design concrète :**

- **Minimisation** : on ne collecte pas la date de naissance exacte d'un enfant si un simple « tranche d'âge » suffit à la feature.
- **Opt-in** : rien n'est partagé hors du cercle famille sans action explicite. Défaut = le plus fermé.
- **Assume breach** : si le serveur Level 2 fuit, le chiffrement au repos et l'absence de données Level 1 côté serveur limitent le blast radius aux seules données déjà partagées, jamais aux données device-only.

> **Défère :** l'implémentation des guards NestJS, du chiffrement, des tokens, de la CSP et la conformité RGPD détaillée = **cours 14 (sécurité)**. Ici on a décidé **quelles menaces**, **quels contrôles**, et **où** — la topologie, pas le code.

---

## 6. Points clés

1. La sécurité est une **propriété de l'architecture**, pas une feature ajoutée « après » (piège A04 – Insecure Design).
2. **Threat modeling** = énumérer systématiquement les menaces *en conception*, sur un schéma, avant de coder.
3. **STRIDE** (Microsoft) = six catégories de menaces (Spoofing, Tampering, Repudiation, Information Disclosure, DoS, Elevation) ; se déroule **à chaque trust boundary**.
4. Une **trust boundary** est une ligne où la donnée change de niveau de confiance ; **chaque traversée = point d'inspection** (authN, validation, authZ, log).
5. **Zero-trust** : never trust always verify, **least privilege**, **assume breach** — vérifier à **chaque** frontière, même interne ; minimiser le blast radius.
6. **Défense en profondeur** : plusieurs contrôles **indépendants** superposés ; jamais un seul point de défaillance.
7. **Placement** : authN à l'entrée, validation en présentation, **autorisation fine dans le domaine/application** (c'est une règle métier), chiffrement en infra.
8. **AuthN ≠ AuthZ** : « qui es-tu » (générique, entrée) vs « as-tu le droit sur cette ressource » (métier, domaine).
9. **Ne jamais faire confiance aux données du client** : identité et droits dérivés du token côté serveur, jamais du body.
10. **Privacy by design** : minimisation, opt-in par défaut, purge réelle — une contrainte d'**architecture** (surtout sur données d'enfants), pas une rustine juridique.

---

## 7. Seeds Anki

```
Quelles sont les 3 questions distinctes de la sécurité architecturale, et l'outil de chacune ?|Contre quoi me défendre → threat modeling (STRIDE) ; où placer les contrôles → zero-trust + défense en profondeur ; comment traiter la donnée sensible → privacy by design.
Que signifie STRIDE et d'où vient-il ?|Modèle de threat modeling de Microsoft : Spoofing (authN), Tampering (intégrité), Repudiation (non-répudiation/audit), Information Disclosure (confidentialité), Denial of Service (disponibilité), Elevation of Privilege (autorisation).
Qu'est-ce qu'une trust boundary et pourquoi c'est central ?|Une ligne où la donnée change de niveau de confiance (Internet→API, API→DB). Chaque traversée est un point d'inspection obligatoire : authN, validation, autorisation, journalisation.
Résume le zero-trust en 3 principes.|Never trust always verify (chaque requête authentifiée+autorisée, même interne) ; least privilege (droits minimaux) ; assume breach (concevoir comme si l'attaquant était déjà dedans, minimiser le blast radius).
Qu'est-ce que la défense en profondeur et pourquoi ?|Superposer plusieurs contrôles indépendants pour qu'aucun ne soit un point de défaillance unique. Si l'autorisation a un bug, le chiffrement limite encore la casse.
Où placer l'authentification vs l'autorisation, et pourquoi pas au même endroit ?|AuthN (qui es-tu) = générique, à la frontière d'entrée. AuthZ fine (droit sur CETTE ressource) = règle métier, dans le domaine/application. Broken Access Control vient de mal placer l'autorisation.
Pourquoi ne jamais dériver l'identité ou les droits du body de la requête ?|Le client est en zone non fiable : un champ authorId/role/isAdmin envoyé par le client ouvre au Tampering et à l'Elevation of Privilege. Identité et droits se dérivent du token vérifié côté serveur.
Différence entre STRIDE et OWASP Top 10 ?|STRIDE = taxonomie de menaces (Microsoft) pour modéliser en conception. OWASP Top 10 = classement de vulnérabilités web répandues, checklist à l'implémentation. Complémentaires.
Cite 3 principes actionnables de privacy by design en architecture.|Minimisation (ne collecter que le nécessaire → moins de surface de fuite), privacy par défaut/opt-in (config la plus fermée par défaut), purge réelle et chiffrement de bout en bout pensés dès la conception.
Quelle est la menace STRIDE dominante sur le Journal familial de TribuZen et son contrôle ?|Information Disclosure via Broken Access Control (voir le journal d'une autre famille). Contrôle : autorisation d'appartenance à la famille en couche application/domaine, dérivée du token.
```

---

## Pont vers le lab

> Lab associé : `labs/lab-20-securite-architecturale/README.md`. Dérouler un threat model STRIDE complet sur une feature TribuZen, placer les contrôles en défense en profondeur (avec la carte « quel contrôle, à quelle frontière »), et appliquer la privacy by design sur des données sensibles. Exercice de conception, évalué par grille + coach — zéro harnais.
