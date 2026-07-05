# Lab 01 — Auditer et refactorer un design avec SOLID

> **Outcome :** à la fin, tu sais lire un design existant, **nommer chaque violation SOLID** (S/O/L/I/D), et **écrire le refactoring** qui la lève — sans over-engineering.
> **Vrai outil :** un éditeur + TypeScript (au choix : `tsc --noEmit` ou juste le typecheck de l'IDE) pour vérifier que ton design refactoré compile. **Pas de test-runner auto-correcteur, pas de harnais** : c'est un exercice de **conception**.
> **Feedback :** le coach valide en session avec la grille ci-dessous. Tu défends tes choix à l'oral.

---

## Énoncé

On te confie le `FamilyOnboardingService` de TribuZen : le service qui inscrit une nouvelle famille (création du compte, envoi de l'email de bienvenue, log d'audit, et attribution d'un plan tarifaire). Il « marche » en production mais l'équipe n'arrive plus à le faire évoluer ni à le tester.

**Code à auditer (ne le modifie pas encore — lis-le d'abord) :**

```ts
// FamilyOnboardingService.ts — design à auditer
class FamilyOnboardingService {
  private db = new MySqlClient('mysql://prod...')
  private mailer = new SmtpMailer('smtp.sendgrid.net')

  async onboard(input: { familyName: string; email: string; plan: string }): Promise<void> {
    // Attribution du plan
    let priceCents: number
    if (input.plan === 'free')    priceCents = 0
    else if (input.plan === 'pro') priceCents = 900
    else if (input.plan === 'team') priceCents = 2900
    else throw new Error('Plan inconnu')

    // Création en base
    const id = await this.db.insert('families', {
      name: input.familyName, email: input.email, price: priceCents,
    })

    // Email de bienvenue (avec le HTML mis en forme ici même)
    const html = `<h1>Bienvenue ${input.familyName} !</h1><p>Votre plan : ${input.plan}</p>`
    await this.mailer.send(input.email, 'Bienvenue sur TribuZen', html)

    // Log d'audit
    await this.db.insert('audit_log', {
      action: 'family_onboarded', family_id: id, at: new Date().toISOString(),
    })
  }
}

// Et une hiérarchie utilisée ailleurs pour les notifications :
class Notification {
  send(to: string): Promise<void> { /* envoi email par défaut */ return Promise.resolve() }
}
class SlackNotification extends Notification {
  send(): Promise<void> {
    throw new Error('Slack non configuré pour cette famille')  // certaines familles n'ont pas Slack
  }
}
```

**Ta mission (design uniquement, pas d'implémentation d'infra réelle) :**

1. Produire un **tableau d'audit** : pour chaque principe SOLID, la/les violation(s) présente(s) dans ce code, avec la ligne/le symptôme précis.
2. Écrire le **design refactoré en TypeScript** : interfaces (ports) + squelettes de classes (corps `/* ... */` acceptés pour l'infra). Ce qui compte, ce sont les **frontières**, pas l'implémentation SQL.
3. Repérer **un piège à ne PAS sur-corriger** : y a-t-il un endroit où appliquer SOLID serait de l'over-engineering ? Justifie.

**Pas de gap-fill.** Tu écris le tableau et le design toi-même à partir de zéro.

---

## Étapes (en friction)

1. **Compte les raisons de changer** de `FamilyOnboardingService`. Liste les acteurs (métier tarifaire, infra base, marketing/email, conformité/audit). → diagnostic **SRP**.
2. **Traque le `if/else` sur `plan`.** Qui doit rouvrir la classe quand un plan « student » arrive ? → diagnostic **OCP**. Décide : abstraction (table de plans / stratégie) ou simple map ? Justifie selon l'axe de variation réel.
3. **Regarde `SlackNotification.send()` qui `throw`.** Un client qui tient un `Notification` et appelle `send()` plante avec une Slack. → diagnostic **LSP**. Propose la correction (ne pas hériter d'un contrat qu'on ne respecte pas).
4. **Cherche les dépendances en dur** (`new MySqlClient`, `new SmtpMailer`). Le métier connaît l'infra. → diagnostic **DIP**. Définis les **ports** possédés par le domaine.
5. **Vérifie l'étroitesse des interfaces** que tu introduis (ISP) : chaque client ne dépend que de ce qu'il utilise.
6. **Écris le design refactoré** et fais-le **compiler** (`tsc --noEmit` ou IDE). Le compilateur est ton oracle de cohérence des types, pas un correcteur pédagogique.
7. **Rédige le paragraphe over-engineering** (étape 3 de la mission).

---

## Grille d'évaluation (le coach coche en session)

| Critère | Attendu | OK ? |
|---|---|---|
| SRP | Les 3-4 acteurs identifiés ; service réduit à l'orchestration | ☐ |
| OCP | `if/else plan` traité par extension **justifiée** (pas d'abstraction gratuite) | ☐ |
| LSP | `SlackNotification` ne `throw` plus ; héritage menteur supprimé | ☐ |
| ISP | Interfaces découpées par rôle client, pas de fourre-tout | ☐ |
| DIP | Ports possédés par le domaine ; `new` d'infra sorti du métier | ☐ |
| Anti-over-engineering | Un endroit identifié où NE PAS abstraire, avec justification | ☐ |
| Compile | Le design refactoré passe `tsc --noEmit` | ☐ |

Score cible : 6/7 minimum. Le critère « anti-over-engineering » est **éliminatoire s'il est absent** — SOLID sans jugement = sur-ingénierie.

---

## Corrigé complet commenté

**Tableau d'audit :**

| Principe | Violation repérée | Symptôme |
|---|---|---|
| SRP | `onboard` fait tarification + persistance + email + audit | 4 acteurs, 4 raisons de changer |
| OCP | `if plan === 'free' / 'pro' / 'team'` | ajouter un plan rouvre la classe |
| LSP | `SlackNotification.send()` jette une exception | casse le contrat de `Notification` |
| ISP | (émerge au refactoring) un port unique mêlerait insert métier + audit | découper `FamilyRepository` vs `AuditLog` |
| DIP | `new MySqlClient()`, `new SmtpMailer()` dans le métier | le domaine dépend d'implémentations concrètes |

**Design refactoré :**

```ts
// ── Domaine : les ports (abstractions possédées par le métier) ──────────────

// DIP + ISP : le repository ne porte QUE ce que l'onboarding utilise
interface FamilyRepository {
  create(family: { name: string; email: string; priceCents: number }): Promise<string>
}

// ISP : l'audit est un rôle client distinct → interface séparée (pas noyée dans le repo)
interface AuditLog {
  record(event: { action: string; familyId: string }): Promise<void>
}

// DIP : port d'envoi. OCP : on ajoutera des canaux sans toucher au service
interface WelcomeMailer {
  sendWelcome(to: string, familyName: string, planLabel: string): Promise<void>
}

// OCP : la tarification devient une donnée extensible, pas une chaîne de if.
// Ici une simple map suffit (voir "over-engineering" plus bas) — pas besoin d'interface Strategy.
const PLAN_PRICES: Record<string, number> = {
  free: 0,
  pro: 900,
  team: 2900,
}
// Ajouter "student: 500" = une ligne, on ne rouvre AUCUNE logique.

// ── Domaine : le service réduit à l'orchestration (SRP) ─────────────────────

class FamilyOnboardingService {
  constructor(
    private readonly families: FamilyRepository,   // DIP
    private readonly mailer: WelcomeMailer,         // DIP
    private readonly audit: AuditLog,               // DIP + ISP
  ) {}

  async onboard(input: { familyName: string; email: string; plan: string }): Promise<void> {
    const priceCents = PLAN_PRICES[input.plan]
    if (priceCents === undefined) throw new Error(`Plan inconnu : ${input.plan}`)

    // Seule responsabilité restante : ORCHESTRER la règle d'inscription
    const id = await this.families.create({
      name: input.familyName, email: input.email, priceCents,
    })
    await this.mailer.sendWelcome(input.email, input.familyName, input.plan)
    await this.audit.record({ action: 'family_onboarded', familyId: id })
  }
}

// ── Infra : les adapters implémentent les ports (corps simplifiés) ──────────

class MySqlFamilyRepository implements FamilyRepository {
  async create(f: { name: string; email: string; priceCents: number }): Promise<string> {
    /* INSERT réel ici */ return 'fam-generated-id'
  }
}
class HtmlWelcomeMailer implements WelcomeMailer {
  async sendWelcome(to: string, familyName: string, planLabel: string): Promise<void> {
    // La mise en forme HTML vit ICI (SRP : raison de changer = branding, pas le métier)
    /* templating + SMTP */
  }
}
class MySqlAuditLog implements AuditLog {
  async record(e: { action: string; familyId: string }): Promise<void> { /* INSERT audit */ }
}

// ── Correction LSP de la hiérarchie de notification ─────────────────────────
// On ne fait plus hériter un canal d'un contrat qu'il ne respecte pas.
// Chaque canal implémente une interface étroite ; le code client dépend de l'interface.
interface NotificationChannel {
  send(to: string, message: string): Promise<void>
}
class EmailChannel implements NotificationChannel {
  async send(to: string, message: string): Promise<void> { /* email */ }
}
// Slack n'est un NotificationChannel QUE pour les familles qui l'ont configuré.
// Plus de throw menti : soit on l'instancie (donc il fonctionne), soit on ne le met pas dans la liste.
class SlackChannel implements NotificationChannel {
  async send(to: string, message: string): Promise<void> { /* API Slack réelle */ }
}
```

**Pourquoi ce corrigé est correct :**

- **SRP** : `FamilyOnboardingService` n'a plus qu'une raison de changer — la *séquence* d'inscription. Tarif, SQL, HTML, audit vivent ailleurs.
- **OCP** : ajouter un plan = une entrée dans `PLAN_PRICES` ; ajouter un canal = une classe qui implémente `NotificationChannel`. Aucun code existant rouvert.
- **LSP** : `SlackChannel` n'hérite plus d'un `Notification` dont il violait `send()`. Un canal présent dans la liste **fonctionne** par construction.
- **ISP** : `FamilyRepository` et `AuditLog` sont deux ports distincts — l'onboarding ne dépend pas d'une méthode d'audit noyée dans le repo, et inversement.
- **DIP** : plus aucun `new MySqlClient`/`new SmtpMailer` dans le domaine ; les 3 ports sont injectés au constructeur.

**Anti-over-engineering (critère éliminatoire) :**
La tarification est traitée par une **simple map** `PLAN_PRICES`, pas par une interface `PricingStrategy` + une classe par plan. Pourquoi : chaque plan est une paire *(nom → prix)* sans comportement propre. Introduire une hiérarchie de stratégies ici serait de l'indirection gratuite (piège #3 du module). On n'ouvrira (OCP « fort », via interface) que le jour où un plan aura une *logique* de prix (prorata, promo dégressive) — pas avant. C'est le jugement qui distingue l'architecte de l'applicateur mécanique de SOLID.

---

## Variante J+30 (fading)

**Même exercice, contraintes ajoutées, en 30 minutes, sans rouvrir ce corrigé ni le module :**

1. On te donne **seulement** l'énoncé (le code à auditer), pas les réponses. Reproduis le tableau d'audit **de tête**.
2. **Nouvelle exigence métier** : l'onboarding doit désormais pouvoir **échouer proprement** si l'email est déjà pris — sans laisser de famille à moitié créée. Où places-tu cette règle pour ne violer **ni SRP ni DIP** ? (indice : c'est une règle *métier*, pas une contrainte infra ; elle appartient au domaine, exprimée via le port.)
3. Justifie à l'oral **un principe que tu choisis de NE PAS appliquer** et pourquoi.

**Critère de réussite :** les 5 violations nommées correctement + la nouvelle règle placée dans le domaine (pas dans l'adapter SQL) + une décision d'over-engineering assumée.

---

## Application TribuZen

Dans le repo `smaurier/tribuzen`, le design refactoré se pose ainsi :

```
tribuzen/
  src/
    onboarding/
      domain/
        FamilyOnboardingService.ts   ← orchestration (SRP), ports injectés (DIP)
        ports/
          FamilyRepository.ts        ← DIP + ISP
          WelcomeMailer.ts           ← DIP + OCP (canaux)
          AuditLog.ts                ← ISP (rôle client distinct)
        pricing/
          plans.ts                   ← PLAN_PRICES (map, PAS de Strategy — décision assumée)
      infra/
        MySqlFamilyRepository.ts
        HtmlWelcomeMailer.ts
        MySqlAuditLog.ts
```

**Différences par rapport au lab :**

- Le câblage réel des ports (providers NestJS, `@Injectable`, tokens) sera fait au **module 04**. Ici on ne fait que *définir les frontières*.
- La règle « email déjà pris » de la variante J+30 deviendra une vraie contrainte d'unicité + une exception métier typée (`EmailAlreadyUsedError`) — traitée avec les patterns d'erreur du **module 11 (API design & backend patterns)**.
- L'audit branchera sur l'observabilité réelle de TribuZen au **module 22**.

**Commit cible :**
```
refactor(onboarding): découpe FamilyOnboardingService selon SOLID (SRP/DIP), ports + adapters
```
