# 04 — Principes de clean code

## Objectif

A la fin de ce cours, tu sauras **appliquer les principes fondamentaux du clean code**, reconnaitre les code smells les plus courants, et surtout **savoir quand ne pas appliquer** ces principes pour éviter la sur-ingenierie.

---

## Rappel du cours précédent

Teste ta mémoire avant de continuer.

**Question 1 — Quelle est la différence entre le pattern Facade et le pattern Adapter ?**

<details>
<summary>Réponse</summary>

- **Facade** : simplifie une interface complexe (sous-système avec de nombreuses classes) en exposant une interface unifiee. Elle cache la complexité interne. Exemple : `ArticleFacade.publish(id)` orchestre validation + SEO + notification + cache.
- **Adapter** : fait le pont entre deux interfaces **incompatibles** qui existent déjà. Elle traduit une interface vers une autre. Exemple : `SendGridAdapter` traduit notre `NotificationSender` vers l'API spécifique de SendGrid.

Facade = simplifier. Adapter = traduire/convertir.
</details>

**Question 2 — Pourquoi la State Machine est-elle préférable à une serie de if/else pour gérer le cycle de vie d'un article ?**

<details>
<summary>Réponse</summary>

Plusieurs raisons :
1. **Exhaustivite** : toutes les transitions valides sont declarees explicitement, les transitions invalides levent une exception.
2. **Lisibilite** : l'état et les transitions possibles sont lisibles d'un coup d'oeil.
3. **Maintenabilite** : ajouter un nouvel état se fait en un seul endroit (`VALID_TRANSITIONS`), pas en cherchant tous les `if` dans le code.
4. **Testabilite** : chaque transition est testable independamment.

Avec les if/else, le comportement se disperse dans le code, et les cas invalides passent silencieusement.
</details>

---

## Analogie — La cuisine professionnelle

Un chef etoile et un cuisinier amateur ont tous les deux accès aux memes ingredients et aux memes outils. La différence ? Le chef **range les ingredients de façon systematique**, nettoie son plan de travail après chaque étape, garde les sauces dans des recipients identifies, et ne prepare jamais quelque chose dont il n'a pas encore besoin.

Le code propre suit la même logique :
- Chaque chose a sa place (**SoC, DRY**)
- Rien d'inutile sur le plan de travail (**YAGNI, KISS**)
- On travaille dans des petites zones propres (**Loi de Demeter**)
- Si un ingredient est mauvais, on le détecté immédiatement et on le jette (**Fail Fast**)

Une cuisine mal rangee ne t'empeche pas de cuisiner aujourd'hui — mais dans six mois, quand d'autres cuisiniers arrivent et que le restaurant sert 300 couverts, le chaos est garantis.

---

## Théorie

### DRY — Don't Repeat Yourself

**"Chaque connaissance doit avoir une representation unique, non ambigue et autoritaire dans un système."**

DRY ne signifie pas "ne jamais écrire deux lignes similaires". Il signifie que la **connaissance métier** ne doit pas etre dupliquee. Deux boucles similaires peuvent rester deux boucles. Une règle métier (calcul d'un prix, validation d'un email) dupliquee en trois endroits est un desastre.

```
Violation DRY — la regle metier est dupliquee :

// Dans ArticleController.ts
if (article.title.length > 255) throw new Error('Titre trop long');
if (article.content.length < 100) throw new Error('Contenu trop court');

// Dans ArticleImportService.ts — copie-colle
if (article.title.length > 255) throw new Error('Titre trop long');
if (article.content.length < 100) throw new Error('Contenu trop court');

// Dans ArticleScheduler.ts — troisieme copie
if (article.title.length > 255) throw new Error('Titre trop long');
if (article.content.length < 100) throw new Error('Contenu trop court');

Probleme : si la regle change (titre max → 500), il faut trouver tous les endroits.
Respect DRY — la regle est centralisee :

function validateArticle(article: Article): void { ... }  // UN seul endroit
```

**Quand DRY ne s'applique PAS** : la règle des "trois strikes". Si tu as deux morceaux de code similaires, attends. Si un troisieme apparait et qu'ils representent vraiment la même connaissance, alors abstrais. **Trois lignes similaires valent mieux qu'une abstraction prematuree**.

---

### KISS — Keep It Simple, Stupid

**"La solution la plus simple qui fonctionne est la bonne solution."**

La complexité est le pire ennemi de la maintenabilité. Chaque niveau d'indirection, chaque généralisation prematuree, chaque pattern applique "au cas où" ajoute une charge cognitive qui s'accumule.

```
Trop complexe (over-engineered) :
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  AbstractBaseEntityFactoryStrategyBuilder<T extends Entity> │
│    implements Buildable<T>, Creatable<T>, Validatable<T>    │
│                                                             │
│  → 4 niveaux d'heritage, 3 interfaces, generics imbriques  │
│  → Pour creer un article avec 3 champs                     │
└─────────────────────────────────────────────────────────────┘

Simple et suffisant :
┌────────────────────────────────────────┐
│  function createArticle(              │
│    title: string,                     │
│    content: string                    │
│  ): Article { ... }                   │
└────────────────────────────────────────┘
```

---

### YAGNI — You Ain't Gonna Need It

**"N'implémenté pas quelque chose tant que tu n'en as pas réellement besoin."**

Le futur est incertain. Le code que tu ecris "au cas où" pour une fonctionnalité hypothetique :
- Prend du temps a écrire maintenant
- Doit etre maintenu même s'il n'est jamais utilise
- Peut etre mal concu car le vrai besoin n'est pas encore clair
- Augmente la surface testable

```
Violation YAGNI — "ca pourrait servir un jour" :

class UserService {
  // Le besoin actuel : authentifier un utilisateur par email/mot de passe
  login(email: string, password: string): User { ... }

  // Personne ne l'a demande — mais "ca pourrait servir" :
  loginWithGoogle(token: string): User { ... }       // pas dans le backlog
  loginWithSAML(assertion: string): User { ... }     // pas dans le backlog
  loginWithBiometrics(data: Buffer): User { ... }    // science-fiction
  loginWithMagicLink(token: string): User { ... }    // "just in case"
}
```

---

### SoC — Séparation of Concerns

**"Chaque module ne doit s'occuper que d'une seule preoccupation."**

Une "preoccupation" (concern) est une raison de changer. SoC est le principe derriere SRP (SOLID) mais applique a tous les niveaux : fichiers, modules, couches, services.

```
Architecture en couches — SoC applique a l'echelle du systeme :

┌─────────────────────────────────────────────────────────────┐
│   Couche Presentation (HTTP, validation de format)          │
│   Preoccupation : gerer la requete et formater la reponse   │
├─────────────────────────────────────────────────────────────┤
│   Couche Metier (logique domaine, regles, calculs)          │
│   Preoccupation : appliquer les regles metier               │
├─────────────────────────────────────────────────────────────┤
│   Couche Infrastructure (base de donnees, cache, emails)    │
│   Preoccupation : persister et communiquer                  │
└─────────────────────────────────────────────────────────────┘

Melanger ces preoccupations = coupler les raisons de changer.
Si la DB change, seule la couche Infrastructure devrait changer.
```

---

### Loi de Demeter — "Ne parle qu'a tes amis proches"

**"Un module ne doit interagir qu'avec ses dépendances directes, pas avec les dépendances de ses dépendances."**

On appelle ça parfois le principe du **"une seule fleche"**. Chaque point dans `a.b.c.d()` est une connaissance de la structure interne d'un objet.

```
Violation — "train wreck" :
user.getAddress().getCity().getPostalCode().validate()
     ↑              ↑           ↑              ↑
  Connait User   Connait    Connait City   Connait PostalCode
                 Address

Probleme : si Address change de structure, ce code casse.

Respect — delegation :
user.validatePostalCode()
// User s'occupe de deleguer — le client ne connait pas la structure interne
```

---

### Composition plutot qu'héritage

**"Prefere la composition de comportements a l'héritage de classe."**

L'héritage créé un couplage fort et permanent entre la classe parente et les classes enfants. La composition reste flexible.

```
Heritage profond — fragile :
       Animal
         │
         ├─ Vertebre
         │    ├─ Mammifere
         │    │    ├─ Canin
         │    │    │    └─ Chien
         │    │    └─ Felin
         │    │         └─ Chat
         │    └─ Oiseau
         │         └─ Perroquet
         └─ Invertébre

Probleme : ajouter un PlatypusVoleant demande de refactoriser toute la hierarchie.

Composition — flexible :
interface CanFly  { fly(): void; }
interface CanSwim { swim(): void; }
interface CanRun  { run(): void; }

class Duck implements CanFly, CanSwim { ... }   // compose des capacites
class Dog implements CanSwim, CanRun  { ... }   // compose des capacites
class Eagle implements CanFly, CanRun { ... }   // compose des capacites
```

---

### Fail Fast — Détecter les erreurs au plus tot

**"Si quelque chose va mal, échoué immédiatement et clairement, plutot que de continuer dans un état incorrect."**

Un système qui échoué silencieusement et continue de tourner peut propager une corruption de données sur des heures avant qu'on détecté le problème. Un système Fail Fast leve une exception immédiate avec un message clair.

```
Fail Late — dangereux :
function processOrder(order: any) {
  // order pourrait etre null, undefined, ou invalide
  const total = order.items.reduce(...);  // crash ici, mais trop tard
  await saveToDatabase(total);             // peut sauvegarder des donnees corrompues
}

Fail Fast — sur :
function processOrder(order: Order | null): void {
  // Valider en premier, avant toute operation
  if (!order) throw new Error('Commande requise');
  if (!order.items || order.items.length === 0) throw new Error('Commande vide');
  if (order.items.some(item => item.price < 0)) throw new Error('Prix negatif detecte');

  // A ce point, on sait que order est valide
  const total = order.items.reduce((sum, item) => sum + item.price, 0);
  saveToDatabase(total);
}
```

---

### Code smells courants et refactorings

```
CODE SMELL                 SYMPTOME                    REMEDE
─────────────────────────────────────────────────────────────────────────
Long Method                > 20-30 lignes               Extraire des fonctions
God Class                  > 500 lignes, fait tout      SRP — diviser
Feature Envy               methode utilise surtout       Deplacer la methode
                           les donnees d'une autre
                           classe
Primitive Obsession        string pour email, phone,     Value Objects
                           statut (pas de typage)
Magic Number               if (status === 3) {...}       Constantes nommees
Shotgun Surgery            1 changement = modifier       Rassembler les
                           10 fichiers                   responsabilites
Data Clump                 memes 3 parametres            Creer un objet
                           partout ensemble              (ex: Address)
Deep Nesting               if > for > if > try...       Extraire, guard clauses
Long Parameter List        > 3-4 parametres             Builder ou objet params
```

---

## Pratique

```typescript
// ============================================================
// DRY — Centraliser la logique de validation metier
// ============================================================

// AVANT : validation dupliquee dans 3 endroits
// ArticleController.ts
// if (title.length > 255) throw new Error('...');
// if (content.length < 100) throw new Error('...');

// ArticleImportService.ts — copie
// if (title.length > 255) throw new Error('...');
// if (content.length < 100) throw new Error('...');

// APRES : source unique de verite
const ARTICLE_RULES = {
  TITLE_MAX_LENGTH: 255,
  CONTENT_MIN_LENGTH: 100,
} as const;

interface ArticleInput {
  title: string;
  content: string;
}

// Validation centralisee — si les regles changent, on change ici uniquement
function validateArticleInput(input: ArticleInput): string[] {
  const errors: string[] = [];

  if (input.title.length === 0) {
    errors.push('Le titre est obligatoire');
  }
  if (input.title.length > ARTICLE_RULES.TITLE_MAX_LENGTH) {
    errors.push(`Titre trop long (max ${ARTICLE_RULES.TITLE_MAX_LENGTH} caracteres)`);
  }
  if (input.content.length < ARTICLE_RULES.CONTENT_MIN_LENGTH) {
    errors.push(`Contenu trop court (min ${ARTICLE_RULES.CONTENT_MIN_LENGTH} caracteres)`);
  }

  return errors;
}

// Tous les appelants utilisent cette fonction
function createArticle(input: ArticleInput) {
  const errors = validateArticleInput(input);
  if (errors.length > 0) throw new Error(errors.join('; '));
  // ... creation
}

// ============================================================
// KISS — Solution simple et lisible
// ============================================================

// AVANT : sur-ingeniere, illisible
const getActiveArticlesTitlesTruncated = (
  articles: Array<{ status: string; title: string }>,
  maxLen: number
) =>
  articles
    .filter(a => a.status === 'published')
    .map(a => ({
      ...a,
      title: a.title.length > maxLen
        ? `${a.title.substring(0, maxLen - 3)}...`
        : a.title
    }))
    .reduce((acc: string[], a) => [...acc, a.title], []);

// APRES : decompose en etapes nommees, chacune simple
function filterPublished<T extends { status: string }>(items: T[]): T[] {
  return items.filter(item => item.status === 'published');
}

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return `${text.substring(0, maxLength - 3)}...`;
}

function extractTitles(articles: Array<{ title: string }>): string[] {
  return articles.map(a => a.title);
}

// Lisible comme une phrase :
const articles = [{ status: 'published', title: 'Un article' }];
const titles = extractTitles(
  filterPublished(articles)
).map(title => truncate(title, 60));

// ============================================================
// FAIL FAST — Guard clauses et validation immediate
// ============================================================

// AVANT : logique imbriquee, validation tardive
function publishArticleBefore(
  article: { id: string; status: string; content: string } | null,
  userId: string | null
): void {
  if (article) {
    if (userId) {
      if (article.status === 'draft') {
        if (article.content.length > 100) {
          // ... logique de publication — on arrive ici apres 4 niveaux
          console.log('Article publie');
        } else {
          throw new Error('Contenu trop court');
        }
      } else {
        throw new Error('Deja publie ou archive');
      }
    } else {
      throw new Error('Utilisateur requis');
    }
  } else {
    throw new Error('Article introuvable');
  }
}

// APRES : guard clauses — Fail Fast, pas d'imbrication
function publishArticle(
  article: { id: string; status: string; content: string } | null,
  userId: string | null
): void {
  // Valide d'abord, travaille ensuite — lecture lineaire, claire
  if (!article)                        throw new Error('Article introuvable');
  if (!userId)                         throw new Error('Utilisateur requis');
  if (article.status !== 'draft')      throw new Error('Deja publie ou archive');
  if (article.content.length <= 100)   throw new Error('Contenu trop court');

  // Ici on sait que tout est valide — zero imbrication
  console.log(`Article ${article.id} publie par ${userId}`);
}

// ============================================================
// Loi de Demeter — Delegation plutot qu'exploration
// ============================================================

// AVANT : train wreck — le code connait trop de structures internes
class UserBefore {
  address: { city: { postalCode: { code: string; isValid(): boolean } } };
  constructor() {
    this.address = {
      city: {
        postalCode: {
          code: '75001',
          isValid: () => /^\d{5}$/.test('75001')
        }
      }
    };
  }
}

function checkPostalCodeBefore(user: UserBefore): boolean {
  // Connait User, Address, City, PostalCode — couplage excessif
  return user.address.city.postalCode.isValid();
}

// APRES : delegation — chaque objet s'occupe de sa propre structure
class PostalCode {
  constructor(private readonly code: string) {}
  isValid(): boolean { return /^\d{5}$/.test(this.code); }
}

class City {
  constructor(private readonly postalCode: PostalCode) {}
  hasValidPostalCode(): boolean { return this.postalCode.isValid(); }
}

class Address {
  constructor(private readonly city: City) {}
  isInValidCity(): boolean { return this.city.hasValidPostalCode(); }
}

class User {
  constructor(private readonly address: Address) {}
  // Le client ne connait que User — delegation complete
  hasValidAddress(): boolean { return this.address.isInValidCity(); }
}

function checkUser(user: User): boolean {
  // Une seule connaissance : User
  return user.hasValidAddress();
}

// ============================================================
// Composition plutot qu'heritage
// ============================================================

// AVANT : heritage — couplage fort
class NotificationBase {
  protected format(message: string): string {
    return `[NOTIF] ${message}`;
  }
}

// Si NotificationBase change, tout change
class EmailNotificationBefore extends NotificationBase {
  send(to: string, message: string): void {
    const formatted = this.format(message);
    console.log(`Email a ${to}: ${formatted}`);
  }
}

// APRES : composition — on injecte des comportements
interface Formatter {
  format(message: string): string;
}

class BracketFormatter implements Formatter {
  format(message: string): string { return `[NOTIF] ${message}`; }
}

class EmojiFormatter implements Formatter {
  format(message: string): string { return `*** ${message} ***`; }
}

// EmailNotification n'herite de rien — elle compose un Formatter
class EmailNotification {
  constructor(private readonly formatter: Formatter) {}

  send(to: string, message: string): void {
    const formatted = this.formatter.format(message);
    console.log(`Email a ${to}: ${formatted}`);
  }
}

// On peut mixer les comportements librement
const standardEmail = new EmailNotification(new BracketFormatter());
const fancyEmail    = new EmailNotification(new EmojiFormatter());

standardEmail.send('user@example.com', 'Votre article a ete publie');
fancyEmail.send('user@example.com', 'Votre article a ete publie');

// ============================================================
// Code smells — Refactoring concret
// ============================================================

// SMELL : Primitive Obsession — utiliser des string pour tout
// AVANT
function createUser(email: string, role: string, tenantId: string) {
  // Comment sait-on si email et tenantId ne sont pas inverses ?
  // 'admin' et 'editor' sont des magic strings
}

// APRES : Value Objects et types stricts
type UserRole = 'admin' | 'editor' | 'viewer';

class Email {
  private constructor(private readonly value: string) {}

  static parse(raw: string): Email {
    if (!raw.includes('@')) throw new Error(`Email invalide : ${raw}`);
    return new Email(raw.toLowerCase().trim());
  }

  toString(): string { return this.value; }
}

class TenantId {
  private constructor(private readonly value: string) {}

  static parse(raw: string): TenantId {
    if (!raw || raw.length < 3) throw new Error(`TenantId invalide : ${raw}`);
    return new TenantId(raw);
  }

  toString(): string { return this.value; }
}

function createUserTyped(email: Email, role: UserRole, tenantId: TenantId): void {
  // Impossible d'inverser email et tenantId — types differents
  // Impossible de passer 'superadmin' — type union verifie a la compilation
  console.log(`Creation de ${email} en tant que ${role} dans ${tenantId}`);
}

// L'erreur de type est detectee a la compilation, pas au runtime
const email = Email.parse('user@example.com');
const tenant = TenantId.parse('acme-corp');
createUserTyped(email, 'admin', tenant);
// createUserTyped(tenant, 'admin', email); // Erreur TypeScript — impossible
```

---

## Résumé

- **DRY** : centralise la connaissance métier — mais attends trois occurrences similaires avant d'abstraire. Deux lignes similaires ne sont pas toujours une violation DRY.
- **KISS et YAGNI** : la solution la plus simple qui resout le problème réel est la bonne. Ne code pas pour un futur hypothetique — "ça pourrait servir" est la première phrase du code mort.
- **SoC et Loi de Demeter** : chaque module parle a ses voisins directs, pas aux voisins de ses voisins. Une chaine de points (`a.b.c.d()`) est un signal d'alarme — délégué plutot qu'explore.
- **Composition > Héritage** : préféré assembler des comportements via des interfaces (Formatter, Sorter, Validator) plutot que d'hériter. L'héritage créé un couplage permanent, la composition reste flexible.
- **Fail Fast** : valide tes preconditions en premier avec des guard clauses, et échoué avec des messages clairs. Un code qui échoué silencieusement dans un mauvais état est infiniment plus dangereux qu'une exception explicite.


---

> **Lien fil rouge — ShopArch**
>
> - Renomme les méthodes du domaine ShopArch pour qu'elles expriment l'intention métier
> - Vérifie que `Money`, `Email` et `Product` suivent les principes clean code
> - Exercice(s) associé(s) : `exercices/01-refactoring-solid/`
> - Checkpoint : Module 00, critère 1

## Prochain cours

[05 — Injection de dépendances et IoC](./05-dependency-injection-ioc.md)

> Dans le prochain cours, nous verrons comment l'injection de dépendances (DI) et l'inversion de controle (IoC) permettent de construire des systèmes testables, modulaires et maintenables. Nous verrons l'injection par constructeur, les scopes (singleton, request, transient), les providers NestJS, et pourquoi le Service Locator est un anti-pattern.
