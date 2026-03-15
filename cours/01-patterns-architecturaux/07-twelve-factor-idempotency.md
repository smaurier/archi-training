# Cours 13 — 12-Factor App & Idempotence

**Objectif :** Maîtriser les 12 facteurs qui rendent une application cloud-native, comprendre l'importance vitale de l'idempotence, implémenter des clés d'idempotence et des retries surs, et éviter les doubles débits dans les systèmes de paiement.

---

## Rappel du cours précédent

> Cours 12 — Vertical Slice Architecture.

**Question 1 — Pourquoi une Query slice peut-elle utiliser du SQL direct sans passer par les Entities Domain, alors que les Command slices doivent les utiliser ?**

<details>
<summary>Réponse</summary>

Parce que les Queries ont pour unique but de lire des données pour les afficher — elles n'appliquent aucune règle métier. Passer par les Entities Domain (reconstitution, mapping, validation) n'ajoute que de la latence et de la complexité sans valeur. Les Entities existent pour protéger les invariants métier lors des modifications. Pour une simple lecture, un SQL optimise retournant exactement le shape nécessaire au front est à la fois plus performant et plus simple. C'est le principe CQRS-lite : les chemins d'écriture et de lecture peuvent etre radicalement différents.

</details>

**Question 2 — Quel est le role du pattern Mediator dans la Vertical Slice Architecture, et quel avantage apporte-t-il par rapport a l'injection directe des handlers dans les controllers ?**

<details>
<summary>Réponse</summary>

Le Mediator est un dispatcher central qui recoit des objets Command ou Query et les route vers le Handler correspondant. Le Controller ne connait pas les Handlers — il envoie juste un message. Avantages : le Controller devient trivial (aucune logique), on peut ajouter des comportements transversaux (logging, validation, tracing, retry) en decorant le Mediator sans toucher aux Handlers ni aux Controllers, et chaque slice peut etre testee complètement en isolation en instanciant directement son Handler sans passer par le framework.

</details>

---

## Analogie — Le distributeur automatique (ATM)

Tu inseres ta carte et appuies sur "Retirer 100 EUR". Le réseau bancaire est lent. Tu rappuies. La machine semble figee. Tu rappuies encore une troisieme fois.

**Si le système n'est pas idempotent :** 300 EUR debites. Catastrophe.

**Si le système est idempotent :** Peu importe combien de fois tu appuies, **un seul retrait de 100 EUR est effectue**. La machine reconnait que tu as déjà effectue cette opération et te repond "Déjà traite" plutot que de la rejouer.

```
SANS IDEMPOTENCE :
  Clic 1 -> [Reseau lent] -> Debit #1 (100 EUR)
  Clic 2 -> [Timeout]     -> Debit #2 (100 EUR)  !! ERREUR
  Clic 3 -> [Succes ?]    -> Debit #3 (100 EUR)  !! CATASTROPHE

AVEC IDEMPOTENCE (cle = "session-ATM-xyz-20240301") :
  Clic 1 -> [Reseau lent] -> Debit #1 (100 EUR)  -> stocke la cle
  Clic 2 -> [Timeout]     -> Cle deja vue -> repond "Deja traite"
  Clic 3 -> [Succes]      -> Cle deja vue -> repond le resultat cache
  Resultat final : 100 EUR debites, pas 300.
```

Ce problème existe dans **tout** système distribue : paiements, envoi d'emails, création de comptes, validation de commandes.

---

## Théorie

### 1. Les 12 Facteurs — Vue d'ensemble

Les 12 facteurs (The Twelve-Factor App, Heroku 2012) sont un ensemble de bonnes pratiques pour construire des applications deployables dans le cloud, scalables et maintenables.

```
+--+-------------------------------+----------------------------+
|  | FACTEUR                       | PRINCIPE                   |
+--+-------------------------------+----------------------------+
| I| Codebase                      | 1 repo, N deployments      |
|II| Dependencies                  | Declarees et isolees       |
|III| Config                       | Dans l'environnement       |
|IV| Backing Services              | Ressources attachees       |
| V| Build, Release, Run           | Etapes strictement separees|
|VI| Processes                     | Stateless + share-nothing  |
|VII| Port Binding                 | Export via port           |
|VIII| Concurrency                 | Scale par process          |
|IX| Disposability                 | Demarrage rapide, shutdown|
| X| Dev/Prod Parity               | Environnements identiques  |
|XI| Logs                          | Streams d'evenements       |
|XII| Admin Processes               | One-off dans l'env prod   |
+--+-------------------------------+----------------------------+
```

---

### 2. Les facteurs les plus critiques en detail

#### Facteur III — Config dans l'environnement

```typescript
// MAUVAIS : secrets hardcodes dans le code
const dbUrl = 'postgresql://admin:secret123@prod-db:5432/orders';

// MAUVAIS : fichier .env commite dans le depot
// .env : DATABASE_URL=postgresql://admin:secret123@prod-db:5432/orders

// BON : variables d'environnement, jamais dans le code
const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) throw new Error('DATABASE_URL is required');
```

**Regle :** Si tu peux publier ton code source sans compromettre la sécurité, ta config est bien externalises.

---

#### Facteur VI — Processes Stateless

```typescript
// MAUVAIS : session utilisateur stockee en memoire du process
// Si l'instance redemartre ou si une autre instance repond -> session perdue
const userSessions = new Map<string, UserSession>();

app.post('/login', (req, res) => {
  userSessions.set(req.body.userId, { token: generateToken() });
});

// BON : session stockee dans Redis — partagee entre toutes les instances
import { createClient } from 'redis';

const redis = createClient({ url: process.env.REDIS_URL });

app.post('/login', async (req, res) => {
  const session = { token: generateToken(), expiresAt: Date.now() + 3600000 };
  // Accessible depuis n'importe quelle instance du service
  await redis.setEx(`session:${req.body.userId}`, 3600, JSON.stringify(session));
  res.json({ token: session.token });
});
```

---

#### Facteur IX — Disposability (Graceful Shutdown)

```typescript
// Un conteneur peut etre arrete a tout moment (K8s scale-down, rolling deploy)
// L'application doit terminer proprement : finir les requetes en cours, fermer les connexions

process.on('SIGTERM', async () => {
  console.log('SIGTERM received — starting graceful shutdown');

  // 1. Arrete d'accepter de nouvelles connexions
  server.close(async () => {
    // 2. Attend la fin des requetes en cours (timeout 10s)
    await waitForActiveRequests(10_000);

    // 3. Ferme les connexions BDD et Redis
    await dataSource.destroy();
    await redis.quit();

    console.log('Graceful shutdown complete');
    process.exit(0);
  });
});
```

---

#### Facteur XI — Logs comme streams

```typescript
// MAUVAIS : ecriture dans un fichier (stateful, need rotation)
import * as fs from 'fs';
const logFile = fs.createWriteStream('/var/log/app.log');
logFile.write('User created\n');

// BON : ecrire sur stdout/stderr — l'infrastructure capte et aggregate
// Kubernetes, Datadog, CloudWatch lisent les streams des containers
console.log(JSON.stringify({
  level: 'info',
  message: 'User created',
  userId: 'usr-123',
  timestamp: new Date().toISOString(),
  service: 'orders-service',
  traceId: getTraceId(),
}));
```

---

### 3. Idempotence — Définition et propriété mathematique

> Une opération est **idempotente** si l'appliquer une ou plusieurs fois produit le même résultat que l'appliquer une seule fois.

```
IDEMPOTENT :
  f(f(x)) = f(x)

Exemples naturellement idempotents :
  PUT /users/123 (remplace la ressource) -> meme resultat si repete
  DELETE /orders/456 (si l'entite n'existe plus : 404, pas d'erreur)
  Multiplier par 1 ou 0

NON-IDEMPOTENTS par defaut :
  POST /orders (chaque appel cree une nouvelle commande)
  POST /payments (chaque appel debite une fois)
  Incrementer un compteur
```

---

### 4. Les clés d'idempotence (Idempotency Keys)

Une **clé d'idempotence** est un identifiant unique généré par le CLIENT avant d'envoyer la requête. Le serveur l'utilise pour reconnaitre une requête déjà traitee.

```
CLIENT                              SERVEUR
  |                                    |
  |  Genere : idempotency-key = UUID   |
  |  POST /payments                    |
  |  Idempotency-Key: abc-123          |
  |----------------------------------->|
  |                                    |  Verifie si abc-123 est connu
  |                                    |  Non -> traite, stocke le resultat
  |                                    |       associe a abc-123
  |  200 OK { paymentId: "pay-789" }   |
  |<-----------------------------------|
  |                                    |
  |  [TIMEOUT — le client ne sait      |
  |   pas si c'est arrive]             |
  |                                    |
  |  Retry : POST /payments            |
  |  Idempotency-Key: abc-123          |  <- MEME CLE
  |----------------------------------->|
  |                                    |  Verifie si abc-123 est connu
  |                                    |  OUI -> retourne le resultat stocke
  |  200 OK { paymentId: "pay-789" }   |  <- MEME REPONSE, pas de nouveau debit
  |<-----------------------------------|
```

---

### 5. Exactly-Once vs At-Least-Once

| Stratégie | Garantie | Risque | Usage |
|---|---|---|---|
| At-Most-Once | 0 ou 1 livraison | Perte de message | Logs, telemetrie |
| At-Least-Once | 1 ou N livraisons | Doublons | Notifications (avec dedup) |
| Exactly-Once | Exactement 1 | Complexe a implémenter | Paiements, débit |

**Exactly-once** est souvent obtenu via : At-Least-Once + Idempotence côté consommateur.

---

## Pratique — Implémentation complete TypeScript

### Configuration typee — Facteur III

```typescript
// src/config/app-config.ts

// Valide toutes les variables d'environnement au demarrage
// Si une variable obligatoire manque, l'app refuse de demarrer
// plutot que de crasher 30 minutes plus tard avec un message confus

export interface AppConfig {
  database: {
    url: string;
    maxConnections: number;
  };
  redis: {
    url: string;
    ttlSeconds: number;
  };
  payment: {
    providerApiKey: string;
    webhookSecret: string;
  };
  app: {
    port: number;
    nodeEnv: 'development' | 'staging' | 'production';
  };
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function optionalEnv(name: string, defaultValue: string): string {
  return process.env[name] ?? defaultValue;
}

// La config est construite une seule fois au demarrage et immuable
export function buildConfig(): AppConfig {
  return {
    database: {
      url: requireEnv('DATABASE_URL'),
      maxConnections: Number(optionalEnv('DB_MAX_CONNECTIONS', '10')),
    },
    redis: {
      url: requireEnv('REDIS_URL'),
      ttlSeconds: Number(optionalEnv('IDEMPOTENCY_TTL_SECONDS', '86400')), // 24h
    },
    payment: {
      providerApiKey: requireEnv('PAYMENT_PROVIDER_API_KEY'),
      webhookSecret: requireEnv('PAYMENT_WEBHOOK_SECRET'),
    },
    app: {
      port: Number(optionalEnv('PORT', '3000')),
      nodeEnv: (optionalEnv('NODE_ENV', 'development')) as AppConfig['app']['nodeEnv'],
    },
  };
}
```

### Store d'idempotence — Redis

```typescript
// src/shared/idempotency/idempotency-store.ts
import { Injectable } from '@nestjs/common';
import type { Redis } from 'ioredis';

export interface IdempotencyRecord {
  status: 'processing' | 'completed' | 'failed';
  result?: unknown;
  errorMessage?: string;
  createdAt: string;
}

@Injectable()
export class IdempotencyStore {
  private readonly ttlSeconds: number;

  constructor(
    private readonly redis: Redis,
    ttlSeconds = 86_400, // 24 heures par defaut
  ) {
    this.ttlSeconds = ttlSeconds;
  }

  private key(service: string, idempotencyKey: string): string {
    return `idempotency:${service}:${idempotencyKey}`;
  }

  // Tente d'acquerir le verrou pour cette cle
  // Retourne true si on est le premier (on doit traiter), false si deja vu
  async tryAcquire(service: string, idempotencyKey: string): Promise<boolean> {
    const key = this.key(service, idempotencyKey);
    const record: IdempotencyRecord = {
      status: 'processing',
      createdAt: new Date().toISOString(),
    };

    // SET NX (Not eXists) : atomique — un seul process peut reussir
    const result = await this.redis.set(
      key,
      JSON.stringify(record),
      'EX',
      this.ttlSeconds,
      'NX', // Ne pose le verrou QUE si la cle n'existe pas
    );

    // result === 'OK' : on a acquis le verrou -> on est le premier
    // result === null : la cle existait deja -> deja en cours ou traite
    return result === 'OK';
  }

  async getRecord(service: string, idempotencyKey: string): Promise<IdempotencyRecord | null> {
    const key = this.key(service, idempotencyKey);
    const raw = await this.redis.get(key);
    if (!raw) return null;
    return JSON.parse(raw) as IdempotencyRecord;
  }

  async markCompleted(
    service: string,
    idempotencyKey: string,
    result: unknown,
  ): Promise<void> {
    const key = this.key(service, idempotencyKey);
    const record: IdempotencyRecord = {
      status: 'completed',
      result,
      createdAt: new Date().toISOString(),
    };
    // Renouvelle le TTL avec le resultat final
    await this.redis.set(key, JSON.stringify(record), 'EX', this.ttlSeconds);
  }

  async markFailed(
    service: string,
    idempotencyKey: string,
    errorMessage: string,
  ): Promise<void> {
    const key = this.key(service, idempotencyKey);
    const record: IdempotencyRecord = {
      status: 'failed',
      errorMessage,
      createdAt: new Date().toISOString(),
    };
    await this.redis.set(key, JSON.stringify(record), 'EX', this.ttlSeconds);
  }
}
```

### Decorateur d'idempotence — Usage transparent

```typescript
// src/shared/idempotency/idempotent.decorator.ts
import { IdempotencyStore } from './idempotency-store';

// Rend n'importe quelle methode idempotente via une cle passee en argument
export function Idempotent(service: string) {
  return function (
    _target: object,
    _propertyKey: string,
    descriptor: PropertyDescriptor,
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (
      this: { idempotencyStore: IdempotencyStore },
      idempotencyKey: string,
      ...args: unknown[]
    ) {
      // 1. Verifie si cette cle a deja ete traitee
      const acquired = await this.idempotencyStore.tryAcquire(service, idempotencyKey);

      if (!acquired) {
        // La cle existe deja — recupere le resultat precedent
        const record = await this.idempotencyStore.getRecord(service, idempotencyKey);

        if (record?.status === 'completed') {
          // Retourne le resultat cache — aucun traitement ne se repete
          return record.result;
        }

        if (record?.status === 'processing') {
          // Encore en cours de traitement — conflict
          throw new Error(`Operation ${idempotencyKey} is still processing. Retry later.`);
        }

        if (record?.status === 'failed') {
          throw new Error(`Operation ${idempotencyKey} previously failed: ${record.errorMessage}`);
        }
      }

      // 2. Premiere fois — execute l'operation reelle
      try {
        const result = await originalMethod.apply(this, [idempotencyKey, ...args]);
        // 3. Stocke le resultat pour les retries futurs
        await this.idempotencyStore.markCompleted(service, idempotencyKey, result);
        return result;
      } catch (error) {
        await this.idempotencyStore.markFailed(service, idempotencyKey, (error as Error).message);
        throw error;
      }
    };

    return descriptor;
  };
}
```

### Exemple concret — Service de paiement idempotent

```typescript
// src/payments/application/process-payment.use-case.ts
import { Injectable, Inject } from '@nestjs/common';
import { IdempotencyStore } from '../../shared/idempotency/idempotency-store';

export interface ProcessPaymentCommand {
  idempotencyKey: string; // UUID genere par le client AVANT l'appel
  orderId: string;
  amount: number;
  currency: string;
  paymentMethodId: string;
}

export interface PaymentResult {
  paymentId: string;
  status: 'succeeded' | 'failed';
  processedAt: string;
}

export const PAYMENT_GATEWAY = 'PAYMENT_GATEWAY';

export interface IPaymentGateway {
  charge(params: {
    amount: number;
    currency: string;
    paymentMethodId: string;
    metadata: Record<string, string>;
  }): Promise<{ chargeId: string; status: 'succeeded' | 'failed' }>;
}

@Injectable()
export class ProcessPaymentUseCase {
  // L'idempotencyStore est public pour que le decorateur puisse y acceder
  constructor(
    public readonly idempotencyStore: IdempotencyStore,
    @Inject(PAYMENT_GATEWAY) private readonly gateway: IPaymentGateway,
  ) {}

  // Methode manuelle sans decorateur — plus explicite et testable
  async execute(command: ProcessPaymentCommand): Promise<PaymentResult> {
    // ETAPE 1 : Tente d'acquerir le verrou d'idempotence
    const acquired = await this.idempotencyStore.tryAcquire(
      'process-payment',
      command.idempotencyKey,
    );

    if (!acquired) {
      // La cle existe — cette operation a deja ete traitee ou est en cours
      const record = await this.idempotencyStore.getRecord(
        'process-payment',
        command.idempotencyKey,
      );

      if (record?.status === 'completed') {
        console.log(`Payment ${command.idempotencyKey} already processed — returning cached result`);
        return record.result as PaymentResult;
      }

      if (record?.status === 'processing') {
        throw new Error('Payment is currently processing. Please retry in a few seconds.');
      }

      // Si echec precedent : on pourrait autoriser le retry selon la politique
      throw new Error(`Payment ${command.idempotencyKey} previously failed`);
    }

    // ETAPE 2 : Premiere tentative — charge le client
    try {
      const charge = await this.gateway.charge({
        amount: command.amount,
        currency: command.currency,
        paymentMethodId: command.paymentMethodId,
        metadata: {
          orderId: command.orderId,
          idempotencyKey: command.idempotencyKey,
        },
      });

      const result: PaymentResult = {
        paymentId: charge.chargeId,
        status: charge.status,
        processedAt: new Date().toISOString(),
      };

      // ETAPE 3 : Stocke le resultat — les retries recevront ce resultat
      await this.idempotencyStore.markCompleted(
        'process-payment',
        command.idempotencyKey,
        result,
      );

      return result;
    } catch (error) {
      await this.idempotencyStore.markFailed(
        'process-payment',
        command.idempotencyKey,
        (error as Error).message,
      );
      throw error;
    }
  }
}
```

### Controller — Cle d'idempotence dans les headers

```typescript
// src/payments/adapters/rest/payments.controller.ts
import { Controller, Post, Body, Headers, BadRequestException } from '@nestjs/common';
import { ProcessPaymentUseCase } from '../../application/process-payment.use-case';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly processPayment: ProcessPaymentUseCase) {}

  @Post()
  async createPayment(
    @Body() body: { orderId: string; amount: number; currency: string; paymentMethodId: string },
    @Headers('Idempotency-Key') idempotencyKey: string,
  ) {
    // La cle d'idempotence est OBLIGATOIRE pour les paiements
    // Le client (front-end) doit la generer avec crypto.randomUUID()
    if (!idempotencyKey) {
      throw new BadRequestException(
        'Idempotency-Key header is required for payment operations'
      );
    }

    // Valide que la cle ressemble a un UUID (protection basique)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(idempotencyKey)) {
      throw new BadRequestException('Idempotency-Key must be a valid UUID v4');
    }

    return this.processPayment.execute({
      idempotencyKey,
      orderId: body.orderId,
      amount: body.amount,
      currency: body.currency,
      paymentMethodId: body.paymentMethodId,
    });
  }
}
```

### Test du comportement idempotent

```typescript
// src/payments/application/process-payment.use-case.spec.ts
import { ProcessPaymentUseCase } from './process-payment.use-case';
import { IdempotencyStore, IdempotencyRecord } from '../../shared/idempotency/idempotency-store';

// Store en memoire pour les tests — pas de Redis necessaire
class InMemoryIdempotencyStore {
  private store = new Map<string, IdempotencyRecord>();

  async tryAcquire(service: string, key: string): Promise<boolean> {
    const fullKey = `${service}:${key}`;
    if (this.store.has(fullKey)) return false;
    this.store.set(fullKey, { status: 'processing', createdAt: new Date().toISOString() });
    return true;
  }

  async getRecord(service: string, key: string): Promise<IdempotencyRecord | null> {
    return this.store.get(`${service}:${key}`) ?? null;
  }

  async markCompleted(service: string, key: string, result: unknown): Promise<void> {
    this.store.set(`${service}:${key}`, {
      status: 'completed',
      result,
      createdAt: new Date().toISOString(),
    });
  }

  async markFailed(service: string, key: string, errorMessage: string): Promise<void> {
    this.store.set(`${service}:${key}`, {
      status: 'failed',
      errorMessage,
      createdAt: new Date().toISOString(),
    });
  }
}

// Gateway de paiement stub — compte les appels
class StubPaymentGateway {
  callCount = 0;

  async charge(_params: unknown) {
    this.callCount++;
    return { chargeId: `charge-${this.callCount}`, status: 'succeeded' as const };
  }
}

describe('ProcessPaymentUseCase — idempotence', () => {
  let useCase: ProcessPaymentUseCase;
  let gateway: StubPaymentGateway;
  const IDEMPOTENCY_KEY = '550e8400-e29b-41d4-a716-446655440000';

  const command = {
    idempotencyKey: IDEMPOTENCY_KEY,
    orderId: 'order-1',
    amount: 9900,
    currency: 'EUR',
    paymentMethodId: 'pm-card-visa',
  };

  beforeEach(() => {
    gateway = new StubPaymentGateway();
    useCase = new ProcessPaymentUseCase(
      new InMemoryIdempotencyStore() as any,
      gateway,
    );
  });

  it('traite le paiement une seule fois meme si appele plusieurs fois', async () => {
    // Premier appel : traitement reel
    const result1 = await useCase.execute(command);
    expect(result1.status).toBe('succeeded');
    expect(gateway.callCount).toBe(1); // gateway appele une fois

    // Deuxieme appel avec la meme cle (retry simulant un timeout)
    const result2 = await useCase.execute(command);
    expect(result2.status).toBe('succeeded');
    expect(result2.paymentId).toBe(result1.paymentId); // MEME resultat
    expect(gateway.callCount).toBe(1); // gateway PAS rappele !

    // Troisieme appel — toujours idempotent
    const result3 = await useCase.execute(command);
    expect(result3.paymentId).toBe(result1.paymentId);
    expect(gateway.callCount).toBe(1); // toujours 1, jamais 2 ni 3
  });

  it('un paiement avec une cle differente est un nouveau paiement', async () => {
    await useCase.execute(command);
    await useCase.execute({ ...command, idempotencyKey: 'autre-uuid-000' });
    // Deux cles differentes = deux paiements distincts
    expect(gateway.callCount).toBe(2);
  });
});
```

---

## Résumé

- Les **12 facteurs** définissent une application cloud-native : config dans l'environnement (Facteur III), processes stateless (VI), shutdown gracieux (IX), et logs comme streams (XI) sont les plus critiques a maîtriser.
- Une opération est **idempotente** si la répéter N fois produit le même résultat que la faire une seule fois — propriété essentielle dans tout système distribue ou les timeouts et retries sont inevitables.
- Les **clés d'idempotence** sont générées par le client (UUID v4) avant l'appel et envoyees dans un header `Idempotency-Key`. Le serveur stocke le résultat associe a cette clé dans Redis pour retourner la même réponse aux retries.
- Le pattern **tryAcquire + markCompleted** avec Redis `SET NX` garantit l'atomicite : un seul process peut acquerir le verrou, les suivants trouvent la clé déjà présenté et retournent le résultat cache.
- Le principe **Exactly-Once** s'obtient en combinant At-Least-Once (retries) avec l'idempotence côté serveur — c'est la seule façon realiste de garantir qu'un paiement n'est jamais debite deux fois.

---

## Fin du Module 01 — Patterns Architecturaux

Tu as maintenant couvert l'ensemble des patterns architecturaux fondamentaux :

| Cours | Pattern | Cas d'usage principal |
|---|---|---|
| 07 | Architecture en couches | Application métier standard |
| 08 | Architecture Hexagonale | Coeur isole de l'infra |
| 09 | Clean Architecture | Domaines complexes, grandes équipes |
| 10 | Monolithe Modulaire & API-First | Equipes < 15, domaine en exploration |
| 11 | Microservices | Domaines stables, équipes autonomes, scale differencie |
| 12 | Vertical Slice | Organisation par feature, autonomie maximale |
| 13 | 12-Factor & Idempotence | Cloud-native, résilience, retries surs |

**Module 02 — Patterns de conception (Design Patterns)** commence au prochain cours.

---

> **Lien fil rouge — ShopArch**
>
> - Passe ShopArch en revue avec la checklist 12-Factor
> - Implémente l'idempotency key sur `POST /orders` pour éviter les doubles commandes
> - Exercice(s) associé(s) : `exercices/08-twelve-factor-checklist/`
> - Checkpoint : Module 01, critère 4

---

<!-- parcours-recommande -->

::: tip Parcours recommandé
1. **Exercice** : [05-layered-to-hexagonal](../../exercices/05-layered-to-hexagonal/ENONCE)
2. **Exercice** : [06-vertical-slice-module](../../exercices/06-vertical-slice-module/ENONCE)
3. **Exercice** : [07-decomposer-monolithe](../../exercices/07-decomposer-monolithe/ENONCE)
4. **Renforcement** : [07b-quand-ne-pas-decomposer](../../exercices/07b-quand-ne-pas-decomposer/ENONCE)
5. **Exercice** : [08-twelve-factor-checklist](../../exercices/08-twelve-factor-checklist/ENONCE)
:::
