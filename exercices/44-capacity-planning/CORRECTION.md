# Correction — Exercice 44 : Capacity planning

## Baseline metrics

| Service | Throughput | Latence p50 | Latence p99 | CPU | RAM | Connexions |
|---|---|---|---|---|---|---|
| API Pod ×2 | 100 req/s total | 25ms | 150ms | 40% | 512 MB | 50 DB conn |
| PostgreSQL ×1 | 200 queries/s | 5ms | 50ms | 30% | 2 GB | 100 max conn |
| Redis ×1 | 5000 ops/s | 0.5ms | 2ms | 10% | 1 GB | 200 |
| Elasticsearch ×1 | 50 queries/s | 15ms | 100ms | 25% | 4 GB | — |

**Bottleneck identifie** : PostgreSQL (100 connexions max, 200 queries/s) saturera en premier a ~500 req/s API.

## Modèle de charge Black Friday (1000 req/s)

| Endpoint | % trafic | Req/s | DB queries/req | DB total |
|---|---|---|---|---|
| Catalogue (GET /products) | 60% | 600 | 1 (cache hit 80%) | 120 |
| Recherche (/search) | 20% | 200 | 0 (Elasticsearch) | 0 |
| Panier (GET/POST /cart) | 15% | 150 | 2 | 300 |
| Checkout (POST /checkout) | 5% | 50 | 5 (transactionnel) | 250 |
| **Total** | 100% | 1000 | — | **670 queries/s** |

Connexions simultanees estimees : 1000 req/s × 25ms avg = 25 connexions actives en parallele (+ marge = 50).

## Dimensionnement

### API Pods
```
Capacite actuelle : 2 pods × 50 req/s = 100 req/s
Besoin : 1000 req/s
1 pod gere ~200 req/s (apres optimisation cache)
Besoin : 1000 / 200 = 5 pods
Marge securite (20%) : 6 pods
```

### PostgreSQL
```
Queries actuelles : 200/s
Queries Black Friday : 670/s
Options :
  1. Read replica × 2 (catalogue en lecture sur replica)
     → Primary : 550 queries/s (ecriture + panier + checkout)
     → Replica : 120 queries/s (catalogue)
  2. Connection pool : pgbouncer avec 300 connexions
  3. Augmenter max_connections : 300
CPU estime : 30% × (670/200) = ~100% → passer a 4 vCPU (au lieu de 2)
```

### Redis
```
Sessions actives estimees : 50 000 utilisateurs simultanes
Taille session : ~2 KB
Memoire sessions : 50 000 × 2 KB = 100 MB
Cache produits : 10 000 produits × 5 KB = 50 MB
Paniers : 20 000 paniers actifs × 3 KB = 60 MB
Total : ~210 MB + overhead = 512 MB minimum
Recommandation : 2 GB (marge pour le pic)
```

### Elasticsearch
```
Recherches actuelles : 50/s
Black Friday : 200/s
1 node gere ~100 queries/s avec les indexes actuels
Besoin : 2 replicas (200/100 = 2, + marge = 3 nodes total)
```

## Plan de scaling

| Composant | Actuel | Black Friday | Quand scaler | Auto-scale |
|---|---|---|---|---|
| API Pods | 2 | 6 (+4) | J-1 pre-warm | CPU > 70% → +1, min=6 |
| PostgreSQL | 1 primary | 1 primary + 2 read replicas | J-7 | Non (manuel) |
| pgbouncer | Non | Oui (300 conn) | J-3 | Non |
| Redis | 1 × 1 GB | 1 × 2 GB | J-3 | Non |
| Elasticsearch | 1 node | 3 nodes | J-3 | Non |
| CDN | Standard | Pre-warm cache | J-1 | Automatique |

### Auto-scaling config

```yaml
# kubernetes HPA
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: api-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: api
  minReplicas: 6        # pre-warmed pour Black Friday
  maxReplicas: 12       # plafond
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
  behavior:
    scaleUp:
      stabilizationWindowSeconds: 60
      policies:
        - type: Pods
          value: 2
          periodSeconds: 60
    scaleDown:
      stabilizationWindowSeconds: 300 # attendre 5 min avant de scale down
```

## Plan de degradation graceful

Si le pic depasse 1500 req/s (150% de la capacité) :

| Priorite | Feature a désactiver | Impact | Seuil |
|---|---|---|---|
| 1 | Recommandations personnalisees | Faible (UX) | > 80% CPU |
| 2 | Recherche avancee (filtres) | Moyen (basculer sur recherche simple) | > 85% CPU |
| 3 | Avis clients sur page produit | Faible | > 85% CPU |
| 4 | Inscription nouveaux comptes | Moyen (checkout en guest) | > 90% CPU |
| 5 | Mode read-only (pas de nouvelles commandes) | Critique (dernier recours) | > 95% CPU |

```typescript
// feature-degradation.service.ts
@Injectable()
export class DegradationService {
  private readonly thresholds = [
    { cpu: 80, features: ['recommendations'] },
    { cpu: 85, features: ['advanced-search', 'reviews'] },
    { cpu: 90, features: ['registration'] },
    { cpu: 95, features: ['new-orders'] },
  ];

  async checkAndDegrade(currentCpuPercent: number) {
    for (const threshold of this.thresholds) {
      if (currentCpuPercent >= threshold.cpu) {
        for (const feature of threshold.features) {
          await this.featureFlags.disable(feature);
        }
      }
    }
  }
}
```

## Estimation du cout

| Composant | Config | Cout/heure | 4h Black Friday |
|---|---|---|---|
| API Pods ×6 | c5.large (2 vCPU, 4 GB) | $0.51 | $2.04 |
| API Pods ×6 extra | Burst pendant pic | $0.51 | $2.04 |
| PostgreSQL primary | db.r5.xlarge (4 vCPU, 32 GB) | $1.20 | $4.80 |
| PostgreSQL replica ×2 | db.r5.large | $0.60 | $2.40 |
| Redis | cache.r5.large (2 GB) | $0.25 | $1.00 |
| Elasticsearch ×3 | r5.large | $0.45 | $1.80 |
| **Total** | | **$3.52/h** | **$14.08** |

## Alternatives et compromis

### Scaling vertical vs horizontal

| Critère | Vertical (plus gros serveur) | Horizontal (plus de serveurs) |
|---|---|---|
| Simplicite | Tres simple (upgrade instance) | Plus complexe (load balancer, stateless) |
| Cout | Croissance exponentielle | Croissance lineaire |
| Limite | Plafond hardware | Quasi illimite |
| Downtime | Oui (reboot pour upgrade) | Non (rolling update) |
| État (sessions) | Pas de problème | Nécessité sticky sessions ou sessions distribuees |

**Verdict pour ShopArch** : horizontal pour l'API (stateless, auto-scalable), vertical pour PostgreSQL (plus simple, plafond suffisant jusqu'a ~5000 req/s).

### Pre-provisioning vs auto-scaling pur

| Critère | Pre-provisioning (J-1) | Auto-scaling reactif |
|---|---|---|
| Cout | Plus élevé (resources reservees) | Optimal (paye a l'usage) |
| Latence de scaling | Zero (déjà provisionne) | 30-60s (cold start) |
| Risque | Sur-provisionnement (cout) | Sous-provisionnement (degradation pendant le scaling) |
| Complexite | Simple (augmenter minReplicas) | Complexe (tuning des seuils, metriques custom) |

**Verdict pour ShopArch** : pre-provisioning pour les events previsibles (Black Friday, soldes). Auto-scaling pour les variations quotidiennes.

### Degradation graceful vs file d'attente

| Critère | Degradation (désactiver des features) | File d'attente (limiter le débit) |
|---|---|---|
| Experience utilisateur | Features manquantes mais site fluide | Attente mais site complet |
| Complexite | Feature flags par composant | Queue management + UI d'attente |
| Equite | Tous les users ont la meme experience degradee | Premier arrive, premier servi |
| Cas d'usage | Pic général sur tout le site | Pic sur une feature spécifique (checkout) |

**Verdict pour ShopArch** : degradation graceful pour le pic général (désactiver les recommandations, simplifier la recherche). File d'attente uniquement pour le checkout si nécessaire (ex: billetterie).

## Ce que tu aurais pu oublier

### 1. Scaler pendant le pic
```
FAUX — attendre que le CPU monte a 90% pour ajouter des pods (cold start = 30s de degradation)
CORRECT — pre-warmer les pods J-1 (minReplicas = 6 AVANT le Black Friday)
```

### 2. Oublier les connexions DB
```
FAUX — 6 pods × 25 connexions = 150 connexions > max_connections (100)
CORRECT — pgbouncer pour le connection pooling, ou augmenter max_connections
         Calculer : pods × pool_size < max_connections
```

### 3. Pas de plan de degradation
```
FAUX — si le pic depasse les previsions, tout tombe en meme temps
CORRECT — degradation progressive : desactiver les features non critiques d'abord
         Les commandes sont la priorite #1
```

### 4. Calculs sans données
```
FAUX — "on va doubler les serveurs, ca devrait suffire"
CORRECT — calcul base sur les metriques reelles : throughput par pod, queries par requete, memoire par session
```
