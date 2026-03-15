# Cours 64 — Load Balancing

> **Objectif** : Comprendre les algorithmes de load balancing (round-robin, least connections, IP hash, weighted), différencier Layer 4 et Layer 7, maîtriser les health checks, et savoir quand la session affinity est nécessaire ou anti-pattern.

---

## Rappel du cours précédent

<details>
<summary>1. Qu'est-ce que la stratégie CDN edge-first et quel TTFB viser ?</summary>

L'approche edge-first consiste a cacher les réponses sur des noeuds CDN proches de l'utilisateur (cache-first SSR). L'objectif est un TTFB < 600ms en Europe. Un edge cache hit descend a ~15-50ms. Le cache est invalide selectivement via des surrogate keys quand le contenu change.
</details>

<details>
<summary>2. Pourquoi utiliser format=auto dans l'image pipeline ?</summary>

Le format `auto` détecté le header `Accept` du navigateur et sert le format le plus optimal supporte : AVIF (meilleure compression, ~60% plus léger que JPEG), WebP (bon support, ~30% plus léger), ou JPEG en fallback. Le client recoit toujours la meilleure qualité/taille possible sans que le développeur géré manuellement les formats.
</details>

---

## Analogie — Le maitre d'hotel dans un grand restaurant

Un restaurant avec 10 serveurs (les serveurs d'application). Le maitre d'hotel (load balancer) a l'entree decide a quel serveur confier chaque nouveau client :
- **Round-robin** : table 1, table 2, table 3... a tour de role
- **Least connections** : "qui a le moins de clients en ce moment ?"
- **Weighted** : le serveur senior géré 3 tables, le stagiaire 1
- **IP hash** : "Monsieur Dupont va toujours à la table 4" (sticky)

Si un serveur tombe malade (health check failed), le maitre d'hotel redirige ses clients vers les autres.

---

## Théorie

### 1. Algorithmes de load balancing

| Algorithme | Logique | Quand utiliser |
|---|---|---|
| **Round-robin** | Alternance sequentielle | Serveurs identiques, requêtes uniformes |
| **Weighted round-robin** | Alternance avec poids | Serveurs de capacités différentes |
| **Least connections** | Serveur avec le moins de connexions actives | Requetes de durées variables |
| **IP hash** | Hash de l'IP client → serveur fixe | Besoin de session affinity |
| **Random** | Choix aleatoire | Simple, bon avec beaucoup de serveurs |
| **Least response time** | Serveur le plus rapide | Optimisation latence |

### 2. Layer 4 vs Layer 7

```
Layer 4 (Transport — TCP/UDP)
┌──────────────┐
│  Client       │
│  IP: 1.2.3.4 │──> Load Balancer ──> Backend A
│  Port: 443   │    (TCP forward)     Backend B
└──────────────┘    Ne lit PAS le        Backend C
                    contenu HTTP

Layer 7 (Application — HTTP)
┌──────────────┐
│  Client       │
│  GET /api/... │──> Load Balancer ──> API servers
│  Host: x.com  │    (HTTP routing)
│  Cookie: ...  │    PEUT lire :       ──> /api/* → API pool
└──────────────┘    URL, headers,      ──> /static/* → CDN
                    cookies, body      ──> /ws/* → WebSocket pool
```

| Critère | Layer 4 | Layer 7 |
|---|---|---|
| Vitesse | Plus rapide (pas d'inspection) | Plus lent (parse HTTP) |
| Intelligence | Aucune (IP + port) | Routing par URL, header, cookie |
| SSL termination | Non (pass-through) | Oui (termine SSL, inspecte) |
| WebSocket | Forward transparent | Peut router par path |
| Usage | Haute performance, TCP générique | Applications web, APIs |

### 3. Health checks

```
┌──────────────┐         ┌───────────────┐
│ Load Balancer │──ping──>│  Backend A    │ → 200 OK ✓
│               │         │  /health      │
│               │──ping──>│  Backend B    │ → 503 ✗ → retire du pool
│               │         │  /health      │
│               │──ping──>│  Backend C    │ → 200 OK ✓
└──────────────┘         └───────────────┘

Types de checks :
  Liveness  : "le process est-il vivant ?" (TCP connect)
  Readiness : "peut-il servir du trafic ?" (DB connectee, cache warm)
  Startup   : "a-t-il fini de demarrer ?" (migrations, warm-up)
```

### 4. Session affinity (sticky sessions)

```
AVEC sticky sessions :
  Client A ──(cookie: srv=B)──> toujours Backend B

SANS sticky sessions (stateless) :
  Client A ──> Backend A (requete 1)
  Client A ──> Backend C (requete 2)
  Client A ──> Backend B (requete 3)
  → L'etat est dans Redis/DB, pas dans le serveur
```

| | Sticky sessions | Stateless |
|---|---|---|
| Avantage | Simple si état in-process | Scale horizontal trivial |
| Inconvenient | 1 serveur down = sessions perdues | Nécessité store externe (Redis) |
| Recommandation | Legacy, WebSocket long-lived | **Architectures modernes** |

### 5. Kubernetes Services & Ingress

```
┌─────────────────────────────────────────────────┐
│                  Ingress Controller               │
│                  (Layer 7 LB)                    │
│  /api/*    → Service API   → Pod 1, Pod 2, Pod 3│
│  /admin/*  → Service Admin → Pod 1, Pod 2       │
│  /*        → Service Front → Pod 1, Pod 2       │
└─────────────────────────────────────────────────┘

Service = abstraction Kubernetes pour load balancing
  ClusterIP  : interne au cluster
  NodePort   : expose un port sur chaque noeud
  LoadBalancer : provisionne un LB cloud
```

---

## Pratique

### Health check endpoint (NestJS)

```typescript
@Controller('health')
export class HealthController {
  constructor(
    private readonly db: DataSource,
    private readonly redis: Redis,
  ) {}

  @Get('liveness')
  liveness(): { status: string } {
    // Le process est vivant → 200
    return { status: 'ok' };
  }

  @Get('readiness')
  async readiness(): Promise<{ status: string; checks: Record<string, string> }> {
    const checks: Record<string, string> = {};

    // Verifier la DB
    try {
      await this.db.query('SELECT 1');
      checks.database = 'ok';
    } catch {
      checks.database = 'failed';
    }

    // Verifier Redis
    try {
      await this.redis.ping();
      checks.redis = 'ok';
    } catch {
      checks.redis = 'failed';
    }

    const allOk = Object.values(checks).every((v) => v === 'ok');

    if (!allOk) {
      throw new ServiceUnavailableException({ status: 'degraded', checks });
    }

    return { status: 'ok', checks };
  }
}
```

### Nginx load balancer config

```nginx
upstream api_servers {
    least_conn;  # Algorithme : least connections

    server api-1:3000 weight=3;  # Plus puissant
    server api-2:3000 weight=2;
    server api-3:3000 weight=1;  # Moins puissant

    # Health checks
    server api-1:3000 max_fails=3 fail_timeout=30s;
}

server {
    listen 443 ssl;

    location /api/ {
        proxy_pass http://api_servers;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header Host $host;

        # Timeouts decroissants
        proxy_connect_timeout 5s;
        proxy_read_timeout 10s;
    }

    location /health {
        proxy_pass http://api_servers;
        access_log off;  # Pas de log pour les health checks
    }
}
```

### Graceful shutdown

```typescript
// Le serveur doit finir les requetes en cours avant de s'arreter
process.on('SIGTERM', async () => {
  console.log('SIGTERM received — starting graceful shutdown');

  // 1. Arreter d'accepter de nouvelles connexions
  server.close();

  // 2. Readiness → false (LB retire ce noeud du pool)
  isReady = false;

  // 3. Attendre que les requetes en cours finissent (max 30s)
  await drainConnections(30_000);

  // 4. Fermer les connexions DB/Redis
  await db.close();
  await redis.quit();

  process.exit(0);
});
```

---

## Résumé

1. **Round-robin** pour serveurs identiques, **least connections** pour charges variables, **weighted** pour capacités différentes
2. **Layer 4** (TCP, rapide, sans inspection) vs **Layer 7** (HTTP, intelligent, routing par URL/header)
3. **Health checks** : liveness (process vivant), readiness (peut servir du trafic), startup (démarrage termine)
4. **Stateless > sticky sessions** : stocker l'état dans Redis/DB, pas dans le serveur — scale horizontal trivial
5. **Graceful shutdown** : SIGTERM → stop accept → drain connections → close resources → exit

---

> **Prochain cours** : [Cours 65 — Scaling, Capacity Planning & Cloud-Native](./04-scaling-cloud-native.md)

---

> **Lien fil rouge — ShopArch**
>
> - Documente la stratégie de load balancing pour ShopArch (round-robin vs least-connections)
> - Vérifie que ShopArch est stateless (pas de session serveur, JWT uniquement)
> - Exercice(s) associé(s) : `exercices/44-capacity-planning/`
> - Checkpoint : Module 09, critère 3
