# Correction — Exercice 56 : Wardley Map

## Wardley Map de ShopArch

```
Valeur utilisateur (visible)
│
│   ┌─ Acheter un produit ──────────────────────────────────────┐
│   │                                                            │
│   │  ┌── Recherche                                             │
│   │  │   produit ─────────────────────────────● Algolia (Buy)  │
│   │  │                                                          │
│   │  ├── Catalogue                                              │
│   │  │   produits ──────────── ● Custom (Build)                 │
│   │  │                                                          │
│   │  ├── Panier ────────────── ● Custom (Build)                 │
│   │  │                                                          │
│   │  ├── Paiement ─────────────────────────── ● Stripe (Rent)  │
│   │  │                                                          │
│   │  └── Livraison ────────────────────────── ● Colissimo (Rent)│
│   │                                                              │
├───┼──────────────────────────────────────────────────────────────┤
│   │  COMPOSANTS TECHNIQUES                                       │
│   │                                                              │
│   │  ● Logique commande (Build) ── Custom                       │
│   │  ● Multi-tenant SDK (Build) ── Custom                       │
│   │  ● Auth ── ● Keycloak (Buy) ── Product                     │
│   │  ● Search engine ── ● ES (Buy) → Algolia ── Product        │
│   │  ● Email ── ● SendGrid (Rent) ── Commodity                 │
│   │  ● Image processing ── ● Sharp + S3 (Build + Rent)         │
│   │  ● Monitoring ── ● Datadog (Rent) ── Commodity             │
│   │                                                              │
├───┼──────────────────────────────────────────────────────────────┤
│   │  INFRASTRUCTURE                                              │
│   │                                                              │
│   │  ● Compute ── ● AWS ECS (Rent) ── Commodity                │
│   │  ● Database ── ● RDS PostgreSQL (Rent) ── Commodity        │
│   │  ● Cache ── ● ElastiCache Redis (Rent) ── Commodity        │
│   │  ● CDN ── ● CloudFront (Rent) ── Commodity                 │
│   │  ● Storage ── ● S3 (Rent) ── Commodity                     │
│   │  ● DNS ── ● Route53 (Rent) ── Commodity                    │
│   │                                                              │
│   Genesis ──── Custom ──── Product ──── Commodity               │
│   (nouveau)   (specifique) (marche)    (utilitaire)             │
└──────────────────────────────────────────────────────────────────┘
```

## Decisions Build / Buy / Rent

| Composant | Position | Decision | Justification |
|---|---|---|---|
| Logique commande | Custom | **Build** | C'est le coeur métier, avantage competitif |
| Multi-tenant SDK | Custom | **Build** | Spécifique a notre modèle d'isolation |
| Catalogue produits | Custom | **Build** | Logique métier spécifique (i18n, variants) |
| Panier | Custom | **Build** | Logique de prix, promotions, stocks |
| Recommandation IA | Genesis | **Build** (prototype) | Differenciateur, mais incertain |
| Auth (Keycloak) | Product | **Buy** (self-hosted) | Mature, standard OIDC, customisable |
| Search (Elasticsearch) | Product | **Buy** → **Rent** (Algolia) | Maintenance ES couteuse, Algolia est meilleur |
| Paiement (Stripe) | Commodity | **Rent** | Commodite, PCI compliance offerte |
| Email (SendGrid) | Commodity | **Rent** | Pas de valeur a développer un SMTP |
| Monitoring (Datadog) | Commodity | **Rent** | Standard, pas de differentiation |
| CI/CD (GitHub Actions) | Commodity | **Rent** | Commodite, maintenance nulle |
| Compute (AWS ECS) | Commodity | **Rent** | Infrastructure standard |
| Database (RDS) | Commodity | **Rent** | Managed PostgreSQL, backups auto |
| CDN (CloudFront) | Commodity | **Rent** | Pas de valeur a gérer des edge servers |
| Image processing | Custom → Product | **Build** (Sharp) | Spécifique (variantes, tenant isolation) |

## Mouvements anticipes

### 6 mois
```
1. Search : Elasticsearch self-hosted → Algolia SaaS
   Raison : maintenance ES = 20% du temps de l'equipe Platform
   Economie : 1 ingenieur full-time redirige vers les features

2. Monitoring : Stack maison (Prometheus + Grafana) → Datadog
   Raison : temps passe a maintenir la stack > valeur produite
```

### 12 mois
```
3. Auth : Keycloak self-hosted → Keycloak Cloud (ou Auth0)
   Raison : maintenance des upgrades Keycloak penible
   Condition : si le cout SaaS est < cout d'un ingenieur a mi-temps

4. Recommandation IA : prototype → ML pipeline avec feedback loop
   Raison : si le prototype montre un uplift de conversion > 5%
```

### 24 mois
```
5. Image processing : Sharp custom → Cloudinary ou imgix
   Raison : si le volume d'images justifie un service specialise

6. Multi-tenant : SDK custom → potentiel open-source
   Raison : si notre SDK est assez mature, le publier en OSS
   Benefice : contributions externes, reputation technique
```

## Investissements a arreter

| Composant actuel | Cout | Alternative | Economie |
|---|---|---|---|
| Elasticsearch self-hosted | 20% temps Platform | Algolia | 1 ingenieur |
| Prometheus + Grafana | 10% temps Platform | Datadog | 0.5 ingenieur |
| Pipeline de deploy custom | 5% temps Platform | GitHub Actions | 0.2 ingenieur |
| **Total** | | | **1.7 ingenieurs** |

## Alternatives et compromis

### Search : Elasticsearch self-hosted vs Algolia SaaS vs Meilisearch

| Critère | Elasticsearch (self-hosted) | Algolia (SaaS) | Meilisearch (self-hosted) |
|---|---|---|---|
| Cout | Infra + 20% temps ingenieur | ~$1/1000 requêtes | Infra + ~5% temps ingenieur |
| Performance | Excellente (tunable) | Excellente (optimise par defaut) | Bonne (plus simple qu'ES) |
| Maintenance | Lourde (upgrades, scaling, monitoring) | Zero | Legere (binaire unique) |
| Personnalisation | Totale | Limitee (mais suffisante) | Bonne |
| Vendor lock-in | Non | Oui (API proprietaire) | Non |

**Verdict pour ShopArch** : Meilisearch comme compromis ideal -- moins de maintenance qu'ES, pas de lock-in comme Algolia, et performances suffisantes pour un catalogue e-commerce.

### Auth : Keycloak self-hosted vs Auth0 vs Ory

| Critère | Keycloak (self-hosted) | Auth0 (SaaS) | Ory (self-hosted + cloud) |
|---|---|---|---|
| Cout | Infra + maintenance | $23/1000 MAU (peut exploser) | Open source + cloud option |
| OIDC compliance | Complete | Complete | Complete |
| Personnalisation | Totale (themes, flows, SPI) | Limitee (Actions/Rules) | Bonne (config-driven) |
| Multi-tenant | Realms natifs | Organisations (plan Enterprise) | Natif |
| Maintenance | Lourde (upgrades Java) | Zero | Moderee |

**Verdict pour ShopArch** : Keycloak pour l'instant (multi-tenant via Realms, customisation complete). Surveiller Ory comme alternative plus légère si la maintenance Keycloak devient un fardeau.

### Monitoring : stack maison vs Datadog vs Grafana Cloud

| Critère | Prometheus + Grafana (self-hosted) | Datadog (SaaS) | Grafana Cloud |
|---|---|---|---|
| Cout | Infra + 10% temps ingenieur | ~$15/host/mois (escale vite) | Free tier genereux + pay-as-you-go |
| Setup | Complexe (Prometheus, AlertManager, Grafana) | Très simple (agent unique) | Simple (agent + cloud) |
| Dashboards | A construire | Pre-faits + custom | Pre-faits + custom |
| Retention | A gérer (stockage, compaction) | Illimitee | Configurable |
| Lock-in | Non | Oui (metriques custom, APM) | Modere |

**Verdict pour ShopArch** : Grafana Cloud comme compromis -- pas de maintenance infra, open source compatible (pas de lock-in complet), cout previsible. Datadog si le budget permet et que la simplicite prime.

## Ce que tu aurais pu oublier

### 1. Build tout
```
FAUX — developper en interne le search, l'auth, le monitoring, le CI/CD
CORRECT — build uniquement ce qui est differenciateur (logique metier)
         Rent/Buy le reste (auth, monitoring, infra sont des commodites)
```

### 2. Rent le coeur métier
```
FAUX — utiliser un SaaS e-commerce (Shopify) pour la logique commande
CORRECT — le coeur metier (commande, panier, catalogue) est l'avantage competitif
         C'est le seul composant qu'on DOIT developper en interne
```

### 3. Position statique
```
FAUX — "Elasticsearch est un Product, on le garde pour toujours"
CORRECT — les composants evoluent : ES etait Product, mais Algolia est devenu
         une Commodity (plus facile, moins de maintenance). Il faut anticiper.
```

### 4. Oublier le cout d'opportunite
```
FAUX — "on developpe notre propre monitoring car c'est gratuit (open source)"
CORRECT — le cout n'est pas l'outil, c'est le temps ingenieur
         20% du temps Platform sur l'infra monitoring = features non livrees
```
