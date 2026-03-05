# Cours 69 — Monitoring, Alerting & SLOs

> **Objectif** : Comprendre les 3 signaux OpenTelemetry (metrics, traces, logs), définir des SLOs formels avec error budgets, implémenter des alertes multi-window burn-rate, et construire des dashboards Grafana actionnables.

---

## Rappel du cours précédent

<details>
<summary>1. Pourquoi utiliser du logging structure JSON plutot que du texte libre ?</summary>

Le JSON est **parsable par machine** — les outils comme Loki, Elasticsearch, Datadog peuvent filtrer (`tenantId=acme`), agreger (`count(order.created) par heure`), et alerter (`error rate > 1%`). Le texte libre nécessité des regex fragiles et ne permet pas les requêtes structurees. De plus, le JSON garantit un format cohérent entre tous les services.
</details>

<details>
<summary>2. Qu'est-ce qu'un correlation ID et a quoi sert-il ?</summary>

Un `traceId` unique généré au point d'entree (API gateway) et **propage a travers tous les services** via un header HTTP (`X-Trace-Id`). Il permet de reconstituer le parcours complet d'une requête dans un système distribue — tous les logs avec le meme traceId correspondent a la meme action utilisateur.
</details>

---

## Analogie — Le tableau de bord d'un avion

Un pilote ne regarde pas UN SEUL instrument — il a un tableau de bord complet :
- **Altimetre** (metric) : valeur numérique a un instant T
- **Boite noire** (trace) : enregistrement sequentiel de tout ce qui s'est passe
- **Alarme** (alerte) : se déclenché quand une valeur depasse un seuil
- **SLO** : "je m'engage a ne pas descendre en dessous de 30000ft pendant 99.9% du vol"

Un SLO n'est pas un objectif de perfection — c'est une **promesse mesurable** avec un budget d'erreur acceptable.

---

## Théorie

### 1. Les 3 signaux OpenTelemetry

```
┌───────────────────────────────────────────────────────────────┐
│                    OpenTelemetry Pipeline                      │
│                                                               │
│  Application ──> OTel SDK ──> OTel Collector ──> Backends     │
│                                                               │
│  Signal 1 : METRICS                                          │
│    → Counter, Gauge, Histogram                                │
│    → Backend : Prometheus / Mimir                             │
│    → "Combien de requetes par seconde ?"                      │
│                                                               │
│  Signal 2 : TRACES                                           │
│    → Spans, context propagation                               │
│    → Backend : Tempo / Jaeger                                 │
│    → "Quel service est lent dans cette requete ?"             │
│                                                               │
│  Signal 3 : LOGS                                             │
│    → Structured JSON                                          │
│    → Backend : Loki / Elasticsearch                           │
│    → "Qu'est-ce qui s'est passe exactement ?"                │
└───────────────────────────────────────────────────────────────┘
```

### 2. Types de metriques

| Type | Description | Exemple |
|---|---|---|
| **Counter** | Valeur qui ne fait qu'augmenter | `http_requests_total` |
| **Gauge** | Valeur qui monte et descend | `active_connections`, `cpu_usage` |
| **Histogram** | Distribution de valeurs | `http_request_duration_seconds` |
| **Summary** | Percentiles pre-calcules | `request_duration_p95` |

### 3. SLOs formels

| SLO | Objectif | Mesure | Budget d'erreur (30j) |
|---|---|---|---|
| API availability | ≥ 99.9% | `1 - (5xx / total)` | 43 min de downtime |
| API latency p95 | ≤ 300ms | `histogram_quantile(0.95, ...)` | 5% des requêtes > 300ms |
| TTFB | ≤ 600ms | `http_request_duration_seconds` | — |
| Lighthouse score | ≥ 90 | Synthetic monitoring | — |
| Cache hit ratio | ≥ 85% | `cache_hits / (cache_hits + cache_misses)` | — |
| Error rate | ≤ 1% / 5min | `rate(http_errors[5m]) / rate(http_total[5m])` | — |

### 4. Error budget

```
SLO : 99.9% availability sur 30 jours
Budget d'erreur = 100% - 99.9% = 0.1%
  → 30 jours × 24h × 60min × 0.001 = 43.2 minutes

Si tu as consomme 30 min ce mois :
  → Budget restant : 13.2 min
  → Burn rate : 30/43.2 = 69.4%

Si le budget est epuise :
  → STOP les deployments
  → Focus sur la fiabilite
  → Pas de nouvelles features
```

### 5. Multi-window burn-rate alerts

```
Alerte rapide (panne majeure) :
  Fenetre 1h : burn rate > 14.4x → PAGE immediatement
  (epuise le budget en ~3h)

Alerte moyenne (degradation) :
  Fenetre 6h : burn rate > 6x → PAGE
  (epuise le budget en ~5h)

Alerte lente (erosion) :
  Fenetre 3j : burn rate > 1x → TICKET
  (epuise le budget en ~30j)

Pourquoi multi-window ?
  → Single window : trop de faux positifs (un spike temporaire)
  → Multi-window : confirme la tendance avant d'alerter
```

### 6. RUM (Real User Monitoring)

```
Client-side → Core Web Vitals → OpenTelemetry → Dashboard

Metriques collectees :
  LCP (Largest Contentful Paint) : <2.5s
  CLS (Cumulative Layout Shift) : <0.1
  INP (Interaction to Next Paint) : <200ms
  TTFB (Time to First Byte) : <600ms
```

---

## Pratique

### Web Vitals composable

```typescript
// useWebVitals.ts
export function useWebVitals(): void {
  if (typeof window === 'undefined') return;

  const reportMetric = (metric: { name: string; value: number }) => {
    // Envoyer a l'endpoint OpenTelemetry
    navigator.sendBeacon('/api/vitals', JSON.stringify({
      name: metric.name,
      value: Math.round(metric.value),
      page: window.location.pathname,
      timestamp: new Date().toISOString(),
    }));
  };

  // Core Web Vitals
  import('web-vitals').then(({ onLCP, onCLS, onINP, onTTFB }) => {
    onLCP(reportMetric);
    onCLS(reportMetric);
    onINP(reportMetric);
    onTTFB(reportMetric);
  });
}
```

### Prometheus metrics (NestJS)

```typescript
import { Counter, Histogram, register } from 'prom-client';

const httpRequestsTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total HTTP requests',
  labelNames: ['method', 'path', 'status', 'tenant'],
});

const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'path', 'tenant'],
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
});

@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest();
    const end = httpRequestDuration.startTimer({
      method: req.method,
      path: req.route?.path ?? req.path,
      tenant: req['tenantId'],
    });

    return next.handle().pipe(
      tap(() => {
        const status = context.switchToHttp().getResponse().statusCode;
        httpRequestsTotal.inc({
          method: req.method,
          path: req.route?.path ?? req.path,
          status: String(status),
          tenant: req['tenantId'],
        });
        end();
      }),
    );
  }
}

// Endpoint /metrics pour Prometheus scraping
@Controller('metrics')
export class MetricsController {
  @Get()
  async getMetrics(): Promise<string> {
    return register.metrics();
  }
}
```

### SLO alerting rules (Prometheus)

```yaml
# prometheus-rules.yml
groups:
  - name: slo-alerts
    rules:
      # Burn rate rapide (1h) — page immediatement
      - alert: HighErrorBurnRate
        expr: |
          (
            sum(rate(http_requests_total{status=~"5.."}[1h]))
            /
            sum(rate(http_requests_total[1h]))
          ) > (14.4 * 0.001)
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "Error burn rate 14.4x — SLO budget sera epuise en ~3h"

      # Burn rate moyen (6h) — page
      - alert: MediumErrorBurnRate
        expr: |
          (
            sum(rate(http_requests_total{status=~"5.."}[6h]))
            /
            sum(rate(http_requests_total[6h]))
          ) > (6 * 0.001)
        for: 5m
        labels:
          severity: warning

      # Latence p95 — alerte si > 300ms
      - alert: HighP95Latency
        expr: |
          histogram_quantile(0.95,
            sum(rate(http_request_duration_seconds_bucket[5m])) by (le)
          ) > 0.3
        for: 5m
        labels:
          severity: warning
```

---

## Resume

1. **3 signaux OTel** : metrics (Prometheus) pour les tendances, traces (Tempo) pour le parcours requête, logs (Loki) pour le detail
2. **SLOs formels** : API p95 ≤300ms, disponibilité ≥99.9%, Lighthouse ≥90 — promesses mesurables, pas des aspirations
3. **Error budget** : 99.9% = 43 min/mois de downtime tolere — budget epuise → stop les features, focus fiabilité
4. **Multi-window burn-rate** : 1h fenetre = page critique, 6h = warning, 3j = ticket — éviter les faux positifs
5. **RUM** : `useWebVitals` collecte LCP/CLS/INP/TTFB sur les vrais utilisateurs → dashboards Grafana par tenant/page/geo

---

> **Prochain cours** : [Cours 70 — Distributed Tracing](./03-distributed-tracing.md)

---

> **Lien fil rouge — ShopArch**
>
> - Définis les SLOs de ShopArch : p95 latence ≤300ms, disponibilité ≥99.9%, error rate ≤1%
> - Configure les alertes d'error budget burn (multi-window)
> - Exercice(s) associé(s) : `exercices/47-slos-error-budgets/`
> - Checkpoint : Module 10, critère 2
