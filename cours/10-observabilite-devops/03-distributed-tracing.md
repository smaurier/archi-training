# Cours 70 — Distributed Tracing

> **Objectif** : Comprendre le distributed tracing (spans, traces, baggage), implémenter la propagation du contexte (W3C Trace Context), définir une stratégie de sampling, et utiliser Jaeger/Tempo pour diagnostiquer les problèmes de latence.

---

## Rappel du cours précédent

<details>
<summary>1. Quels sont les 3 signaux OpenTelemetry et leur backend typique ?</summary>

1. **Metrics** (Prometheus/Mimir) — valeurs numériques dans le temps (counters, gauges, histograms)
2. **Traces** (Tempo/Jaeger) — parcours d'une requête a travers les services (spans hierarchiques)
3. **Logs** (Loki/Elasticsearch) — événements structures detailles. Les 3 sont correles via le `traceId`.
</details>

<details>
<summary>2. Qu'est-ce qu'un error budget et que faire quand il est epuise ?</summary>

L'error budget est la quantité d'erreurs acceptable dans une periode (ex: 99.9% SLO sur 30j = 43min de downtime tolere). Quand le budget est epuise : **stop les deployments de features**, focus exclusif sur la fiabilité, pas de nouvelles fonctionnalités jusqu'a ce que le budget se recharge.
</details>

---

## Analogie — Le GPS de livraison

Quand tu commandes un colis, tu peux voir son parcours complet :
- **Trace** : le trajet complet Paris → Entrepot Lyon → Hub Marseille → Domicile
- **Span** : chaque étape (Paris→Lyon = 1 span, Lyon→Marseille = 1 span)
- **Sampling** : on ne trace pas CHAQUE colis — un echantillon suffit pour détecter les problèmes
- **Correlation** : le numéro de suivi = le `traceId`

Si le colis met 3 jours alors qu'il devrait arriver en 1 jour, le GPS te montre exactement ou il a ete bloque.

---

## Théorie

### 1. Anatomie d'une trace

```
Trace (traceId: abc-123)
│
├── Span 1: API Gateway (12ms)
│   ├── Span 2: Auth Service — validate JWT (3ms)
│   └── Span 3: Order Service — create order (45ms)
│       ├── Span 4: DB — INSERT order (8ms)
│       ├── Span 5: Payment Service — charge (120ms)  ← LENT !
│       │   └── Span 6: Stripe API (110ms)
│       └── Span 7: Email Service — send confirmation (15ms)
│
Total : 195ms

Chaque span contient :
  - traceId (partage par toute la trace)
  - spanId (unique a ce span)
  - parentSpanId (le span parent)
  - operationName ("order.create", "payment.charge")
  - startTime, duration
  - status (OK, ERROR)
  - attributes (tenantId, orderId, ...)
  - events (logs inline)
```

### 2. W3C Trace Context propagation

```
Header standard : traceparent

Format :
  traceparent: {version}-{traceId}-{spanId}-{flags}
  traceparent: 00-abc123def456-span789-01

Service A ──[traceparent: 00-abc-s1-01]──> Service B
              Service B cree un nouveau spanId (s2)
              mais garde le meme traceId (abc)
Service B ──[traceparent: 00-abc-s2-01]──> Service C

Resultat : tous les spans sont correles dans la meme trace
```

### 3. Sampling stratégies

| Stratégie | Description | Quand |
|---|---|---|
| **Head-based** | Decision au debut de la trace (1%) | Production haute charge |
| **Tail-based** | Decision apres la trace complete | Collecter les erreurs/lents |
| **Always-on** | Tout tracer (100%) | Staging, dev |
| **Adaptive** | Ajuster le ratio selon la charge | Systèmes variables |

```
Production :
  1% des traces normales (head-based)
  100% des traces en erreur (tail-based)
  100% des traces > 1s (tail-based)

Staging :
  100% de tout (always-on)
```

### 4. Quand le tracing resout ce que le logging ne peut pas

```
PROBLEME : "l'API est lente — 2s au lieu de 300ms"

Avec les LOGS seuls :
  → Order service : 45ms ✓
  → Payment service : 120ms ✓
  → Email service : 15ms ✓
  Tous rapides individuellement... mais total = 2s ???

Avec le TRACING :
  → Span 1 → Span 2 → attente 1.8s → Span 3
  → Le probleme est ENTRE les spans !
  → Cause : connection pool epuise, requete en file d'attente

Le tracing montre la LATENCE ENTRE les etapes, pas juste DANS les etapes.
```

### 5. Baggage — contexte métier propage

```
Le baggage est un key-value propage automatiquement a travers les services :

Service A :
  baggage: tenantId=acme, userId=u-123, featureFlag=new-checkout

Service B recoit automatiquement :
  baggage.tenantId = "acme"
  baggage.featureFlag = "new-checkout"

Usage : per-tenant metrics, feature flag propagation, A/B testing
```

---

## Pratique

### OpenTelemetry setup (NestJS)

```typescript
// tracing.ts — initialiser AVANT l'application
import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { NestInstrumentation } from '@opentelemetry/instrumentation-nestjs-core';
import { PgInstrumentation } from '@opentelemetry/instrumentation-pg';

const sdk = new NodeSDK({
  serviceName: process.env.SERVICE_NAME ?? 'api',
  traceExporter: new OTLPTraceExporter({
    url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? 'http://otel-collector:4318',
  }),
  instrumentations: [
    new HttpInstrumentation(),
    new NestInstrumentation(),
    new PgInstrumentation(),
  ],
  // Sampling : 1% en prod, 100% en staging
  sampler: process.env.NODE_ENV === 'production'
    ? new TraceIdRatioBasedSampler(0.01)
    : new AlwaysOnSampler(),
});

sdk.start();
```

### Custom span pour une opération métier

```typescript
import { trace, SpanKind, SpanStatusCode } from '@opentelemetry/api';

const tracer = trace.getTracer('order-service');

@Injectable()
export class OrderService {
  async createOrder(dto: CreateOrderDto, tenantId: string): Promise<Order> {
    return tracer.startActiveSpan(
      'order.create',
      { kind: SpanKind.INTERNAL },
      async (span) => {
        try {
          span.setAttributes({
            'tenant.id': tenantId,
            'order.items_count': dto.items.length,
          });

          // Chaque operation interne cree un sous-span
          const order = await tracer.startActiveSpan('db.insert_order', async (dbSpan) => {
            const result = await this.repo.create(dto);
            dbSpan.setAttributes({ 'db.operation': 'INSERT', 'db.table': 'orders' });
            dbSpan.end();
            return result;
          });

          await tracer.startActiveSpan('payment.charge', async (paymentSpan) => {
            await this.paymentService.charge(order.id, order.total);
            paymentSpan.end();
          });

          span.setStatus({ code: SpanStatusCode.OK });
          return order;
        } catch (error) {
          span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
          span.recordException(error);
          throw error;
        } finally {
          span.end();
        }
      },
    );
  }
}
```

### Context propagation dans les appels HTTP

```typescript
import { context, propagation } from '@opentelemetry/api';

@Injectable()
export class TracedHttpService {
  constructor(private readonly http: HttpService) {}

  async get<T>(url: string): Promise<T> {
    // Injecter le contexte de trace dans les headers
    const headers: Record<string, string> = {};
    propagation.inject(context.active(), headers);

    const response = await this.http.axiosRef.get<T>(url, { headers });
    return response.data;
  }
}

// Le service appele recoit automatiquement traceparent
// et continue la meme trace avec un nouveau spanId
```

---

## Resume

1. **Trace** = parcours complet d'une requête, **Span** = une étape dans ce parcours — hierarchie parent/enfant
2. **W3C Trace Context** : header `traceparent` propage automatiquement le `traceId` entre services
3. **Sampling** : 1% en prod (head-based) + 100% des erreurs/lentes (tail-based), 100% en staging
4. **Le tracing montre la latence ENTRE les étapes** — les logs seuls ne revelent pas les temps d'attente (queue, connection pool)
5. **Baggage** : contexte métier (`tenantId`, feature flags) propage automatiquement a travers la chaine de services

---

> **Prochain cours** : [Cours 71 — Architecture CI/CD, Feature Flags & Deployment Stratégies](./04-cicd-feature-flags-deploy.md)

---

> **Lien fil rouge — ShopArch**
>
> - Instrumente ShopArch avec OpenTelemetry (spans sur les appels DB, Redis, HTTP)
> - Visualise un trace complet : client → BFF → API → DB dans Jaeger/Tempo
> - Exercice(s) associé(s) : `exercices/46-pipeline-observabilite/`
> - Checkpoint : Module 10, critère 1
