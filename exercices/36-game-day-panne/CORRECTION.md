# Correction — Exercice 36 : Game day simuler une panne

## Plan du Game Day

### Scénario 1 — Redis indisponible (Risque: faible)
| Champ | Detail |
|---|---|
| **Hypothese** | Si Redis tombe, les sessions expirent et le cache est perdu, mais l'app continue de fonctionner (fallback DB) |
| **Injection** | `docker stop redis` ou `iptables -A OUTPUT -p tcp --dport 6379 -j DROP` |
| **Metriques** | Latence API p99, taux d'erreur, sessions perdues |
| **Succes** | L'app continue de servir des requêtes, latence < 2s |
| **Echec** | Erreur 500, pages blanches, perte de paniers |
| **Rollback** | `docker start redis` ou `iptables -D OUTPUT -p tcp --dport 6379 -j DROP` |

### Scénario 2 — Elasticsearch down (Risque: faible)
| Champ | Detail |
|---|---|
| **Hypothese** | La recherche degrade gracefully vers PostgreSQL full-text search |
| **Injection** | `docker stop elasticsearch` |
| **Metriques** | Temps de recherche, résultats retournes, taux d'erreur search |
| **Succes** | La recherche fonctionne (degradee) en < 500ms |
| **Echec** | La recherche retourne une erreur 500 |
| **Rollback** | `docker start elasticsearch` |

### Scénario 3 — Service paiement lent (Risque: moyen)
| Champ | Detail |
|---|---|
| **Hypothese** | Le circuit breaker s'ouvre apres 5 timeouts, affiche un message "paiement temporairement indisponible" |
| **Injection** | Proxy toxiproxy avec 5s de latence sur le port du service paiement |
| **Metriques** | Latence checkout, circuit breaker state, queue de commandes en attente |
| **Succes** | Circuit breaker ouvert en < 30s, message user-friendly |
| **Echec** | Timeouts en cascade, tout le site ralentit |
| **Rollback** | Retirer le proxy toxiproxy |

### Scénario 4 — Database read-only (Risque: moyen)
| Champ | Detail |
|---|---|
| **Hypothese** | Les lectures continuent, les écritures echouent avec un message clair |
| **Injection** | `SET default_transaction_read_only = on;` sur la connexion principale |
| **Metriques** | Taux d'erreur en écriture, lectures toujours OK, messages d'erreur |
| **Succes** | Navigation et recherche fonctionnent, panier/checkout affiche "maintenance" |
| **Echec** | Erreurs 500 génériques, pas de message clair |
| **Rollback** | `SET default_transaction_read_only = off;` |

### Scénario 5 — Perte réseau partielle (Risque: élevé)
| Champ | Detail |
|---|---|
| **Hypothese** | Avec 50% de packet loss, les retries et timeouts permettent de servir 80% des requêtes |
| **Injection** | `tc qdisc add dev eth0 root netem loss 50%` |
| **Metriques** | Taux de succes, latence p50/p95/p99, retries |
| **Succes** | > 80% des requêtes aboutissent, retry transparent pour le user |
| **Echec** | < 50% des requêtes aboutissent, pas de retry |
| **Rollback** | `tc qdisc del dev eth0 root` |

## Scripts d'injection

```bash
#!/bin/bash
# game-day-inject.sh

SCENARIO=$1

case $SCENARIO in
  redis-down)
    echo "🔴 Injecting: Redis down"
    docker stop shoparch-redis
    echo "Rollback: docker start shoparch-redis"
    ;;

  es-down)
    echo "🔴 Injecting: Elasticsearch down"
    docker stop shoparch-elasticsearch
    echo "Rollback: docker start shoparch-elasticsearch"
    ;;

  payment-slow)
    echo "🔴 Injecting: Payment service 5s latency"
    toxiproxy-cli toxic add payment-proxy -t latency -a latency=5000
    echo "Rollback: toxiproxy-cli toxic remove payment-proxy -n latency_downstream"
    ;;

  db-readonly)
    echo "🔴 Injecting: Database read-only"
    psql -c "ALTER DATABASE shoparch SET default_transaction_read_only = on;"
    echo "Rollback: psql -c \"ALTER DATABASE shoparch SET default_transaction_read_only = off;\""
    ;;

  network-loss)
    echo "🔴 Injecting: 50% packet loss"
    tc qdisc add dev eth0 root netem loss 50%
    echo "Rollback: tc qdisc del dev eth0 root"
    ;;

  *)
    echo "Usage: $0 {redis-down|es-down|payment-slow|db-readonly|network-loss}"
    exit 1
    ;;
esac
```

## Template de rapport post-mortem

```markdown
# Post-mortem — Scenario : [nom]

## Date et duree
- Date : YYYY-MM-DD
- Debut injection : HH:MM
- Rollback : HH:MM
- Duree totale : X minutes

## Hypothese vs realite

| Aspect | Attendu | Observe |
|---|---|---|
| Comportement | ... | ... |
| Latence | ... | ... |
| Taux d'erreur | ... | ... |

## Verdict : ✅ Succes / ❌ Echec

## Observations
- ...

## Actions correctives

| Action | Priorite | Responsable | Deadline |
|---|---|---|---|
| ... | P0/P1/P2 | ... | ... |
```

## Exemple de rapport rempli

```markdown
# Post-mortem — Scenario : Redis down

## Hypothese vs realite

| Aspect | Attendu | Observe |
|---|---|---|
| Sessions | Fallback DB | ❌ Erreur 500 — pas de fallback |
| Cache | Requetes directes DB | ✅ Fallback DB, latence +200ms |
| Panier (Redis) | Persiste en DB | ❌ Panier perdu, pas de persistence |

## Verdict : ❌ Echec partiel

## Actions correctives

| Action | Priorite | Responsable | Deadline |
|---|---|---|---|
| Ajouter fallback session → DB | P0 | Backend | 1 semaine |
| Persister le panier en DB (Redis = cache) | P1 | Backend | 2 semaines |
| Ajouter alerte Redis health check | P1 | DevOps | 1 semaine |
```

## Fallback patterns a implémenter

```typescript
// redis-fallback.service.ts — pattern a implementer apres le Game Day
@Injectable()
export class ResilientCacheService {
  constructor(
    private readonly redis: Redis,
    private readonly db: DataSource,
  ) {}

  async get<T>(key: string, fallback: () => Promise<T>, ttl: number): Promise<T> {
    try {
      const cached = await this.redis.get(key);
      if (cached) return JSON.parse(cached);
    } catch {
      // Redis down → fallback direct DB
      console.warn(`Redis unavailable, falling back to DB for key: ${key}`);
    }

    const value = await fallback();

    // Essayer de mettre en cache (best-effort)
    try {
      await this.redis.set(key, JSON.stringify(value), 'EX', ttl);
    } catch {
      // Redis toujours down, pas grave
    }

    return value;
  }
}
```

## Ce que tu aurais pu oublier

### 1. Tester en production
```
FAUX — injecter des pannes directement en production (risque reel)
CORRECT — staging d'abord, production uniquement quand le systeme est resilient
         Netflix fait du chaos en prod, mais ils ont 10 ans d'experience
```

### 2. Pas de rollback plan
```
FAUX — injecter la panne et improviser le rollback
CORRECT — ecrire le rollback AVANT d'injecter, le tester, et le garder pret
```

### 3. Pas de baseline
```
FAUX — injecter la panne sans connaitre les metriques normales
CORRECT — capturer les metriques de reference AVANT le Game Day
         Comparer normal vs panne pour quantifier l'impact
```

### 4. Scénarios simultanes
```
FAUX — injecter Redis down + payment slow + network loss en meme temps
CORRECT — un scenario a la fois, observer, documenter, puis passer au suivant
```
