# Correction — Exercice 54 : Fitness functions

## Fitness functions structurelles

```typescript
// fitness/structural.test.ts
import { Project, SyntaxKind } from 'ts-morph';
import * as madge from 'madge';

describe('Structural fitness functions', () => {
  describe('No circular dependencies', () => {
    it('should have no circular imports', async () => {
      const result = await madge('src/', { tsConfig: 'tsconfig.json' });
      const circular = result.circular();
      expect(circular).toEqual([]);
    });
  });

  describe('Layer dependencies', () => {
    const project = new Project({ tsConfigFilePath: 'tsconfig.json' });

    it('controllers should not import repositories directly', () => {
      const violations: string[] = [];
      const controllers = project.getSourceFiles('src/**/*.controller.ts');

      for (const file of controllers) {
        const imports = file.getImportDeclarations();
        for (const imp of imports) {
          const moduleSpecifier = imp.getModuleSpecifierValue();
          if (moduleSpecifier.includes('.repository') || moduleSpecifier.includes('typeorm')) {
            violations.push(`${file.getBaseName()} imports ${moduleSpecifier}`);
          }
        }
      }

      expect(violations).toEqual([]);
    });

    it('entities should not import services', () => {
      const violations: string[] = [];
      const entities = project.getSourceFiles('src/**/*.entity.ts');

      for (const file of entities) {
        const imports = file.getImportDeclarations();
        for (const imp of imports) {
          if (imp.getModuleSpecifierValue().includes('.service')) {
            violations.push(`${file.getBaseName()} imports a service`);
          }
        }
      }

      expect(violations).toEqual([]);
    });

    it('all endpoints should have auth decorator', () => {
      const violations: string[] = [];
      const controllers = project.getSourceFiles('src/**/*.controller.ts');

      for (const file of controllers) {
        const classes = file.getClasses();
        for (const cls of classes) {
          const methods = cls.getMethods();
          for (const method of methods) {
            const decorators = method.getDecorators().map((d) => d.getName());
            const httpDecorators = ['Get', 'Post', 'Put', 'Patch', 'Delete'];

            if (httpDecorators.some((d) => decorators.includes(d))) {
              const hasAuth = decorators.includes('Roles')
                || decorators.includes('Public')
                || cls.getDecorators().some((d) => d.getName() === 'UseGuards');

              if (!hasAuth) {
                violations.push(`${file.getBaseName()}:${method.getName()} has no auth decorator`);
              }
            }
          }
        }
      }

      expect(violations).toEqual([]);
    });
  });
});
```

## Fitness functions de performance

```typescript
// fitness/performance.test.ts
import { execSync } from 'node:child_process';
import { statSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

describe('Performance fitness functions', () => {
  it('build should complete in < 60s', () => {
    const start = Date.now();
    execSync('npm run build', { stdio: 'pipe' });
    const duration = Date.now() - start;

    expect(duration).toBeLessThan(60000);
  });

  it('no JS bundle should exceed 250 KB gzip', () => {
    const distDir = join(__dirname, '../../dist');
    const violations: string[] = [];

    function checkFiles(dir: string) {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const path = join(dir, entry.name);
        if (entry.isDirectory()) {
          checkFiles(path);
        } else if (entry.name.endsWith('.js')) {
          const stat = statSync(path);
          // Approximation : gzip ≈ 30% de la taille brute
          const estimatedGzip = stat.size * 0.3;
          if (estimatedGzip > 250 * 1024) {
            violations.push(`${entry.name}: ${Math.round(estimatedGzip / 1024)} KB gzip`);
          }
        }
      }
    }

    checkFiles(distDir);
    expect(violations).toEqual([]);
  });

  it('critical endpoints should respond in < 200ms', async () => {
    const endpoints = [
      { method: 'GET', path: '/products?limit=20' },
      { method: 'GET', path: '/products/test-product-id' },
      { method: 'GET', path: '/categories' },
    ];

    for (const endpoint of endpoints) {
      const start = performance.now();
      const res = await fetch(`${BASE_URL}${endpoint.path}`);
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(200);
      expect(res.ok).toBe(true);
    }
  });
});
```

## Fitness functions de sécurité

```typescript
// fitness/security.test.ts
describe('Security fitness functions', () => {
  it('should have no critical npm vulnerabilities', () => {
    try {
      execSync('npx audit-ci --critical', { stdio: 'pipe' });
    } catch (error) {
      throw new Error('Critical npm vulnerabilities found. Run "npm audit" for details.');
    }
  });

  it('should have no secrets in source code', () => {
    const SECRET_PATTERNS = [
      /(?:password|secret|api_key|apikey|token)\s*[:=]\s*['"][^'"]{8,}['"]/gi,
      /AKIA[0-9A-Z]{16}/g, // AWS access key
      /sk_live_[a-zA-Z0-9]{24,}/g, // Stripe secret key
    ];

    const violations: string[] = [];
    const sourceFiles = globSync('src/**/*.{ts,js}');

    for (const file of sourceFiles) {
      const content = readFileSync(file, 'utf-8');
      for (const pattern of SECRET_PATTERNS) {
        const matches = content.match(pattern);
        if (matches) {
          violations.push(`${file}: potential secret found — ${matches[0].slice(0, 30)}...`);
        }
      }
    }

    expect(violations).toEqual([]);
  });

  it('CSP header should be present on all responses', async () => {
    const res = await fetch(`${BASE_URL}/products`);
    const csp = res.headers.get('content-security-policy')
      || res.headers.get('content-security-policy-report-only');

    expect(csp).toBeTruthy();
    expect(csp).toContain("default-src 'self'");
  });
});
```

## Intégration CI

```yaml
# .github/workflows/fitness.yml
name: Fitness Functions
on: [pull_request]

jobs:
  structural:
    runs-on: ubuntu-latest
    timeout-minutes: 5
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npm run test:fitness:structural
        name: "Check: no circular deps, layer rules, auth decorators"

  performance:
    runs-on: ubuntu-latest
    timeout-minutes: 5
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npm run test:fitness:performance
        name: "Check: build time, bundle size"

  security:
    runs-on: ubuntu-latest
    timeout-minutes: 5
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npm run test:fitness:security
        name: "Check: npm audit, secrets, CSP"
```

## Ce que tu aurais pu oublier

### 1. Fitness functions manuelles
```
FAUX — "on review les dependances manuellement en code review"
CORRECT — les fitness functions sont AUTOMATISEES et executees en CI
         Un humain oublie, un script jamais
```

### 2. Fitness functions trop lentes
```
FAUX — fitness functions qui prennent 10 minutes (bloquent le CI)
CORRECT — < 30 secondes pour les checks structurels
         Les checks de performance peuvent etre plus longs mais paralleles
```

### 3. Pas de message d'erreur clair
```
FAUX — "Fitness function failed" (quoi exactement ?)
CORRECT — "OrderController.createOrder() has no auth decorator"
         Le developpeur sait exactement quoi corriger
```

### 4. Regles non documentees
```
FAUX — "controllers ne doivent pas importer de repositories" (mais pourquoi ?)
CORRECT — documenter chaque regle : "separation des couches, le controller delegue au service
         qui utilise le repository. Cela permet de tester la logique sans DB."
```
