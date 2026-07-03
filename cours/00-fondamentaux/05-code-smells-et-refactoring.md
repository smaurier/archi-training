# 05 — Code smells et refactoring

## Objectif

A la fin de ce cours, tu sauras **diagnostiquer un code malade** en nommant précisément ses "odeurs" (code smells), et **le soigner** en appliquant la bonne technique de refactoring — par petits pas sûrs, sans casser le comportement. Tu disposeras d'un catalogue de référence : les 22 smells classés en 5 familles, et les 66 techniques de refactoring classées en 6 groupes.

> Ce cours s'appuie sur le travail de référence de Martin Fowler (*Refactoring*) et sur l'excellent catalogue illustré de **[refactoring.guru](https://refactoring.guru/)** — garde ce site ouvert en complément : chaque smell et chaque technique y a une fiche détaillée avec diagramme UML.

---

## Rappel du cours précédent

Teste ta mémoire avant de continuer.

**Question 1 — La règle des "trois strikes" pour DRY : que dit-elle et pourquoi ?**

<details>
<summary>Réponse</summary>

Elle dit d'**attendre trois occurrences** de code similaire avant d'abstraire. Deux morceaux qui se ressemblent peuvent diverger pour des raisons différentes ; abstraire trop tôt crée un couplage prématuré (une abstraction fausse). Au troisième, si les trois représentent vraiment **la même connaissance métier**, alors on factorise. Une mauvaise abstraction coûte plus cher que la duplication.
</details>

**Question 2 — Pourquoi préférer la composition à l'héritage ?**

<details>
<summary>Réponse</summary>

L'héritage crée un couplage **fort et permanent** entre parent et enfant : un changement dans la classe de base se propage à toute la hiérarchie, et on hérite parfois de méthodes dont on n'a pas besoin (Refused Bequest). La composition assemble des comportements via des interfaces injectées (`Formatter`, `SortStrategy`) : chaque capacité est remplaçable à l'exécution, testable isolément, et sans hiérarchie fragile.
</details>

---

## Analogie — Le diagnostic médical

Un **code smell** n'est pas une maladie — c'est un **symptôme**. Une fièvre ne te dit pas ce que tu as, mais elle te dit "regarde ici". De même, une méthode de 200 lignes (Long Method) ne plante pas forcément, mais elle **signale** un problème de conception probable.

Le **refactoring**, lui, c'est le **traitement** : une intervention chirurgicale précise, avec un protocole nommé (Extract Method, Move Field…), qui change la structure interne du patient **sans changer ce qu'il fait de l'extérieur**. Comme un chirurgien, tu ne bricoles pas : tu suis un geste connu, tu vérifies les constantes vitales (les tests) à chaque étape, et tu avances par petits pas réversibles.

```
SMELL (symptôme)          →   REFACTORING (traitement)
─────────────────────────────────────────────────────────
Long Method                   Extract Method
Feature Envy                  Move Method
Primitive Obsession           Replace Data Value with Object
Switch Statements             Replace Conditional with Polymorphism
Message Chains                Hide Delegate
```

---

## Théorie

### Qu'est-ce que le refactoring (et ce que ce n'est pas)

**Refactoring** : modifier la **structure interne** du code pour le rendre plus lisible et plus facile à modifier, **sans changer son comportement observable**. Les entrées produisent les mêmes sorties avant et après.

Ce que le refactoring **n'est PAS** :
- Ajouter une fonctionnalité (c'est du développement — on ne fait pas les deux en même temps)
- Corriger un bug (le comportement change, par définition)
- Réécrire de zéro (c'est un remplacement, pas un refactoring)

**Les deux casquettes** (Fowler) : à tout instant, tu portes soit la casquette "j'ajoute une feature" (le comportement change, les tests évoluent), soit la casquette "je refactore" (le comportement est figé, les tests restent verts). **Jamais les deux ensemble** — sinon, quand un test casse, tu ne sais pas si c'est ta feature ou ta restructuration.

### Le filet de sécurité : petits pas + tests verts

```
CYCLE DE REFACTORING SÛR
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. Tests verts au départ  (sinon : pas de filet, stop)
2. UN petit changement    (une seule technique nommée)
3. Relancer les tests     (toujours verts ?)
   ├─ OUI → commit, retour à l'étape 2
   └─ NON → annuler (revert), le pas était trop gros
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

Sans tests, le refactoring devient un pari. La séquence **Red-Green-Refactor** du TDD (cours de testing) fait du refactoring la troisième étape naturelle : une fois le test vert, on nettoie **avant** d'écrire le test suivant.

### Quand refactorer — et quand s'abstenir

**Refactore quand :**
- **La règle de trois** : la troisième fois que tu touches un code sale, refactore-le.
- **Avant d'ajouter une feature** : range la cuisine avant de cuisiner. Un code propre rend l'ajout plus facile.
- **Pendant une code review** : le meilleur moment pour repérer les smells.
- **Pour comprendre** : refactorer un code obscur est une façon de le lire.

**Ne refactore PAS quand :**
- Le code doit être **réécrit** de zéro (trop cassé pour être sauvé).
- Tu es **près d'une deadline** : le refactoring inachevé est une dette cachée.
- Le code **ne sera plus touché** : du code moche mais stable et isolé peut rester tel quel (le refactoring a un coût, il faut un ROI).

### Dette technique

La **dette technique** est la métaphore de Ward Cunningham : livrer vite avec un code imparfait, c'est emprunter du temps. Les **intérêts** = le surcoût de chaque future modification sur ce code sale. Le refactoring, c'est **rembourser le capital**. Une dette maîtrisée (choisie, tracée) est saine ; une dette subie et ignorée finit par immobiliser l'équipe. (Voir aussi le cours `12-architecture-pratique/03-dette-technique`.)

---

## Les 22 code smells (5 familles)

Un smell ne prouve pas un problème — il invite à **regarder**. Voici la taxonomie de référence (refactoring.guru), avec le symptôme et le refactoring habituel.

### Famille 1 — Bloaters (les obèses)

Du code, des méthodes et des classes qui ont grossi au point de devenir ingérables. Ils s'accumulent avec le temps.

| Smell | Symptôme | Refactoring associé |
|---|---|---|
| **Long Method** | Une méthode > ~10-20 lignes qui fait trop de choses | Extract Method, Replace Temp with Query, Decompose Conditional |
| **Large Class** | Une classe avec trop de champs/méthodes (God Class) | Extract Class, Extract Subclass, Extract Interface |
| **Primitive Obsession** | `string`/`number` partout pour représenter des concepts métier (email, argent, code postal) | Replace Data Value with Object, Replace Type Code with Class, Introduce Parameter Object |
| **Long Parameter List** | > 3-4 paramètres à une fonction | Introduce Parameter Object, Preserve Whole Object, Replace Parameter with Method Call |
| **Data Clumps** | Les mêmes groupes de variables voyagent ensemble (x, y, width, height) | Extract Class, Introduce Parameter Object, Preserve Whole Object |

### Famille 2 — Object-Orientation Abusers (mauvais usage de l'OO)

Application incomplète ou incorrecte des principes objet.

| Smell | Symptôme | Refactoring associé |
|---|---|---|
| **Switch Statements** | Un `switch`/chaîne de `if` sur un type, dupliqué à plusieurs endroits | Replace Conditional with Polymorphism, Replace Type Code with Subclasses/State/Strategy |
| **Temporary Field** | Un champ n'a de valeur que dans certaines circonstances (souvent `null` sinon) | Extract Class, Introduce Null Object |
| **Refused Bequest** | Une sous-classe hérite de méthodes/champs dont elle n'a pas besoin (et ne les utilise pas) | Replace Inheritance with Delegation, Extract Superclass, Push Down Method/Field |
| **Alternative Classes with Different Interfaces** | Deux classes font la même chose mais avec des noms de méthodes différents | Rename Method, Move Method, Extract Superclass |

### Famille 3 — Change Preventers (les bloqueurs de changement)

Un changement à un endroit force des changements en cascade ailleurs. C'est le pire type : il ralentit chaque évolution.

| Smell | Symptôme | Refactoring associé |
|---|---|---|
| **Divergent Change** | Une classe est modifiée pour des raisons **différentes** (SRP violé) | Extract Class |
| **Shotgun Surgery** | Un seul changement métier oblige à modifier **plein de** classes | Move Method, Move Field, Inline Class |
| **Parallel Inheritance Hierarchies** | Créer une sous-classe dans une hiérarchie force à en créer une dans une autre | Move Method, Move Field (fusionner les hiérarchies) |

> Astuce mnémotechnique : **Divergent Change** = une classe, plusieurs raisons de changer. **Shotgun Surgery** = une raison de changer, plusieurs classes. Ce sont deux faces opposées d'un mauvais découpage.

### Famille 4 — Dispensables (le superflu)

Du code qui n'apporte rien et dont la suppression rendrait tout plus propre.

| Smell | Symptôme | Refactoring associé |
|---|---|---|
| **Comments** | Des commentaires qui **expliquent un mauvais code** (au lieu de le corriger) | Extract Method, Rename Method, Introduce Assertion |
| **Duplicate Code** | Le même code à plusieurs endroits | Extract Method, Pull Up Method, Form Template Method, Substitute Algorithm |
| **Lazy Class** | Une classe qui ne fait plus assez pour justifier son existence | Inline Class, Collapse Hierarchy |
| **Data Class** | Une classe qui n'a que des champs + getters/setters, aucune logique | Move Method, Encapsulate Field, Encapsulate Collection |
| **Dead Code** | Variable, paramètre, méthode ou classe plus jamais utilisée | Supprimer (Inline / Remove Parameter) |
| **Speculative Generality** | Abstraction "au cas où" jamais utilisée (YAGNI violé) | Collapse Hierarchy, Inline Class, Remove Parameter, Rename Method |

> **Comments** est subtil : un bon commentaire explique le **pourquoi** (une décision, un contexte). Un mauvais commentaire paraphrase le **quoi** — signe que le code n'est pas assez expressif. Le remède n'est pas de supprimer le commentaire, c'est de rendre le code assez clair pour s'en passer.

### Famille 5 — Couplers (le couplage excessif)

Un couplage trop fort entre classes — ou, à l'inverse, une délégation excessive pour l'éviter.

| Smell | Symptôme | Refactoring associé |
|---|---|---|
| **Feature Envy** | Une méthode utilise surtout les données d'**une autre** classe que la sienne | Move Method, Extract Method |
| **Inappropriate Intimacy** | Deux classes fouillent dans les champs privés l'une de l'autre | Move Method/Field, Extract Class, Hide Delegate, Replace Inheritance with Delegation |
| **Message Chains** | `a.getB().getC().getD().doIt()` (train wreck, Loi de Demeter violée) | Hide Delegate, Extract Method |
| **Middle Man** | Une classe qui ne fait que **déléguer** à une autre (trop de Hide Delegate) | Remove Middle Man, Inline Method |
| **Incomplete Library Class** | Une lib tierce à laquelle il manque une méthode dont tu as besoin | Introduce Foreign Method, Introduce Local Extension |

> **Message Chains** et **Middle Man** sont un couple d'équilibre : trop de chaînes → on cache derrière des délégués (Hide Delegate) ; trop de délégués vides → on retire le middle man (Remove Middle Man). Le bon niveau est entre les deux.

---

## Les 66 techniques de refactoring (6 groupes)

Chaque technique porte un nom précis et un geste reproductible. Format : **problème → avant → après**. Garde le catalogue [refactoring.guru/refactoring/techniques](https://refactoring.guru/refactoring/techniques) sous la main pour le pas-à-pas mécanique de chacune.

### Groupe 1 — Composing Methods (composer les méthodes)

La moitié des problèmes viennent de méthodes trop longues. Ce groupe les découpe et clarifie le flux local.

#### Extract Method

Un fragment de code peut être regroupé → en faire une méthode dont le **nom explique l'intention**.

```typescript
// AVANT
function printOwing(invoice: Invoice) {
  printBanner();
  let outstanding = invoice.amount;
  console.log(`Nom: ${invoice.customer}`);   // détails
  console.log(`Montant: ${outstanding}`);
}
// APRÈS
function printOwing(invoice: Invoice) {
  printBanner();
  printDetails(invoice, invoice.amount);
}
function printDetails(invoice: Invoice, outstanding: number) {
  console.log(`Nom: ${invoice.customer}`);
  console.log(`Montant: ${outstanding}`);
}
```

#### Inline Method

L'inverse : quand le corps d'une méthode est aussi clair que son nom, supprime l'indirection inutile.

```typescript
// AVANT
function getRating(d: Driver) { return moreThanFiveDeliveries(d) ? 2 : 1; }
function moreThanFiveDeliveries(d: Driver) { return d.deliveries > 5; }
// APRÈS
function getRating(d: Driver) { return d.deliveries > 5 ? 2 : 1; }
```

#### Extract Variable

Une expression complexe → une variable locale nommée qui documente le calcul.

```typescript
// AVANT
if (order.qty * order.price - Math.max(0, order.qty - 500) * order.price * 0.05 > 1000) {}
// APRÈS
const basePrice = order.qty * order.price;
const quantityDiscount = Math.max(0, order.qty - 500) * order.price * 0.05;
if (basePrice - quantityDiscount > 1000) {}
```

#### Inline Temp

Une variable temporaire affectée une seule fois par une expression simple → remplace-la par l'expression.

```typescript
// AVANT
const basePrice = anOrder.basePrice();
return basePrice > 1000;
// APRÈS
return anOrder.basePrice() > 1000;
```

#### Replace Temp with Query

Une temp qui stocke le résultat d'une expression → extrais l'expression dans une méthode (query) réutilisable.

```typescript
// AVANT
const basePrice = this.qty * this.price;
if (basePrice > 1000) return basePrice * 0.95;
// APRÈS
if (this.basePrice() > 1000) return this.basePrice() * 0.95;
basePrice() { return this.qty * this.price; }
```

#### Split Temporary Variable

Une même variable réutilisée pour **deux choses différentes** → une variable par responsabilité (chacune assignée une fois).

```typescript
// AVANT
let temp = 2 * (h + w); console.log(temp);
temp = h * w;           console.log(temp);
// APRÈS
const perimeter = 2 * (h + w); console.log(perimeter);
const area = h * w;            console.log(area);
```

#### Remove Assignments to Parameters

Ne réassigne pas un paramètre → utilise une variable locale (le paramètre reste la valeur d'entrée).

```typescript
// AVANT
function discount(input: number, quantity: number) {
  if (quantity > 50) input -= 2;   // réassigne le paramètre
  return input;
}
// APRÈS
function discount(input: number, quantity: number) {
  let result = input;
  if (quantity > 50) result -= 2;
  return result;
}
```

#### Replace Method with Method Object

Une méthode longue avec beaucoup de variables locales entremêlées → transforme-la en **objet** dédié où les temps deviennent des champs, ce qui permet ensuite d'Extract Method librement.

```typescript
// AVANT : gross() a 6 variables locales impossibles à extraire
// APRÈS
class GrossCalculator {
  private base = 0; private tax = 0;   // ex-variables locales → champs
  constructor(private readonly order: Order) {}
  compute(): number { this.base = /*...*/ 0; this.tax = /*...*/ 0; return this.base + this.tax; }
}
```

#### Substitute Algorithm

Remplace tout le corps d'un algorithme par un autre, plus clair, à comportement identique.

```typescript
// AVANT : boucle for + flag
function found(people: string[]) {
  for (const p of people) if (p === 'Don' || p === 'John') return true;
  return false;
}
// APRÈS
function found(people: string[]) {
  return people.some(p => ['Don', 'John'].includes(p));
}
```

### Groupe 2 — Moving Features Between Objects (déplacer les responsabilités)

Mettre chaque comportement et chaque donnée dans la bonne classe.

#### Move Method

Une méthode est plus utilisée par une autre classe que par la sienne (Feature Envy) → déplace-la là où sont ses données.

```typescript
// AVANT : Account.overdraftCharge() lit surtout accountType
// APRÈS : AccountType.overdraftCharge(daysOverdrawn) ; Account délègue
class AccountType { overdraftCharge(days: number) { /* logique ici */ return 0; } }
```

#### Move Field

Un champ est plus utilisé par une autre classe → déplace-le dans celle qui s'en sert vraiment.

```typescript
// interestRate appartenait à Account mais dépend du type de compte
class AccountType { constructor(public interestRate: number) {} }
```

#### Extract Class

Une classe fait le travail de deux (Large Class / Divergent Change) → sépare une partie cohérente dans une nouvelle classe.

```typescript
// AVANT : Person a name, officeAreaCode, officeNumber
// APRÈS
class TelephoneNumber { constructor(public areaCode: string, public number: string) {} }
class Person { constructor(public name: string, public phone: TelephoneNumber) {} }
```

#### Inline Class

Une classe ne fait presque plus rien (Lazy Class) → fusionne-la dans sa principale utilisatrice.

```typescript
// TelephoneNumber trop maigre → ses champs remontent dans Person
class Person { constructor(public name: string, public areaCode: string, public number: string) {} }
```

#### Hide Delegate

Un client navigue `a.getB().getC()` (Message Chain) → expose une méthode sur A qui masque la délégation.

```typescript
// AVANT
const manager = john.getDepartment().getManager();
// APRÈS
const manager = john.getManager();        // Person.getManager() délègue en interne
```

#### Remove Middle Man

Une classe ne fait que déléguer (Middle Man) → laisse le client parler directement à l'objet réel.

```typescript
// AVANT : person.getManager() ne fait que return department.manager
// APRÈS : le client accède person.department.manager (on retire le passe-plat)
```

#### Introduce Foreign Method

Il manque une méthode à une classe **que tu ne peux pas modifier** (lib tierce) → écris une fonction externe qui prend l'objet en premier paramètre.

```typescript
// Date n'a pas nextDay() → fonction "étrangère"
function nextDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
}
```

#### Introduce Local Extension

Il manque **plusieurs** méthodes à une classe tierce → crée une sous-classe ou un wrapper qui les regroupe.

```typescript
// Wrapper autour de Date avec les méthodes manquantes
class RichDate {
  constructor(private readonly d: Date) {}
  nextDay(): RichDate { return new RichDate(nextDay(this.d)); }
  isWeekend(): boolean { return [0, 6].includes(this.d.getDay()); }
}
```

### Groupe 3 — Organizing Data (organiser les données)

Rendre les données plus sûres et plus expressives — souvent la sortie de la Primitive Obsession.

#### Self Encapsulate Field

Accède à tes propres champs via getter/setter plutôt qu'en direct, pour pouvoir surcharger la logique d'accès.

```typescript
get low() { return this._low; }
set low(v: number) { this._low = v; }
includes(n: number) { return n >= this.low && n <= this.high; }
```

#### Replace Data Value with Object

Une donnée primitive porte un comportement métier (Primitive Obsession) → transforme-la en objet.

```typescript
// AVANT : order.customer est un string
// APRÈS
class Customer { constructor(public readonly name: string) {} }
```

#### Change Value to Reference

Plusieurs objets identiques qui devraient être **le même** → passe par une factory qui retourne une instance partagée.

```typescript
class Customer {
  private static instances = new Map<string, Customer>();
  static get(name: string): Customer {
    if (!this.instances.has(name)) this.instances.set(name, new Customer(name));
    return this.instances.get(name)!;
  }
  private constructor(public readonly name: string) {}
}
```

#### Change Reference to Value

Un objet référence est petit et immuable → fais-en un objet valeur (comparé par contenu, dupliqué librement).

```typescript
class Currency {
  constructor(public readonly code: string) {}
  equals(o: Currency) { return this.code === o.code; }   // égalité par valeur
}
```

#### Duplicate Observed Data

Des données métier vivent dans la couche UI → duplique-les dans le domaine et synchronise via Observer.

```typescript
// La valeur du champ texte est copiée dans un modèle domaine,
// tenue à jour par un observateur (voir pattern Observer, cours 03)
```

#### Replace Array with Object

Un tableau dont les éléments ont des rôles différents (`row[0]` = nom, `row[1]` = score) → un objet aux champs nommés.

```typescript
// AVANT : const row = ['Liverpool', '15'];
// APRÈS
class Performance { constructor(public name: string, public wins: number) {} }
```

#### Change Unidirectional Association to Bidirectional

Deux classes ont besoin de se référencer mutuellement → ajoute le lien retour (en gérant la cohérence des deux côtés).

```typescript
class Order { customer!: Customer; setCustomer(c: Customer) { this.customer = c; c.addOrder(this); } }
```

#### Change Bidirectional Association to Unidirectional

Un des deux liens n'est plus utilisé → supprime-le pour réduire le couplage.

```typescript
// On retire Customer.orders si Customer n'a plus besoin de connaître ses Order
```

#### Replace Magic Number with Symbolic Constant

Un nombre "magique" au sens caché → une constante nommée.

```typescript
// AVANT: return 9.81 * mass;
const GRAVITATIONAL_CONSTANT = 9.81;
function potentialEnergy(mass: number, height: number) { return GRAVITATIONAL_CONSTANT * mass * height; }
```

#### Encapsulate Field

Un champ public → rends-le privé avec accesseurs, pour contrôler lecture/écriture.

```typescript
class Person { private _name = ''; get name() { return this._name; } set name(v: string) { this._name = v; } }
```

#### Encapsulate Collection

Une méthode retourne une collection modifiable → retourne une copie/vue en lecture seule, avec add/remove dédiés.

```typescript
class Course { private _list: string[] = [];
  get list(): readonly string[] { return [...this._list]; }   // copie défensive
  add(c: string) { this._list.push(c); }
}
```

#### Replace Type Code with Class

Un "code" numérique/chaîne pour un type → une classe qui restreint les valeurs valides.

```typescript
class BloodGroup {
  static readonly O = new BloodGroup('O');
  static readonly A = new BloodGroup('A');
  private constructor(public readonly code: string) {}
}
```

#### Replace Type Code with Subclasses

Un type code qui **change le comportement** → une sous-classe par valeur (quand le code est immuable).

```typescript
abstract class Employee { abstract payAmount(): number; }
class Engineer extends Employee { payAmount() { return this.monthlySalary; } monthlySalary = 0; }
class Salesman extends Employee { payAmount() { return this.monthlySalary + this.commission; } monthlySalary = 0; commission = 0; }
```

#### Replace Type Code with State/Strategy

Comme ci-dessus, mais quand le type **change en cours de vie** de l'objet → délègue à un objet State/Strategy remplaçable.

```typescript
class Employee { constructor(private type: EmployeeType) {}
  payAmount() { return this.type.payAmount(this); } }
interface EmployeeType { payAmount(e: Employee): number; }   // remplaçable à l'exécution
```

#### Replace Subclass with Fields

Des sous-classes ne diffèrent que par des **constantes** retournées → remplace-les par des champs dans la classe parent.

```typescript
// AVANT : class Male/Female extends Person avec getCode() constant
// APRÈS
class Person { private constructor(public code: string) {}
  static createMale() { return new Person('M'); }
  static createFemale() { return new Person('F'); }
}
```

### Groupe 4 — Simplifying Conditional Expressions (simplifier les conditions)

Les conditionnelles se complexifient vite. Ce groupe les aplatit et les rend lisibles.

#### Decompose Conditional

Un `if/else` complexe → extrais la condition et chaque branche dans des méthodes nommées.

```typescript
// AVANT
if (date < SUMMER_START || date > SUMMER_END) charge = qty * winterRate + winterFee;
else charge = qty * summerRate;
// APRÈS
charge = isSummer(date) ? summerCharge(qty) : winterCharge(qty);
```

#### Consolidate Conditional Expression

Plusieurs conditions menant au **même** résultat → fusionne-les en une seule, extraite en méthode.

```typescript
// AVANT: if (seniority < 2) return 0; if (months > 12) return 0; if (isPartTime) return 0;
// APRÈS
if (isNotEligibleForDisability()) return 0;
function isNotEligibleForDisability() { return seniority < 2 || months > 12 || isPartTime; }
```

#### Consolidate Duplicate Conditional Fragments

Un même fragment présent dans **toutes** les branches → sors-le du conditionnel.

```typescript
// AVANT: if (x) { doA(); send(); } else { doB(); send(); }
// APRÈS
if (x) doA(); else doB();
send();
```

#### Remove Control Flag

Une variable booléenne qui pilote une boucle → utilise `break`/`return` directement.

```typescript
// AVANT: let found = false; for (...) { if (cond) found = true; }
// APRÈS
for (const p of people) if (isSuspect(p)) return true;
return false;
```

#### Replace Nested Conditional with Guard Clauses

Des `if` imbriqués pour les cas particuliers → des **guard clauses** qui sortent tôt (Fail Fast).

```typescript
// AVANT: if (isDead) {..} else { if (isSeparated){..} else {..} }
// APRÈS
if (isDead) return deadAmount();
if (isSeparated) return separatedAmount();
return normalAmount();
```

#### Replace Conditional with Polymorphism

Un `switch`/`if` sur un type (Switch Statements) → une méthode polymorphe par sous-classe.

```typescript
// AVANT: switch(bird.type) { case 'european': return 35; case 'african': ... }
// APRÈS
abstract class Bird { abstract speed(): number; }
class European extends Bird { speed() { return 35; } }
class African  extends Bird { speed() { return 40 - this.load; } load = 0; }
```

#### Introduce Null Object

Des vérifications `if (x === null)` répétées → un objet "nul" qui offre le comportement par défaut.

```typescript
class NullCustomer implements ICustomer { get name() { return 'occupant'; } isNull() { return true; } }
// plus besoin de tester null : customer.name marche toujours
```

#### Introduce Assertion

Une hypothèse implicite sur l'état → rends-la explicite par une assertion (documente + Fail Fast).

```typescript
function expense(): number {
  console.assert(this.expenseLimit !== NULL || this.primaryProject !== null);
  return /* ... */ 0;
}
```

### Groupe 5 — Simplifying Method Calls (simplifier les appels)

Rendre les interfaces des méthodes plus simples et plus sûres à appeler.

#### Rename Method

Un nom qui ne révèle pas l'intention → renomme (le refactoring le plus fréquent et le plus rentable).

```typescript
// getInvcAmt() → getInvoiceAmount()
```

#### Add Parameter / Remove Parameter

Ajoute un paramètre quand la méthode a besoin d'une info supplémentaire ; retire-le quand il n'est plus utilisé (Dead Code).

```typescript
// getContact()  →  getContact(date: Date)     // Add
// getContact(date)  →  getContact()           // Remove si date inutile
```

#### Separate Query from Modifier

Une méthode qui **retourne une valeur ET modifie l'état** → sépare en une query (lecture pure) et un modifier (écriture).

```typescript
// AVANT: getTotalAndSetReady()
// APRÈS
getTotal(): number { /* lecture pure */ return 0; }
setReady(): void { /* effet de bord */ }
```

#### Parameterize Method

Plusieurs méthodes qui ne diffèrent que par une constante → une seule méthode paramétrée.

```typescript
// fivePercentRaise() + tenPercentRaise()  →  raise(percentage: number)
raise(percentage: number) { this.salary *= (1 + percentage); }
```

#### Replace Parameter with Explicit Methods

Un paramètre qui **sélectionne un comportement** via un `switch` → une méthode explicite par cas.

```typescript
// AVANT: setValue('height', v) / setValue('width', v)
// APRÈS
setHeight(v: number) {}
setWidth(v: number) {}
```

#### Preserve Whole Object

Tu extrais plusieurs valeurs d'un objet pour les passer une à une → passe l'objet entier.

```typescript
// AVANT: withinRange(days.low, days.high)
// APRÈS
withinRange(days);
```

#### Introduce Parameter Object

Un groupe de paramètres qui voyagent ensemble (Data Clumps) → regroupe-les dans un objet.

```typescript
// AVANT: amountInvoicedIn(startDate, endDate)
class DateRange { constructor(public start: Date, public end: Date) {} }
// APRÈS: amountInvoicedIn(range: DateRange)
```

#### Remove Setting Method

Un champ ne doit changer qu'à la création → supprime son setter, assigne-le seulement dans le constructeur (immuabilité).

```typescript
class Account { constructor(private readonly id: string) {} }   // pas de setId()
```

#### Hide Method

Une méthode n'est plus utilisée en dehors de sa classe → rends-la privée.

```typescript
class Foo { private helper() {} }
```

#### Replace Constructor with Factory Method

Tu as besoin de logique/nom parlant à la création → une factory method plutôt qu'un constructeur nu.

```typescript
class Employee {
  private constructor(public type: number) {}
  static create(type: string): Employee { return new Employee(codeFor(type)); }
}
```

#### Replace Parameter with Method Call

Un paramètre que l'appelé peut obtenir lui-même → supprime-le et laisse la méthode le calculer.

```typescript
// AVANT: discountedPrice(basePrice, discountLevel)
// APRÈS: discountedPrice(basePrice) { const level = this.discountLevel(); ... }
```

#### Replace Error Code with Exception

Une méthode retourne un code d'erreur spécial → lève une exception (le succès et l'échec ne se confondent plus).

```typescript
// AVANT: return -1;
// APRÈS: throw new BalanceError();
```

#### Replace Exception with Test

Tu utilises une exception pour un cas que tu peux **tester avant** → remplace le try/catch par une condition.

```typescript
// AVANT: try { return values[i]; } catch { return 0; }
// APRÈS: return i < values.length ? values[i] : 0;
```

### Groupe 6 — Dealing with Generalization (gérer la généralisation)

Organiser les hiérarchies : remonter le commun, descendre le spécifique, ou remplacer l'héritage.

#### Pull Up Field / Pull Up Method

Des sous-classes ont un champ/une méthode identiques → remonte-les dans la superclasse (supprime la duplication).

```typescript
// name existait dans Salesman et Engineer → remonte dans Employee
abstract class Employee { name = ''; }
```

#### Pull Up Constructor Body

Les constructeurs des sous-classes partagent du code d'init → remonte-le via `super()`.

```typescript
class Manager extends Employee { constructor(name: string, public grade: number) { super(name); } }
```

#### Push Down Method / Push Down Field

Un membre de la superclasse n'est utile qu'à **certaines** sous-classes → descends-le là où il sert (contraire de Pull Up).

```typescript
// quota ne concerne que Salesman → descend de Employee vers Salesman
class Salesman extends Employee { quota = 0; }
```

#### Extract Subclass

Une classe a des fonctionnalités utilisées seulement dans **certains cas** → crée une sous-classe pour ces cas.

```typescript
// JobItem avec un flag "labor" → sous-classe LaborItem
class LaborItem extends JobItem {}
```

#### Extract Superclass

Deux classes partagent des membres communs → crée une superclasse qui les factorise.

```typescript
abstract class Party { name = ''; annualCost(): number { return 0; } }
class Employee extends Party {}
class Department extends Party {}
```

#### Extract Interface

Plusieurs clients n'utilisent qu'un **sous-ensemble** de l'interface d'une classe → extrais ce sous-ensemble en interface (ISP).

```typescript
interface Billable { charge(): number; }
class Employee implements Billable { charge() { return 0; } }
```

#### Collapse Hierarchy

Une superclasse et sa sous-classe ne sont plus assez différentes → fusionne-les.

```typescript
// Salesman ne se distingue plus assez d'Employee → on fusionne
```

#### Form Template Method

Deux méthodes de sous-classes suivent les mêmes étapes dans le même ordre → remonte le squelette dans la superclasse (Template Method, cf. cours 03).

```typescript
abstract class Site {
  statement(): string { return this.header() + this.body() + this.footer(); }
  protected abstract body(): string;    // varie ; header/footer communs
  protected header() { return ''; } protected footer() { return ''; }
}
```

#### Replace Inheritance with Delegation

Une sous-classe n'utilise qu'une partie de son parent, ou l'héritage crée un mauvais couplage (Refused Bequest) → remplace par une délégation (composition).

```typescript
// AVANT: class Stack extends Vector
// APRÈS
class Stack { private items: Vector = new Vector();
  push(x: unknown) { this.items.add(x); } }   // délègue, n'hérite pas
```

#### Replace Delegation with Inheritance

L'inverse : tu délègues **tout** à une autre classe et écris plein de passe-plats → hérite directement (quand la relation est un vrai "est-un").

```typescript
// Employee déléguait toutes ses méthodes à Person → Employee extends Person
class Employee extends Person {}
```

---

## Pratique — Une session de refactoring complète

On part d'un code qui pue et on le soigne, **une technique à la fois**, en gardant les tests verts. C'est le geste réel du métier.

```typescript
// ============================================================
// DÉPART — Le code malade
// Smells : Long Method + Switch Statements + Primitive Obsession
//          + Magic Number + Feature Envy
// ============================================================

function statement(customer: string, plays: Record<string, { name: string; type: string }>,
                   performances: { playID: string; audience: number }[]): string {
  let totalAmount = 0;
  let result = `Relevé pour ${customer}\n`;

  for (const perf of performances) {
    const play = plays[perf.playID];
    let thisAmount = 0;

    // Switch Statements + Magic Number : la logique de prix par genre
    switch (play.type) {
      case 'tragedy':
        thisAmount = 40000;
        if (perf.audience > 30) thisAmount += 1000 * (perf.audience - 30);
        break;
      case 'comedy':
        thisAmount = 30000;
        if (perf.audience > 20) thisAmount += 10000 + 500 * (perf.audience - 20);
        thisAmount += 300 * perf.audience;
        break;
      default:
        throw new Error(`Genre inconnu: ${play.type}`);
    }

    result += `  ${play.name}: ${thisAmount / 100} (${perf.audience} places)\n`;
    totalAmount += thisAmount;
  }

  result += `Total dû: ${totalAmount / 100}\n`;
  return result;
}

// ============================================================
// ÉTAPE 1 — Extract Method : sortir le calcul de prix
// La logique du switch part dans sa propre fonction nommée.
// ============================================================

function amountFor(perf: { audience: number }, play: { type: string }): number {
  let thisAmount = 0;
  switch (play.type) {
    case 'tragedy':
      thisAmount = 40000;
      if (perf.audience > 30) thisAmount += 1000 * (perf.audience - 30);
      break;
    case 'comedy':
      thisAmount = 30000;
      if (perf.audience > 20) thisAmount += 10000 + 500 * (perf.audience - 20);
      thisAmount += 300 * perf.audience;
      break;
    default:
      throw new Error(`Genre inconnu: ${play.type}`);
  }
  return thisAmount;
}

// ============================================================
// ÉTAPE 2 — Replace Conditional with Polymorphism
// Le switch sur play.type devient une hiérarchie : un calculateur
// par genre. Ajouter un genre = ajouter une classe (OCP), zéro switch.
// ============================================================

interface Play { name: string; }
interface Performance { audience: number; }

abstract class PerformanceCalculator {
  constructor(protected readonly perf: Performance, protected readonly play: Play) {}
  abstract amount(): number;

  // Fabrique : remplace le switch par un aiguillage unique et localisé
  static create(type: string, perf: Performance, play: Play): PerformanceCalculator {
    switch (type) {
      case 'tragedy': return new TragedyCalculator(perf, play);
      case 'comedy':  return new ComedyCalculator(perf, play);
      default: throw new Error(`Genre inconnu: ${type}`);
    }
  }
}

class TragedyCalculator extends PerformanceCalculator {
  amount(): number {
    let a = TRAGEDY_BASE;
    if (this.perf.audience > TRAGEDY_THRESHOLD) {
      a += TRAGEDY_EXTRA_PER_SEAT * (this.perf.audience - TRAGEDY_THRESHOLD);
    }
    return a;
  }
}

class ComedyCalculator extends PerformanceCalculator {
  amount(): number {
    let a = COMEDY_BASE;
    if (this.perf.audience > COMEDY_THRESHOLD) {
      a += COMEDY_EXTRA_FLAT + COMEDY_EXTRA_PER_SEAT * (this.perf.audience - COMEDY_THRESHOLD);
    }
    a += COMEDY_PER_HEAD * this.perf.audience;
    return a;
  }
}

// ============================================================
// ÉTAPE 3 — Replace Magic Number with Symbolic Constant
// Chaque nombre magique reçoit un nom qui explique sa raison d'être.
// ============================================================

const TRAGEDY_BASE = 40000;
const TRAGEDY_THRESHOLD = 30;
const TRAGEDY_EXTRA_PER_SEAT = 1000;
const COMEDY_BASE = 30000;
const COMEDY_THRESHOLD = 20;
const COMEDY_EXTRA_FLAT = 10000;
const COMEDY_EXTRA_PER_SEAT = 500;
const COMEDY_PER_HEAD = 300;

// ============================================================
// ÉTAPE 4 — Decompose Conditional + Extract Variable
// La fonction principale devient lisible « comme une phrase ».
// Le comportement observable n'a jamais changé : mêmes relevés en sortie.
// ============================================================

function statementClean(
  customer: string,
  plays: Record<string, Play & { type: string }>,
  performances: { playID: string; audience: number }[],
): string {
  const lines = performances.map(perf => {
    const play = plays[perf.playID];
    const amount = PerformanceCalculator.create(play.type, perf, play).amount();
    return { name: play.name, audience: perf.audience, amount };
  });

  const total = lines.reduce((sum, l) => sum + l.amount, 0);

  const body = lines
    .map(l => `  ${l.name}: ${l.amount / 100} (${l.audience} places)`)
    .join('\n');

  return `Relevé pour ${customer}\n${body}\nTotal dû: ${total / 100}\n`;
}

// Bilan : 5 smells éliminés en 4 pas nommés et réversibles.
// Ajouter un genre "history" = 1 classe + 1 case, sans toucher au reste.
```

---

## Résumé

- **Refactoring** = changer la structure **sans changer le comportement**. Une casquette à la fois : soit tu ajoutes une feature, soit tu refactores — jamais les deux. Le filet de sécurité, ce sont des **tests verts** et des **petits pas** commités.
- **Un code smell est un symptôme, pas un verdict** : il invite à regarder. Les 22 smells se rangent en 5 familles : **Bloaters** (trop gros), **OO Abusers** (mauvais objet), **Change Preventers** (bloquent le changement), **Dispensables** (superflu), **Couplers** (couplage). Retiens le couple Divergent Change / Shotgun Surgery, et le couple Message Chains / Middle Man.
- **Les 66 techniques** se rangent en 6 groupes : composer les méthodes, déplacer les responsabilités, organiser les données, simplifier les conditions, simplifier les appels, gérer la généralisation. La plupart vont **par paires inverses** (Extract/Inline, Pull Up/Push Down, Hide Delegate/Remove Middle Man) — le bon design est un équilibre, pas un extrême.
- Les techniques les plus rentables au quotidien : **Extract Method**, **Rename Method**, **Replace Nested Conditional with Guard Clauses**, **Replace Conditional with Polymorphism**, **Introduce Parameter Object**, **Replace Magic Number with Symbolic Constant**.
- **Un smell ne se corrige pas au hasard** : à chaque symptôme correspond une (ou quelques) technique nommée. C'est ce couplage smell → refactoring qui transforme le "ce code me gêne" en geste précis.

---

> **Lien fil rouge — ShopArch**
>
> - Repère 3 smells dans le code hérité de ShopArch (probable : Long Method dans le calcul de panier, Primitive Obsession sur les montants, Switch Statements sur les modes de livraison)
> - Applique la séquence Extract Method → Replace Conditional with Polymorphism → Replace Magic Number sur le calcul de frais de port
> - Vérifie que les tests restent verts à **chaque** étape
> - Exercice(s) associé(s) : `exercices/01b-refactoring-smells/` (filet de sécurité golden-master fourni)
> - Checkpoint : Module 00, critère 2

## Ressources pour approfondir

Ce cours est un **catalogue-carte** : il te donne les noms et le geste de chaque smell et technique. Pour le pas-à-pas mécanique détaillé (avec diagrammes UML avant/après), la référence est :

- **[refactoring.guru/refactoring](https://refactoring.guru/refactoring)** — Le site de référence, superbement illustré. Section [smells](https://refactoring.guru/refactoring/smells) pour les 22 odeurs, section [techniques](https://refactoring.guru/refactoring/techniques) pour les 66 refactorings, chacune avec problème / solution / procédure étape par étape. Disponible en français. **À garder ouvert pendant tes refactorings réels.**
- **[refactoring.guru/design-patterns](https://refactoring.guru/design-patterns)** — Le catalogue des 23 patterns GoF (voir aussi notre cours 03).
- **[patterns.dev](https://patterns.dev)** — Complément orienté JavaScript/React moderne : design patterns ES6+, rendering patterns (SSR/SSG/ISR/RSC) et performance patterns (code-splitting, tree-shaking, list virtualization). Pragmatique et web-first.
- **Martin Fowler, *Refactoring* (2e éd.)** — La source originale de toute cette taxonomie. Les exemples y sont en JavaScript.

> **Conseil** : ne cherche pas à mémoriser les 66 techniques. Mémorise les **6 groupes** et le **couplage smell → refactoring**. Le nom précis, tu le retrouveras sur refactoring.guru au moment où le smell apparaît sous tes yeux.

---

## Prochain cours

[06 — Injection de dépendances et IoC](./06-dependency-injection-ioc.md)

> Dans le prochain cours, nous verrons comment l'injection de dépendances (DI) et l'inversion de controle (IoC) permettent de construire des systèmes testables, modulaires et maintenables. Nous verrons l'injection par constructeur, les scopes (singleton, request, transient), les providers NestJS, et pourquoi le Service Locator est un anti-pattern.
