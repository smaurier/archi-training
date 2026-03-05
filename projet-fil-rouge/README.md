# Projet Fil Rouge — ShopArch

> Un e-commerce simplifie construit incrementalement a travers les 14 modules de la formation.

---

## Concept

ShopArch est une plateforme e-commerce simplifiee. L'objectif n'est **pas** de livrer un produit complet, mais d'appliquer chaque concept d'architecture dans un contexte realiste et cohérent.

Chaque module ajoute une couche architecturale au projet. A la fin de la formation, tu auras construit un système complet avec :

- Une API REST bien concue (NestJS)
- Un front-end performant (React/Next.js)
- Une base de données modélisée (PostgreSQL)
- De l'authentification (OIDC/JWT)
- Du cache multi-niveaux
- De l'observabilité
- Des tests a tous les niveaux

---

## Fonctionnalites

### Catalogue
- Liste de produits avec recherche full-text
- Filtres par categorie, prix, disponibilité
- Fiches produit detaillees avec images

### Panier
- Ajout / modification / suppression d'articles
- Persistance côté serveur (utilisateur connecte) ou localStorage (anonyme)
- Calcul du total avec taxes

### Commande
- Checkout avec résumé du panier
- Paiement simule (pas de vrai gateway)
- Historique des commandes
- FSM : Created → Paid → Shipped → Delivered (ou Cancelled)

### Compte utilisateur
- Inscription / connexion via OIDC (Keycloak simule)
- Profil, adresses de livraison
- Historique des commandes

### Administration
- Dashboard avec metriques (commandes, revenus, stock)
- CRUD produits avec upload d'images
- Gestion des commandes (changement de statut)

---

## Stack technique

| Couche | Technologie |
|---|---|
| Front-end | React 18+ / Next.js 14+ |
| State management | Zustand |
| Styling | CSS custom properties (design tokens) |
| Back-end | NestJS 10+ |
| ORM | TypeORM |
| Base de données | PostgreSQL 16 |
| Cache | Redis 7 |
| Search | PostgreSQL FTS (puis Elasticsearch) |
| Auth | Keycloak (simule en dev) |
| File storage | S3 (MinIO en local) |
| Testing | Vitest, Playwright, Pact, k6 |
| CI/CD | GitHub Actions |
| Observabilite | OpenTelemetry, Prometheus, Grafana |

---

## Modèle de domaine

```
┌─────────────────────────────────────────────────────────────────┐
│                        ShopArch Domain                          │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │   Catalog     │  │    Cart      │  │      Order           │  │
│  │              │  │              │  │                      │  │
│  │  Product     │  │  CartItem    │  │  Order               │  │
│  │  Category    │  │  Cart        │  │  OrderLine           │  │
│  │  Image       │  │              │  │  OrderStatus (FSM)   │  │
│  │  Review      │  │              │  │  Payment             │  │
│  └──────┬───────┘  └──────┬───────┘  └──────────┬───────────┘  │
│         │                 │                      │              │
│         └─────────────────┼──────────────────────┘              │
│                           │                                     │
│  ┌──────────────┐  ┌──────┴───────┐  ┌──────────────────────┐  │
│  │   User       │  │   Shared     │  │     Payment          │  │
│  │              │  │              │  │                      │  │
│  │  User        │  │  Money (VO)  │  │  PaymentIntent       │  │
│  │  Address     │  │  Email (VO)  │  │  PaymentStatus       │  │
│  │  Role        │  │  UUID        │  │  IdempotencyKey      │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Bounded Contexts

| Context | Responsabilite | Entités cles |
|---|---|---|
| **Catalog** | Gestion du catalogue produits | Product, Category, Image, Review |
| **Cart** | Panier d'achat temporaire | Cart, CartItem |
| **Order** | Gestion des commandes | Order, OrderLine, OrderStatus |
| **Payment** | Traitement des paiements | PaymentIntent, IdempotencyKey |
| **User** | Identité et profil | User, Address, Role |

### Relations entre contexts

```
  Catalog ──── Shared Kernel ──── Cart
     │                              │
     │                              │
     └──── Customer/Supplier ───── Order
                                    │
                                    │
                              ACL ──┤
                                    │
                                Payment
                                    │
                              ACL ──┤
                                    │
                                  User
```

---

## Architecture cible (fin de formation)

```
                            ┌─────────────┐
                            │   CDN/Edge  │
                            │  (images,   │
                            │   assets)   │
                            └──────┬──────┘
                                   │
┌──────────────────────────────────┼──────────────────────────────┐
│                            Next.js App                          │
│                                                                 │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌───────────────────┐  │
│  │ Catalog  │ │  Cart    │ │ Checkout │ │  Admin Dashboard  │  │
│  │  (SSR)   │ │  (SPA)   │ │  (SPA)   │ │     (SPA)        │  │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────────┬──────────┘  │
│       └─────────────┼───────────┼────────────────┘              │
│                     │    Zustand + React Query                   │
└─────────────────────┼───────────────────────────────────────────┘
                      │
                ┌─────┴──────┐
                │    BFF     │ (auth tokens server-side)
                └─────┬──────┘
                      │
┌─────────────────────┼───────────────────────────────────────────┐
│                 NestJS API                                       │
│                                                                  │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐  │
│  │ Catalog │ │  Cart   │ │  Order  │ │ Payment │ │  User   │  │
│  │ Module  │ │ Module  │ │ Module  │ │ Module  │ │ Module  │  │
│  └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘  │
│       └───────────┴───────────┴───────────┴───────────┘        │
│                           │                                     │
│              SearchProvider (interface)                          │
│              ┌────────┴────────┐                                │
│              │ PgFtsProvider   │ (v1)                            │
│              │ ElasticProvider │ (v2 — si trigger atteint)       │
│              └─────────────────┘                                │
└──────────────────────┬──────────────────────────────────────────┘
                       │
         ┌─────────────┼─────────────┐
         │             │             │
    ┌────┴────┐  ┌─────┴────┐  ┌────┴────┐
    │ Postgres│  │  Redis   │  │   S3    │
    │ (data)  │  │ (cache)  │  │ (files) │
    └─────────┘  └──────────┘  └─────────┘
```

---

## Progression par module

| Module | Increment ShopArch |
|---|---|
| **00 — Fondamentaux** | Types TypeScript du domaine (Product, Cart, Order, User). Design tokens types. Trade-off analysis du projet. |
| **01 — Patterns archi** | Architecture hexagonale du back (ports & adapters). API-First contract (OpenAPI). 12-Factor checklist. |
| **02 — DDD** | Bounded Contexts : Catalog, Cart, Order, Payment, User. FSM commande (Created → Paid → Shipped → Delivered → Cancelled). |
| **03 — Back-end** | API REST NestJS — CRUD produits + auth OIDC + tenant isolation + idempotency key sur paiement. Lock optimiste sur le stock. |
| **04 — BDD** | Schema PostgreSQL — migrations, UUID PKs, index GIN full-text, JSON i18n. Search avec FTS puis Elasticsearch. |
| **05 — Front-end** | Front React — component tree, design tokens OKLCH, theme switcher, SSR catalogue + ISR fiches produit + SPA panier. i18n + hreflang + canonical. |
| **06 — Communication** | HTTP/2. Webhooks HMAC pour notifications commande. BFF pour auth tokens. |
| **07 — Distribue** | CQRS catalogue/commandes. Outbox pattern. Circuit breaker sur payment gateway. |
| **08 — Sécurité** | CSP hash-only. Rate limiting. Threat model STRIDE du checkout. CMP consentement analytics. |
| **09 — Performance** | Cache Redis 3-niveaux. CDN images WebP/AVIF + focal-point. Capacity planning. Serverless thumbnails. |
| **10 — Observabilite** | Logging OTel. SLOs Prometheus. CI/CD Helm + k6 + Lighthouse. Feature flag promo flash. Blue/Green deploy. |
| **11 — Testing** | Tests E2E + a11y axe-core. Contract tests Pact. Load testing k6. MSW mock layer. |
| **12 — Pratique** | ADR. Diagrammes C4. Fitness functions. Plugin "produits recommandes". Conway's Law analysis. Wardley Map. |
| **13 — Culture** | API mobile-friendly (delta sync). Editeur collaboratif CRDT. Anti-corruption layer vers ERP legacy. |

---

## Structure du projet (cible)

```
shoparch/
├── apps/
│   ├── api/                    # NestJS
│   │   ├── src/
│   │   │   ├── catalog/        # Module Catalog
│   │   │   ├── cart/           # Module Cart
│   │   │   ├── order/          # Module Order
│   │   │   ├── payment/        # Module Payment
│   │   │   ├── user/           # Module User
│   │   │   ├── shared/         # Value Objects, interfaces
│   │   │   └── infra/          # DB, Redis, S3 adapters
│   │   └── test/
│   └── web/                    # Next.js
│       ├── src/
│       │   ├── components/     # Atomic design
│       │   ├── features/       # Feature-based modules
│       │   ├── hooks/          # Custom hooks
│       │   ├── stores/         # Zustand stores
│       │   ├── tokens/         # Design tokens JSON
│       │   └── utils/
│       └── public/
├── packages/
│   ├── shared-types/           # Types partages front/back
│   └── design-tokens/          # Token pipeline
├── infra/
│   ├── docker-compose.yml      # Dev environment
│   ├── helm/                   # K8s charts
│   └── terraform/              # Cloud infra
├── docs/
│   └── adr/                    # Architecture Decision Records
└── tests/
    ├── contracts/              # Pact contract tests
    ├── load/                   # k6 load tests
    └── e2e/                    # Playwright E2E tests
```

---

## Demarrage rapide

```bash
# 1. Cloner le repo
git clone https://github.com/yourname/shoparch.git
cd shoparch

# 2. Installer les dependances
npm install

# 3. Demarrer l'infra locale
docker compose up -d   # PostgreSQL, Redis, MinIO, Keycloak

# 4. Lancer les migrations
npm run db:migrate

# 5. Seeder les donnees de dev
npm run db:seed

# 6. Demarrer le back
npm run dev:api        # http://localhost:3001

# 7. Demarrer le front
npm run dev:web        # http://localhost:3000
```

---

## Regles du projet

1. **Pas de code mort** — si une feature n'est pas encore implémentée, elle n'existe pas dans le code
2. **Chaque module = un commit** — pour pouvoir naviguer dans l'historique
3. **Tests avant merge** — aucune feature sans au moins un test
4. **ADR pour chaque decision** — documenter le "pourquoi", pas juste le "quoi"
5. **Interface d'abord** — définir le contrat avant l'implémentation

---

## Checkpoints par module

Utilise ces checklists pour vérifier ta progression. Chaque critère doit être validé avant de passer au module suivant.

### Module 00 — Fondamentaux
- [ ] Les types TypeScript du domaine compilent (`npx tsc --noEmit`)
- [ ] Les Value Objects (Money, Email) rejettent les valeurs invalides (tests passent)
- [ ] Tu sais expliquer pourquoi Money est un VO et Product une Entité
- [ ] Le trade-off analysis du choix NestJS vs Fastify vs Express est documenté

### Module 01 — Patterns architecturaux
- [ ] L'architecture hexagonale est en place (ports dans `domain/`, adapters dans `infra/`)
- [ ] Le `OrderService` ne dépend d'aucun import d'infrastructure (vérifie les imports)
- [ ] Le fichier `openapi.yaml` décrit les endpoints Catalog CRUD
- [ ] La checklist 12-Factor est remplie pour ShopArch (au moins 8/12 applicables)

### Module 02 — Domain-Driven Design
- [ ] Les 5 Bounded Contexts sont identifiés (Catalog, Cart, Order, Payment, User)
- [ ] La Context Map montre les relations entre contexts (Shared Kernel, Customer/Supplier, ACL)
- [ ] La FSM de commande est implémentée (Created → Paid → Shipped → Delivered/Cancelled)
- [ ] Les transitions invalides lèvent une erreur (ex: Created → Delivered impossible)

### Module 03 — Architecture back-end
- [ ] L'API REST NestJS expose les endpoints CRUD Catalog avec pagination cursor
- [ ] L'auth OIDC est en place (JWT validé par le guard, rôles dans le token)
- [ ] L'idempotency key fonctionne sur `POST /orders` (2 appels identiques = 1 commande)
- [ ] Le lock optimiste sur le stock empêche les race conditions (test avec 2 requêtes concurrentes)
- [ ] Le RBAC fonctionne (admin peut tout, customer ne peut que consulter et commander)

### Module 04 — Architecture BDD
- [ ] Le schéma PostgreSQL est en place avec UUID PKs et created_at/updated_at
- [ ] Les migrations sont versionnées et réversibles (`npm run db:migrate:undo` fonctionne)
- [ ] L'index GIN full-text est créé et la recherche produit fonctionne en français
- [ ] Le EXPLAIN ANALYZE des requêtes principales montre un index scan (pas de seq scan)

### Module 05 — Architecture front-end
- [ ] Le component tree suit l'atomic design (atoms → molecules → organisms → templates)
- [ ] Les design tokens sont en JSON et génèrent des CSS custom properties
- [ ] Le theme switcher dark/light fonctionne sans FOUC (tokens injectés côté serveur)
- [ ] Le catalogue est en SSR, les fiches produit en ISR, le panier en SPA
- [ ] Les balises hreflang et canonical sont présentes sur les pages publiques

### Module 06 — Communication & Intégration
- [ ] La page charge en HTTP/2 (vérifiable dans DevTools > Network > Protocol)
- [ ] Le webhook HMAC-SHA256 est implémenté (signature vérifiée avec `timingSafeEqual`)
- [ ] Le BFF agrège catalogue + panier en un seul appel (pas de waterfall côté client)
- [ ] Un webhook invalide (mauvaise signature) retourne 401

### Module 07 — Patterns distribués
- [ ] Le CQRS sépare les modèles de lecture (catalogue dénormalisé) et d'écriture (commandes)
- [ ] L'outbox pattern garantit la publication des events après commit DB
- [ ] Le circuit breaker sur le payment gateway gère les timeouts gracefully
- [ ] Le read model se met à jour via les domain events (pas de couplage direct)

### Module 08 — Sécurité
- [ ] La CSP est en place sans `unsafe-inline` ni `unsafe-eval` (vérifiable dans les headers HTTP)
- [ ] Le rate limiting fonctionne (>100 req/min → 429 Too Many Requests)
- [ ] Le threat model STRIDE du checkout identifie au moins 5 menaces avec mitigations
- [ ] Le CMP (Consent Management Platform) conditionne le chargement des scripts analytics

### Module 09 — Performance & Scalabilité
- [ ] Le cache Redis 3 niveaux est en place (HTTP cache, application cache, query cache)
- [ ] Les images sont servies en WebP/AVIF avec srcset responsive (3 tailles minimum)
- [ ] Le capacity planning est documenté (estimation du trafic pic, ressources nécessaires)
- [ ] Le Lighthouse score est ≥ 90 sur la page catalogue

### Module 10 — Observabilité & DevOps
- [ ] Les logs structurés JSON sont émis via OpenTelemetry (correlationId présent)
- [ ] Les SLOs sont définis (p95 latence ≤300ms, disponibilité ≥99.9%, error rate ≤1%)
- [ ] Le pipeline CI exécute lint + tests + build + Lighthouse (GitHub Actions)
- [ ] Le feature flag active/désactive la promo flash sans redéploiement
- [ ] Le déploiement Blue/Green est documenté avec procédure de rollback

### Module 11 — Testing
- [ ] Les tests E2E Playwright couvrent le parcours search → product → cart → checkout
- [ ] L'audit a11y axe-core passe sans erreur critique sur les pages principales
- [ ] Les contract tests Pact vérifient le contrat BFF ↔ API
- [ ] Le load test k6 valide les SLOs sous charge (p95 < 300ms avec 100 VUs)

### Module 12 — Architecture pratique
- [ ] Au moins 3 ADRs sont rédigés (choix DB, choix framework, choix auth)
- [ ] Le diagramme C4 (niveaux 1-3) est à jour et correspond au code
- [ ] Les fitness functions vérifient automatiquement les contraintes d'architecture en CI
- [ ] L'analyse Conway's Law identifie l'alignement équipe ↔ architecture

### Module 13 — Culture architecturale
- [ ] L'API mobile-friendly supporte le delta sync (champ `updatedSince`)
- [ ] Le PoC CRDT démontre l'édition collaborative (2 clients, pas de conflit)
- [ ] L'Anti-Corruption Layer isole l'intégration ERP legacy du domaine ShopArch
- [ ] Tu peux expliquer dans quels cas ShopArch bénéficierait de chaque concept (Wardley Map, edge computing, etc.)
