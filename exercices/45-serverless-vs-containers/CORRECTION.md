# Correction — Exercice 45 : Serverless vs containers

## Classification des workloads

| Workload | Fréquence | Duree | Latence | Invocations/mois |
|---|---|---|---|---|
| API Catalogue | 600 req/s continu | < 100ms | < 50ms | ~1.5 milliard |
| Image processing | 0-50/h sporadique | 5-30s | Tolerant | ~36 000 |
| Import CSV | 1-2/semaine | 5-10 min | Tolerant | ~8 |

## Analyse par workload

### 1. API Catalogue

**Serverless (Lambda + API Gateway)**
```
Invocations : 1.5 milliard/mois
Cold start : ~300ms (Node.js) — INACCEPTABLE pour 50ms SLA
Provisioned concurrency : 600 × $0.000004 = $5 760/mois (juste le compute)
API Gateway : 1.5B × $1/million = $1 500/mois
Total serverless : ~$7 260/mois
```

**Container (Kubernetes)**
```
6 pods × c5.large (2 vCPU, 4 GB) = 6 × $62/mois = $372/mois
Load balancer : $18/mois
Total container : ~$390/mois
```

**Verdict** : Container (18x moins cher, pas de cold start)

### 2. Image processing

**Serverless (Lambda)**
```
Invocations : 36 000/mois
Duree moyenne : 15s
Memoire : 1 GB (sharp processing)
Cout : 36 000 × 15s × 1 GB × $0.0000166/GB-s = $8.97/mois
Cold start : ~500ms (acceptable, image pas encore chargee)
Total serverless : ~$9/mois
```

**Container (Kubernetes)**
```
1 pod toujours up (meme quand idle) = $62/mois
Ou : CronJob/scale-to-zero avec KEDA = $10-15/mois
Total container : $15-62/mois
```

**Verdict** : Serverless (8x moins cher, scaling automatique, pas de pod idle)

### 3. Import CSV

**Serverless (Lambda/Step Functions)**
```
8 invocations/mois × 10 min = probleme : Lambda max = 15 min ✅ (juste)
Ou Step Functions pour orchestrer en chunks
Cout : negligeable (< $1/mois)
MAIS : 100 000 lignes × DB write = connexions DB limitees en serverless
Total serverless : ~$1/mois + complexite connexion DB
```

**Container (Kubernetes Job)**
```
Job one-shot : cree quand necessaire, detruit apres
Ou : pod worker avec BullMQ (deja existant)
Total container : ~$5/mois (job ephemere)
```

**Verdict** : Container (connexion DB stable, BullMQ déjà en place)

## Tableau de decision

| Critère | API Catalogue | Image Processing | Import CSV |
|---|---|---|---|
| Fréquence | Continu ❌ Lambda | Sporadique ✅ Lambda | Ponctuel ✅ Lambda |
| Duree | < 100ms ✅ Lambda | 5-30s ✅ Lambda | 5-10 min ⚠️ Lambda |
| Latence SLA | < 50ms ❌ Lambda | Tolerant ✅ Lambda | Tolerant ✅ Lambda |
| Cout a scale | 1.5B/mois ❌ Lambda | 36K/mois ✅ Lambda | 8/mois ✅ Lambda |
| Connexion DB | Pool ✅ Container | Pas de DB ✅ Lambda | Pool nécessaire ❌ Lambda |
| **Recommandation** | **Container** | **Serverless** | **Container** |

## Decision framework

```typescript
// serverless-decision.ts
interface WorkloadProfile {
  invocationsPerMonth: number;
  avgDurationSeconds: number;
  maxLatencyMs: number;
  continuous: boolean;
  needsDBPool: boolean;
  needsGPU: boolean;
}

function recommendArchitecture(profile: WorkloadProfile): 'serverless' | 'container' {
  // Cold start tue la latence faible + continu
  if (profile.maxLatencyMs < 100 && profile.continuous) return 'container';

  // > 15 min = pas de Lambda
  if (profile.avgDurationSeconds > 900) return 'container';

  // Trafic continu + volume eleve = container moins cher
  if (profile.continuous && profile.invocationsPerMonth > 10_000_000) return 'container';

  // Besoin de GPU = container (pas de GPU en Lambda standard)
  if (profile.needsGPU) return 'container';

  // Besoin de connexion DB stable = container
  if (profile.needsDBPool && profile.invocationsPerMonth > 100_000) return 'container';

  // Par defaut : serverless (moins de gestion operationnelle)
  return 'serverless';
}
```

## Architecture hybride recommandee

```
┌──────────────────────────────────┐
│         Kubernetes Cluster       │
│                                  │
│  ┌─────────┐  ┌──────────────┐  │
│  │ API ×6  │  │ Worker ×2    │  │
│  │ (continu)│  │ (BullMQ)     │  │
│  └─────────┘  └──────────────┘  │
│       │                          │
│  ┌─────────┐  ┌──────────────┐  │
│  │ PG ×1   │  │ Redis ×1     │  │
│  └─────────┘  └──────────────┘  │
└───────────────┬──────────────────┘
                │ events
                ▼
┌──────────────────────────────────┐
│         Serverless               │
│                                  │
│  ┌─────────────────────────┐    │
│  │ Image Processing        │    │
│  │ (Lambda, declenche par  │    │
│  │  S3 event)              │    │
│  └─────────────────────────┘    │
│                                  │
│  ┌─────────────────────────┐    │
│  │ Email sending           │    │
│  │ (Lambda, declenche par  │    │
│  │  SQS)                   │    │
│  └─────────────────────────┘    │
└──────────────────────────────────┘
```

## Ce que tu aurais pu oublier

### 1. Tout en serverless
```
FAUX — API en Lambda (cold start + cout a scale = catastrophe)
CORRECT — serverless uniquement pour les workloads sporadiques et tolerants en latence
```

### 2. Tout en containers
```
FAUX — image processing en pod always-on (paye 24/7 pour 0-50 images/h)
CORRECT — serverless pour les workloads idle 90% du temps (pas de pod qui attend)
```

### 3. Ignorer le cold start
```
FAUX — "Lambda demarre en 50ms" (en realite : 300-800ms selon le runtime + VPC)
CORRECT — mesurer le cold start reel avec les dependances du projet
```

### 4. Oublier les couts operationnels
```
FAUX — comparer uniquement le cout compute
CORRECT — inclure : monitoring, logging, CI/CD, maintenance, gestion des deployments
         Serverless = moins d'ops, Container = plus de controle
```
