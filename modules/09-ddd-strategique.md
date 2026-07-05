---
titre: DDD stratégique (langage ubiquitaire, bounded contexts, context mapping)
cours: 13-architecture
notions: ["Domain-Driven Design", "domaine et sous-domaine", "langage ubiquitaire", "bounded context", "frontière de modèle", "context map", "relations de contexte (Partnership, Customer/Supplier, Conformist, ACL, Open Host Service, Shared Kernel)", "anti-corruption layer (ACL)", "sous-domaines core / supporting / generic", "bounded context vs microservice", "quand DDD vaut le coût"]
outcomes:
  - "sait définir un langage ubiquitaire pour un domaine et repérer un terme polysémique dangereux"
  - "sait découper un domaine en bounded contexts à partir de signaux de frontière"
  - "sait dessiner une context map et nommer le type de relation entre deux contextes"
  - "sait classer un sous-domaine en core / supporting / generic et en déduire où investir"
  - "sait décider si le DDD vaut son coût pour un projet donné"
prerequis: ["Module 00 — posture d'architecte", "Module 01 — principes SOLID", "Module 03 — clean code / code smells", "Module 05 — architecture en couches", "Module 06 — architecture hexagonale", "Module 07 — clean architecture", "Module 08 — monolithe modulaire vs microservices"]
next: 10-ddd-tactique
libs: []
tribuzen: "cartographie du domaine de TribuZen — identification des bounded contexts (Routines, Famille, Récompenses, Identité, Notifications) et de leur langage ubiquitaire"
last-reviewed: 2026-07
---

# DDD stratégique (langage ubiquitaire, bounded contexts, context mapping)

> **Outcomes — tu sauras FAIRE :** définir un langage ubiquitaire et débusquer un terme polysémique, découper un domaine en bounded contexts, dessiner une context map en nommant chaque relation, classer un sous-domaine core/supporting/generic pour savoir où investir, et décider si le DDD vaut son coût.
> **Difficulté :** :star::star::star:
>
> **Portée :** ce module couvre le **DDD stratégique SEULEMENT** — le niveau macro qui répond à « **quoi** construire et **où** tracer les frontières ». On voit le langage ubiquitaire, les bounded contexts, le context mapping, les sous-domaines et le critère de coût. Tout le **tactique** — comment modéliser *à l'intérieur* d'un contexte avec entités, value objects, agrégats, repositories et domain events — est le **module 10 (DDD tactique)** : on n'y touche pas ici. La règle d'or DDD est justement : **sans stratégique, le tactique est appliqué au mauvais endroit**. Ce module pose donc l'étage indispensable avant le suivant.

## 1. Cas concret d'abord

Tu reprends le backend de TribuZen. Depuis six mois, une seule entité `User` a servi de fourre-tout. Voici ce qu'elle est devenue :

```ts
// user.entity.ts — le fourre-tout qui a grossi contexte après contexte
class User {
  id: string;
  email: string;
  passwordHash: string;      // pour l'auth
  displayName: string;
  role: string;              // 'parent' | 'child' | 'admin'
  avatarColor: string;       // pour l'affichage famille
  points: number;            // pour la gamification
  streak: number;            // série de routines complétées
  badges: string[];          // récompenses débloquées
  pushToken: string | null;  // pour les notifications
  timezone: string;          // pour planifier les rappels
  consentRgpdAt: Date | null;
  // ... 14 autres champs, la moitié null selon le rôle
}
```

Ce code « marche ». Mais pose-toi les questions qui font mal :

1. **Que veut dire `User` ici ?** Un compte qui se connecte (parent) ? Un enfant qui n'a **pas** de mot de passe et ne se connecte jamais ? Le mot `user` recouvre trois réalités métier différentes, et la moitié des champs sont `null` selon le cas.
2. **Qui a le droit de changer `points` et `streak` ?** Ces champs appartiennent à la logique de récompenses. Mais comme ils vivent sur `User`, **n'importe quel** service — auth, notifications, profil — peut les écrire. Aucune frontière ne les protège.
3. **Quand l'équipe grandira**, deux personnes voudront modifier `User` en même temps : l'une pour l'auth, l'autre pour les badges. Elles se marchent dessus sur le **même fichier**, pour des raisons **sans rapport**.

Le problème n'est pas technique — c'est un problème de **modèle** : on a un seul modèle géant là où le métier contient **plusieurs domaines distincts** qui utilisent le mot « utilisateur » différemment. Le DDD stratégique donne le vocabulaire et la méthode pour **tracer les frontières** entre ces domaines *avant* d'écrire une entité. C'est l'objet de ce module.

---

## 2. Théorie complète, concise

### 2.1 Le point de départ : le DDD centre le code sur le domaine

Le **Domain-Driven Design** (Eric Evans, 2003) part d'un constat : dans les projets complexes, le coût principal n'est pas la technique, c'est la **friction de communication** entre les experts du métier et les développeurs. Le DDD répond en imposant que **la structure et le vocabulaire du code reflètent le domaine métier**, pas l'inverse.

On appelle **domaine** l'espace du problème que le logiciel résout (pour TribuZen : aider les familles à tenir des routines de bien-être). Un domaine se découpe en **sous-domaines** (routines, récompenses, identité…). Le DDD se scinde en deux niveaux :

- **Stratégique** (ce module) — macro, « quoi construire et où tracer les frontières » : langage ubiquitaire, bounded contexts, context map, sous-domaines.
- **Tactique** (module 10) — micro, « comment modéliser dans un contexte » : entités, value objects, agrégats, repositories, domain events.

**Règle d'or : sans stratégique, le tactique est inutile.** Bien modéliser une entité dans le mauvais contexte ne résout rien. On trace d'abord les frontières.

### 2.2 Le langage ubiquitaire

Le **langage ubiquitaire** (*ubiquitous language*) est un vocabulaire **partagé et rigoureusement défini**, utilisé par **tout le monde** — experts métier, développeurs, testeurs, PO — et présent **partout** : conversations, documentation, noms de classes/méthodes, tests, et jusqu'aux noms de tables. Le but : supprimer la **traduction mentale** permanente entre le mot du métier et le mot du code.

Le signal d'alarme le plus utile est le **terme polysémique** : un mot qui cache plusieurs concepts métier. Dans le §1, `User` en cachait trois. En e-commerce, « annuler » cache souvent trois opérations distinctes :

| Terme ambigu | Terme ubiquitaire | Définition précise |
|---|---|---|
| « annuler » | `abandonPanier` | panier non finalisé, abandonné |
| « annuler » | `annulerCommande` | commande annulée **avant** expédition |
| « annuler » | `demanderRemboursement` | commande déjà expédiée, retour demandé |

Trois noms précis à la place d'un `cancel()` fourre-tout. Le langage ubiquitaire **vaut à l'intérieur d'un contexte** : le même mot peut légitimement signifier autre chose dans un autre contexte (voir 2.3). C'est une caractéristique, pas un défaut.

### 2.3 Le bounded context : une frontière autour d'un modèle

Un **bounded context** (contexte borné) est une **frontière explicite** à l'intérieur de laquelle un modèle et son langage ont un sens **cohérent et unique**. En dehors de cette frontière, le même terme peut avoir un autre sens — et c'est très bien.

L'exemple canonique : le mot « produit ».

```
  Contexte CATALOGUE              Contexte COMMANDE
  ┌──────────────────────┐        ┌──────────────────────┐
  │  Produit             │        │  LigneDeCommande     │
  │  ─────────────────── │        │  ─────────────────── │
  │  nom multilingue     │        │  nomProduit (snapshot)│
  │  description riche    │        │  prixUnitaire (figé)  │
  │  images, SEO          │        │  quantité             │
  │  variantes, stock     │        │  // AUCUN lien "live" │
  └──────────────────────┘        └──────────────────────┘

  Même mot "produit", deux modèles totalement différents.
  La commande capture un SNAPSHOT : si le prix change demain,
  les anciennes commandes ne bougent pas.
```

Partager **une seule** entité `Produit` entre les deux contextes couple tout : un changement de schéma du catalogue casse les commandes, les deux équipes se bloquent, les jointures explosent. La frontière **protège** chaque modèle.

**Signaux qui trahissent une frontière de contexte** (à connaître par cœur) :

1. le **même mot** a des définitions différentes selon l'interlocuteur ;
2. une **équipe différente** est (ou sera) responsable de cette partie ;
3. le **rythme de changement** diffère (le catalogue bouge rarement, le panier tout le temps) ;
4. les **modèles de données** sont structurellement différents ;
5. les **exigences** de disponibilité/consistance diffèrent.

### 2.4 La context map : cartographier les relations entre contextes

Une fois les contextes identifiés, la **context map** documente **comment ils s'intègrent**. Ce n'est pas un diagramme décoratif : chaque relation implique un **niveau de couplage et de coordination** différent. Les patterns à connaître :

| Relation | Idée | Couplage |
|---|---|---|
| **Shared Kernel** (noyau partagé) | deux contextes partagent une petite portion de modèle (ex. un type `Money`, un `UserId`). Tout changement exige de coordonner les deux équipes. | fort, à réserver aux concepts très stables |
| **Customer/Supplier** (client/fournisseur) | l'amont (supplier) fournit, l'aval (customer) consomme et peut **négocier** le contrat. | modéré |
| **Conformist** (conformiste) | l'aval adopte le modèle de l'amont **tel quel**, sans négociation (ex. API externe imposée). | subi |
| **Anti-Corruption Layer (ACL)** | l'aval intercale une **couche de traduction** qui convertit le modèle externe en son propre vocabulaire — il se protège de la contamination. | découplé (au prix d'un traducteur) |
| **Open Host Service (OHS)** | un contexte expose une **API stable et documentée** pour plusieurs consommateurs. | maîtrisé |
| **Published Language** | l'échange passe par un **format standard publié** (JSON Schema, Avro, Protobuf), souvent au-dessus d'un OHS. | maîtrisé |

L'**anti-corruption layer** est le pattern le plus précieux au quotidien : quand tu intègres Stripe, DHL ou un legacy, tu ne laisses **pas** leur vocabulaire (`PaymentIntent`, `shipment_leg`) envahir ton domaine — l'ACL traduit `PaymentIntent` → `PaiementConfirmé` à la frontière. Le détail d'implémentation des flux d'événements et de messaging entre contextes relève du **cours 17** ; ici on nomme juste la relation.

Une context map minimale se lit d'un coup d'œil :

```
   ┌──────────┐   OHS/Published   ┌──────────────┐
   │ ROUTINES │ ────Language────▶ │ RÉCOMPENSES  │
   │  (core)  │  RoutineComplétée │   (core)     │
   └────┬─────┘                   └──────────────┘
        │ Customer/Supplier
        ▼
   ┌──────────┐        ACL         ┌──────────────┐
   │ IDENTITÉ │ ◀──(traduction)──  │  Fournisseur │
   │ (generic)│                    │  OAuth ext.  │
   └──────────┘                    └──────────────┘
```

### 2.5 Sous-domaines : core, supporting, generic

Tout le code **n'a pas** la même valeur stratégique. Classer chaque sous-domaine dit **où mettre les meilleurs efforts** :

| Type | Définition | Où investir |
|---|---|---|
| **Core domain** | l'avantage concurrentiel, ce qui te différencie | fait maison, DDD complet, meilleurs devs |
| **Supporting domain** | nécessaire mais pas différenciateur | fait maison léger, ou sous-traité, DDD partiel |
| **Generic domain** | problème universel déjà résolu par l'industrie | **achète** une solution (SaaS/lib), zéro DDD |

Erreur classique : investir un effort de modélisation énorme sur du **generic** (réécrire un système d'auth ou d'envoi d'e-mails) et bâcler le **core**. La règle : DDD complet sur le core, achète le generic, dose le supporting.

### 2.6 Bounded context ≠ microservice

Piège majeur, à désamorcer tout de suite. Un **bounded context** est une frontière **logique/conceptuelle** ; un **microservice** est une frontière **physique/déployable** (module 08). Ils **ne coïncident pas** mécaniquement : un contexte peut être plusieurs services, ou plusieurs contextes peuvent vivre dans un seul déployable.

**Recommandation :** commence par un **monolithe modulaire** — 1 bounded context = 1 module bien isolé (ex. un module NestJS) — et n'extrais un microservice **que si** un besoin réel (scaling, équipe, isolation de panne) est prouvé. Découper les contextes est **toujours** utile ; les déployer séparément ne l'est **pas toujours**.

### 2.7 Quand le DDD vaut-il son coût ?

Le DDD a un prix : montée en compétence, ateliers de modélisation, overhead initial. Il n'est justifié **que si la complexité métier le mérite**.

| Critère | DDD pertinent | DDD superflu |
|---|---|---|
| Complexité métier | élevée (règles, workflows, invariants) | faible (CRUD basique) |
| Durée de vie | longue (produit qui vivra des années) | jetable (prototype, MVP throwaway) |
| Équipe | pluridisciplinaire (devs + experts métier) | solo/technique |
| Domaine | routines/bien-être, finance, santé, logistique | blog, site vitrine, formulaire |

**Règles rapides :** si toute ta logique métier tient dans un seul `if`, pas de DDD. Si l'équipe passe plus de temps à **débattre des noms** qu'à coder, c'est que le DDD **manque**. Et surtout : le DDD stratégique (langage + frontières) est **beaucoup moins cher** que le tactique — même sur un projet modeste, clarifier le langage ubiquitaire et tracer 3-4 contextes rapporte gros pour un coût faible. Le doute porte surtout sur le **tactique** (module 10).

---

## 3. Worked examples

### Exemple 1 — Découper le fourre-tout `User` du §1 en bounded contexts

On reprend l'entité `User` géante et on applique les signaux de frontière (2.3).

**Étape 1 — repérer les termes polysémiques.** `User` désigne : un compte qui se connecte, un enfant qui ne se connecte jamais, un porteur de points. Trois concepts → au moins trois modèles.

**Étape 2 — regrouper les champs par « qui les fait changer ».**

| Champs | Raison de changer | Contexte |
|---|---|---|
| `email`, `passwordHash`, `consentRgpdAt` | règles d'authentification/RGPD | **Identité & Accès** |
| `displayName`, `avatarColor`, `role`, appartenance famille | composition de la famille | **Famille** |
| `points`, `streak`, `badges` | règles de gamification | **Récompenses** |
| `pushToken`, `timezone` | planification des rappels | **Notifications** |

**Étape 3 — nommer le concept dans chaque contexte (langage ubiquitaire local).** Le mot « utilisateur » disparaît au profit de noms précis :

- Identité : `Compte` (a un email + mot de passe, peut se connecter).
- Famille : `Membre` (un enfant est un `Membre` **sans** `Compte`).
- Récompenses : `Joueur` (porte points, série, badges).
- Notifications : `Destinataire` (a un token push + un fuseau).

**Résultat :** un `Compte` (Identité) et un `Membre` (Famille) peuvent référencer le **même** identifiant de personne, mais ce sont **deux modèles**, dans deux contextes, protégés par leur frontière. Plus aucun champ `null` selon le rôle : chaque contexte ne porte que ce qui le concerne. On n'a **rien** modélisé en tactique (ni agrégat, ni value object) — on a seulement tracé des frontières et fixé un vocabulaire. C'est exactement le périmètre du stratégique.

### Exemple 2 — Nommer les relations d'une context map

On te donne ces cinq contextes de TribuZen et leurs interactions. Nomme la relation.

```
(A) ROUTINES  ─── émet "RoutineComplétée" ──▶  RÉCOMPENSES
(B) ROUTINES  ─── a besoin du nom du membre ──▶  FAMILLE
(C) IDENTITÉ  ─── s'appuie sur un fournisseur OAuth externe imposé
(D) NOTIFICATIONS ─── consomme un SDK push propriétaire (Firebase)
(E) plusieurs contextes partagent le type "IdMembre"
```

Analyse :

- **(A)** Routines expose un événement stable et documenté que Récompenses consomme sans jamais appeler Routines en retour → **Open Host Service** (+ **Published Language** si l'événement suit un schéma versionné). Récompenses ne connaît pas les entrailles de Routines.
- **(B)** Routines (aval/customer) a besoin d'une donnée que Famille (amont/supplier) fournit, et l'équipe Routines peut **négocier** le contrat (« je veux juste `idMembre` + `displayName` ») → **Customer/Supplier**.
- **(C)** le fournisseur OAuth impose son modèle, non négociable → **Conformist**. On protège quand même le domaine Identité avec un **ACL** qui traduit le token externe en `Compte` interne.
- **(D)** le SDK Firebase impose son vocabulaire → on intercale un **Anti-Corruption Layer** pour ne pas laisser `messaging.Message` envahir le contexte Notifications.
- **(E)** un type partagé, très stable, entre plusieurs contextes → **Shared Kernel** — à garder minuscule (juste l'identifiant), car tout changement force à coordonner **toutes** les équipes concernées.

Verdict : cinq interactions, cinq relations nommées. La map dit d'un coup d'œil **où est le couplage fort** (E, à surveiller) et **où le domaine est protégé** (C et D via ACL).

---

## 4. Pièges & misconceptions

### PIÈGE #1 — « Un bounded context, c'est un microservice »

Faux, et cher payé. Un contexte est une frontière **logique** ; un microservice une frontière **de déploiement** (module 08). Extraire chaque contexte en service dès le départ, c'est s'infliger la complexité distribuée (réseau, cohérence, observabilité) **avant** d'en avoir le besoin. Le bon défaut : monolithe modulaire, 1 contexte = 1 module, extraction en service **seulement** si un besoin réel le prouve.

### PIÈGE #2 — « Le langage ubiquitaire doit être global à toute l'entreprise »

Faux. Chercher **un** vocabulaire unique valable partout produit une « carte d'identité universelle » qui ne satisfait personne — comme un `Produit` unique partagé entre catalogue et commande. Le langage ubiquitaire est **local à un contexte**. Le même mot peut légitimement signifier autre chose ailleurs ; la frontière est justement ce qui l'autorise.

### PIÈGE #3 — Confondre sous-domaine et bounded context

Ce sont deux choses. Le **sous-domaine** appartient à l'espace du **problème** (une partie du métier : « les récompenses »). Le **bounded context** appartient à l'espace de la **solution** (une frontière que tu traces dans le code/modèle). L'idéal est **un contexte par sous-domaine**, mais un legacy peut mélanger deux sous-domaines dans un seul contexte fourre-tout — c'est précisément ce qu'on cherche à corriger.

### PIÈGE #4 — Mettre le DDD tactique partout, y compris sur le generic

Faux. Réécrire un système d'authentification ou d'envoi d'e-mails « proprement en DDD » avec agrégats et value objects, c'est gaspiller l'effort sur du **generic** — un problème déjà résolu par l'industrie, à **acheter**. Le core mérite le DDD complet ; le generic mérite un SaaS. (Le tactique lui-même est le module 10 : ici on décide seulement **où** il aura le droit d'exister.)

### PIÈGE #5 — Croire qu'une context map est un dessin décoratif

Faux. Chaque flèche encode une **décision de couplage** : un Shared Kernel oblige à coordonner deux équipes à chaque changement ; un ACL coûte un traducteur mais découple ; un Conformist te soumet à un tiers. Nommer la relation, c'est nommer la contrainte organisationnelle qui va avec. Une map sans types de relation ne sert à rien.

### PIÈGE #6 — Lancer le DDD stratégique « quand la complexité sera là »

Attention à l'excès inverse. Le stratégique (langage + frontières) est **peu coûteux** et paie tôt : clarifier le vocabulaire et tracer 3-4 contextes évite le fourre-tout `User` du §1 dès les premiers mois. C'est le **tactique** qui se justifie seulement sur un vrai cœur métier complexe. Ne repousse pas le stratégique sous prétexte que « le projet est petit ».

---

## 5. Ancrage TribuZen

TribuZen est un domaine à **vraie complexité métier** (routines récurrentes, séries, récompenses, familles, offline, RGPD) et à **longue durée de vie** : le DDD stratégique y vaut clairement son coût (2.7). On applique la méthode au produit réel.

**Les bounded contexts de TribuZen** (découpage cible) :

```
┌───────────────────────────────────────────────────────────────┐
│                          TribuZen                              │
│                                                               │
│  ┌────────────┐   ┌────────────┐   ┌────────────────────────┐ │
│  │  ROUTINES  │   │ RÉCOMPENSES│   │        FAMILLE         │ │
│  │  (core)    │   │  (core)    │   │      (supporting)     │ │
│  │            │   │            │   │                        │ │
│  │ Routine    │   │ Joueur     │   │ Foyer                  │ │
│  │ Complétion │   │ Badge      │   │ Membre (enfant/parent) │ │
│  │ Série      │   │ Points     │   │ Rôle                   │ │
│  └────────────┘   └────────────┘   └────────────────────────┘ │
│                                                               │
│  ┌────────────┐   ┌──────────────────────────────────────────┐│
│  │  IDENTITÉ  │   │            NOTIFICATIONS                 ││
│  │ (generic)  │   │              (generic)                   ││
│  │ Compte     │   │ Destinataire, Rappel, Canal              ││
│  └────────────┘   └──────────────────────────────────────────┘│
└───────────────────────────────────────────────────────────────┘
```

**Classement des sous-domaines :**

- **Routines** et **Récompenses** = **core**. C'est la proposition de valeur de TribuZen (tenir des routines de bien-être + gamification bienveillante). DDD complet, meilleur soin — la modélisation tactique de ces contextes est le terrain du **module 10**.
- **Famille** = **supporting**. Nécessaire (foyers, membres, rôles) mais pas différenciateur. Modélisation soignée mais sans sur-ingénierie.
- **Identité** et **Notifications** = **generic**. Auth (OAuth/OIDC via un fournisseur) et push (Firebase/APNs) sont des problèmes résolus : on **achète**, on protège le reste avec un **ACL**.

**Langage ubiquitaire local — le mot « personne » selon le contexte :**

| Contexte | Nom | Ce que c'est |
|---|---|---|
| Identité | `Compte` | a un e-mail + credentials, peut se connecter (les parents) |
| Famille | `Membre` | appartient à un `Foyer` ; un **enfant** est un `Membre` **sans** `Compte` |
| Récompenses | `Joueur` | porte points, série, badges |
| Notifications | `Destinataire` | a un token push + un fuseau |

**Décisions de context map pour TribuZen :**

- **Routines → Récompenses** via un événement `RoutineComplétée` (**Open Host Service / Published Language**). Récompenses recalcule points et badges **sans** connaître les entrailles de Routines. Ainsi, changer la règle de série ne touche pas les récompenses.
- **Routines → Famille** en **Customer/Supplier** : Routines a juste besoin de l'`idMembre` et du nom d'affichage, négociés avec Famille.
- **Identité → fournisseur OAuth** en **Conformist + ACL** : on subit le modèle du fournisseur mais on traduit son token en `Compte` interne à la frontière.
- **`idMembre`** = **Shared Kernel** minimal entre contextes — juste l'identifiant, rien de plus, pour garder le couplage au minimum.

> **Défère :** la modélisation *interne* d'un contexte (l'agrégat `Routine`, le value object `Série`, le repository) est le **module 10 (DDD tactique)**. La mécanique des événements entre contextes (bus, messaging) est le **cours 17**. L'implémentation NestJS/Prisma relève des **cours 09/10**. Ici on a seulement tracé les frontières, nommé les relations et fixé le vocabulaire — c'est tout le stratégique.

---

## 6. Points clés

1. Le **DDD** centre le code sur le domaine métier pour supprimer la friction de traduction entre experts et devs ; il se divise en **stratégique** (frontières, ce module) et **tactique** (modélisation interne, module 10).
2. **Règle d'or :** sans stratégique, le tactique est appliqué au mauvais endroit et ne résout rien. On trace les frontières **d'abord**.
3. Le **langage ubiquitaire** est un vocabulaire partagé, **local à un contexte** ; le meilleur signal de problème est le **terme polysémique** (`user`, `cancel`, `produit`).
4. Un **bounded context** est une frontière **explicite** où un modèle a un sens unique ; on le repère via les signaux (même mot/sens différents, équipe, rythme de changement, structure de données, exigences).
5. La **context map** nomme le type de chaque relation (Shared Kernel, Customer/Supplier, Conformist, **ACL**, Open Host Service, Published Language) — chaque type = un niveau de couplage et une contrainte d'équipe.
6. L'**anti-corruption layer** protège ton domaine du vocabulaire des systèmes externes (Stripe, DHL, OAuth) en traduisant à la frontière.
7. Classer les sous-domaines en **core / supporting / generic** dit où investir : DDD complet sur le core, achat sur le generic.
8. **Bounded context ≠ microservice** : frontière logique vs déploiement. Défaut recommandé : monolithe modulaire, extraction en service seulement si prouvée.
9. Le DDD **stratégique** est peu coûteux et paie tôt ; le doute sur « est-ce que ça vaut le coût » porte surtout sur le **tactique**, réservé aux domaines à vraie complexité et longue durée de vie.

---

## 7. Seeds Anki

```
Quelle est la règle d'or du DDD stratégique vs tactique ?|Sans stratégique, le tactique est inutile : bien modéliser une entité dans le mauvais contexte ne résout rien. On trace d'abord les frontières (langage, bounded contexts), puis on modélise à l'intérieur.
Qu'est-ce que le langage ubiquitaire et où doit-il apparaître ?|Un vocabulaire partagé et rigoureusement défini, local à un contexte, utilisé par tous (experts + devs) et présent partout : conversations, docs, code, tests, base. Il supprime la traduction mentale métier/technique.
Pourquoi un terme comme "user" est-il dangereux ?|Il est polysémique : il cache plusieurs concepts métier (compte qui se connecte, enfant sans login, porteur de points). Un fourre-tout avec des champs null selon le rôle en résulte. Le langage ubiquitaire impose un nom précis par contexte.
Qu'est-ce qu'un bounded context ?|Une frontière explicite à l'intérieur de laquelle un modèle et son langage ont un sens cohérent et unique. En dehors, le même mot peut avoir un autre sens — et c'est voulu. La frontière protège chaque modèle du couplage.
Cite trois signaux qui trahissent une frontière de bounded context.|Le même mot a des définitions différentes selon l'interlocuteur ; une équipe différente en est responsable ; le rythme de changement diffère ; les modèles de données sont structurellement différents ; les exigences de dispo/consistance diffèrent.
À quoi sert une context map et quels sont ses types de relation ?|Elle cartographie comment les contextes s'intègrent, chaque relation encodant un niveau de couplage : Shared Kernel, Customer/Supplier, Conformist, Anti-Corruption Layer (ACL), Open Host Service, Published Language.
Qu'est-ce qu'un Anti-Corruption Layer (ACL) ?|Une couche de traduction placée à la frontière qui convertit le modèle d'un système externe (Stripe, DHL, OAuth) dans le vocabulaire interne, empêchant le modèle externe de contaminer le domaine.
Différence entre core, supporting et generic domain ?|Core = avantage concurrentiel (DDD complet, fait maison) ; supporting = nécessaire mais pas différenciateur (soigné mais léger) ; generic = problème universel déjà résolu (on achète un SaaS/lib, zéro DDD).
Bounded context et microservice, c'est pareil ?|Non. Le contexte est une frontière logique/conceptuelle ; le microservice une frontière physique de déploiement. Défaut recommandé : monolithe modulaire (1 contexte = 1 module), extraire un service seulement si un besoin réel le prouve.
Quand le DDD vaut-il son coût ?|Quand la complexité métier est élevée et la durée de vie longue, avec une équipe pluridisciplinaire. Le stratégique (langage + frontières) est peu coûteux et paie tôt ; c'est surtout le tactique qui doit être justifié par un vrai cœur métier complexe.
```

---

## Pont vers le lab

> Lab associé : `labs/lab-09-ddd-strategique/README.md`. Découper le domaine de TribuZen en bounded contexts à partir d'un pêle-mêle de concepts, dessiner la context map en nommant chaque relation, classer les sous-domaines core/supporting/generic et rédiger le langage ubiquitaire local. Exercice de conception, évalué par grille + coach — zéro harnais.
