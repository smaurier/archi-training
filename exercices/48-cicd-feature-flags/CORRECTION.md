# Correction — Exercice 48 : CI/CD et feature flags

## Feature flags SDK

```typescript
// feature-flag.service.ts
interface FeatureFlag {
  key: string;
  type: 'boolean' | 'percentage' | 'user-based';
  enabled: boolean;
  percentage?: number;         // pour type 'percentage'
  allowedUsers?: string[];     // pour type 'user-based'
  allowedTenants?: string[];   // multi-tenant support
  description: string;
  createdAt: Date;
}

@Injectable()
export class FeatureFlagService {
  private readonly CACHE_TTL = 30; // secondes

  constructor(
    private readonly flagRepo: Repository<FeatureFlag>,
    private readonly redis: Redis,
  ) {}

  async isEnabled(
    key: string,
    context: { userId?: string; tenantId?: string },
  ): Promise<boolean> {
    const flag = await this.getFlag(key);
    if (!flag || !flag.enabled) return false;

    // Multi-tenant : si des tenants specifiques sont definis, verifier
    if (flag.allowedTenants?.length && context.tenantId) {
      if (!flag.allowedTenants.includes(context.tenantId)) return false;
    }

    switch (flag.type) {
      case 'boolean':
        return true;

      case 'percentage':
        // Hash deterministe pour que le meme user voie toujours le meme resultat
        const hash = this.hashUser(key, context.userId ?? context.tenantId ?? '');
        return hash < (flag.percentage ?? 0);

      case 'user-based':
        return flag.allowedUsers?.includes(context.userId ?? '') ?? false;

      default:
        return false;
    }
  }

  private async getFlag(key: string): Promise<FeatureFlag | null> {
    // Cache Redis
    const cached = await this.redis.get(`flag:${key}`);
    if (cached) return JSON.parse(cached);

    // DB
    const flag = await this.flagRepo.findOne({ where: { key } });
    if (flag) {
      await this.redis.set(`flag:${key}`, JSON.stringify(flag), 'EX', this.CACHE_TTL);
    }
    return flag;
  }

  private hashUser(flagKey: string, userId: string): number {
    // Hash deterministe : meme user + meme flag = meme bucket
    const hash = createHash('md5').update(`${flagKey}:${userId}`).digest();
    return (hash.readUInt32BE(0) % 100); // 0-99
  }

  // API pour modifier les flags en temps reel
  async updateFlag(key: string, updates: Partial<FeatureFlag>): Promise<FeatureFlag> {
    await this.flagRepo.update({ key }, updates);
    await this.redis.del(`flag:${key}`); // invalider le cache
    return this.flagRepo.findOneOrFail({ where: { key } });
  }
}
```

## Usage dans le code

```typescript
// back-end : guard conditionnel
@Injectable()
export class FeatureGuard implements CanActivate {
  constructor(private readonly flags: FeatureFlagService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const handler = context.getHandler();
    const featureKey = Reflect.getMetadata('feature-flag', handler);
    if (!featureKey) return true;

    const req = context.switchToHttp().getRequest();
    return this.flags.isEnabled(featureKey, {
      userId: req.user?.id,
      tenantId: req.headers['x-tenant-id'],
    });
  }
}

// Decorator
const Feature = (key: string) => SetMetadata('feature-flag', key);

// Usage
@Feature('new-checkout-flow')
@Post('checkout')
async checkout() { /* nouveau flow */ }
```

```typescript
// front-end : hook React
import { useState, useEffect } from 'react';

export function useFeatureFlag(key: string) {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/flags/${key}`)
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setEnabled(data.enabled);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [key]);

  return { enabled, loading } as const;
}

// Usage dans un composant React
// const { enabled: newCheckout } = useFeatureFlag('new-checkout-flow');
// {newCheckout ? <NewCheckoutFlow /> : <LegacyCheckoutFlow />}
```

## Pipeline CI

```yaml
# .github/workflows/ci.yml
name: CI
on: [pull_request]

jobs:
  quality:
    runs-on: ubuntu-latest
    timeout-minutes: 5
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'

      - run: npm ci

      # Parallel : lint + type-check + tests
      - name: Lint
        run: npm run lint

      - name: Type check
        run: npx tsc --noEmit

      - name: Unit tests
        run: npm run test:unit -- --coverage

      - name: Integration tests
        run: npm run test:integration

  security:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - run: npx audit-ci --critical
      - uses: gitleaks/gitleaks-action@v2

  build:
    needs: [quality, security]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci && npm run build
      - uses: actions/upload-artifact@v4
        with:
          name: build
          path: dist/
```

## Pipeline CD

```yaml
# .github/workflows/cd.yml
name: CD
on:
  push:
    branches: [main]

jobs:
  deploy-staging:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci && npm run build
      - name: Deploy to staging
        run: kubectl apply -k k8s/staging/

      - name: Smoke tests
        run: npm run test:smoke -- --base-url=$STAGING_URL
        timeout-minutes: 2

  deploy-production:
    needs: deploy-staging
    runs-on: ubuntu-latest
    environment: production # gate manuelle OU auto apres smoke tests
    steps:
      - name: Deploy to production
        run: kubectl apply -k k8s/production/

      - name: Monitor error rate (5 min)
        run: |
          sleep 300
          ERROR_RATE=$(curl -s "$PROMETHEUS_URL/api/v1/query?query=rate(http_requests_total{status=~'5..'}[5m])/rate(http_requests_total[5m])")
          if (( $(echo "$ERROR_RATE > 0.01" | bc -l) )); then
            echo "Error rate too high, rolling back"
            kubectl rollout undo deployment/api
            exit 1
          fi
```

## Trunk-based development workflow

```
main ─────────────────────────────────────────►
  │                    │               │
  ├── feat/new-search  │               │
  │   (< 1 jour)      │               │
  │   [behind flag]    │               │
  ├───────────────── merge             │
  │                    │               │
  │                    ├── fix/typo    │
  │                    │  (1h)        │
  │                    ├─── merge     │
  │                    │              │
  │                    │              ├── activate flag
  │                    │              │   "new-search" → 10%
  │                    │              ├── monitor
  │                    │              ├── 50% → 100%
  │                    │              └── remove flag + dead code
```

## Ce que tu aurais pu oublier

### 1. Feature flag debt
```
FAUX — laisser les feature flags indefiniment (code mort + if/else partout)
CORRECT — chaque flag a une date d'expiration
         Quand la feature est 100% deployed, supprimer le flag ET le code legacy
```

### 2. Branches longues
```
FAUX — branch "feature/new-checkout" ouverte pendant 3 semaines
CORRECT — merge dans main en < 1 jour derriere un feature flag
         La branche ne diverge jamais longtemps de main
```

### 3. Pas de rollback
```
FAUX — rollback = redeployer l'ancienne version (5-10 min)
CORRECT — rollback = desactiver le feature flag (< 30s)
         Le kill switch est le mecanisme de rollback le plus rapide
```

### 4. Tests sur la branche seulement
```
FAUX — tester uniquement sur la PR (merge peut casser main)
CORRECT — CI sur PR + CD avec smoke tests en staging + monitoring en production
         La qualite est validee a CHAQUE etape
```
