---
titre: Les principes SOLID
cours: 13-architecture
notions: ["SRP — une raison de changer", "OCP — ouvert extension fermé modification", "LSP — substituabilité", "ISP — interfaces ségréguées", "DIP — dépendre d'abstractions", "code smells liés aux violations SOLID", "quand SOLID = over-engineering"]
outcomes:
  - sait énoncer les 5 principes SOLID et le problème que chacun résout
  - sait repérer une violation SRP/OCP/LSP/ISP/DIP dans un design existant
  - sait proposer un refactoring TypeScript qui lève la violation sans over-engineering
  - sait décider quand NE PAS appliquer SOLID (prototype, code figé, logique triviale)
prerequis: ["Module 00 — qu'est-ce que l'architecture et posture (distinction architecture vs design)"]
next: 02-design-patterns-essentiels
libs: []
tribuzen: "cœur métier TribuZen — le ReminderService (rappels de rituels familiaux) refactoré pour respecter SRP et DIP"
last-reviewed: 2026-07
---

# Les principes SOLID

> **Outcomes — tu sauras FAIRE :** repérer une violation SRP/OCP/LSP/ISP/DIP dans un design, proposer le refactoring qui la lève, décider quand SOLID est de l'over-engineering.
> **Difficulté :** :star::star::star:
>
> **Portée :** ce module couvre **uniquement les 5 principes SOLID** comme grille de lecture d'un design. Le **D (Dependency Inversion)** est introduit ici comme principe ; sa mise en œuvre concrète (conteneur IoC, injection par constructeur, tokens) est approfondie au **module 04 — dependency injection & IoC**. Les patterns qui *implémentent* OCP/DIP (Strategy, Factory, Adapter…) sont le sujet du **module 02 — design patterns essentiels**. Ici, on reste au niveau du **raisonnement** : nommer la violation, justifier le refactoring.

## 1. Cas concret d'abord

Tu rejoins l'équipe TribuZen. Première tâche : reprendre le `ReminderService`, le service qui envoie les rappels de rituels familiaux (« C'est l'heure du rituel du soir »). Un collègue a écrit ça vite, et les tests sont impossibles à lancer sans une vraie base et un vrai serveur SMTP :

```ts
// ReminderService.ts — AVANT (tel qu'on te le donne)
class ReminderService {
  private db = new PostgresClient('postgres://prod...')   // ← instancie une impl concrète
  private mailer = new SmtpMailer('smtp.sendgrid.net')    // ← idem

  async sendDailyReminders(familyId: string): Promise<void> {
    // 1. va chercher les données
    const rows = await this.db.query(
      `SELECT * FROM rituals WHERE family_id = $1 AND active = true`, [familyId],
    )

    // 2. décide quoi envoyer (règle métier)
    const due = rows.filter(r => new Date(r.next_run) <= new Date())

    // 3. met en forme le message (présentation)
    for (const r of due) {
      const html = `<h1>${r.title}</h1><p>C'est l'heure : ${r.time}</p>`

      // 4. envoie (infrastructure)
      await this.mailer.send(r.parent_email, 'Rappel TribuZen', html)

      // 5. persiste l'état (infrastructure)
      await this.db.query(
        `UPDATE rituals SET last_sent = now() WHERE id = $1`, [r.id],
      )
    }
  }
}
```

Avant toute théorie, **compte les raisons pour lesquelles cette classe devra changer** :

1. La règle « est-ce dû ? » évolue (fuseaux horaires, snooze) → on touche cette classe.
2. On veut envoyer par **push mobile** en plus de l'email → on touche cette classe.
3. La mise en forme du message change (branding) → on touche cette classe.
4. On migre de Postgres vers autre chose → on touche cette classe.
5. On veut **tester** la règle métier sans base ni SMTP → **impossible**, tout est câblé en dur.

Cinq raisons de changer, zéro testabilité. Ce module te donne la grille — SOLID — pour nommer *exactement* chacun de ces problèmes et le corriger un par un.

---

## 2. Théorie complète, concise

SOLID est un acronyme de Robert C. Martin (*Uncle Bob*). Ce sont **5 heuristiques de conception orientée objet**, pas des lois. Objectif commun : du code qui **change sans casser** et se **teste isolément**.

```
S — Single Responsibility Principle   une classe = une seule raison de changer
O — Open/Closed Principle             ouvert à l'extension, fermé à la modification
L — Liskov Substitution Principle     un sous-type remplace son type sans surprise
I — Interface Segregation Principle   pas d'interface fourre-tout imposée au client
D — Dependency Inversion Principle    dépendre d'abstractions, pas d'implémentations
```

### 2.1 SRP — Single Responsibility Principle

> « Une classe ne doit avoir **qu'une seule raison de changer**. »

La « raison de changer » se lit en termes d'**acteur** : qui, dans l'organisation, peut demander une modification ? Le métier (règle « est-ce dû ? »), le marketing (mise en forme du mail), l'infra (base de données) sont trois acteurs différents. S'ils tirent tous sur la même classe, chaque changement risque d'en casser un autre.

Test rapide : décris la classe en une phrase. Si tu es obligé d'utiliser « **et** » (« il récupère les données **et** les met en forme **et** les envoie »), c'est un signal SRP.

```ts
// Violation : ArticleService fait tout
class ArticleService {
  fetch(id: string) { /* accès données */ }
  toHtml() { /* présentation */ }
  save() { /* persistance */ }
  emailAuthor() { /* notification */ }
}
// 4 acteurs → 4 raisons de changer → 1 seule classe = fragile
```

SRP découpe : `ArticleRepository` (données), `ArticleRenderer` (présentation), `ArticleNotifier` (notif). Chacun a **un** acteur.

### 2.2 OCP — Open/Closed Principle

> « Ouvert à l'**extension**, fermé à la **modification**. »

Tu dois pouvoir ajouter un comportement **sans rouvrir** le code déjà testé et en production. Le symptôme de violation : un `switch`/chaîne de `if` sur un « type » qui grandit à chaque nouveau cas.

```ts
// Violation OCP : chaque nouveau canal rouvre la classe
class Notifier {
  send(msg: string, channel: string) {
    if (channel === 'email') { /* ... */ }
    if (channel === 'sms')   { /* ... */ }
    if (channel === 'push')  { /* ... */ }   // ← on rouvre encore
  }
}
```

```ts
// Respect OCP : on ferme Notifier, on ouvre par de nouvelles classes
interface Channel { send(msg: string): Promise<void> }

class EmailChannel implements Channel { async send(m: string) { /* ... */ } }
class SmsChannel   implements Channel { async send(m: string) { /* ... */ } }
// Nouveau canal push ? → nouvelle classe PushChannel, on ne touche à RIEN d'existant.

class Notifier {
  constructor(private readonly channels: Channel[]) {}
  async broadcast(msg: string) {
    for (const c of this.channels) await c.send(msg)
  }
}
```

OCP se paie en abstraction : ne l'applique qu'aux axes de variation **réels** (voir §4).

### 2.3 LSP — Liskov Substitution Principle

> « Un sous-type doit pouvoir **remplacer** son type parent sans altérer la correction du programme. »

Si du code marche avec `Parent`, il doit marcher avec n'importe quel `Enfant` sans le savoir. Violer LSP, c'est qu'un enfant **renforce une précondition**, **affaiblit une postcondition**, ou **jette une exception** là où le parent ne le fait pas.

Le cas d'école (rectangle/carré) :

```ts
class Rectangle {
  constructor(protected w: number, protected h: number) {}
  setWidth(w: number)  { this.w = w }
  setHeight(h: number) { this.h = h }
  area() { return this.w * this.h }
}
class Square extends Rectangle {
  setWidth(w: number)  { this.w = w; this.h = w }   // ← effet de bord surprise
  setHeight(h: number) { this.w = h; this.h = h }
}

function stretchAndCheck(r: Rectangle) {
  r.setWidth(5); r.setHeight(10)
  return r.area()          // attendu 50 ; avec un Square on obtient 100 → contrat brisé
}
```

Correctif : **ne pas hériter** quand le comportement diverge. Faire de `Shape` une interface et laisser `Rectangle` et `Square` l'implémenter chacun à sa façon (composition > héritage).

### 2.4 ISP — Interface Segregation Principle

> « Un client ne doit pas être **forcé de dépendre de méthodes qu'il n'utilise pas**. »

Une grosse interface fourre-tout oblige chaque implémenteur à fournir des méthodes vides ou à lever `NotImplemented`. C'est le SRP appliqué aux **interfaces** : découpe par rôle client.

```ts
// Violation : interface fourre-tout
interface Repository<T> {
  findById(id: string): Promise<T | null>
  save(x: T): Promise<void>
  bulkImport(rows: unknown[]): Promise<void>   // seul l'ETL en a besoin
  vacuum(): Promise<void>                       // seul l'admin DB en a besoin
}
```

```ts
// Respect ISP : chaque client dépend d'un rôle étroit
interface Reader<T> { findById(id: string): Promise<T | null> }
interface Writer<T> { save(x: T): Promise<void> }
// bulkImport / vacuum vivent dans des interfaces séparées (ImportPort, MaintenancePort)
```

### 2.5 DIP — Dependency Inversion Principle

> « Les modules de **haut niveau** ne dépendent pas des modules de **bas niveau** ; les deux dépendent d'**abstractions**. »

Le haut niveau, c'est la **règle métier** (« envoyer les rappels dus »). Le bas niveau, c'est le **détail technique** (Postgres, SMTP). En OO naïf, le métier dépend du détail (`new PostgresClient()`). DIP **inverse** la flèche : on définit l'abstraction *côté métier*, et le détail l'implémente.

```ts
// Le métier possède l'abstraction (le "port")
interface RitualRepository {
  findDue(familyId: string): Promise<Ritual[]>
  markSent(id: string): Promise<void>
}

// Le détail implémente le port (l'"adapter") — vit dans la couche infra
class PostgresRitualRepository implements RitualRepository { /* SQL réel */ }
class InMemoryRitualRepository implements RitualRepository { /* pour les tests */ }

class ReminderService {
  constructor(private readonly repo: RitualRepository) {}   // dépend de l'abstraction
}
```

> **Renvoi :** *comment* `repo` arrive dans le constructeur (conteneur IoC, `@Injectable`, tokens de provider) = **module 04**. DIP est le **principe** ; l'injection de dépendances est la **technique** qui le réalise. Ne pas confondre les deux.

DIP est ce qui rend le `ReminderService` **testable** : en test on injecte `InMemoryRitualRepository`, pas de base ni de SMTP.

### 2.6 Comment les 5 s'articulent

- **SRP** découpe les responsabilités → on obtient des collaborateurs distincts.
- Ces collaborateurs communiquent par **interfaces** (**ISP** les garde étroites).
- **DIP** dit dans quel sens pointe la dépendance vers ces interfaces (vers l'abstraction).
- **OCP** est le *résultat* : une fois qu'on dépend d'abstractions, on étend par de nouvelles implémentations.
- **LSP** est la *condition de validité* : ces implémentations doivent être vraiment substituables, sinon OCP/DIP produisent des bugs silencieux.

---

## 3. Worked examples

### Exemple 1 — Refactorer le `ReminderService` du §1

On traite les problèmes **dans l'ordre**, un principe à la fois.

**Étape A — SRP : séparer les responsabilités.** On identifie 4 acteurs → 4 collaborateurs :

```ts
// 1. Le port de données (abstraction possédée par le métier) — DIP + ISP (étroit)
interface RitualRepository {
  findDue(familyId: string, now: Date): Promise<Ritual[]>
  markSent(id: string, at: Date): Promise<void>
}

// 2. Le port d'envoi — DIP + OCP (on ajoutera des canaux sans toucher au métier)
interface ReminderChannel {
  notify(to: string, reminder: RenderedReminder): Promise<void>
}

// 3. La présentation — SRP (une seule raison de changer : le branding)
interface ReminderRenderer {
  render(ritual: Ritual): RenderedReminder
}
```

**Étape B — le métier ne dépend plus que d'abstractions (DIP) :**

```ts
class ReminderService {
  constructor(
    private readonly repo: RitualRepository,
    private readonly renderer: ReminderRenderer,
    private readonly channels: ReminderChannel[],   // OCP : liste ouverte de canaux
    private readonly clock: () => Date = () => new Date(),  // même l'heure est injectée
  ) {}

  // Seule responsabilité qui reste ici : ORCHESTRER la règle "envoyer les dus"
  async sendDailyReminders(familyId: string): Promise<void> {
    const now = this.clock()
    const due = await this.repo.findDue(familyId, now)

    for (const ritual of due) {
      const message = this.renderer.render(ritual)
      await Promise.all(this.channels.map(c => c.notify(ritual.contact, message)))
      await this.repo.markSent(ritual.id, now)
    }
  }
}
```

**Étape C — les détails implémentent les ports (couche infra) :**

```ts
class PostgresRitualRepository implements RitualRepository { /* SQL réel */ }
class HtmlReminderRenderer   implements ReminderRenderer   { /* templating */ }
class EmailChannel implements ReminderChannel { /* SendGrid */ }
class PushChannel  implements ReminderChannel { /* Firebase — AJOUTÉ sans toucher au service (OCP) */ }
```

**Ce qu'on a gagné, principe par principe :**

| Problème du §1 | Principe | Comment c'est levé |
|---|---|---|
| 5 raisons de changer | SRP | 4 collaborateurs, chacun 1 acteur |
| Ajouter le push rouvrait la classe | OCP | nouveau `PushChannel`, `ReminderService` intact |
| Impossible à tester (base + SMTP en dur) | DIP | ports injectés → `InMemory*` + faux canal en test |
| `find*` mêlait maintenance DB | ISP | `RitualRepository` ne porte que ce que le métier utilise |

**Test unitaire devenu trivial :**

```ts
const repo = new InMemoryRitualRepository([{ id: 'r1', contact: 'a@b.c', /* dû */ }])
const sent: string[] = []
const fakeChannel: ReminderChannel = { async notify(to) { sent.push(to) } }

const svc = new ReminderService(repo, new HtmlReminderRenderer(), [fakeChannel],
  () => new Date('2026-07-05T20:00:00Z'))   // horloge figée = test déterministe

await svc.sendDailyReminders('fam-1')
// assert : sent === ['a@b.c'] — aucune base, aucun SMTP
```

### Exemple 2 — Repérer une violation LSP dans un design de paiement

Design proposé : `PaymentMethod` avec `refund()`, et une sous-classe `GiftCardPayment`.

```ts
class PaymentMethod {
  charge(amount: number): Promise<void> { /* ... */ }
  refund(amount: number): Promise<void> { /* ... */ }
}
class GiftCardPayment extends PaymentMethod {
  refund(): Promise<void> {
    throw new Error('Les cartes cadeaux ne sont pas remboursables')   // ← viole LSP
  }
}
```

Le code qui appelle `refund()` sur un `PaymentMethod` **plante** dès qu'on lui passe une carte cadeau : l'enfant affaiblit le contrat. **Diagnostic LSP.** Refactoring : ségréguer les capacités (ISP) au lieu d'un héritage menteur.

```ts
interface Chargeable  { charge(amount: number): Promise<void> }
interface Refundable  { refund(amount: number): Promise<void> }

class CardPayment     implements Chargeable, Refundable { /* les deux */ }
class GiftCardPayment implements Chargeable { /* charge seulement — pas de refund menti */ }

// Le code de remboursement demande un Refundable → un GiftCard ne peut MÊME PAS y entrer.
function processRefund(p: Refundable, amount: number) { return p.refund(amount) }
```

La violation LSP disparaît parce que le type interdit désormais l'appel invalide *à la compilation*.

---

## 4. Pièges & misconceptions

### PIÈGE #1 — « SRP = une classe ne fait qu'une seule chose »
Faux raccourci. SRP parle d'**une seule raison de changer** (un seul acteur), pas d'une seule méthode. Une classe `Money` avec `add`, `subtract`, `format` a plusieurs méthodes mais **un seul acteur** (le domaine monétaire) → SRP respecté. Le bon test est « qui demande le changement ? », pas « combien de méthodes ? ».

### PIÈGE #2 — Confondre DIP et « injection de dépendances »
DIP est un **principe de direction** (le métier possède l'abstraction, l'infra en dépend). L'injection de dépendances est une **technique** de câblage. On peut faire de l'injection sans inverser (injecter une classe concrète = pas de DIP). Et le sens de la flèche compte : mettre l'interface `RitualRepository` **dans la couche métier**, pas dans la couche infra. (Technique détaillée → module 04.)

### PIÈGE #3 — Appliquer OCP partout → sur-abstraction
Créer une interface + une factory pour un comportement qui n'a **jamais** varié, c'est de l'over-engineering : indirection gratuite, code plus dur à lire. Règle : n'ouvre (OCP) que sur un **axe de variation avéré** (tu as déjà 2 cas, ou un 2e est planifié). Sinon, un simple `if` est plus honnête. Applique SOLID quand le code **va changer**, que **plusieurs personnes** le lisent, ou qu'il est **testé unitairement** — sinon KISS prime.

### PIÈGE #4 — Croire que tout héritage respecte LSP « parce que ça compile »
TypeScript accepte l'override de `Square.setWidth`. LSP est un contrat **sémantique** (comportement, pré/postconditions), pas seulement de signatures. Le compilateur ne le vérifie pas : c'est à la revue de design de l'attraper. Signal : une sous-classe qui `throw`, ignore un paramètre, ou ajoute un effet de bord absent du parent.

### PIÈGE #5 — ISP = « faire beaucoup de petites interfaces »
ISP ne demande pas d'atomiser chaque méthode. Il demande de découper **par rôle client** : regroupe ce qu'**un même client** utilise ensemble. Une interface d'une seule méthode par service, c'est du bruit ; une interface `Reader` + `Writer` séparées parce que *lecteurs et écrivains sont des clients distincts*, c'est ISP.

### PIÈGE #6 — Traiter SOLID comme une checklist à cocher à 100 %
SOLID sont des **heuristiques** qui parfois se tendent entre elles (OCP pousse à l'abstraction, KISS/YAGNI poussent à la simplicité). L'architecte arbitre selon le **coût du changement attendu**, il ne coche pas mécaniquement les 5 lettres sur chaque classe.

---

## 5. Ancrage TribuZen

Le fil rouge de ce module est le **`ReminderService`** (cœur métier des rappels de rituels familiaux), refactoré aux §1 et §3.

Dans `smaurier/tribuzen`, le découpage cible :

```
tribuzen/
  src/
    reminders/
      domain/
        ReminderService.ts        ← orchestration métier (SRP), dépend des ports (DIP)
        ports/
          RitualRepository.ts     ← abstraction possédée par le domaine (DIP + ISP)
          ReminderChannel.ts      ← port d'envoi, liste ouverte (OCP)
          ReminderRenderer.ts     ← présentation (SRP : raison de changer = branding)
      infra/
        PostgresRitualRepository.ts   ← adapter (implémente le port)
        EmailChannel.ts / PushChannel.ts  ← canaux ajoutés sans toucher au domaine (OCP)
        InMemoryRitualRepository.ts   ← utilisé par les tests (DIP en action)
```

Deux décisions d'architecture TribuZen que SOLID justifie :

1. **Le `ReminderService` ne connaît ni Postgres ni SendGrid.** Quand TribuZen ajoutera les rappels **push mobile** (roadmap beta), on crée `PushChannel` et on l'ajoute à la liste des canaux — le service métier, déjà testé, ne bouge pas.
2. **La règle « est-ce dû ? » se teste sans infra.** L'horloge est injectée (`clock`), donc les tests de fuseaux/snooze sont déterministes — indispensable pour un produit dont la valeur *est* d'envoyer le bon rappel au bon moment.

> Le câblage effectif de ces ports dans le module NestJS de TribuZen (providers, `@Injectable`, tokens) est traité au **module 04**. Ici, on a seulement justifié *pourquoi* le design est découpé ainsi.

---

## 6. Points clés

1. **SRP** = une seule *raison de changer* (un seul acteur), pas « une seule méthode ». Test : décris la classe sans « et ».
2. **OCP** = étendre par de nouvelles classes, ne pas rouvrir le code testé. À réserver aux axes de variation réels.
3. **LSP** = un sous-type est substituable sans surprise ; contrat sémantique que le compilateur ne vérifie pas. Signal : un enfant qui `throw` ou ignore un paramètre.
4. **ISP** = pas d'interface fourre-tout ; découpe *par rôle client* (`Reader`/`Writer`), pas atomisation.
5. **DIP** = le métier possède l'abstraction, l'infra en dépend. Principe ≠ injection de dépendances (technique, module 04).
6. Les 5 s'articulent : SRP découpe, ISP garde les interfaces étroites, DIP oriente la dépendance, OCP en découle, LSP en conditionne la validité.
7. SOLID = heuristiques, pas checklist : sur prototype, code figé ou logique triviale, KISS/YAGNI priment.

---

## 7. Seeds Anki

```
Quel est le vrai critère du SRP ?|Une seule RAISON de changer = un seul acteur qui peut demander une modification. Pas "une seule méthode". Test : décrire la classe sans utiliser "et".
Comment repérer une violation OCP dans un design ?|Un switch/chaîne de if sur un "type" qui grossit à chaque nouveau cas : ajouter un cas force à rouvrir et re-tester une classe existante.
Qu'est-ce qui viole LSP concrètement ?|Un sous-type qui renforce une précondition, affaiblit une postcondition, jette une exception ou ajoute un effet de bord absent du parent (ex : Square.setWidth qui modifie aussi la hauteur, GiftCard.refund qui throw).
Pourquoi LSP n'est-il pas garanti par le compilateur TypeScript ?|LSP est un contrat sémantique (comportement, pré/postconditions), pas seulement de signatures. Le code compile mais casse le contrat à l'exécution — c'est à la revue de design de l'attraper.
Que demande vraiment ISP ?|Découper les interfaces par rôle client : ne pas forcer un client à dépendre de méthodes qu'il n'utilise pas. Reader/Writer séparés, pas une interface fourre-tout — mais pas non plus une atomisation absurde.
Quelle est la différence entre DIP et l'injection de dépendances ?|DIP est un principe de DIRECTION : le métier possède l'abstraction, l'infra en dépend. L'injection de dépendances est la TECHNIQUE de câblage. On peut injecter une classe concrète (injection sans DIP).
Quand NE PAS appliquer SOLID ?|Prototype/MVP, code qui ne changera jamais, logique triviale (3 lignes), script one-shot, chemin ultra performant. SOLID vaut le coût quand le code va changer, est lu à plusieurs, ou est testé unitairement.
Comment SOLID rend-il un service testable ?|Via DIP : le service dépend d'abstractions (ports) injectées. En test on passe des implémentations InMemory + une horloge figée → aucune base, aucun réseau, tests déterministes.
```

---

## Pont vers le lab

> Lab associé : `labs/lab-01-principes-solid/README.md`. Exercice de design pur (README-only) : auditer un service TribuZen, nommer chaque violation SOLID, proposer le refactoring. Évalué par grille + coach, sans harnais.
