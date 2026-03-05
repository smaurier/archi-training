# Cours 65 — Scaling, Capacity Planning & Cloud-Native

> **Objectif** : Differencier scaling horizontal et vertical, maîtriser les patterns cloud-native (sidecar, ambassador, init container), comprendre le capacity planning via Little's Law, et implémenter l'autoscaling Kubernetes.

---

## Rappel du cours précédent

<details>
<summary>1. Quelle est la différence entre Layer 4 et Layer 7 load balancing ?</summary>

**Layer 4** travaille au niveau TCP/UDP : il forward les paquets sans les inspecter (rapide, pas d'intelligence HTTP). **Layer 7** travaille au niveau HTTP : il parse les requêtes et peut router par URL, headers, cookies. Layer 7 est plus lent mais permet le routing intelligent (ex: `/api/*` vers un pool, `/static/*` vers un autre).
</details>

<details>
<summary>2. Quels sont les 3 types de health checks Kubernetes ?</summary>

1. **Liveness** : le process est-il vivant ? (Si non → restart le pod)
2. **Readiness** : peut-il servir du trafic ? (Si non → retire du load balancer)
3. **Startup** : a-t-il fini de demarrer ? (Empeche liveness/readiness de tuer un container qui demarre lentement)
</details>

---

## Analogie — La pizzeria

Une pizzeria qui grandit :
- **Scaling vertical** : acheter un four plus grand → limite physique, un seul point de panne
- **Scaling horizontal** : ouvrir une 2eme, 3eme pizzeria → chacune autonome, résilience
- **Capacity planning** : "si on recoit 100 commandes/heure et chaque pizza prend 6 minutes, combien de fours faut-il ?" → Little's Law
- **Cloud-native** : chaque pizzeria est un container identique, deployable en 5 min n'importe ou

---

## Théorie

### 1. Horizontal vs Vertical scaling

```
Vertical (Scale Up)                 Horizontal (Scale Out)
┌───────────────────┐              ┌──────┐ ┌──────┐ ┌──────┐
│                   │              │ Pod 1│ │ Pod 2│ │ Pod 3│
│   BIG SERVER      │              │ 2CPU │ │ 2CPU │ │ 2CPU │
│   32 CPU, 128GB   │              │ 4GB  │ │ 4GB  │ │ 4GB  │
│                   │              └──────┘ └──────┘ └──────┘
└───────────────────┘
Avantages :                        Avantages :
- Simple                          - Pas de plafond
- Pas de coordination             - Resilience (1 pod down → OK)
                                   - Cout lineaire
Inconvenients :                    Inconvenients :
- Plafond physique                 - Stateless obligatoire
- Cout exponentiel                 - Coordination necessaire
- SPOF                             - Complexite reseau
```

### 2. Stateless containers

```
REGLE : pas d'etat in-process

FAUX (stateful) :                  VRAI (stateless) :
const sessions = new Map();        // Sessions dans Redis
app.get('/me', (req, res) => {     app.get('/me', (req, res) => {
  const user = sessions.get(sid);    const user = await redis.get(sid);
  // Perdu si le pod restart !       // Partage entre tous les pods
});                                });
```

| État | Stockage |
|---|---|
| Sessions utilisateur | Redis (TTL) |
| Fichiers uploades | S3 / Object Storage |
| Cache | Redis (partage) |
| Jobs en cours | BullMQ (Redis-backed) |
| Config runtime | ConfigMap / env vars |

### 3. Little's Law — Capacity Planning

```
L = λ × W

L = nombre moyen d'elements dans le systeme (requetes in-flight)
λ = taux d'arrivee (requetes par seconde)
W = temps moyen de traitement (secondes)

Exemple :
  λ = 200 req/s
  W = 50ms = 0.05s
  L = 200 × 0.05 = 10 requetes in-flight

  Si chaque pod gere 5 requetes simultanees :
  → il faut 10 / 5 = 2 pods minimum
  → avec marge 2x : 4 pods recommandes
```

### 4. Cloud-Native patterns

| Pattern | Description | Exemple |
|---|---|---|
| **Sidecar** | Container auxiliaire a côté de l'app | Envoy proxy (mTLS), log collector |
| **Ambassador** | Proxy sortant pour l'app | Connection pooling vers DB, circuit breaker |
| **Init Container** | S'exécuté AVANT l'app | Migrations DB, warm cache, wait-for-db |
| **Adapter** | Normalise les sorties de l'app | Convertir logs custom → format standard |

```
Pod
┌─────────────────────────────────────┐
│ ┌──────────┐  Init Container       │
│ │ migrate  │  → Migrations DB       │
│ │ DB       │  → s'arrete apres      │
│ └──────────┘                        │
│                                     │
│ ┌──────────┐  ┌──────────────────┐ │
│ │  App     │  │  Sidecar         │ │
│ │  NestJS  │──│  Envoy (mTLS)    │ │
│ │  :3000   │  │  Logging agent   │ │
│ └──────────┘  └──────────────────┘ │
└─────────────────────────────────────┘
```

### 5. Autoscaling Kubernetes

```yaml
# HorizontalPodAutoscaler
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: api-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: api
  minReplicas: 2
  maxReplicas: 10
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70   # Scale up a 70% CPU
    - type: Resource
      resource:
        name: memory
        target:
          type: Utilization
          averageUtilization: 80
```

### 6. Multi-region

```
┌────────────────────────────────────────────┐
│           Latency-based DNS routing         │
│                                            │
│   EU users ──> EU region (primary)         │
│   US users ──> US region (replica)         │
│   APAC     ──> APAC region (replica)       │
│                                            │
│   Data sovereignty :                       │
│   EU data NEVER leaves EU region           │
│   Replication : read replicas only         │
│   Writes : routed to primary (EU)          │
└────────────────────────────────────────────┘
```

---

## Pratique

### Capacity planning calculator

```typescript
interface CapacityPlan {
  requestsPerSecond: number;
  avgResponseTimeMs: number;
  concurrencyPerPod: number;
  safetyMargin: number; // 1.5 = 50% marge
}

function calculatePods(plan: CapacityPlan): {
  minPods: number;
  recommendedPods: number;
  maxPods: number;
} {
  // Little's Law : L = λ × W
  const inFlight = plan.requestsPerSecond * (plan.avgResponseTimeMs / 1000);
  const minPods = Math.ceil(inFlight / plan.concurrencyPerPod);
  const recommendedPods = Math.ceil(minPods * plan.safetyMargin);

  return {
    minPods,
    recommendedPods,
    maxPods: recommendedPods * 2, // Pour les pics
  };
}

// Exemple : 500 req/s, 80ms avg, 10 concurrents/pod, marge 1.5x
const plan = calculatePods({
  requestsPerSecond: 500,
  avgResponseTimeMs: 80,
  concurrencyPerPod: 10,
  safetyMargin: 1.5,
});
// → minPods: 4, recommendedPods: 6, maxPods: 12
```

### Kubernetes deployment avec init container

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api
spec:
  replicas: 3
  template:
    spec:
      initContainers:
        - name: migrate
          image: api:latest
          command: ['npx', 'typeorm', 'migration:run']
          env:
            - name: DATABASE_URL
              valueFrom:
                secretKeyRef:
                  name: db-credentials
                  key: url
      containers:
        - name: api
          image: api:latest
          ports:
            - containerPort: 3000
          resources:
            requests:
              cpu: '250m'
              memory: '256Mi'
            limits:
              cpu: '1000m'
              memory: '512Mi'
          readinessProbe:
            httpGet:
              path: /health/readiness
              port: 3000
            initialDelaySeconds: 5
            periodSeconds: 10
          livenessProbe:
            httpGet:
              path: /health/liveness
              port: 3000
            initialDelaySeconds: 15
            periodSeconds: 20
```

---

## Resume

1. **Horizontal > vertical** : pas de plafond, résilience, cout lineaire — mais stateless obligatoire
2. **Stateless containers** : tout l'état dans des services externes (Redis, S3, PG) — le pod est jetable
3. **Little's Law** : `L = λ × W` — calculer le nombre de pods minimum, ajouter une marge de sécurité
4. **Cloud-native patterns** : init container (migrations), sidecar (proxy mTLS), ambassador (connection pooling)
5. **Autoscaling K8s** : HPA sur CPU/memory, min/max replicas — scale automatiquement selon la charge

---

> **Prochain cours** : [Cours 66 — Sharding & Réplication](./05-sharding-réplication.md)

---

> **Lien fil rouge — ShopArch**
>
> - Documente le capacity planning de ShopArch (estimation trafic pic Black Friday)
> - Identifie les bottlenecks : DB connections, Redis memory, S3 bandwidth
> - Exercice(s) associé(s) : `exercices/44-capacity-planning/`
> - Checkpoint : Module 09, critère 3
