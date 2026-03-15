# Correction — Exercice 55 : Team Topologies

## Organisation actuelle (problématique)

```
┌─────────────────────────────────────────────┐
│            Organisation par specialite       │
│                                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│  │ Front ×6 │  │ Back ×8  │  │ Infra ×4 │  │
│  │          │  │          │  │          │  │
│  │ - SPA    │  │ - API    │  │ - CI/CD  │  │
│  │ - SSR    │→→│ - DB     │→→│ - K8s    │  │
│  │ - Mobile │  │ - Queue  │  │ - Monitor│  │
│  └──────────┘  └──────────┘  └──────────┘  │
│                                             │
│  Problemes:                                 │
│  - Feature traverse 3 equipes (handoffs)    │
│  - Bottleneck sur l'equipe Back             │
│  - Infra deporte du contexte metier         │
└─────────────────────────────────────────────┘
```

## Organisation proposee (Team Topologies)

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│  STREAM-ALIGNED TEAMS                                   │
│  ┌──────────────────────┐  ┌──────────────────────┐    │
│  │ Team Catalogue (6)    │  │ Team Commerce (7)     │    │
│  │ Type: Stream-aligned  │  │ Type: Stream-aligned  │    │
│  │                       │  │                       │    │
│  │ 2 front + 3 back + 1 │  │ 2 front + 4 back + 1 │    │
│  │ full-stack            │  │ full-stack            │    │
│  │                       │  │                       │    │
│  │ Owns:                 │  │ Owns:                 │    │
│  │ - Produits            │  │ - Panier              │    │
│  │ - Categories          │  │ - Checkout            │    │
│  │ - Recherche           │  │ - Commandes           │    │
│  │ - Pages produit       │  │ - Paiements           │    │
│  │ - Import catalogue    │  │ - Notifications       │    │
│  └──────────────────────┘  └──────────────────────┘    │
│                                                         │
│  PLATFORM TEAM                                          │
│  ┌──────────────────────┐                               │
│  │ Team Platform (5)     │                               │
│  │ Type: Platform        │                               │
│  │                       │                               │
│  │ 2 infra + 2 back + 1 │                               │
│  │ SRE                   │                               │
│  │                       │                               │
│  │ Provides:             │                               │
│  │ - CI/CD pipeline      │                               │
│  │ - Monitoring/alerting │                               │
│  │ - Auth SDK (Keycloak) │                               │
│  │ - Multi-tenant SDK    │                               │
│  │ - Dev environment     │                               │
│  └──────────────────────┘                               │
└─────────────────────────────────────────────────────────┘
```

## Modes d'interaction

| Équipe A | Équipe B | Mode | Duree | Objectif |
|---|---|---|---|---|
| Platform | Catalogue | X-as-a-Service | Permanent | CI/CD, monitoring, auth SDK |
| Platform | Commerce | X-as-a-Service | Permanent | CI/CD, monitoring, auth SDK |
| Platform | Commerce | Collaboration | 3 sprints | Mettre en place l'observabilité pour le checkout |
| Catalogue | Commerce | X-as-a-Service | Permanent | API Catalogue consommee par Commerce |
| Platform | Catalogue | Facilitating | 2 sprints | Formation sur le nouveau pipeline de deploy |

### Progression des interactions

```
Sprint 1-3 : Collaboration forte (Platform aide Commerce)
                Platform ←→ Commerce (collaboration)

Sprint 4+  : X-as-a-Service (Platform fournit, Commerce consomme)
                Platform → Commerce (service)
```

## Charge cognitive par équipe

| Équipe | Domaines | Charge | Ajustement |
|---|---|---|---|
| Catalogue | Produits, Categories, Recherche, Pages produit, Import | 5 domaines ⚠️ | OK si import est rare |
| Commerce | Panier, Checkout, Commandes, Paiements, Notifications | 5 domaines ⚠️ | Notifications pourrait etre un service Platform |
| Platform | CI/CD, Monitoring, Auth, Multi-tenant, Dev env | 5 domaines ⚠️ | Charge acceptable car outils, pas métier |

**Ajustement propose** : transferer les Notifications vers Platform (c'est un service transversal, pas du métier Commerce).

## Team APIs

```markdown
# Team API — Team Catalogue

## Nous fournissons
- API REST /products (CRUD, search, pagination)
- API REST /categories (CRUD, arbre)
- Events : ProductCreated, ProductUpdated, ProductDeleted
- Webhook : product.updated (pour la synchronisation)

## Nous attendons
- SDK Auth (de Platform) pour l'authentification
- SDK Multi-tenant (de Platform) pour l'isolation
- CI/CD pipeline (de Platform)

## Comment nous contacter
- Slack : #team-catalogue
- Code reviews : @shoparch/catalogue
- On-call rotation : lundi-vendredi 9h-18h

## SLOs
- API Catalogue : 99.9% disponibilite, p95 < 200ms
- Recherche : 99.5% disponibilite, p90 < 500ms
```

## Mapping équipes ↔ architecture (loi de Conway inverse)

```
Architecture                    Equipes
┌───────────────┐              ┌──────────────┐
│ Catalogue API │ ◄──────────► │ Team         │
│ Search Index  │              │ Catalogue    │
│ Product Pages │              │              │
└───────────────┘              └──────────────┘

┌───────────────┐              ┌──────────────┐
│ Cart API      │ ◄──────────► │ Team         │
│ Checkout API  │              │ Commerce     │
│ Order API     │              │              │
│ Payment GW    │              │              │
└───────────────┘              └──────────────┘

┌───────────────┐              ┌──────────────┐
│ CI/CD         │ ◄──────────► │ Team         │
│ Monitoring    │              │ Platform     │
│ Auth SDK      │              │              │
│ Infra         │              │              │
└───────────────┘              └──────────────┘
```

## Alternatives et compromis

### Stream-aligned vs Feature teams vs Component teams

| Critère | Stream-aligned (par domaine) | Feature team (par feature) | Component team (par specialite) |
|---|---|---|---|
| Autonomie | Forte (bout en bout) | Forte (pour une feature) | Faible (dépendances croisees) |
| Duplication de code | Possible (chaque équipe a son front+back) | Faible | Aucune |
| Handoffs | Zero | Peu | Beaucoup (front → back → infra) |
| Expertise technique | Moderee (generalistes) | Moderee | Forte (specialistes) |
| Scalabilite orga | Bonne (ajouter une équipe = ajouter un domaine) | Moyenne (features se chevauchent) | Mauvaise (bottleneck) |

**Verdict pour ShopArch** : stream-aligned pour les domaines métier (Catalogue, Commerce). Les feature teams sont utiles pour des initiatives temporaires cross-domaine (ex: refonte du checkout).

### 2 équipes stream-aligned vs 3 équipes stream-aligned

| Config | 2 équipes (Catalogue + Commerce) | 3 équipes (Catalogue + Commerce + Users) |
|---|---|---|
| Taille équipes | 6-7 personnes (OK) | 4-5 personnes (petites) |
| Charge cognitive | 5 domaines chacune (limite) | 3-4 domaines chacune (confortable) |
| Coordination | 2 équipes = faible overhead | 3 équipes = plus d'interfaces |
| Cout | 18 personnes + Platform | 18 personnes + Platform (même effectif, reparti) |

**Verdict pour ShopArch** : 2 stream-aligned pour l'instant (effectif de 18 personnes). Passer a 3 quand l'équipe dépasse 25 personnes ou que la charge cognitive devient intenable.

### Platform team interne vs PaaS externe

| Critère | Platform team interne | PaaS (Heroku, Render, Vercel) |
|---|---|---|
| Personnalisation | Totale | Limitee aux options du PaaS |
| Cout humain | 5 personnes dédiées | ~0 personnes (managed) |
| Cout financier | Salaires + infra | Abonnement PaaS (souvent plus cher a l'echelle) |
| Autonomie des équipes | Depend de la qualité du Platform team | Immediate (self-service natif) |

**Verdict pour ShopArch** : Platform team interne a long terme (multi-tenant, Keycloak = besoins spécifiques). Mais un PaaS comme point de depart est pertinent pour aller vite avant d'avoir l'effectif pour un Platform team.

## Ce que tu aurais pu oublier

### 1. Équipe par specialite
```
FAUX — equipe Front, equipe Back, equipe Infra (silos)
CORRECT — equipe stream-aligned cross-fonctionnelle (front + back + ops)
         Chaque equipe livre de la valeur bout-en-bout
```

### 2. Équipe trop grande
```
FAUX — equipe de 12 personnes (communication trop complexe)
CORRECT — max 8 personnes (Two-Pizza Team d'Amazon)
         Au-dela, splitter en deux stream-aligned
```

### 3. Pas de Team API
```
FAUX — les equipes interagissent de maniere informelle (Slack au cas par cas)
CORRECT — chaque equipe a une API formelle : ce qu'elle fournit, ce qu'elle attend
         Reduit les interruptions et clarifie les responsabilites
```

### 4. Reorganisation sans transition
```
FAUX — reorganiser du jour au lendemain (chaos)
CORRECT — transition progressive sur 2-3 mois
         Phase 1 : formation, Phase 2 : equipes pilotes, Phase 3 : generalisation
```
