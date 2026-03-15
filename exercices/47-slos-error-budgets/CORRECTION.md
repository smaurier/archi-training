# Correction — Exercice 47 : SLOs et error budgets

## SLIs et SLOs

| Service | SLI | SLO | Justification |
|---|---|---|---|
| API Catalogue | % requêtes 2xx/4xx (hors 5xx) | 99.9% disponibilité | Page la plus visitee, mais pas critique (cache fallback) |
| API Catalogue | % requêtes < 200ms | p95 < 200ms | Au-dela, le LCP est impacte |
| Checkout | % requêtes 2xx/4xx | 99.95% disponibilité | Impacte directement le revenu |
| Checkout | % requêtes < 1s | p99 < 1s | L'utilisateur attend le résultat du paiement |
| Recherche | % requêtes 2xx/4xx | 99.5% disponibilité | Fallback PG possible, qualité degradee acceptable |
| Recherche | % requêtes < 500ms | p90 < 500ms | Utilisateur tolere un peu de latence |

### Pourquoi pas 99.99% pour le catalogue ?
```
99.9%  = 43.8 min de downtime/mois → 1 incident de 30 min autorise
99.99% = 4.38 min de downtime/mois → quasi aucun incident autorise
Cout : passer de 99.9% a 99.99% necessite multi-region, zero-downtime deploys, etc.
ROI : le catalogue a un cache, les utilisateurs ne voient pas 30 min de downtime API
Decision : 99.9% est suffisant pour le catalogue
```

## Error budgets

| Service | SLO | Error Budget | Minutes/mois | Requetes echouees autorisees* |
|---|---|---|---|---|
| API Catalogue | 99.9% | 0.1% | 43.8 min | ~155 000/mois (sur 155M) |
| Checkout | 99.95% | 0.05% | 21.9 min | ~650/mois (sur 1.3M) |
| Recherche | 99.5% | 0.5% | 219 min | ~260 000/mois (sur 52M) |

*Base sur le volume de requêtes estime.

## Calcul du SLI via Prometheus

```typescript
// slo-calculator.service.ts
@Injectable()
export class SLOCalculator {
  constructor(private readonly prometheus: PrometheusClient) {}

  async calculateAvailabilitySLI(service: string, windowDays: number): Promise<number> {
    // SLI = (total - erreurs) / total
    const query = `
      1 - (
        sum(rate(http_requests_total{service="${service}", status=~"5.."}[${windowDays}d]))
        /
        sum(rate(http_requests_total{service="${service}"}[${windowDays}d]))
      )
    `;
    const result = await this.prometheus.query(query);
    return parseFloat(result.data.result[0]?.value[1] ?? '0');
  }

  async calculateLatencySLI(service: string, thresholdMs: number, percentile: number): Promise<number> {
    const query = `
      histogram_quantile(${percentile / 100},
        rate(http_request_duration_seconds_bucket{service="${service}"}[30d])
      ) < ${thresholdMs / 1000}
    `;
    // Retourne true/false si le percentile est sous le seuil
    return this.prometheus.query(query);
  }

  calculateErrorBudget(slo: number, sli: number): ErrorBudgetStatus {
    const errorBudget = 1 - slo;        // ex: 0.001 (0.1%)
    const errorsConsumed = 1 - sli;      // ex: 0.0003 (0.03%)
    const budgetConsumed = errorsConsumed / errorBudget; // ex: 30%
    const budgetRemaining = 1 - budgetConsumed;

    return {
      slo,
      sli,
      errorBudget,
      budgetConsumedPercent: budgetConsumed * 100,
      budgetRemainingPercent: budgetRemaining * 100,
      minutesRemaining: budgetRemaining * 43800 * errorBudget,
      status: budgetConsumed > 1 ? 'exhausted'
            : budgetConsumed > 0.8 ? 'critical'
            : budgetConsumed > 0.5 ? 'warning'
            : 'healthy',
    };
  }
}
```

## Politique d'error budget

```typescript
// error-budget-policy.ts
interface ErrorBudgetPolicy {
  threshold: number; // % consomme
  actions: string[];
}

const POLICY: ErrorBudgetPolicy[] = [
  {
    threshold: 50,
    actions: [
      'Notification Slack au lead',
      'Review des changements recents',
      'Accelerer les fix en cours de bugs de fiabilite',
    ],
  },
  {
    threshold: 80,
    actions: [
      'Gel des features — focus 100% fiabilite',
      'Deployments uniquement avec rollback automatique',
      'Review obligatoire par SRE pour chaque deploy',
      'Post-mortem preventif sur les incidents recents',
    ],
  },
  {
    threshold: 100,
    actions: [
      'Rollback automatique du dernier deployment',
      'Incident declare — war room',
      'Post-mortem obligatoire avec blameless review',
      'Pas de nouveau deploy tant que le budget n\'est pas recupere',
      'Escalation au CTO',
    ],
  },
];

// Burn rate alert — detecter une consommation trop rapide
// Si on consomme 1h de budget en 5 min → alerte
// Normal burn rate = budget / 30 jours
// Fast burn = 14.4x normal (consomme le budget en 2 jours)
// Slow burn = 6x normal (consomme le budget en 5 jours)
```

## Burn rate alerts (Prometheus)

```yaml
# Burn rate alerts
groups:
  - name: slo-burn-rate
    rules:
      # Fast burn: consomme le budget en 1h (si on maintient ce taux pendant 1h)
      - alert: SLOBurnRateCritical
        expr: |
          (
            sum(rate(http_requests_total{status=~"5.."}[5m]))
            /
            sum(rate(http_requests_total[5m]))
          ) > 14.4 * 0.001
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "Error budget consumed 14.4x faster than normal — budget exhausted in ~2 days"

      # Slow burn: consomme le budget en 3 jours
      - alert: SLOBurnRateWarning
        expr: |
          (
            sum(rate(http_requests_total{status=~"5.."}[30m]))
            /
            sum(rate(http_requests_total[30m]))
          ) > 6 * 0.001
        for: 15m
        labels:
          severity: warning
        annotations:
          summary: "Error budget consumed 6x faster than normal — budget exhausted in ~5 days"
```

## Composite SLO

```
SLO(ShopArch) = SLO(Catalogue) × SLO(Checkout) × SLO(Recherche)
             = 0.999 × 0.9995 × 0.995
             = 0.9935 (99.35%)

Interpretation : sur un parcours complet (search → catalogue → checkout),
la disponibilite globale est de 99.35%, soit ~4.7h de downtime/mois.
```

## Ce que tu aurais pu oublier

### 1. SLO = 100%
```
FAUX — "notre objectif est 100% de disponibilite"
CORRECT — 100% est impossible et bloque toute innovation
         Un SLO de 99.9% donne un budget d'erreur pour deployer des features
```

### 2. SLO sans mesure automatique
```
FAUX — "on est probablement a 99.9%" (sans mesure)
CORRECT — SLI mesure en temps reel via Prometheus
         Si on ne mesure pas, on ne sait pas
```

### 3. Même SLO pour tous les services
```
FAUX — 99.99% pour tous les services (over-engineering pour la recherche)
CORRECT — SLO adapte a la criticite business
         Checkout (revenu) > Catalogue (experience) > Recherche (confort)
```

### 4. Pas de politique quand le budget est epuise
```
FAUX — le budget est a 0% mais on continue a deployer des features
CORRECT — gel automatique des features, focus fiabilite
         L'error budget est un outil de negociation entre produit et ingenierie
```
