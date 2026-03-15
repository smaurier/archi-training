# Cours 14 — Introduction au Domain-Driven Design (DDD)

**Objectif :** Comprendre ce qu'est le DDD, distinguer la conception stratégique de la conception tactique, maîtriser la notion de Langage Ubiquitaire, et savoir reconnaitre les situations ou le DDD est pertinent (où superflu).

---

## Rappel du cours précédent

> Module 01 — Patterns Architecturaux. Ces questions couvrent les 12-Factor App, dernier theme du module précédent.

**Question 1 — Citez trois des douze facteurs de la 12-Factor App et expliquez leur intérêt.**

<details>
<summary>Réponse</summary>

Exemples parmi les douze facteurs :

- **III. Config** : la configuration (URLs de BDD, clés API) doit etre dans des variables d'environnement, jamais dans le code source. Cela permet de déployer le même binaire dans plusieurs environnements.
- **VI. Processes** : l'application doit etre sans état (stateless) ; l'état est externalise (Redis, BDD). Cela rend le scale horizontal trivial.
- **XI. Logs** : les logs sont des flux d'événements ecrits sur stdout ; l'infrastructure s'occupe de les collecter et stocker. L'application ne sait pas ou vont ses logs.

</details>

**Question 2 — Qu'est-ce que la règle de dépendance dans une architecture propre (Clean Architecture) ?**

<details>
<summary>Réponse</summary>

Dans la Clean Architecture, les dépendances de code ne pointent que vers l'interieur : les couches externes (infrastructure, UI) dependent des couches internes (domaine, use cases), jamais l'inverse. Le domaine ne sait pas qu'une base de données existe. Cela permet de tester le domaine sans infrastructure, et de remplacer un adaptateur (ex : MySQL par PostgreSQL) sans toucher au métier.

</details>

---

## Analogie

**Apprendre une langue etrangere avant de voyager.**

Imaginez que vous partez travailler au Japon. Vous pouvez vous debrouiller avec Google Translate (traduction mot a mot), mais les malentendus seront fréquents : certains mots n'ont pas d'équivalent direct, les nuances culturelles disparaissent, les reunions deviennent fastidieuses.

Maintenant imaginez que vous apprenez le japonais : vous adoptez les concepts locaux, vous pensez dans la langue du pays, vous comprenez les sous-entendus. Les echanges sont fluides, rapides, sans friction de traduction.

Le DDD, c'est exactement ça : **parler la même langue que les experts métier**. Sans DDD, les développeurs traduisent en permanence entre le vocabulaire métier et le vocabulaire technique. Avec le DDD, un concept métier ("commande annulee") a le même nom dans la bouche du DBA, du Product Owner, du développeur et dans le code source.

---

## Théorie

### 1. Qu'est-ce que le DDD ?

Le Domain-Driven Design est une approche de conception logicielle formulee par Eric Evans en 2003. Son idee centrale : **la structure et le langage du code doivent refléter le domaine métier**, pas l'inverse.

Le DDD repond à une constatation simple : dans les projets complexes, le plus grand cout n'est pas technique — c'est la **friction de communication** entre les experts du domaine (comptables, juristes, logisticiens) et les développeurs.

```
SANS DDD                              AVEC DDD
-----------                           ---------
Expert : "La commande est suspendue"  Expert : "La commande est suspendue"
   |                                     |
   | traduction mentale                  | pas de traduction
   v                                     v
Dev : order.status = 'HOLD'          Dev : order.suspend()
   |                                     |
   | traduction SQL                      | meme concept dans le code
   v                                     v
DB : UPDATE orders SET status='HOLD'  DB : UPDATE orders SET status='SUSPENDED'
     (mais c'est quoi HOLD ? FREEZE ?       (le nom SQL correspond au terme metier)
      PENDING ? BLOCKED ?)
```

### 2. Langage Ubiquitaire (Ubiquitous Language)

Le Langage Ubiquitaire est un **vocabulaire partage**, rigoureusement défini, utilise par tous : experts métier, développeurs, testers, managers. Il doit apparaître :

- Dans les conversations (reunions, emails)
- Dans la documentation
- Dans le code (noms de classes, méthodes, variables)
- Dans les tests
- Dans la base de données (noms de tables, colonnes)

**Exemple — E-commerce :**

| Terme ambigu | Terme ubiquitaire | Définition précisé |
|---|---|---|
| "user" | `Customer` | Personne ayant passe au moins une commande |
| "user" | `Visitor` | Personne naviguant sans compte |
| "item" | `OrderLine` | Une ligne d'une commande (produit + quantité + prix au moment de l'achat) |
| "cancel" | `abandonCart` | Panier non finalisé dans les 24h |
| "cancel" | `cancelOrder` | Commande annulee avant expedition |
| "cancel" | `requestRefund` | Commande déjà expediee, retour demandé |

Notez comment "cancel" cache en realite trois opérations métier totalement différentes. Sans Langage Ubiquitaire, chaque développeur invente sa propre interprétation.

```typescript
// MAUVAIS — langage technique, ambigu
class UserService {
  cancel(userId: number, itemId: number): void { ... }
}

// BON — Langage Ubiquitaire
class CartApplicationService {
  abandonCart(visitorId: VisitorId): void { ... }
}

class OrderApplicationService {
  cancelOrder(customerId: CustomerId, orderId: OrderId): void { ... }
  requestRefund(customerId: CustomerId, orderId: OrderId, reason: RefundReason): void { ... }
}
```

### 3. DDD Stratégique vs DDD Tactique

Le DDD se divise en deux niveaux complementaires :

```
DDD
├── STRATEGIQUE (macro — "quoi construire")
│   ├── Bounded Contexts     (delimitation des modeles)
│   ├── Context Map          (relations entre contextes)
│   ├── Ubiquitous Language  (vocabulaire par contexte)
│   └── Core/Supporting/Generic Domain (priorités)
│
└── TACTIQUE (micro — "comment le construire")
    ├── Entities             (identite + cycle de vie)
    ├── Value Objects        (valeur sans identite)
    ├── Aggregates           (frontiere de coherence)
    ├── Domain Events        (fait metier passe)
    ├── Repositories         (acces aux agregats)
    ├── Domain Services      (logique sans foyer naturel)
    └── Factories            (creation complexe)
```

**Regle d'or : sans stratégique, le tactique est inutile.** Bien nommer une entité dans le mauvais contexte ne resout rien.

### 4. Sous-domaines : Core, Supporting, Generic

Pas tout le code n'à la même valeur stratégique. Distinguer :

| Type | Définition | Exemple e-commerce | Approche |
|---|---|---|---|
| **Core Domain** | Avantage concurrentiel réel, ce qui vous differencie | Algorithme de recommandation personalise | Fait maison, DDD complet, meilleurs devs |
| **Supporting Domain** | Nécessaire mais pas differenciateur | Gestion des retours, catalogue produits | Peut etre sous-traite, DDD léger |
| **Generic Domain** | Problème universel résolu par l'industrie | Envoi d'emails, paiement Stripe, auth OAuth | Achetez une solution du marche |

```
INVESTISSEMENT DDD
      ^
      |  Core Domain
      |  ████████████████   <- DDD complet, equipe senior
      |
      |  Supporting Domain
      |  ████████           <- DDD partiel, equipe standard
      |
      |  Generic Domain
      |  ██                 <- Bibliotheques, SaaS, pas de DDD
      +-----------------------> Valeur strategique
```

### 5. Quand le DDD est-il pertinent ?

Le DDD à un cout : montee en compétences, ceremonies de modélisation (Event Storming), overhead initial. Il n'est justifie que si la complexité métier le merite.

| Critère | DDD recommande | DDD inutile |
|---|---|---|
| Complexite métier | Elevee (règles, workflows, exceptions) | Faible (CRUD basique) |
| Duree de vie | Long terme (5+ ans) | Court terme (MVP, prototype) |
| Équipe | Pluridisciplinaire (devs + experts) | Solo ou petite équipe technique |
| Domaine | Finance, sante, logistique, e-commerce avance | Blog, site vitrine, formulaire simple |
| Budget modélisation | Disponible | Nul |

**Regles rapides :**
- Si votre logique métier tient dans un seul `if`, pas besoin de DDD.
- Si vous passez plus de temps a debattre des noms que des algorithmes, c'est que le DDD manque.
- Si les experts métier ne peuvent pas lire votre code (même sans connaître TypeScript), quelque chose cloche.

### 6. Processus de modélisation : Event Storming

L'Event Storming est l'atelier de modélisation DDD par excellence (Alberto Brandolini, 2013). Sur un grand tableau, on pose des post-its de couleurs :

```
LEGENDE EVENT STORMING
  [orange]  Domain Event      — quelque chose qui s'est passe ("Commande passee")
  [bleu]    Command           — intention declenchant un evenement ("Passer commande")
  [jaune]   Actor             — qui emet la commande ("Client")
  [lilas]   Aggregate         — sur quoi la commande agit ("Commande")
  [rose]    Policy            — regle automatique ("Si stock < 5, alerter")
  [rouge]   HotSpot           — question non resolue, debat a continuer
  [vert]    Read Model        — donnees lues pour afficher ("Recapitulatif panier")

FLUX TYPIQUE
  [Client] --> [Passer commande] --> [Commande] --> [Commande passee]
                                                         |
                                          [Si premier achat] --> [Envoyer bon de bienvenue]
```

---

## Pratique

### Exercice 1 — Définir un Langage Ubiquitaire

Voici un code "pre-DDD". Identifiez les ambiguites et proposez un refactoring.

```typescript
// AVANT — vocabulaire technique generique
interface User {
  id: number;
  name: string;
  type: string; // 'admin' | 'customer' | 'guest'
  active: boolean;
}

class UserService {
  create(data: Partial<User>): User { /* ... */ }
  update(id: number, data: Partial<User>): User { /* ... */ }
  delete(id: number): void { /* ... */ }
  disable(id: number): void { /* ... */ }
}
```

```typescript
// APRES — Langage Ubiquitaire, contextes separes

// Contexte : Gestion des acces
interface Administrator {
  readonly id: AdministratorId;
  readonly email: Email;
  readonly role: AdminRole; // 'SUPER_ADMIN' | 'CONTENT_MANAGER' | 'SUPPORT'
}

// Contexte : Ventes
interface Customer {
  readonly id: CustomerId;
  readonly fullName: PersonName;
  readonly email: Email;
  readonly registeredAt: Date;
}

interface GuestSession {
  readonly sessionId: SessionId;
  readonly cart: Cart;
  readonly expiresAt: Date;
}

// Les operations ont des noms metier precis
class CustomerAccountService {
  registerCustomer(email: Email, password: Password): Customer { /* ... */ }
  deactivateAccount(customerId: CustomerId, reason: DeactivationReason): void { /* ... */ }
  // PAS de "delete" — on ne supprime pas un client, on desactive son compte
}

class AdministratorService {
  revokeAccess(adminId: AdministratorId, revokedBy: AdministratorId): void { /* ... */ }
  // PAS de "disable" — on "revoke access" dans ce contexte
}
```

### Exercice 2 — Classer les sous-domaines

Vous construisez une plateforme de telemedicine. Classez ces composants :

```typescript
type Subdomain =
  | { name: string; type: 'core' | 'supporting' | 'generic' }

const components: Subdomain[] = [
  // CORE — avantage concurrentiel
  { name: 'Matching medecin-patient (IA)', type: 'core' },
  { name: 'Protocoles de triage urgence', type: 'core' },
  { name: 'Ordonnances electroniques signees', type: 'core' },

  // SUPPORTING — necessaire mais pas differenciateur
  { name: 'Gestion des rendez-vous', type: 'supporting' },
  { name: 'Dossier patient basique', type: 'supporting' },
  { name: 'Facturation / remboursements', type: 'supporting' },

  // GENERIC — achetez une solution
  { name: 'Envoi de SMS de rappel', type: 'generic' },    // Twilio
  { name: 'Visioconference', type: 'generic' },             // Daily.co, Whereby
  { name: 'Paiement en ligne', type: 'generic' },           // Stripe
  { name: 'Authentification', type: 'generic' },            // Auth0, Keycloak
];

// Allocation des ressources selon le type
function allocateTeam(subdomain: Subdomain): string {
  switch (subdomain.type) {
    case 'core':
      return 'Equipe senior, DDD complet, revues hebdo avec medecins';
    case 'supporting':
      return 'Equipe standard, DDD allegé, specifications fonctionnelles suffisent';
    case 'generic':
      return 'Integrez un SaaS, ne reinventez pas la roue';
  }
}
```

### Exercice 3 — Identifier le Core Domain dans un CMS multi-tenant

```typescript
// Dans le CMS Givexpert, quels sont les sous-domaines ?

const cmsSubdomains = {
  core: [
    'Multi-tenancy & isolation des donnees',     // differenciateur cle
    'Workflows de publication (Draft→Published)', // logique metier complexe
    'Blocs dynamiques hybrides',                  // specificite produit
    'Moteur de permissions par tenant',           // complexite elevee
  ],
  supporting: [
    'Gestion des utilisateurs back-office',
    'Analytics & reporting',
    'Themes & personnalisation CSS',
    'Gestion des medias (DAM)',
  ],
  generic: [
    'Authentification (Keycloak)',         // solution du marche
    'Stockage fichiers (S3)',              // AWS, pas de valeur a reinventer
    'Recherche plein texte (Elasticsearch)', // moteur du marche
    'Envoi emails transactionnels',        // SendGrid, Mailgun
  ],
};

// Consequence directe : ou investir le DDD ?
// -> Workflows de publication, multi-tenancy, blocs dynamiques
// -> PAS dans l'upload S3 ou l'envoi d'emails
```

---

## Résumé

- Le **DDD centre le code sur le domaine métier**, en alignant le vocabulaire des développeurs sur celui des experts.
- Le **Langage Ubiquitaire** elimine la friction de traduction : un même terme a le même sens dans les reunions, le code, la BDD et les tests.
- Le **DDD Stratégique** (Bounded Contexts, Core/Supporting/Generic) repond a "quoi construire et ou investir" ; le **DDD Tactique** (Entités, VO, Agregats) repond a "comment le modéliser".
- Le DDD n'est **pas universel** : pour un CRUD simple, il ajoute de la complexité sans valeur ; il brille sur les domaines complexes et les projets long-terme.
- L'**Event Storming** est l'atelier de modélisation DDD le plus efficace pour aligner toute l'équipe sur le domaine en quelques heures.


---

> **Lien fil rouge — ShopArch**
>
> - Définis l'Ubiquitous Language de ShopArch avec l'équipe (Product, Cart, Order, Checkout...)
> - Distingue les termes métier des termes techniques dans le domaine ShopArch
> - Exercice(s) associé(s) : `exercices/09-modeliser-domaine/`
> - Checkpoint : Module 02, critère 1

## Prochain cours

[Cours 15 — Bounded Contexts & Context Map](./02-bounded-contexts.md)
