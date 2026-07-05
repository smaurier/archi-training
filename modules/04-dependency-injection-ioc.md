---
titre: Injection de dépendances et inversion de contrôle
cours: 13-architecture
notions: [inversion de controle, injection de dependances, "injection par constructeur (vs setter/methode)", conteneur IoC, "DI manuelle vs conteneur", couplage et testabilite, "lien avec le principe DIP", anti-pattern Service Locator]
outcomes:
  - sait distinguer l'inversion de contrôle (le principe) de l'injection de dépendances (la technique)
  - sait refactorer un couplage dur en injection par constructeur et dessiner le sens des dépendances
  - sait décider entre DI manuelle et conteneur IoC selon la taille et le contexte d'un projet
  - sait relier DI, DIP et testabilité, et reconnaître l'anti-pattern Service Locator
prerequis: [modules 00-03 de ce cours, dont 01-principes-solid]
next: 05-architecture-en-couches
libs: []
tribuzen: backend TribuZen — le service métier RitualService dépend de ports injectés (RitualRepository, NotificationPort) au lieu de les instancier
last-reviewed: 2026-07
---

# Injection de dépendances et inversion de contrôle

> **Outcomes — tu sauras FAIRE :** refactorer un couplage dur en injection par constructeur, dessiner le sens des dépendances, décider entre DI manuelle et conteneur, relier DI au principe DIP.
> **Difficulté :** :star::star::star:
>
> **Portée :** ce module traite la DI/IoC comme **principe d'architecture** — le raisonnement sur le couplage, la testabilité et le sens des dépendances. Le **conteneur IoC concret de NestJS** (décorateurs `@Injectable`, `providers`, scopes, tokens) est le sujet du **cours 09 (NestJS)** — ici on le mentionne mais on ne le code pas. Le principe DIP dont dérive la DI a été posé au **module 01 (SOLID)** ; ce module en montre la mise en œuvre.

## 1. Cas concret d'abord

Dans le backend TribuZen, un développeur écrit le service qui enregistre le « rituel » quotidien d'une famille (un petit rendez-vous de bien-être). Voici son premier jet :

```ts
// RitualService.ts — AVANT (couplage dur)
class RitualService {
  private repo = new PostgresRitualRepository()   // ← instancie une classe concrète
  private notifier = new FirebasePushNotifier()   // ← instancie un service externe

  async completeRitual(familyId: string, ritualId: string): Promise<void> {
    const ritual = await this.repo.findById(ritualId)
    if (!ritual) throw new Error('Rituel introuvable')

    ritual.completedAt = new Date()
    await this.repo.save(ritual)

    // envoie une notif push à toute la famille
    this.notifier.sendToFamily(familyId, 'Rituel accompli !')
  }
}
```

Ce code marche en production. Mais essaie d'écrire **un seul test unitaire** de `completeRitual` :

1. `new PostgresRitualRepository()` ouvre une **vraie connexion Postgres** — le test exige une base de données.
2. `new FirebasePushNotifier()` appelle **le vrai Firebase** — le test envoie une notif réelle à chaque exécution.
3. `RitualService` **décide lui-même** de quelles implémentations il dépend — impossible de les remplacer sans éditer la classe.

Le problème n'est pas la logique métier : c'est que la classe **contrôle la création de ses propres dépendances**. Tant que ce contrôle reste à l'intérieur, la classe est soudée à Postgres et à Firebase. Ce module montre comment **inverser** ce contrôle.

---

## 2. Théorie complète, concise

### 2.1 Inversion de contrôle (IoC) — le principe

Par défaut, un objet **contrôle** la création de ce dont il a besoin :

```ts
class A {
  private b = new B()   // A décide QUELLE classe et QUAND l'instancier
}
```

L'**inversion de contrôle** renverse cette responsabilité : ce n'est plus l'objet qui crée ses dépendances, c'est **un agent extérieur** (le code appelant, ou un conteneur) qui les lui fournit.

```ts
class A {
  constructor(private b: B) {}   // quelqu'un d'autre décide et fournit B
}
```

IoC est un principe large (« ne m'appelle pas, je t'appellerai » — le framework pilote ton code, pas l'inverse). L'**injection de dépendances** en est le cas particulier qui concerne les dépendances entre objets.

### 2.2 Injection de dépendances (DI) — la technique

La DI consiste à **fournir** à un objet ses collaborateurs plutôt que de le laisser les instancier. Trois formes, de la plus recommandée à la plus rare :

- **Injection par constructeur** — les dépendances sont des paramètres du constructeur. Elles deviennent **visibles** (le constructeur est le contrat de la classe) et **obligatoires** (l'objet ne peut pas exister dans un état à moitié construit). C'est la forme par défaut.
- **Injection par setter/propriété** — la dépendance est assignée après construction (`service.logger = ...`). L'objet peut exister sans elle → état potentiellement invalide, dépendance cachée. À éviter, sauf dépendance vraiment optionnelle.
- **Injection par méthode** — la dépendance est passée en argument d'une méthode précise. Utile quand elle change à **chaque appel** (ex. un contexte de requête), pas quand c'est une dépendance stable de service.

> **Règle par défaut :** injection par constructeur. Si tu hésites, c'est celle-là.

### 2.3 Dépendre d'une abstraction, pas d'un concret

Injecter `new PostgresRitualRepository()` par le constructeur, c'est déjà mieux, mais la classe reste typée sur une implémentation concrète. Le vrai levier est de **typer le paramètre sur une interface** (un *port*) :

```ts
interface RitualRepository {
  findById(id: string): Promise<Ritual | null>
  save(ritual: Ritual): Promise<void>
}

interface NotificationPort {
  sendToFamily(familyId: string, message: string): void
}

class RitualService {
  constructor(
    private readonly repo: RitualRepository,     // interface, pas Postgres
    private readonly notifier: NotificationPort,  // interface, pas Firebase
  ) {}
}
```

Maintenant `RitualService` ne connaît **que des contrats**. On peut lui donner une implémentation Postgres en production et une implémentation en mémoire dans les tests — sans toucher une ligne de `RitualService`.

### 2.4 Le lien direct avec DIP (module 01)

Le **Dependency Inversion Principle** (SOLID, module 01) dit : *les modules de haut niveau ne doivent pas dépendre des modules de bas niveau ; les deux doivent dépendre d'abstractions.* La DI est **la mécanique concrète** qui réalise ce principe :

- **DIP** = la règle sur le **sens des dépendances** (le métier dépend d'une interface, l'infra implémente cette interface).
- **DI** = **comment** on fournit l'implémentation à l'objet (par le constructeur).

Sans DI, DIP reste un vœu pieux : si la classe fait `new` sur le concret, elle dépend du bas niveau, quelle que soit l'interface déclarée.

Le **sens des dépendances** se dessine ainsi (la flèche = « dépend de ») :

```
AVANT (couplage dur)          APRÈS (DI + interface)
──────────────────────        ──────────────────────────────
RitualService                 RitualService ──▶ RitualRepository  (interface)
     │                                               ▲
     ▼                                               │ implémente
PostgresRepository            PostgresRepository ─────┘
(le métier dépend             (l'infra dépend du contrat défini
 de l'infra)                   par le métier — dépendance inversée)
```

La flèche entre `RitualService` et l'infra a **changé de sens** : c'est ça, l'inversion.

### 2.5 DI manuelle vs conteneur IoC

Une fois les dépendances injectées par constructeur, quelqu'un doit **assembler** le graphe : créer les implémentations concrètes et les passer. Deux façons :

**DI manuelle** — tu câbles à la main, en général dans un point d'entrée (« composition root ») :

```ts
// main.ts — composition root : le SEUL endroit qui connaît le concret
const repo = new PostgresRitualRepository(dbPool)
const notifier = new FirebasePushNotifier(firebaseApp)
const ritualService = new RitualService(repo, notifier)
```

Simple, explicite, zéro magie, zéro dépendance. Suffisant pour un petit projet, un script, une lib. Le coût monte quand le graphe grossit : câbler 40 services à la main devient fastidieux et répétitif.

**Conteneur IoC** — une bibliothèque (le conteneur de NestJS, Angular, Spring…) qui **résout automatiquement** le graphe : tu déclares « ce port → cette implémentation », et le conteneur construit les objets dans le bon ordre, gère leur durée de vie (une seule instance partagée, ou une par requête), et les injecte.

```ts
// Idée conceptuelle (le détail NestJS = cours 09) :
// « quand quelqu'un demande RitualRepository, fournis PostgresRitualRepository »
providers: [
  { provide: 'RitualRepository', useClass: PostgresRitualRepository },
  RitualService,
]
```

**Le point clé :** un conteneur n'est **pas** de la DI. La DI, c'est déjà d'avoir mis les dépendances au constructeur. Le conteneur n'est qu'un **automate d'assemblage** qui remplace le câblage manuel quand il devient coûteux. On peut faire de la DI parfaite sans aucun conteneur.

| | DI manuelle | Conteneur IoC |
|---|---|---|
| Câblage | à la main, composition root | automatique, déclaratif |
| Dépendance externe | aucune | une bibliothèque (framework) |
| Lisibilité | explicite, « on voit tout » | implicite, « magique » |
| Coût quand le graphe grossit | croît (répétitif) | stable |
| Bon pour | petit projet, lib, script | app moyenne/grande (NestJS…) |

### 2.6 Couplage et testabilité — le bénéfice mesurable

Le gain de la DI n'est pas esthétique, il est **opérationnel**. Avec l'injection par constructeur d'interfaces, tester devient trivial :

```ts
// implémentation de test — zéro infra, tout en mémoire
class InMemoryRitualRepository implements RitualRepository {
  private store = new Map<string, Ritual>()
  async findById(id: string) { return this.store.get(id) ?? null }
  async save(r: Ritual) { this.store.set(r.id, r) }
}

class SpyNotifier implements NotificationPort {
  sent: Array<{ familyId: string; message: string }> = []
  sendToFamily(familyId: string, message: string) {
    this.sent.push({ familyId, message })   // on enregistre au lieu d'envoyer
  }
}

// le test : instanciation directe, pas de base, pas de réseau
const repo = new InMemoryRitualRepository()
const notifier = new SpyNotifier()
const service = new RitualService(repo, notifier)
```

Une classe testable **sans mock lourd ni infra** est presque toujours une classe bien découplée. La difficulté à tester est un **signal d'alarme** de couplage — la DI est le remède.

### 2.7 L'anti-pattern à connaître : Service Locator

Le Service Locator ressemble à de la DI mais fait l'inverse : au lieu de **recevoir** ses dépendances, l'objet va les **chercher** dans un registre global.

```ts
class RitualService {
  completeRitual(/* ... */) {
    // ✗ va chercher sa dépendance dans un registre global
    const repo = ServiceLocator.get<RitualRepository>('RitualRepository')
    // ...
  }
}
```

Pourquoi c'est mauvais :
- **Dépendances invisibles** — la signature de la classe ne dit plus de quoi elle a besoin.
- **Tests pénibles** — il faut configurer (et nettoyer) le registre global avant chaque test.
- **Couplage caché** — la classe dépend maintenant du `ServiceLocator` lui-même.
- **Erreurs au runtime** — si le service n'est pas enregistré, ça casse à l'usage, pas à la compilation.

L'injection par constructeur rend toutes les dépendances explicites et vérifiées par le compilateur. C'est la raison pour laquelle « demander » est un anti-pattern et « recevoir » est la bonne pratique.

---

## 3. Worked examples

### Exemple 1 — Refactorer le couplage dur du §1

On reprend le `RitualService` soudé et on l'amène en DI, étape par étape.

**Étape 1 — extraire les contrats (ports).** On regarde ce dont le service a *vraiment* besoin, indépendamment de la techno :

```ts
interface RitualRepository {
  findById(id: string): Promise<Ritual | null>
  save(ritual: Ritual): Promise<void>
}
interface NotificationPort {
  sendToFamily(familyId: string, message: string): void
}
```

**Étape 2 — remonter les dépendances au constructeur, typées sur les ports :**

```ts
// RitualService.ts — APRÈS
class RitualService {
  constructor(
    private readonly repo: RitualRepository,
    private readonly notifier: NotificationPort,
  ) {}

  async completeRitual(familyId: string, ritualId: string): Promise<void> {
    const ritual = await this.repo.findById(ritualId)
    if (!ritual) throw new Error('Rituel introuvable')

    ritual.completedAt = new Date()
    await this.repo.save(ritual)

    this.notifier.sendToFamily(familyId, 'Rituel accompli !')
  }
}
```

La logique métier n'a **pas bougé d'une ligne**. Seul le mode d'obtention des dépendances a changé.

**Étape 3 — implémenter les ports côté infra :**

```ts
class PostgresRitualRepository implements RitualRepository {
  constructor(private readonly db: DbPool) {}
  async findById(id: string) { /* SELECT ... */ return null }
  async save(r: Ritual) { /* INSERT/UPDATE ... */ }
}

class FirebasePushNotifier implements NotificationPort {
  constructor(private readonly app: FirebaseApp) {}
  sendToFamily(familyId: string, message: string) { /* app.messaging()... */ }
}
```

**Étape 4 — assembler au composition root (DI manuelle) :**

```ts
// main.ts — le seul fichier qui connaît le concret
const repo = new PostgresRitualRepository(dbPool)
const notifier = new FirebasePushNotifier(firebaseApp)
const ritualService = new RitualService(repo, notifier)
```

Résultat : `RitualService` est désormais testable sans Postgres ni Firebase, et on pourrait remplacer Firebase par un notifieur e-mail sans jamais rouvrir le service.

### Exemple 2 — Décider : DI manuelle ou conteneur ?

Deux contextes TribuZen, deux décisions justifiées.

**Contexte A — un script de migration ponctuel** qui recalcule des statistiques de rituels. Trois services impliqués, exécuté une fois.

> **Décision : DI manuelle.** Le graphe est minuscule, le script jetable. Ajouter un conteneur (et sa configuration) serait un coût sans bénéfice. Trois `new` dans un `main` suffisent.

**Contexte B — le backend TribuZen complet** : ~30 services, dépendances croisées, durées de vie différentes (un pool de connexions partagé = une instance ; un contexte utilisateur = une instance par requête HTTP).

> **Décision : conteneur IoC (celui de NestJS, cours 09).** Câbler 30 services et gérer les durées de vie à la main deviendrait une source d'erreurs. Le conteneur résout le graphe et gère les scopes automatiquement. Le prix à payer — un peu de « magie » et une dépendance au framework — est justifié à cette échelle.

**Le critère de décision :** taille du graphe + gestion des durées de vie. Petit et statique → manuel. Grand ou avec des scopes → conteneur. Dans les deux cas, **la DI (constructeur + interfaces) est identique** ; seul l'assembleur change.

---

## 4. Pièges & misconceptions

### PIÈGE #1 — Confondre « DI » et « avoir un conteneur »

« On fait de la DI parce qu'on utilise NestJS. » Faux dans les deux sens. On peut utiliser un conteneur en gardant du couplage dur (`new` à l'intérieur d'un service malgré `@Injectable`), et on peut faire de la DI impeccable avec zéro conteneur (trois `new` dans un `main`). **La DI, c'est injecter par le constructeur ; le conteneur n'est qu'un automate d'assemblage optionnel.**

### PIÈGE #2 — Injecter le concret au lieu de l'abstraction

```ts
// ✗ dépendance injectée, mais typée sur le concret : couplage toujours là
constructor(private repo: PostgresRitualRepository) {}

// ✓ typée sur l'interface : le service ne connaît qu'un contrat
constructor(private repo: RitualRepository) {}
```

Remonter la dépendance au constructeur **sans** l'abstraire ne réalise pas DIP. Le métier reste soudé à Postgres, juste un cran plus haut. La testabilité ne progresse presque pas.

### PIÈGE #3 — Prendre le Service Locator pour de la DI

Récupérer une dépendance via `container.get('X')` **à l'intérieur** d'une méthode, ce n'est pas de l'injection : c'est du Service Locator (§2.7). Le signe qui ne trompe pas : la dépendance **n'apparaît pas** dans la signature du constructeur. Si tu dois lire le corps des méthodes pour savoir de quoi une classe dépend, c'est un Service Locator déguisé.

### PIÈGE #4 — Sur-abstraire « au cas où »

Créer une interface pour **chaque** classe, y compris celles qui n'auront jamais qu'une implémentation et ne sont jamais mockées, ajoute de l'indirection sans bénéfice. On abstrait ce qui **varie ou traverse une frontière** (l'infra : base, réseau, tiers), pas la logique pure interne. DI ne veut pas dire « une interface partout ».

### PIÈGE #5 — Injection par setter là où le constructeur suffit

```ts
// ✗ l'objet peut exister sans repo → NullPointer différé, dépendance cachée
service.repo = new PostgresRitualRepository()

// ✓ dépendance obligatoire et visible dès la construction
new RitualService(repo, notifier)
```

Le setter n'est justifié que pour une dépendance **réellement optionnelle** ou pour casser un cycle. Par défaut, le constructeur garantit qu'un objet construit est un objet **utilisable**.

---

## 5. Ancrage TribuZen

Dans TribuZen, la DI structure toute la **couche métier du backend** (le module 05 montrera comment cette couche se pose dans une architecture en couches).

**`RitualService`** (le fil rouge de ce module) dépend de deux ports :
- `RitualRepository` — persistance des rituels (implémenté par Postgres en prod, en mémoire en test) ;
- `NotificationPort` — notification à la famille (implémenté par Firebase Push en prod, un espion en test).

D'autres services suivent exactement le même schéma :
- `FamilyService` dépend de `FamilyRepository` ;
- `CheckInService` (le pointage d'humeur quotidien) dépend de `CheckInRepository` et de `NotificationPort` (port partagé, une seule interface, plusieurs consommateurs).

Le **sens des dépendances** est toujours le même : le service métier définit le port (l'interface vit avec le métier), l'infra l'implémente. C'est DIP réalisé par DI.

**Décision d'architecture TribuZen :** le backend tourne sur NestJS, donc l'assemblage passe par **le conteneur IoC de NestJS** (déclaration des `providers`, substitution d'implémentation en test) — le détail de ces décorateurs et de leur configuration est traité au **cours 09**. Ce qui compte ici : que chaque service reste typé sur des **ports**, jamais sur du concret, pour que le conteneur (ou un `new` manuel en test) puisse injecter n'importe quelle implémentation.

Fichiers cibles dans `smaurier/tribuzen` :
```
tribuzen/
  src/
    ritual/
      ritual.service.ts          ← dépend de RitualRepository + NotificationPort
      ritual.repository.ts       ← interface (port) définie avec le métier
      ritual.repository.pg.ts    ← implémentation Postgres (infra)
    notification/
      notification.port.ts       ← interface partagée
```

---

## 6. Points clés

1. **IoC** est le principe (un agent externe fournit les dépendances) ; **DI** est la technique (les fournir par le constructeur).
2. **Injection par constructeur** par défaut : dépendances visibles, obligatoires, objet toujours valide. Setter/méthode = cas particuliers.
3. Injecter ne suffit pas : il faut **typer sur une interface (port)**, sinon le couplage au concret demeure.
4. La DI est **la mise en œuvre de DIP** (module 01) : le métier définit le port, l'infra l'implémente, la flèche de dépendance s'inverse.
5. **DI manuelle** (composition root) pour les petits graphes ; **conteneur IoC** quand le graphe grossit ou qu'il faut gérer des durées de vie. Le conteneur n'est pas la DI.
6. Une classe **difficile à tester sans infra** signale un couplage dur ; la DI + interfaces rend le test trivial (implémentation en mémoire, espion).
7. **Service Locator** (aller chercher ses dépendances dans un registre) est un anti-pattern : dépendances cachées, tests pénibles, erreurs au runtime.

---

## 7. Seeds Anki

```
Quelle est la différence entre IoC et DI ?|IoC est le principe (un agent externe contrôle et fournit les dépendances, au lieu que l'objet les crée) ; DI est la technique concrète pour l'appliquer, le plus souvent l'injection par constructeur.
Pourquoi préférer l'injection par constructeur au setter ?|Les dépendances deviennent visibles (le constructeur = contrat de la classe) et obligatoires : un objet construit est toujours dans un état valide. Le setter permet un objet à moitié construit, avec des dépendances cachées.
Injecter une dépendance par le constructeur suffit-il à découpler ?|Non : si le paramètre est typé sur une classe concrète (PostgresRepository), le couplage demeure. Il faut typer sur une interface/port pour réaliser DIP et pouvoir substituer l'implémentation.
Quel est le lien entre DI et le principe DIP (SOLID) ?|DIP dit que le haut niveau dépend d'abstractions, pas du bas niveau. DI est la mécanique qui le réalise : on fournit l'implémentation au constructeur, typée sur l'interface définie par le métier. Sans DI, DIP reste théorique.
Un conteneur IoC est-il indispensable pour faire de la DI ?|Non. La DI, c'est injecter par le constructeur ; on peut la faire avec trois `new` dans un composition root (DI manuelle). Le conteneur n'est qu'un automate d'assemblage utile quand le graphe grossit ou qu'il faut gérer des scopes.
Quand choisir DI manuelle plutôt qu'un conteneur ?|Petit graphe statique, script jetable ou lib : DI manuelle (explicite, zéro dépendance). Grand graphe ou durées de vie multiples (singleton/par requête) : conteneur IoC.
Qu'est-ce que le Service Locator et pourquoi est-ce un anti-pattern ?|Un objet va chercher ses dépendances dans un registre global au lieu de les recevoir. Anti-pattern car dépendances invisibles (absentes du constructeur), tests pénibles (registre à configurer/nettoyer), couplage au locator, erreurs au runtime.
Quel signal indique qu'une classe est mal découplée ?|La difficulté à la tester sans infra (vraie base, réseau, service tiers). Une classe testable par simple instanciation avec des implémentations en mémoire est presque toujours bien découplée.
```

---

## Pont vers le lab

> Lab associé : `labs/lab-04-dependency-injection-ioc/README.md`. Refactorer un couplage dur en DI et dessiner le graphe de dépendances — exercice de conception évalué par grille + coach, avec variante J+30. Zéro harnais.
