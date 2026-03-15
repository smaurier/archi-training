# Cours 53 — Résilience, Chaos Engineering & Disaster Recovery

> **Objectif** : Maîtriser les patterns de résilience (Circuit Breaker, Bulkhead, Timeout), comprendre le Chaos Engineering, et planifier la Disaster Recovery (RPO, RTO).

---

## Rappel du cours précédent

<details>
<summary>1. Quelle est la différence entre une saga choreographiee et une saga orchestree ?</summary>

- **Choreographiee** : chaque service écoute les events des autres et reagit. Pas de coordinateur central. Plus découplé, mais plus difficile à suivre.
- **Orchestree** : un orchestrateur central appelle les services dans l'ordre et géré les compensations. Plus facile à comprendre, mais l'orchestrateur est un SPOF potentiel.
</details>

<details>
<summary>2. Qu'est-ce qu'une transaction compensatoire dans le Saga Pattern ?</summary>

C'est l'inverse d'une transaction. Si l'étape 3 d'une saga échoué, on exécuté les compensations des étapes 2 et 1 dans l'ordre inverse (ex : annuler la reservation de stock, rembourser le paiement). Ce n'est PAS un rollback DB — c'est une nouvelle transaction qui defait l'effet de la précédente.
</details>

---

## Analogie — Le disjoncteur electrique

Un disjoncteur dans une maison :
- **Ferme** (closed) : le courant passe normalement
- **Ouvert** (open) : trop de surcharge → le disjoncteur coupe le courant pour protéger l'installation
- **Semi-ouvert** (half-open) : après un moment, on teste si le problème est résolu en laissant passer un peu de courant

Le **Circuit Breaker** logiciel fait exactement pareil : il détecté qu'un service est en panne et arrete de l'appeler (open), puis teste periodiquement si le service est de retour (half-open).

---

## Théorie

### 1. Circuit Breaker

```
         Succes
    ┌───────────────┐
    │               │
    ▼               │
┌────────┐  Echec > seuil  ┌────────┐  Timer expire  ┌───────────┐
│ CLOSED │─────────────────>│  OPEN  │───────────────>│ HALF-OPEN │
│ (OK)   │                  │ (fail  │                │ (test)    │
│        │<─────────────────│  fast) │<───────────────│           │
└────────┘   Reset          └────────┘    Echec       └───────────┘
             (succes en                                    │
              half-open)                                   │ Succes
                                                          │
                                                    → CLOSED
```

| État | Comportement | Quand |
|---|---|---|
| **Closed** | Requetes passent normalement | Service sain |
| **Open** | Echec immédiat (fail fast), pas d'appel au service | Seuil d'echecs atteint |
| **Half-Open** | N requêtes de test autorisees | Timer expire après open |

### 2. Bulkhead Pattern

Isoler les ressources pour qu'une panne dans un sous-système ne se propage pas :

```
Sans Bulkhead :
┌─────────────────────────┐
│   Thread Pool (100)      │
│   Service A: 80 threads  │ ← Service A lent → monopolise tout
│   Service B: 20 threads  │ ← Service B starve
└─────────────────────────┘

Avec Bulkhead :
┌──────────────┐  ┌──────────────┐
│ Pool A (50)  │  │ Pool B (50)  │
│ Service A    │  │ Service B    │ ← Isole ! A peut etre lent
│ (lent)       │  │ (OK)         │   sans impacter B
└──────────────┘  └──────────────┘
```

### 3. Timeout cascading

Sans timeout, une latence se propage en cascade :

```
Client → API (timeout 30s) → Service A (timeout 30s) → Service B (timeout 30s)
Si B met 29s, A attend 29s, l'API attend 29s + traitement...
Le client attend 60s+ !

SOLUTION : timeouts decroissants
Client → API (timeout 10s) → Service A (timeout 5s) → Service B (timeout 2s)
Si B depasse 2s → A echoue en 2s → API echoue en 2s → Client voit l'erreur en ~3s
```

### 4. Retry avec jitter

```typescript
// Exponential backoff AVEC jitter (anti-thundering herd)
function calculateDelay(attempt: number): number {
  const base = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s, 8s...
  const jitter = Math.random() * base * 0.5; // ±50% aleatoire
  return Math.min(base + jitter, 30_000);     // Cap a 30s
}
```

Sans jitter, si 1000 clients echouent en même temps, ils retryent tous au même moment → nouvelle surcharge. Le jitter etale les retries.

### 5. Chaos Engineering

| Principe | Description |
|---|---|
| **Hypothese** | Définir l'état "normal" du système (SLOs) |
| **Experimentation** | Injecter une panne controlee |
| **Observation** | Le système reste-t-il dans les SLOs ? |
| **Apprentissage** | Documenter et corriger les faiblesses |

Types de pannes a injecter :
- Kill un pod/container
- Ajouter de la latence réseau (200ms)
- Saturer le CPU/mémoire
- Couper la connexion à la DB
- Bloquer le DNS

**Game Day** = exercice planifie ou l'équipe simule une panne majeure en staging et observe la reaction du système.

### 6. Disaster Recovery

| Metrique | Définition | Exemple |
|---|---|---|
| **RPO** (Recovery Point Objective) | Perte de données maximale acceptable | RPO 1h = on peut perdre max 1h de données |
| **RTO** (Recovery Time Objective) | Temps de retour en service maximal | RTO 4h = le système doit etre up en 4h |

```
┌──────────────────────────────────────────┐
│           Disaster Recovery Plan          │
│                                           │
│  RPO = 1h       RTO = 4h                 │
│                                           │
│  Backup :       Recovery :                │
│  - DB : WAL     - Failover auto           │
│    shipping      (PostgreSQL streaming)   │
│    toutes les   - Restore depuis S3       │
│    15 min       - Infra recreee via       │
│  - S3 : cross-    Terraform              │
│    region       - Runbook documente       │
│    replication                            │
│  - Redis :                                │
│    AOF persist                            │
└──────────────────────────────────────────┘
```

---

## Pratique

### Circuit Breaker implémentation

```typescript
type CircuitState = 'closed' | 'open' | 'half-open';

interface CircuitBreakerOptions {
  failureThreshold: number;     // Nombre d'echecs avant ouverture
  resetTimeoutMs: number;       // Temps avant de passer en half-open
  halfOpenMaxAttempts: number;  // Requetes de test en half-open
}

export class CircuitBreaker {
  private state: CircuitState = 'closed';
  private failureCount = 0;
  private lastFailureTime = 0;
  private halfOpenAttempts = 0;

  constructor(private readonly options: CircuitBreakerOptions) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailureTime > this.options.resetTimeoutMs) {
        this.state = 'half-open';
        this.halfOpenAttempts = 0;
      } else {
        throw new CircuitOpenError('Circuit breaker is open');
      }
    }

    if (this.state === 'half-open' && this.halfOpenAttempts >= this.options.halfOpenMaxAttempts) {
      throw new CircuitOpenError('Circuit breaker half-open limit reached');
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    if (this.state === 'half-open') {
      this.state = 'closed'; // Service recovered
    }
    this.failureCount = 0;
  }

  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.state === 'half-open') {
      this.state = 'open'; // Still failing
    } else if (this.failureCount >= this.options.failureThreshold) {
      this.state = 'open';
    }
  }

  getState(): CircuitState {
    return this.state;
  }
}

class CircuitOpenError extends Error {
  constructor(message: string) { super(message); this.name = 'CircuitOpenError'; }
}
```

### Usage avec un service externe

```typescript
@Injectable()
export class PaymentGateway {
  private readonly breaker = new CircuitBreaker({
    failureThreshold: 5,
    resetTimeoutMs: 30_000,   // 30s avant de retester
    halfOpenMaxAttempts: 2,
  });

  async charge(orderId: string, amount: number): Promise<PaymentResult> {
    try {
      return await this.breaker.execute(() =>
        this.httpClient.post('/payments/charge', { orderId, amount }),
      );
    } catch (error) {
      if (error instanceof CircuitOpenError) {
        // Le payment gateway est down → degraded mode
        return { status: 'pending', message: 'Payment will be retried' };
      }
      throw error;
    }
  }
}
```

### Game day checklist

```markdown
## Game Day — Simulation panne base de donnees

### Preparation
- [ ] Annoncer le game day a l'equipe (date, scope)
- [ ] Verifier les SLOs de reference (p95 < 300ms, error rate < 1%)
- [ ] Preparer le monitoring dashboard

### Execution (en staging)
- [ ] T+0 : Couper la connexion PostgreSQL (kill connection)
- [ ] T+1min : Observer les metriques (error rate, latence)
- [ ] T+3min : Le circuit breaker est-il ouvert ?
- [ ] T+5min : Les fallbacks fonctionnent-ils ? (cache Redis)
- [ ] T+10min : Remettre PostgreSQL
- [ ] T+12min : Le systeme se remet-il automatiquement ?

### Observations
- Temps de detection de la panne : ___
- Temps de basculement vers fallback : ___
- Erreurs utilisateur visibles : ___
- Temps de recovery complet : ___

### Actions correctives
- [ ] ...
```

---

## Résumé

1. **Circuit Breaker** : closed → open (fail fast) → half-open (test) — protégé contre les cascading failures
2. **Bulkhead** : isoler les thread pools/connexions par service — une panne locale ne contamine pas
3. **Timeout decroissant** : API 10s → Service 5s → DB 2s — éviter les attentes en cascade
4. **Chaos Engineering** : injecter des pannes controlees pour découvrir les faiblesses AVANT la production
5. **RPO/RTO** : définir la perte de données et le temps d'arret acceptables, puis dimensionner les backups et le failover

---

> **Prochain cours** : [Cours 54 — Strangler Fig & Migration progressive](./06-strangler-fig-migration.md)

---

> **Lien fil rouge — ShopArch**
>
> - Implémente le circuit breaker sur le payment gateway ShopArch
> - Simule une panne du service de paiement et vérifie le fallback graceful
> - Exercice(s) associé(s) : `exercices/36-game-day-panne/`
> - Checkpoint : Module 07, critère 3
