# Lab 04 — Injection de dépendances et inversion de contrôle

> **Outcome :** à la fin, tu sais transformer un service au couplage dur en injection par constructeur sur interfaces, dessiner le graphe de dépendances avant/après, et justifier DI manuelle vs conteneur.
> **Vrai outil :** ton éditeur (TypeScript en pseudo-conception — on raisonne l'archi, on ne monte pas de projet) + papier/tableau blanc pour le diagramme de dépendances.
> **Feedback :** le coach valide en session — pas de test-runner auto-correcteur. C'est un exercice de **conception et de décision**, pas d'exécution.

---

## Énoncé

Le backend TribuZen contient un service qui envoie le récapitulatif hebdomadaire d'une famille (résumé des rituels + humeur moyenne, par e-mail). Un développeur pressé a écrit ceci :

```ts
// WeeklyDigestService.ts — état de départ (couplage dur)
class WeeklyDigestService {
  private repo = new PostgresRitualRepository()   // ouvre une connexion Postgres
  private mailer = new SendgridMailer()           // appelle l'API SendGrid
  private clock = new SystemClock()               // lit l'heure système (new Date())

  async sendDigest(familyId: string): Promise<void> {
    const since = this.clock.oneWeekAgo()
    const rituals = await this.repo.findCompletedSince(familyId, since)

    if (rituals.length === 0) {
      // pas de rituel cette semaine → on n'envoie rien
      return
    }

    const summary = `${rituals.length} rituels accomplis cette semaine !`
    this.mailer.send(familyId, 'Votre semaine TribuZen', summary)
  }
}
```

Ce service est **impossible à tester** proprement : il faut une base Postgres, il envoie de vrais e-mails, et son résultat dépend de l'heure réelle. Ta mission : le rendre découplé et testable **par la conception**, sans changer la logique métier.

**Ce n'est pas du gap-fill.** Tu réécris le service et tu produis un diagramme. Tu ne montes aucun projet, tu ne lances aucun test : tu raisonnes l'architecture.

---

## Étapes (en friction)

1. **Repère les 3 dépendances dures** dans `sendDigest` et, pour chacune, écris en une phrase *pourquoi* elle bloque le test unitaire.
2. **Extrais un port (interface) par dépendance** : `RitualRepository`, `Mailer`, `Clock`. N'y mets que les méthodes réellement utilisées par le service (pas plus).
3. **Réécris `WeeklyDigestService`** en injection par constructeur, chaque paramètre typé sur son **interface** (pas sur la classe concrète). La logique métier ne doit pas bouger.
4. **Écris le composition root** (`main.ts`) qui assemble le service avec les implémentations concrètes de production (DI manuelle).
5. **Écris les implémentations de test** : un `InMemoryRitualRepository`, un `SpyMailer` (qui enregistre au lieu d'envoyer) et un `FixedClock` (heure figée). Montre en 3-4 lignes comment tu instancierais le service pour un test — **sans** base ni réseau.
6. **Dessine le graphe de dépendances AVANT et APRÈS** (flèche = « dépend de »). Fais apparaître le changement de sens de la flèche entre le service et l'infra (l'inversion).
7. **Décision écrite (3-4 lignes) :** pour le backend TribuZen complet (~30 services, un pool DB partagé, un contexte par requête), choisis DI manuelle **ou** conteneur IoC, et justifie avec le critère taille-du-graphe + durées-de-vie.
8. **Bonus — piège :** ton collègue propose `const repo = ServiceLocator.get('RitualRepository')` à l'intérieur de `sendDigest` « pour éviter d'allonger le constructeur ». Explique en 2 lignes pourquoi c'est un anti-pattern et ce que ça casse.

---

## Corrigé complet commenté

**Étape 1 — pourquoi les 3 dépendances bloquent le test :**
- `new PostgresRitualRepository()` → exige une vraie base Postgres pour exécuter le test.
- `new SendgridMailer()` → chaque exécution de test envoie un vrai e-mail via l'API.
- `new SystemClock()` → le résultat dépend de l'heure réelle → test non déterministe.

**Étapes 2-3 — ports + service injecté :**

```ts
// Ports : uniquement ce que le service consomme réellement
interface RitualRepository {
  findCompletedSince(familyId: string, since: Date): Promise<Ritual[]>
}
interface Mailer {
  send(familyId: string, subject: string, body: string): void
}
interface Clock {
  oneWeekAgo(): Date
}

// Service : dépendances injectées, typées sur les INTERFACES
class WeeklyDigestService {
  constructor(
    private readonly repo: RitualRepository,   // ← interface, pas Postgres
    private readonly mailer: Mailer,           // ← interface, pas SendGrid
    private readonly clock: Clock,             // ← interface, pas SystemClock
  ) {}

  // La logique métier est IDENTIQUE à l'original — seule l'obtention
  // des dépendances a changé. C'est le signe d'un bon refactoring DI.
  async sendDigest(familyId: string): Promise<void> {
    const since = this.clock.oneWeekAgo()
    const rituals = await this.repo.findCompletedSince(familyId, since)

    if (rituals.length === 0) return

    const summary = `${rituals.length} rituels accomplis cette semaine !`
    this.mailer.send(familyId, 'Votre semaine TribuZen', summary)
  }
}
```

**Étape 4 — composition root (DI manuelle) :**

```ts
// main.ts — le SEUL fichier qui connaît les implémentations concrètes
const repo = new PostgresRitualRepository(dbPool)
const mailer = new SendgridMailer(sendgridApiKey)
const clock = new SystemClock()

const digestService = new WeeklyDigestService(repo, mailer, clock)
// digestService.sendDigest('family-42')
```

**Étape 5 — implémentations de test + instanciation :**

```ts
// Implémentations de test : zéro infrastructure
class InMemoryRitualRepository implements RitualRepository {
  constructor(private rituals: Ritual[] = []) {}
  async findCompletedSince(_familyId: string, _since: Date) {
    return this.rituals   // renvoie l'état préparé, aucune base
  }
}
class SpyMailer implements Mailer {
  sent: Array<{ familyId: string; subject: string; body: string }> = []
  send(familyId: string, subject: string, body: string) {
    this.sent.push({ familyId, subject, body })   // enregistre au lieu d'envoyer
  }
}
class FixedClock implements Clock {
  constructor(private readonly ref: Date) {}
  oneWeekAgo() { return this.ref }   // heure figée → test déterministe
}

// Le test, sans base ni réseau — instanciation directe :
const repo = new InMemoryRitualRepository([/* 2 rituels préparés */])
const mailer = new SpyMailer()
const clock = new FixedClock(new Date('2026-07-01'))
const service = new WeeklyDigestService(repo, mailer, clock)
// await service.sendDigest('family-42')
// puis on vérifierait : mailer.sent.length === 1
```

**Étape 6 — graphe de dépendances (flèche = dépend de) :**

```
AVANT (couplage dur)                 APRÈS (DI + interfaces)
─────────────────────                ──────────────────────────────────────
WeeklyDigestService                  WeeklyDigestService
   │   │   │                            │        │        │
   ▼   ▼   ▼                            ▼        ▼        ▼
Postgres Sendgrid System           RitualRepo  Mailer   Clock   (interfaces)
Repo     Mailer   Clock                ▲          ▲        ▲
                                       │ implémente│        │
(le métier dépend                   Postgres   Sendgrid  System
 directement de l'infra)            Repo       Mailer    Clock  (infra)

La flèche métier→infra a disparu : l'infra dépend maintenant
du contrat (interface) défini côté métier. C'est l'inversion.
```

**Étape 7 — décision manuelle vs conteneur (backend complet) :**
> **Conteneur IoC.** Le graphe (~30 services) est trop grand pour un câblage manuel fiable, et il y a des durées de vie hétérogènes (pool DB = une instance partagée ; contexte par requête HTTP). Un conteneur résout le graphe et gère ces scopes automatiquement. Le coût (dépendance au framework, un peu de « magie ») est justifié à cette échelle — alors que pour un script de 3 services, la DI manuelle resterait le bon choix.

**Étape 8 — pourquoi le Service Locator est un anti-pattern :**
> Aller chercher `RitualRepository` dans un registre à l'intérieur de la méthode rend la dépendance **invisible** (absente du constructeur, donc du contrat de la classe) et **couple** le service au locator. Ça casse la testabilité (il faut configurer et nettoyer un registre global avant chaque test) et repousse les erreurs au runtime au lieu de la compilation.

**Pourquoi ce corrigé est correct :**
- La logique de `sendDigest` est intacte — on a seulement inversé le contrôle de la création des dépendances.
- Chaque paramètre est typé sur une **interface**, pas sur le concret : c'est ce qui réalise DIP et permet la substitution en test.
- Les ports ne contiennent que les méthodes utilisées — pas de sur-abstraction.
- Le test s'écrit par simple instanciation, sans base ni réseau : preuve que le couplage a bien disparu.

---

## Variante J+30 (fading)

**Même exercice, contraintes ajoutées, sans rouvrir ce corrigé ni le module :**

1. En **20 minutes**, refactore un `NotificationService` qui, en couplage dur, instancie `new TwilioSmsSender()`, `new FirebasePushNotifier()` et `new UserRepository()`, et qui **choisit** le canal (SMS ou push) selon une préférence utilisateur lue en base.
2. Contrainte : introduis **un seul port** `NotificationSender` avec deux implémentations (SMS, push) et injecte la **bonne** au composition root selon un critère — sans que `NotificationService` connaisse Twilio ni Firebase.
3. Dessine le graphe et **nomme** le pattern qui te permet de choisir l'implémentation à l'assemblage (indice : ce n'est pas du Service Locator).

**Critère de réussite :** `NotificationService` ne mentionne aucune techno concrète, un seul port couvre les deux canaux, et tu sais expliquer où et comment le canal est décidé (au composition root, pas dans le service).

---

## Application TribuZen

Dans le repo `smaurier/tribuzen`, ce refactoring vit ici :

```
tribuzen/
  src/
    digest/
      weekly-digest.service.ts     ← service métier, dépend de ports
      ritual.repository.ts         ← interface (port)
      mailer.port.ts               ← interface partagée
      clock.port.ts                ← interface (testabilité du temps)
```

**Différences par rapport au lab :**
- L'assemblage réel passe par le **conteneur IoC de NestJS** (`providers`, substitution d'implémentation en test) — les décorateurs et leur configuration sont le sujet du **cours 09**. Ici, le composition root manuel sert à comprendre ce que le conteneur automatise.
- `Clock` paraît sur-abstrait en apparence, mais c'est le port qui rend le digest **testable dans le temps** (heure figée) — un cas où l'interface est justifiée même avec une seule implémentation de prod.
- Les ports (`RitualRepository`, `Mailer`) sont partagés avec d'autres services (`CheckInService`, `RitualService`) — d'où l'intérêt de les définir côté métier.

**Commit cible :**
```
refactor(digest): WeeklyDigestService en DI par constructeur (ports repo/mailer/clock)
```
