# Cours 83 — Evolutionary Architecture, FinOps & Wardley Mapping

> **Objectif** : Comprendre l'architecture évolutive (fitness functions, guided change), maîtriser le FinOps (cost architecture, build vs buy), et utiliser le Wardley Mapping pour les decisions stratégiques.

---

## Rappel du cours précédent

<details>
<summary>1. Qu'est-ce que Conway's Law et comment l'utiliser a son avantage ?</summary>

Conway's Law dit que l'architecture d'un système reflété la structure de communication de l'organisation qui le construit. L'**Inverse Conway Maneuver** consiste a définir l'architecture cible d'abord, puis a reorganiser les équipes pour correspondre. Si tu veux des microservices, organise tes équipes par domaine, pas par couche technique.
</details>

<details>
<summary>2. Quels sont les 4 types d'équipes Team Topologies ?</summary>

1. **Stream-aligned** : delivre de la valeur business (équipe Catalog, équipe Checkout)
2. **Platform** : fournit des outils aux stream-aligned (CI/CD, monitoring)
3. **Enabling** : aide les autres a monter en competence (coaching, pas de code en prod)
4. **Complicated-subsystem** : géré un sous-système technique complexe (ML, sécurité)
</details>

---

## Analogie — La carte geographique vs le plan de bataille

Un général ne planifie pas une bataille sur un plan d'architecte — il utilise une **carte** :
- **Wardley Map** : ou sont les troupes (composants), le terrain (marche), les mouvements possibles (évolution)
- **Fitness functions** : des eclaireurs qui rapportent "le pont tient toujours" ou "l'ennemi a bouge" — surveillance continue des invariants
- **FinOps** : le budget militaire — combien coute chaque bataillon, ou investir, ou economiser

L'architecture évolutive dit : "le plan de bataille change a chaque nouvelle information — il faut une architecture qui ACCUEILLE le changement."

---

## Théorie

### 1. Evolutionary Architecture

```
Architecture traditionnelle :
  Planifier tout → Construire → Ne plus toucher
  (Waterfall architectural)

Architecture evolutive :
  Construire → Mesurer (fitness functions) → Adapter → Repeter
  (Feedback loop continu)

Principes :
  1. Guided change : les fitness functions guident l'evolution
  2. Incremental change : petits changements frequents > gros changements rares
  3. Multiple fitness functions : plusieurs invariants surveilles en parallele
```

### 2. Fitness functions — exemples concrets

| Invariant | Test automatise | Seuil |
|---|---|---|
| Pas de dépendance cyclique | `madge --circular` | 0 cycles |
| Bundle JS | `stat(dist/*.js)` | < 200KB gzip |
| Latence API | k6 smoke test | p95 < 300ms |
| Lighthouse score | Lighthouse CI | ≥ 90 |
| Domaine isole de l'infra | grep imports dans /domain/ | 0 import infra |
| Pas de `console.log` en prod | eslint no-console | 0 violations |
| Coverage branches critiques | vitest --coverage | > 80% |
| Pas de N+1 queries | query count assertions | ≤ expected |
| Security headers | E2E check response headers | CSP present |

### 3. Guided vs Unguided change

```
Guided (controlable) :
  → Nouvelle feature, refactoring planifie, migration
  → Les fitness functions verifient que l'invariant tient
  → Le changement est VOULU

Unguided (subit) :
  → Nouvelle regulation (GDPR, AI Act)
  → Technologie obsolete (fin de support Node 16)
  → Concurrent qui change le marche
  → Le changement est IMPOSE — l'architecture doit l'absorber
```

### 4. FinOps — Cost Architecture

```
Cout total = Compute + Storage + Network + Licenses + People

┌──────────────────────────────────────────────┐
│              FinOps Dashboard                 │
│                                              │
│  Compute :                                   │
│  ├── API (3 pods × $50/mois)    = $150       │
│  ├── Workers (2 pods × $30)     = $60        │
│  └── Serverless (Lambda)        = $5         │
│                                              │
│  Storage :                                   │
│  ├── PostgreSQL (RDS)           = $200       │
│  ├── Redis (ElastiCache)        = $80        │
│  └── S3 (500GB)                 = $12        │
│                                              │
│  Network :                                   │
│  ├── CDN (Cloudflare)           = $0 (free)  │
│  └── Data transfer              = $30        │
│                                              │
│  Total : $537/mois                           │
│  Per-tenant : $537 / 10 tenants = $53.70     │
│  Per-request : $537 / 5M req = $0.0001       │
└──────────────────────────────────────────────┘
```

### 5. Build vs Buy decision framework

| Critère | Build | Buy |
|---|---|---|
| **Avantage concurrentiel** | Oui → build | Non → buy |
| **Expertise interne** | Forte → build | Faible → buy |
| **Time to market** | Pas urgent → build | Urgent → buy |
| **Maintenance long terme** | Équipe dédiée → build | Pas de ressource → buy |
| **Cout 3 ans** | < licence → build | < dev → buy |

```
Exemples :
  Auth → BUY (Keycloak) : pas un avantage concurrentiel, complexe
  CMS → BUILD : c'est le produit, avantage concurrentiel
  Search → BUILD abstraction, BUY moteur (Elasticsearch/Meilisearch)
  Email → BUY (SendGrid) : pas de valeur a gerer un MTA
  Analytics → BUY (Matomo) : pas un differenciateur
```

### 6. Wardley Mapping

```
Chaine de valeur → Evolution

           Genesis    Custom    Product    Commodity
           (nouveau)  (sur-    (standard) (utilities)
                      mesure)
Visible    ┌────────────────────────────────────────┐
(user      │                                        │
needs)     │  CMS UI ───────────●                   │
           │                                        │
           │  Content API ──────────●               │
           │                                        │
           │  Search ────────────────●              │
           │                                        │
Invisible  │  Auth ──────────────────────●          │
(infra)    │                                        │
           │  Database ──────────────────────●      │
           │                                        │
           │  Hosting ───────────────────────────●  │
           └────────────────────────────────────────┘

Strategic plays :
  Genesis/Custom → BUILD (differenciateur)
  Product → BUILD ou BUY (selon l'expertise)
  Commodity → BUY/outsource (pas de valeur a le construire)

Le CMS UI est "custom" → build (c'est le produit)
L'auth est "product" → buy (Keycloak)
Le hosting est "commodity" → buy (AWS/GCP)
```

---

## Pratique

### Fitness function runner

```typescript
// tests/fitness/fitness-runner.ts
interface FitnessFunction {
  name: string;
  category: 'performance' | 'architecture' | 'security' | 'cost';
  check: () => Promise<FitnessResult>;
}

interface FitnessResult {
  passed: boolean;
  value: number | string;
  threshold: number | string;
  message: string;
}

const fitnessFunctions: FitnessFunction[] = [
  {
    name: 'No circular dependencies',
    category: 'architecture',
    check: async () => {
      const result = await madge('./src').then((r) => r.circular());
      return {
        passed: result.length === 0,
        value: result.length,
        threshold: 0,
        message: result.length > 0
          ? `Found ${result.length} circular deps: ${result.map((c) => c.join('→')).join(', ')}`
          : 'No circular dependencies',
      };
    },
  },
  {
    name: 'Bundle size budget',
    category: 'performance',
    check: async () => {
      const files = await glob('./dist/assets/*.js');
      let total = 0;
      for (const f of files) total += (await stat(f)).size;
      const totalKB = total / 1024;
      return {
        passed: totalKB < 600,
        value: `${totalKB.toFixed(0)}KB`,
        threshold: '600KB',
        message: `JS bundle: ${totalKB.toFixed(0)}KB (limit: 600KB)`,
      };
    },
  },
  {
    name: 'Domain isolation',
    category: 'architecture',
    check: async () => {
      const domainFiles = await glob('./src/domain/**/*.ts');
      const violations: string[] = [];
      const forbidden = ['typeorm', '@nestjs', 'express', 'redis'];
      for (const file of domainFiles) {
        const content = await readFile(file, 'utf-8');
        for (const lib of forbidden) {
          if (content.includes(`from '${lib}`)) {
            violations.push(`${file} imports ${lib}`);
          }
        }
      }
      return {
        passed: violations.length === 0,
        value: violations.length,
        threshold: 0,
        message: violations.length > 0
          ? `Domain isolation violated: ${violations.join(', ')}`
          : 'Domain is isolated from infrastructure',
      };
    },
  },
];

// Runner
async function runFitnessFunctions(): Promise<void> {
  console.log('=== Fitness Functions Report ===\n');
  let allPassed = true;

  for (const ff of fitnessFunctions) {
    const result = await ff.check();
    const icon = result.passed ? '✓' : '✗';
    console.log(`${icon} [${ff.category}] ${ff.name}: ${result.message}`);
    if (!result.passed) allPassed = false;
  }

  if (!allPassed) {
    process.exit(1); // Fail CI
  }
}
```

### FinOps metering hook

```typescript
// Tracker de cout par tenant/feature
@Injectable()
export class FinOpsMetering {
  constructor(private readonly redis: Redis) {}

  async trackUsage(
    tenantId: string,
    feature: string,
    units: number = 1,
  ): Promise<void> {
    const month = new Date().toISOString().slice(0, 7); // "2024-03"
    const key = `finops:${tenantId}:${feature}:${month}`;

    await this.redis.incrby(key, units);
    await this.redis.expire(key, 90 * 24 * 60 * 60); // 90 jours
  }

  async getUsage(tenantId: string, month: string): Promise<Record<string, number>> {
    const keys = await this.redis.keys(`finops:${tenantId}:*:${month}`);
    const usage: Record<string, number> = {};

    for (const key of keys) {
      const feature = key.split(':')[2];
      usage[feature] = parseInt(await this.redis.get(key) ?? '0', 10);
    }

    return usage;
  }
}

// Usage dans un middleware
async trackApiCall(req: Request, next: NextFunction): Promise<void> {
  await this.metering.trackUsage(req['tenantId'], 'api_calls');
  next();
}
```

---

## Resume

1. **Evolutionary Architecture** : construire → mesurer (fitness functions) → adapter — le changement est la norme, pas l'exception
2. **Fitness functions** : tests automatises pour les invariants architecturaux — bundle size, circular deps, domain isolation, latence
3. **Build vs Buy** : build si avantage concurrentiel + expertise interne, buy sinon — auth (buy), CMS (build), hosting (buy)
4. **Wardley Mapping** : visualiser la chaine de valeur sur l'axe d'évolution — genesis/custom (build) vs commodity (buy)
5. **FinOps** : mesurer le cout par tenant/feature/request — right-sizing, reserved vs spot, cost per request

---

> **Prochain cours** : [Cours 84 — Architecture mobile](../13-culture-architecturale/01-architecture-mobile.md)

---

> **Lien fil rouge — ShopArch**
>
> - Dessine la Wardley Map de ShopArch (positionnement des composants : Genesis → Custom → Product → Commodity)
> - Identifie les composants à acheter (auth, search) vs ceux à construire (domain logic)
> - Exercice(s) associé(s) : `exercices/56-wardley-map/`
> - Checkpoint : Module 12, critère 4
