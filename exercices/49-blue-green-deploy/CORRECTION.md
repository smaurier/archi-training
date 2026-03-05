# Correction — Exercice 49 : Blue-green deployment

## Architecture

```
                    ┌─────────────────────┐
                    │    Load Balancer     │
                    │   (Nginx / Ingress)  │
                    └──────────┬──────────┘
                               │
                    ┌──────────┼──────────┐
                    │          │          │
              ┌─────▼─────┐  ┌─────▼─────┐
              │   BLUE     │  │   GREEN    │
              │  (v1.2.0)  │  │  (v1.3.0)  │
              │  ← active  │  │  ← standby │
              │  Pod ×3    │  │  Pod ×3    │
              └─────┬──────┘  └─────┬──────┘
                    │               │
                    └───────┬───────┘
                            │
                    ┌───────▼───────┐
                    │  PostgreSQL   │  ← partage par blue ET green
                    │  (shared DB)  │
                    └───────────────┘
```

## Migrations backward-compatible

### Ajouter une colonne (safe)
```sql
-- Phase 1 : Migration (AVANT le deploy)
ALTER TABLE products ADD COLUMN discount_percent DECIMAL(5,2) DEFAULT 0;
-- Blue (v1.2.0) ignore la colonne — aucun impact
-- Green (v1.3.0) utilise la nouvelle colonne
```

### Renommer une colonne (3 phases)
```sql
-- Phase 1 : Ajouter la nouvelle colonne
ALTER TABLE products ADD COLUMN product_name VARCHAR(255);
UPDATE products SET product_name = name;

-- Phase 2 : Deploy v1.3.0 qui ecrit dans LES DEUX colonnes
-- Code : dual-write
-- UPDATE products SET name = $1, product_name = $1 WHERE id = $2

-- Phase 3 : (prochain deploy) Supprimer l'ancienne colonne
ALTER TABLE products DROP COLUMN name;
```

### Supprimer une colonne (2 phases)
```sql
-- Phase 1 : Deploy v1.3.0 qui n'utilise PLUS la colonne
-- (le code ne reference plus 'legacy_field')

-- Phase 2 : (prochain deploy) Supprimer
ALTER TABLE products DROP COLUMN legacy_field;
```

```typescript
// migration-safety.ts — verification automatisee
const UNSAFE_OPERATIONS = [
  /DROP COLUMN/i,
  /ALTER COLUMN.*TYPE/i,
  /RENAME COLUMN/i,
  /DROP TABLE/i,
  /ALTER TABLE.*NOT NULL/i, // ajouter NOT NULL sans default
];

function checkMigrationSafety(sql: string): { safe: boolean; warnings: string[] } {
  const warnings: string[] = [];
  for (const pattern of UNSAFE_OPERATIONS) {
    if (pattern.test(sql)) {
      warnings.push(`Unsafe operation detected: ${pattern.source}`);
    }
  }
  return { safe: warnings.length === 0, warnings };
}
```

## Script de deployment blue-green

```typescript
// deploy-blue-green.ts
import { KubernetesClient } from './k8s-client';

interface DeploymentConfig {
  serviceName: string;
  newVersion: string;
  healthCheckUrl: string;
  rolloutSteps: number[]; // [1, 10, 50, 100]
}

async function blueGreenDeploy(config: DeploymentConfig) {
  const k8s = new KubernetesClient();

  // 1. Identifier blue (active) et green (standby)
  const activeColor = await k8s.getActiveColor(config.serviceName);
  const newColor = activeColor === 'blue' ? 'green' : 'blue';

  console.log(`Active: ${activeColor}, deploying to: ${newColor}`);

  // 2. Deployer la nouvelle version sur green
  await k8s.updateDeployment(`${config.serviceName}-${newColor}`, config.newVersion);
  await k8s.waitForRollout(`${config.serviceName}-${newColor}`);

  // 3. Health check sur green
  const healthy = await healthCheck(config.healthCheckUrl.replace('COLOR', newColor));
  if (!healthy) {
    console.error('Health check failed on green, aborting');
    return;
  }

  // 4. Switch progressif
  for (const percentage of config.rolloutSteps) {
    console.log(`Switching ${percentage}% traffic to ${newColor}`);
    await k8s.updateTrafficSplit(config.serviceName, {
      [activeColor]: 100 - percentage,
      [newColor]: percentage,
    });

    // Monitorer pendant 2 min a chaque etape
    const metrics = await monitorForDuration(120);
    if (metrics.errorRate > 0.01 || metrics.p99 > 1000) {
      console.error(`Metrics degraded at ${percentage}%, rolling back`);
      await k8s.updateTrafficSplit(config.serviceName, {
        [activeColor]: 100,
        [newColor]: 0,
      });
      return;
    }
  }

  // 5. Succes — green est maintenant active
  console.log(`Deployment successful, ${newColor} is now active`);

  // 6. Garder blue en standby pendant 1h pour rollback
  setTimeout(async () => {
    console.log(`Updating ${activeColor} to ${config.newVersion} (standby)`);
    await k8s.updateDeployment(`${config.serviceName}-${activeColor}`, config.newVersion);
  }, 3600000);
}

async function healthCheck(url: string): Promise<boolean> {
  for (let attempt = 0; attempt < 10; attempt++) {
    try {
      const res = await fetch(url);
      if (res.ok) return true;
    } catch {}
    await new Promise((r) => setTimeout(r, 5000));
  }
  return false;
}
```

## Kubernetes config

```yaml
# k8s/blue-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api-blue
  labels:
    app: api
    color: blue
spec:
  replicas: 3
  selector:
    matchLabels:
      app: api
      color: blue
  template:
    metadata:
      labels:
        app: api
        color: blue
    spec:
      containers:
        - name: api
          image: shoparch/api:v1.2.0
          readinessProbe:
            httpGet:
              path: /health
              port: 3000
            initialDelaySeconds: 10
            periodSeconds: 5
          livenessProbe:
            httpGet:
              path: /health
              port: 3000
            initialDelaySeconds: 30
            periodSeconds: 10
---
# Traffic split via Istio VirtualService
apiVersion: networking.istio.io/v1beta1
kind: VirtualService
metadata:
  name: api
spec:
  hosts:
    - api.shoparch.com
  http:
    - route:
        - destination:
            host: api-blue
          weight: 100
        - destination:
            host: api-green
          weight: 0
```

## Alternatives et arbitrages

> En architecture, ta valeur n'est pas de connaître UNE solution,
> mais de savoir POURQUOI tu choisis celle-ci plutôt qu'une autre.

### Option A : Blue/Green (solution présentée)
**Quand la choisir :** Rollback instantané nécessaire, application stateless, environnement de production clonable, budget pour 2x l'infrastructure.
**Limites :** Double coût infra pendant le déploiement, migrations DB doivent être backward-compatible, sessions utilisateurs (sticky sessions problématiques).

### Option B : Canary deployment
**Quand la choisir :** Tester la nouvelle version sur un pourcentage de trafic réel (1% → 5% → 25% → 100%), métriques de validation automatique (error rate, latence).
**Limites :** Plus complexe à implémenter (traffic splitting), deux versions tournent en parallèle pendant plus longtemps, debugging plus difficile (quel % voit quelle version ?).

### Option C : Shadow traffic (dark launch)
**Quand la choisir :** Valider les performances et la compatibilité SANS impacter les utilisateurs, dupliquer le trafic vers la nouvelle version, comparer les réponses.
**Limites :** Le trafic shadow ne teste pas les effets de bord (écritures), double charge sur les backends, complexité de routing.

### Option D : Rolling update
**Quand la choisir :** Infrastructure limitée (pas de budget pour 2x), Kubernetes natif (`maxUnavailable`, `maxSurge`), tolérance à un rollback plus lent.
**Limites :** Pendant le rolling update, deux versions coexistent (incompatibilité d'API possible), rollback = re-rolling update (plus lent), pas de point de bascule net.

### Matrice de décision
| Critère | Blue/Green | Canary | Shadow | Rolling |
|---|---|---|---|---|
| Rollback speed | Instantané | Rapide | N/A | Lent |
| Coût infra | 2x | 1.x | 2x trafic | 1x |
| Validation réelle | Non (avant switch) | Oui (progressif) | Oui (sans impact) | Non |
| Complexité | Moyenne | Élevée | Élevée | Faible |
| Zero-downtime | Oui | Oui | Oui | Oui (si bien configuré) |

### Pour ShopArch, on choisit...
Blue/Green pour les déploiements majeurs (changement de schéma, nouvelle feature critique) car le rollback instantané est essentiel pour un site e-commerce (chaque minute de downtime = perte de CA). Pour les changements mineurs (hotfix, copy change), on utilise un simple rolling update Kubernetes.

---

## Ce que tu aurais pu oublier

### 1. Migration destructive en une étape
```
FAUX — DROP COLUMN name + ADD COLUMN product_name dans la meme migration
CORRECT — 3 phases : add new → dual-write → drop old
         La version active (blue) utilise encore l'ancien schema
```

### 2. Switch instantane 0 → 100%
```
FAUX — switcher 100% du trafic d'un coup (si bug, 100% des users impactes)
CORRECT — switch progressif 1% → 10% → 50% → 100% avec monitoring a chaque etape
```

### 3. Pas de rollback test
```
FAUX — "on fera un rollback si necessaire" (jamais teste)
CORRECT — tester le rollback en staging avant chaque deploy en production
         Le rollback doit etre un bouton, pas une procedure
```

### 4. Supprimer blue immédiatement
```
FAUX — des que green est active, detruire blue
CORRECT — garder blue en standby pendant 1h minimum
         Si un probleme est detecte apres 30 min, rollback instantane
```
