# Cours 71 — Architecture CI/CD, Feature Flags & Deployment Stratégies

> **Objectif** : Maîtriser les pipelines CI/CD (Helm, init containers, health checks), les feature flags pour rollout progressif, et les stratégies de déploiement (Blue/Green, Canary, Rolling), avec zero-downtime comme contrainte.

---

## Rappel du cours précédent

<details>
<summary>1. Quelle est la différence entre head-based et tail-based sampling ?</summary>

**Head-based** : decision de tracer prise au debut de la trace (ex: 1% aleatoire). Simple mais rate les traces lentes/en erreur. **Tail-based** : decision prise APRES la trace complete — on peut garder 100% des traces en erreur ou > 1s. Plus couteux (il faut buffer toutes les traces) mais plus intelligent.
</details>

<details>
<summary>2. Pourquoi le tracing resout des problèmes que le logging seul ne peut pas ?</summary>

Le logging montre ce qui se passe **dans** chaque service individuellement. Le tracing montre la latence **entre** les services — file d'attente, connection pool epuise, DNS lent. Un service rapide (45ms) peut contribuer à une requête lente (2s) si le temps d'attente avant son appel est long.
</details>

---

## Analogie — La chaine de production automobile

- **CI** (Continuous Intégration) : chaque piece est testee individuellement sur la chaine (tests unitaires, lint, build)
- **CD** (Continuous Delivery) : la voiture assemblee passe au controle qualité (tests d'intégration, load tests)
- **Feature flags** : certaines voitures sortent avec un toit ouvrant active, d'autres non — même chaine, même déploiement
- **Blue/Green** : la nouvelle chaine de production est prete a côté de l'ancienne — on bascule les commandes en un instant
- **Canary** : 5% des voitures passent sur la nouvelle chaine — si tout va bien, on monte a 100%

---

## Théorie

### 1. Pipeline CI/CD

```
Code Push → CI Pipeline → CD Pipeline → Production
                │                │
    ┌───────────┤    ┌───────────┤
    │ Lint      │    │ Build     │
    │ Type check│    │ Push image│
    │ Unit tests│    │ Deploy    │
    │ Sec scan  │    │ Smoke test│
    │ Build     │    │ Rollback? │
    └───────────┘    └───────────┘
```

### 2. Helm deployment avec init containers

```yaml
# values-production.yaml
replicaCount: 3
image:
  repository: registry.example.com/api
  tag: "1.2.3"

initContainers:
  - name: migrate
    command: ['npx', 'typeorm', 'migration:run']
    # S'execute AVANT le container principal
    # Si la migration echoue → le pod ne demarre pas

resources:
  requests:
    cpu: 250m
    memory: 256Mi
  limits:
    cpu: 1000m
    memory: 512Mi

probes:
  liveness:
    path: /health/liveness
    initialDelay: 15
    period: 20
  readiness:
    path: /health/readiness
    initialDelay: 5
    period: 10
  startup:
    path: /health/liveness
    failureThreshold: 30  # 30 × 10s = 5min pour demarrer
    period: 10
```

### 3. Feature flags

```
3 niveaux de feature flags :

1. Build-time (env vars) :
   NEXT_PUBLIC_FEATURE_NEW_CHECKOUT=true
   → Compile dans le build, pas modifiable apres

2. Runtime (config DB/Redis) :
   feature_flags:new_checkout = { enabled: true, rollout: 25% }
   → Modifiable sans redeploy

3. Per-user (experimentation) :
   user.features.includes('new_checkout')
   → A/B testing, beta users
```

| Type | Vitesse de changement | Usage |
|---|---|---|
| **Release flag** | Courte durée (sprint) | Déployer du code inactif |
| **Experiment flag** | Moyenne durée (A/B test) | Mesurer l'impact d'un changement |
| **Ops flag** | Longue durée | Kill switch, mode maintenance |
| **Permission flag** | Permanent | Feature par tier/plan |

### 4. Deployment stratégies

```
Rolling Update (default K8s) :
  v1 v1 v1                    Progressif, zero-downtime
  v1 v1 v2   → v1 v2 v2 → v2 v2 v2
  Risque : v1 et v2 cohabitent temporairement

Blue/Green :
  Blue (v1) ─── active ───> Load Balancer
  Green (v2) ── standby ──>

  Bascule instantanee :
  Blue (v1) ── standby
  Green (v2) ── active ──> Load Balancer
  Rollback : rebascule vers Blue
  Cout : 2x l'infra temporairement

Canary :
  v1 ──── 95% du trafic ──> Load Balancer
  v2 ────  5% du trafic ──>

  Si metriques OK :
  v1 ──── 50% ──> puis v2 ──── 100%
  Si metriques KO :
  v2 ──── 0% (rollback automatique)
```

| Stratégie | Rollback | Cout infra | Risque |
|---|---|---|---|
| **Rolling** | Lent (re-deploy v1) | Normal | v1+v2 cohabitent |
| **Blue/Green** | Instantane | 2x temporaire | Tout ou rien |
| **Canary** | Rapide (0% canary) | +5-10% | Petit blast radius |

### 5. Zero-downtime deployment checklist

```
□ Migrations DB backward-compatible (expand-contract)
□ API versions cohabitent (v1 et v2 servies simultanement)
□ Health checks readiness avant de recevoir du trafic
□ Graceful shutdown (drain connections avant arret)
□ Init containers pour migrations (avant le start)
□ PodDisruptionBudget (minimum 1 pod toujours dispo)
□ Rolling update maxUnavailable: 0
```

### 6. Quality gates en CI

```
Gate 1 : Lint + Type check + Unit tests
Gate 2 : Build Docker image + security scan (Trivy)
Gate 3 : Integration tests + contract tests (Pact)
Gate 4 : Load test k6 (smoke 2min) sur staging
Gate 5 : Lighthouse CI (score ≥ 90)
Gate 6 : Deploy canary 5% + observe 10min
Gate 7 : Promote to 100%
```

---

## Pratique

### Feature flag middleware (NestJS)

```typescript
@Injectable()
export class FeatureFlagService {
  constructor(private readonly redis: Redis) {}

  async isEnabled(flag: string, context?: FeatureFlagContext): Promise<boolean> {
    const config = await this.redis.get(`ff:${flag}`);
    if (!config) return false;

    const parsed = JSON.parse(config) as FeatureFlagConfig;

    if (!parsed.enabled) return false;

    // Rollout progressif (percentage-based)
    if (parsed.rollout < 100 && context?.userId) {
      const hash = this.hashUserId(context.userId, flag);
      if (hash > parsed.rollout) return false;
    }

    return true;
  }

  private hashUserId(userId: string, flag: string): number {
    const hash = createHash('md5').update(`${userId}:${flag}`).digest();
    return hash.readUInt32BE(0) % 100;
  }
}

interface FeatureFlagConfig {
  enabled: boolean;
  rollout: number; // 0-100
  description: string;
}

// Guard NestJS
@Injectable()
export class FeatureFlagGuard implements CanActivate {
  constructor(
    private readonly ff: FeatureFlagService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const flag = this.reflector.get<string>('feature_flag', context.getHandler());
    if (!flag) return true;

    const req = context.switchToHttp().getRequest();
    const enabled = await this.ff.isEnabled(flag, { userId: req.user?.id });

    if (!enabled) {
      throw new ForbiddenException('Feature not available');
    }

    return true;
  }
}

// Usage
@Controller('api/checkout')
export class CheckoutController {
  @Post()
  @SetMetadata('feature_flag', 'new_checkout')
  @UseGuards(FeatureFlagGuard)
  async checkout(@Body() dto: CheckoutDto): Promise<Order> {
    return this.service.processCheckout(dto);
  }
}
```

### GitHub Actions CI pipeline

```yaml
# .github/workflows/ci.yml
name: CI Pipeline
on: [push, pull_request]

jobs:
  lint-and-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: npm ci
      - run: npm run lint
      - run: npm run typecheck
      - run: npm run test:unit -- --coverage

  security-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: aquasecurity/trivy-action@master
        with:
          scan-type: 'fs'
          severity: 'CRITICAL,HIGH'

  build-and-push:
    needs: [lint-and-test, security-scan]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: docker build -t $REGISTRY/$IMAGE:${{ github.sha }} .
      - run: docker push $REGISTRY/$IMAGE:${{ github.sha }}

  deploy-staging:
    needs: build-and-push
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - run: |
          helm upgrade api ./helm \
            --set image.tag=${{ github.sha }} \
            --values helm/values-staging.yaml \
            --wait --timeout 5m
      - run: npm run test:smoke -- --base-url=$STAGING_URL

  lighthouse:
    needs: deploy-staging
    runs-on: ubuntu-latest
    steps:
      - uses: treosh/lighthouse-ci-action@v10
        with:
          urls: ${{ env.STAGING_URL }}
          budgets: ./lighthouse-budget.json
```

---

## Résumé

1. **CI pipeline** : lint → typecheck → unit tests → security scan → build → intégration tests — chaque étape est un gate
2. **Feature flags** : déployer du code inactif, activer progressivement (rollout %), kill switch en cas de problème
3. **Blue/Green** : rollback instantane (rebascule), cout 2x infra temporaire — ideal pour les releases majeures
4. **Canary** : 5% du trafic d'abord, observer les metriques, promouvoir où rollback — blast radius minimal
5. **Zero-downtime** : migrations backward-compatible + readiness probes + graceful shutdown + PodDisruptionBudget

---

> **Prochain cours** : [Cours 72 — Infrastructure as Code](./05-infrastructure-as-code.md)

---

> **Lien fil rouge — ShopArch**
>
> - Configure le pipeline CI/CD ShopArch : lint → test → build → Lighthouse → deploy
> - Implémente un feature flag pour activer/désactiver la promo flash sans redéploiement
> - Exercice(s) associé(s) : `exercices/48-cicd-feature-flags/`
> - Checkpoint : Module 10, critère 3-4
