# Cours 09 — Clean Architecture

**Objectif :** Comprendre les cercles concentriques de Robert Martin, maîtriser la Dependency Rule comme loi absolue, comparer avec l'architecture hexagonale, et reconnaitre quand ce patron est adapte ou excessif.

---

## Rappel du cours précédent

> Cours 08 — Architecture Hexagonale (Ports & Adapters).

**Question 1 — Quelle est la différence entre un Port Primaire et un Port Secondaire dans l'architecture hexagonale ?**

<details>
<summary>Réponse</summary>

Un Port Primaire (driving) est une interface d'entree que le coeur expose aux clients exterieurs : les adapters REST, CLI ou gRPC appellent le coeur via ce port. Un Port Secondaire (driven) est une interface de sortie que le coeur exige de l'infrastructure : le coeur appelle ce port pour persister des données, envoyer des emails, etc. Dans les deux cas, l'interface est définie par le coeur — jamais par l'infrastructure.

</details>

**Question 2 — Pourquoi l'adapter "en mémoire" est-il considere comme le super-pouvoir de l'architecture hexagonale ?**

<details>
<summary>Réponse</summary>

Parce qu'il permet de tester le coeur applicatif complet (Domain + Use Cases) sans aucune infrastructure reelle : pas de base de données, pas de réseau, pas de fichiers. Les tests s'executent en quelques millisecondes et sont parfaitement deterministiques. C'est rendu possible uniquement parce que le coeur ne dépend que d'interfaces — on peut brancher n'importe quel adapter implementant ces interfaces.

</details>

---

## Analogie — L'oignon

Coupe un oignon en deux. Tu vois des cercles concentriques. La Clean Architecture ressemble a ca :

- **Le coeur (la première pellicule)** : pur, essentiel, ne dépend de rien d'autre
- **Les couches intermédiaires** : chaque couche enveloppe et protégé la suivante
- **La couche externe** : frameworks, UI, bases de données — tout ce qui est jetable

```
    Couche externe (Frameworks, UI, DB)
  +---------------------------------------+
  |  Couche adaptateurs (Controllers,     |
  |  Presenters, Gateways)                |
  |  +-------------------------------+    |
  |  |  Use Cases (Application)      |    |
  |  |  +-------------------------+  |    |
  |  |  |  Entities (Domain)      |  |    |
  |  |  |  Logique metier pure    |  |    |
  |  |  +-------------------------+  |    |
  |  +-------------------------------+    |
  +---------------------------------------+
```

Si tu veux enlever une couche d'oignon, tu peux — les couches internes restent intactes. Si tu changes de base de données (couche externe), le Domain (coeur) ne change pas d'un bit.

---

## Théorie

### 1. Les quatre cercles de Robert Martin

```
+===========================================================+
|  FRAMEWORKS & DRIVERS                                     |
|  (Web, UI, DB, Devices, External Interfaces)              |
|  +=====================================================+   |
|  |  INTERFACE ADAPTERS                                |   |
|  |  (Controllers, Presenters, Gateways)               |   |
|  |  +=============================================+   |   |
|  |  |  APPLICATION BUSINESS RULES                 |   |   |
|  |  |  (Use Cases / Interactors)                  |   |   |
|  |  |  +---------------------------------------+  |   |   |
|  |  |  |  ENTERPRISE BUSINESS RULES            |  |   |   |
|  |  |  |  (Entities — logique metier           |  |   |   |
|  |  |  |   independante de l'application)      |  |   |   |
|  |  |  +---------------------------------------+  |   |   |
|  |  +=============================================+   |   |
|  +=====================================================+   |
+===========================================================+

Fleches de dependance : toujours vers l'interieur -->
```

#### Cercle 1 — Entities (Enterprise Business Rules)
Les règles métier qui existeraient meme sans ce logiciel. Ex : "une facture non payee depuis 90 jours passe en contentieux". Ces règles valent pour l'entreprise entiere, pas juste pour cette application.

#### Cercle 2 — Use Cases (Application Business Rules)
L'orchestration spécifique a cette application. Ex : "créer une commande en ligne" — ce flux n'existe que parce qu'il y a cette application. Les Use Cases orchestrent les Entities.

#### Cercle 3 — Interface Adapters
Traduction entre le format du coeur et le format de l'exterieur. Controllers (HTTP -> Use Case), Presenters (Use Case result -> Vue), Gateways (interface -> Implémentation).

#### Cercle 4 — Frameworks & Drivers
Tout ce qui est "detail" : NestJS, TypeORM, React, PostgreSQL, SendGrid. Ce sont des outils — la Clean Architecture les considere remplacables.

---

### 2. La Dependency Rule — la loi absolue

> **"Source code dependencies must point only inward."**
> — Robert C. Martin

```
Autorise :                        Interdit :
  [Use Case] --> [Entity]           [Entity] --> [Use Case]
  [Controller] --> [Use Case]       [Use Case] --> [Controller]
  [TypeORM] --> [IRepository]       [Entity] --> [TypeORM]
```

**Corollaire :** Si une couche externe change, aucune couche interne n'est modifiee. Si les Entities changent, tout peut changer — c'est normal, c'est le coeur.

**Comment faire appeler le coeur vers l'exterieur sans violer la règle ?**
Via l'inversion de dépendance : le coeur définit une interface (IRepository), l'infrastructure l'implémenté. Le coeur n'appelle que l'interface — il ne sait pas qui est derriere.

---

### 3. Comparaison Clean Architecture vs Hexagonale

| Aspect | Architecture Hexagonale | Clean Architecture |
|---|---|---|
| Auteur | Alistair Cockburn (2005) | Robert C. Martin (2012) |
| Metaphore | Hexagone / Ports & Adapters | Cercles concentriques / Oignon |
| Granularite | 2 niveaux (Core / Adapters) | 4 niveaux distincts |
| Distinction Use Case / Entity | Implicite | **Explicite et fondamentale** |
| Presenters | Non spécifiques | Specifiques (Output Boundaries) |
| Complexite | Moderee | Elevee |
| Documentation | Legere | Tres detaillee (livre complet) |
| Adoption | Tres repandue | Repandue dans les grandes équipes |

**Conclusion :** La Clean Architecture est une hexagonale plus detaillee avec des cercles supplementaires. Elle est particulierement utile quand tu dois distinguer "logique d'entreprise" (Entities) de "logique d'application" (Use Cases).

---

### 4. Le flux de données dans la Clean Architecture

```
HTTP Request
    |
    v
[Controller]  (Cercle 3)
    |  Cree un Input DTO
    v
[Use Case Interactor]  (Cercle 2)
    |  Manipule les Entities
    |  Appelle le Output Boundary (interface)
    v
[Entity]  (Cercle 1)
    |  Logique metier pure
    v
[Use Case Interactor]  (Cercle 2, suite)
    |  Resultat via Output Boundary
    v
[Presenter]  (Cercle 3)
    |  Transforme en View Model
    v
[View / Response]  (Cercle 4)
```

Le Use Case ne retourne PAS directement un résultat au Controller. Il appelle un `OutputBoundary` (interface) — le Presenter l'implémenté. Cela évité que le Use Case connaisse le format de réponse HTTP.

---

### 5. Quand la Clean Architecture est-elle overkill ?

| Situation | Clean Architecture | Alternative |
|---|---|---|
| CRUD simple (blog, admin) | Surdimensionne | Architecture en couches |
| Prototype / MVP | Trop lent a demarrer | Flat ou MVC |
| Équipe < 3 personnes | Overhead organisationnel | Hexagonale simplifiee |
| Domaine métier complexe | Parfaitement adapte | Garder Clean Architecture |
| Multiples clients (REST + CLI + gRPC) | Adapte | Hexagonale ou Clean |
| Regles métier independantes de l'app | Essentiel | Clean Architecture |

---

## Pratique — Implémentation TypeScript

### Entities — Cercle 1 (logique d'entreprise pure)

```typescript
// src/core/entities/invoice.entity.ts

// Cette logique existerait dans un tableau Excel avant ce logiciel
// Elle est independante de NestJS, TypeORM, HTTP — elle appartient au METIER

export class Invoice {
  private readonly id: string;
  private readonly amount: number;
  private readonly issuedAt: Date;
  private paidAt: Date | null = null;

  constructor(id: string, amount: number, issuedAt: Date) {
    if (amount <= 0) throw new Error('Invoice amount must be positive');
    this.id = id;
    this.amount = amount;
    this.issuedAt = issuedAt;
  }

  // REGLE D'ENTREPRISE : 90 jours de delai avant contentieux
  // Cette regle vient du service juridique — pas de l'application
  isOverdue(today: Date = new Date()): boolean {
    const diffDays = Math.floor(
      (today.getTime() - this.issuedAt.getTime()) / (1000 * 60 * 60 * 24)
    );
    return !this.paidAt && diffDays > 90;
  }

  markAsPaid(paidAt: Date = new Date()): void {
    if (this.paidAt) throw new Error('Invoice already paid');
    if (paidAt < this.issuedAt) throw new Error('Payment cannot precede invoice');
    this.paidAt = paidAt;
  }

  getId() { return this.id; }
  getAmount() { return this.amount; }
  isPaid() { return this.paidAt !== null; }
}
```

### Use Case — Cercle 2 avec Input/Output Boundaries

```typescript
// src/core/use-cases/flag-overdue-invoices.use-case.ts

// Input Boundary : l'interface que le Controller utilisera
export interface IFlagOverdueInvoicesUseCase {
  execute(request: FlagOverdueRequest): Promise<void>;
}

export interface FlagOverdueRequest {
  tenantId: string;
}

// Output Boundary : l'interface que le Presenter implementera
// Le Use Case ne sait PAS comment le resultat sera affiche
export interface IFlagOverdueOutputBoundary {
  present(result: FlagOverdueResult): void;
}

export interface FlagOverdueResult {
  flaggedCount: number;
  invoiceIds: string[];
}

// Ports secondaires — definis dans le cercle 2, implementes dans le cercle 4
export interface IInvoiceRepository {
  findUnpaidByTenant(tenantId: string): Promise<import('../entities/invoice.entity').Invoice[]>;
  save(invoice: import('../entities/invoice.entity').Invoice): Promise<void>;
}

export interface INotificationService {
  notifyAccountingTeam(tenantId: string, overdueCount: number): Promise<void>;
}
```

```typescript
// src/core/use-cases/flag-overdue-invoices.interactor.ts
import { Injectable, Inject } from '@nestjs/common';
import {
  IFlagOverdueInvoicesUseCase,
  FlagOverdueRequest,
  IFlagOverdueOutputBoundary,
  IInvoiceRepository,
  INotificationService,
} from './flag-overdue-invoices.use-case';

export const INVOICE_REPO = 'INVOICE_REPO';
export const NOTIFICATION_SVC = 'NOTIFICATION_SVC';
export const OUTPUT_BOUNDARY = 'OUTPUT_BOUNDARY';

@Injectable()
export class FlagOverdueInvoicesInteractor implements IFlagOverdueInvoicesUseCase {
  constructor(
    // Cercle 2 ne connait que des interfaces — jamais de classes concretes
    @Inject(INVOICE_REPO) private readonly invoiceRepo: IInvoiceRepository,
    @Inject(NOTIFICATION_SVC) private readonly notificationSvc: INotificationService,
    @Inject(OUTPUT_BOUNDARY) private readonly outputBoundary: IFlagOverdueOutputBoundary,
  ) {}

  async execute(request: FlagOverdueRequest): Promise<void> {
    // 1. Recupere les donnees via le port secondaire
    const unpaidInvoices = await this.invoiceRepo.findUnpaidByTenant(request.tenantId);

    // 2. Applique la logique des Entities (cercle 1)
    const today = new Date();
    const overdueInvoices = unpaidInvoices.filter((inv) => inv.isOverdue(today));

    // 3. Effectue les actions necessaires
    const notifyPromises = overdueInvoices.map((inv) => this.invoiceRepo.save(inv));
    await Promise.all(notifyPromises);

    if (overdueInvoices.length > 0) {
      await this.notificationSvc.notifyAccountingTeam(
        request.tenantId,
        overdueInvoices.length
      );
    }

    // 4. Passe le resultat au Presenter via Output Boundary
    // Le Use Case ne sait PAS si c'est du JSON, du HTML ou un email
    this.outputBoundary.present({
      flaggedCount: overdueInvoices.length,
      invoiceIds: overdueInvoices.map((inv) => inv.getId()),
    });
  }
}
```

### Interface Adapters — Cercle 3

```typescript
// src/adapters/presenters/flag-overdue.presenter.ts
import { IFlagOverdueOutputBoundary, FlagOverdueResult } from '../../core/use-cases/flag-overdue-invoices.use-case';

// Le Presenter transforme le resultat metier en format HTTP
// Il connait le format de sortie, le Use Case ne le connait pas
export class FlagOverduePresenter implements IFlagOverdueOutputBoundary {
  // Le ViewModel sera lu par le Controller apres execution du Use Case
  viewModel: { message: string; count: number; ids: string[] } | null = null;

  present(result: FlagOverdueResult): void {
    this.viewModel = {
      message: result.flaggedCount === 0
        ? 'No overdue invoices found'
        : `${result.flaggedCount} invoice(s) flagged as overdue`,
      count: result.flaggedCount,
      ids: result.invoiceIds,
    };
  }
}
```

```typescript
// src/adapters/controllers/invoices.controller.ts
import { Controller, Post, Param, Inject } from '@nestjs/common';
import { IFlagOverdueInvoicesUseCase } from '../../core/use-cases/flag-overdue-invoices.use-case';
import { FlagOverduePresenter } from '../presenters/flag-overdue.presenter';

export const FLAG_OVERDUE_USE_CASE = 'FLAG_OVERDUE_USE_CASE';

@Controller('invoices')
export class InvoicesController {
  constructor(
    // Le Controller depend du Port Primaire (interface), pas de l'Interactor
    @Inject(FLAG_OVERDUE_USE_CASE)
    private readonly flagOverdueUseCase: IFlagOverdueInvoicesUseCase,
    // Le Presenter est injecte — le Controller lit le ViewModel apres
    private readonly presenter: FlagOverduePresenter,
  ) {}

  @Post('tenants/:tenantId/flag-overdue')
  async flagOverdue(@Param('tenantId') tenantId: string) {
    // Execute le Use Case — le Presenter est appele a l'interieur
    await this.flagOverdueUseCase.execute({ tenantId });
    // Lit le ViewModel prepare par le Presenter
    return this.presenter.viewModel;
  }
}
```

### Test du Cercle 2 sans aucun framework

```typescript
// src/core/use-cases/flag-overdue-invoices.spec.ts
import { FlagOverdueInvoicesInteractor } from './flag-overdue-invoices.interactor';
import { Invoice } from '../entities/invoice.entity';
import { FlagOverdueResult, IInvoiceRepository, INotificationService } from './flag-overdue-invoices.use-case';

// Stubs minimalistes — aucun NestJS, aucune BDD
class StubInvoiceRepo implements IInvoiceRepository {
  constructor(private invoices: Invoice[]) {}
  async findUnpaidByTenant() { return this.invoices; }
  async save() {}
}

class StubNotificationSvc implements INotificationService {
  calls: Array<{ tenantId: string; count: number }> = [];
  async notifyAccountingTeam(tenantId: string, overdueCount: number) {
    this.calls.push({ tenantId, count: overdueCount });
  }
}

class SpyPresenter {
  captured: FlagOverdueResult | null = null;
  present(result: FlagOverdueResult) { this.captured = result; }
}

describe('FlagOverdueInvoicesInteractor', () => {
  it('signale les factures en retard et notifie la comptabilite', async () => {
    const oldDate = new Date('2024-01-01'); // > 90 jours
    const recentDate = new Date();
    const overdueInvoice = new Invoice('inv-1', 500, oldDate);
    const recentInvoice = new Invoice('inv-2', 300, recentDate);

    const notifSvc = new StubNotificationSvc();
    const presenter = new SpyPresenter();
    const interactor = new FlagOverdueInvoicesInteractor(
      new StubInvoiceRepo([overdueInvoice, recentInvoice]),
      notifSvc,
      presenter,
    );

    await interactor.execute({ tenantId: 'tenant-A' });

    // Seule la facture ancienne est signalee
    expect(presenter.captured?.flaggedCount).toBe(1);
    expect(presenter.captured?.invoiceIds).toContain('inv-1');
    // La comptabilite est notifiee
    expect(notifSvc.calls).toHaveLength(1);
    expect(notifSvc.calls[0].count).toBe(1);
  });
});
```

---

## Resume

- La Clean Architecture organise le code en **4 cercles concentriques** : Entities (règles d'entreprise), Use Cases (logique d'application), Interface Adapters (traduction), Frameworks & Drivers (details techniques).
- La **Dependency Rule** est absolue : les dépendances du code source ne pointent **que vers l'interieur** — les frameworks ne connaissent pas les Use Cases, les Use Cases ne connaissent pas les Controllers.
- La distinction **Entity vs Use Case** est fondamentale : les Entities contiennent des règles valables pour l'entreprise entiere, les Use Cases contiennent des règles spécifiques a cette application.
- Les **Presenters et Output Boundaries** permettent aux Use Cases de communiquer des résultats sans connaitre le format de sortie (HTTP, email, CLI) — plus isoles que dans l'hexagonale de base.
- La Clean Architecture vaut le cout pour les **grands domaines complexes** avec des règles métier riches ; elle est disproportionnee pour un CRUD simple ou un prototype.


---

> **Lien fil rouge — ShopArch**
>
> - Compare la Clean Architecture avec l'hexagonale utilisée dans ShopArch
> - Identifie si ShopArch a besoin des 4 couches de la Clean Architecture ou si l'hexagonale suffit
> - Exercice(s) associé(s) : `exercices/05-layered-to-hexagonal/`
> - Checkpoint : Module 01, critère 1

## Prochain cours

[Cours 10 — Monolithe Modulaire & API-First](./04-monolithe-modulaire.md)

> On va voir que "monolithe" n'est pas un gros mot : un monolithe modulaire bien decoupled peut battre les microservices dans beaucoup de situations. On explorera aussi l'approche API-First, l'architecture headless et les conteneurs stateless.
