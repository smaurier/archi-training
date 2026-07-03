# Parcours — Architecture Logicielle (Front, Back, Globale)

> **De débutant a architecte expert**
> Stack de référence : React · NestJS · PostgreSQL
> Approche agnostique — les patterns sont universels, les exemples concrets.

---

## Méthodologie — Apprendre pour retenir

Ce parcours applique des principes de neuroscience pour maximiser la retention :

| Principe | Regle | Pourquoi |
|---|---|---|
| **Charge cognitive** | 1 cours = 1 session | Un seul concept par session évité la surcharge |
| **Consolidation** | 24h entre chaque cours | Le sommeil consolide la mémoire declarative |
| **Récupération active** | Tente AVANT de voir la solution | L'effort de rappel ancre la mémoire |
| **Rappel espace** | Revise a J+1, J+7, J+30 | Courbe d'Ebbinghaus — espacer pour retenir |
| **Entrelacement** | Exercices de renforcement (variantes `b`) | Revoir un concept sous un angle différent |
| **Analogies** | Chaque concept = une analogie concrete | Ancrer l'abstrait dans le réel |
| **Contextes varies** | Front, back, infra, organisationnel | Transferer les patterns d'un domaine a l'autre |

### Révision espacee — comment faire

- **J+1** : Relis les sections pratiques, refais 1-2 exercices de mémoire
- **J+7** : Explique chaque concept a voix haute en 30 secondes depuis le résumé
- **J+30** : Refais l'exercice principal du module ; relis le cours seulement si bloque > 5 min

### Structure de chaque cours

Chaque fichier de cours suit ce schema :

1. **Titre + objectif** — ce que tu sauras faire à la fin
2. **Rappel du cours précédent** — 2 questions avec réponses masquees (`<details>`)
3. **Analogie** — ancrer le concept dans le réel
4. **Rappel prérequis** — rappel JS/TS/réseau si nécessaire
5. **Théorie** — explications, schemas ASCII, tableaux comparatifs
6. **Pratique** — exemples de code commentes (le "pourquoi", pas juste le "quoi")
7. **Résumé** — les points clés en 5 bullet points
8. **Lien vers le cours suivant**

### Structure de chaque exercice

Chaque dossier `exercices/XX-slug/` contient 3 fichiers :

- `ENONCE.md` — objectif, instructions numerotees, contraintes, bonus
- `CHECKLIST.md` — auto-évaluation case par case
- `CORRECTION.md` — solution commentee + section "Ce que tu aurais pu oublier" (4-6 erreurs fréquentes avec code faux vs correct)

### Fichier transverse

- `00-pieges-frequents-archi.md` — ~20 pieges cross-cutting références depuis les cours concernes

---

## Vue d'ensemble

| Module | Theme | Cours | Exercices | Temps estime |
|---|---|---|---|---|
| 00 | Fondamentaux du design | 6 | 4 | ~8h |
| 01 | Patterns architecturaux | 7 | 5 | ~10h |
| 02 | Domain-Driven Design | 5 | 4 | ~8h |
| 03 | Architecture Back-end | 8 | 6 | ~13h |
| 04 | Architecture Base de Données | 6 | 5 | ~10h |
| 05 | Architecture Front-end | 10 | 8 | ~16h |
| 06 | Communication & Intégration | 6 | 5 | ~10h |
| 07 | Patterns distribues | 7 | 5 | ~11h |
| 08 | Sécurité | 6 | 5 | ~10h |
| 09 | Performance & Scalabilite | 6 | 4 | ~9h |
| 10 | Observabilité & DevOps | 5 | 4 | ~8h |
| 11 | Testing Architecture | 4 | 4 | ~7h |
| 12 | Architecture dans la vraie vie | 7 | 4 | ~10h |
| 13 | Culture architecturale elargie | 6 | 3 | ~8h |
| | **Total** | **89** | **66** | **~138h** |

**Duree recommandee** : ~4-5 mois à raison d'1 cours/jour (5 jours/semaine)

---

## Fichier transverse : Pieges fréquents

> `cours/00-pieges-frequents-archi.md` — a consulter régulièrement, référence depuis les cours.

20 pieges classes par domaine :

| # | Piege | Cours lies |
|---|---|---|
| 1 | "On m'a dit microservices, donc microservices" — distributed monolith | 10, 11 |
| 2 | "SOLID partout tout le temps" — over-engineering, abstractions prematurees | 2, 4 |
| 3 | "J'ai mis du cache partout" — cache invalidation hell, stale data | 50, 51 |
| 4 | "Eventual consistency alors que le métier exige strong" — mauvais trade-off | 45, 46 |
| 5 | "Un store global pour tout" — God Store, couplage implicite | 28 |
| 6 | "CSP en mode unsafe-inline parce que ça marche pas" — sécurité sacrifiee | 48 |
| 7 | "On refactorise tout d'un coup" — Big Bang rewrite | 72, 43 |
| 8 | "Les tests ralentissent le projet" — dette exponentielle | 64 |
| 9 | "Je fais du DDD partout" — over-modeling pour un CRUD simple | 10, 12 |
| 10 | "Pas besoin de schema, on est en NoSQL" — schema implicite = dette | 26 |
| 11 | "Le front n'a pas besoin d'architecture" — spaghetti components | 27, 28 |
| 12 | "Je vais faire mon propre framework" — NIH syndrome | 4, 73 |
| 13 | "Ça marche en local" — pas d'environnement de staging | 62, 63 |
| 14 | "JWT dans localStorage, c'est bon" — XSS → vol de session | 17, 48 |
| 15 | "On verra la sécurité plus tard" — bolt-on security | 44, 49 |
| 16 | "Mon API retourne 200 avec un body d'erreur" — API design anti-pattern | 15, 20 |
| 17 | "Pas besoin de rate limiting, on est en interne" — lateral movement | 49, 18 |
| 18 | "On scale verticalement, ça suffira" — scaling ceiling | 55 |
| 19 | "L'archi est figee, on ne touche plus" — architecture fossile | 73, 74 |
| 20 | "Conway's Law ne s'applique pas a nous" — spoiler : si | 75 |

---

## Module 00 — Fondamentaux du design (~8h)

> Avant de construire un batiment, il faut comprendre la resistance des materiaux.

| # | Cours | Fichier | Temps |
|---|---|---|---|
| 1 | Qu'est-ce que l'architecture logicielle ? | `00-fondamentaux/01-quest-ce-que-architecture.md` | 45 min |
| 2 | Principes SOLID | `00-fondamentaux/02-principes-solid.md` | 1h15 |
| 3 | Design patterns essentiels | `00-fondamentaux/03-design-patterns-essentiels.md` | 1h30 |
| 4 | Principes de clean code | `00-fondamentaux/04-principes-clean-code.md` | 1h |
| 5 | Code smells et refactoring | `00-fondamentaux/05-code-smells-et-refactoring.md` | 1h30 |
| 6 | Dependency Injection & Inversion of Control | `00-fondamentaux/06-dependency-injection-ioc.md` | 1h |
| 7 | Raisonner en architecte (trade-offs & -ilities) | `00-fondamentaux/07-raisonner-en-architecte.md` | 1h15 |

**Cours 1** : Définition, role de l'architecte, architecture vs design, les 4 dimensions (structure, communication, decisions, vision). Analogie : l'architecte d'un immeuble vs le macon.

**Cours 2** : Single Responsibility, Open/Closed, Liskov Substitution, Interface Segregation, Dependency Inversion. Chaque principe avec analogie + code faux → code correct.

**Cours 3** : Creational (Factory, Builder, Singleton), Structural (Adapter, Facade, Proxy, Decorator), Behavioral (Observer, Strategy, **State Machine**, Command). State Machine illustre par un workflow editorial (Draft → Published → Archived).

**Cours 4** : DRY, KISS, YAGNI, SoC (Séparation of Concerns), LoD (Law of Demeter), Composition over Inheritance, Fail Fast. Quand CHAQUE principe ne s'applique PAS (anti-dogmatisme).

**Cours 5** : Les 22 code smells (5 familles : Bloaters, OO Abusers, Change Preventers, Dispensables, Couplers) et les 66 techniques de refactoring (6 groupes). Refactoring par petits pas, tests verts, couplage smell → technique. Source de référence : refactoring.guru.

**Cours 6** : IoC container, constructor injection, token-based injection, scope (singleton, request, transient). NestJS providers, Symfony services. Analogie : la prise electrique (interface) vs l'appareil (implémentation).

**Cours 7** : Architecture characteristics (-ilities : scalability, maintainability, testability, deployability, security...). Trade-off analysis : chaque decision à un cout. Matrice impact/effort. Fitness functions (tests automatises pour invariants architecturaux). Analogie : le triangle qualité/cout/delai.

| Exercice | Fichier | Temps |
|---|---|---|
| 01 — Refactoring SOLID | `exercices/01-refactoring-solid/` | 1h |
| 01b — Refactoring par les code smells | `exercices/01b-refactoring-smells/` | 1h30 |
| 02 — Identifier les design patterns | `exercices/02-identifier-patterns/` | 45 min |
| 03 — Injection de dépendances | `exercices/03-injection-dependances/` | 45 min |
| 04 — Trade-off analysis d'un cas réel | `exercices/04-tradeoff-analysis/` | 1h |

---

## Module 01 — Patterns architecturaux (~10h)

> Choisir une architecture, c'est choisir le plan d'un immeuble : combien d'etages, ou sont les murs porteurs, comment circule l'air.

| # | Cours | Fichier | Temps |
|---|---|---|---|
| 7 | Architecture en couches (Layered) | `01-patterns-architecturaux/01-architecture-en-couches.md` | 1h |
| 8 | Architecture hexagonale (Ports & Adapters) | `01-patterns-architecturaux/02-architecture-hexagonale.md` | 1h15 |
| 9 | Clean Architecture | `01-patterns-architecturaux/03-clean-architecture.md` | 1h15 |
| 10 | Monolithe modulaire & API-First | `01-patterns-architecturaux/04-monolithe-modulaire.md` | 1h |
| 11 | Microservices Architecture | `01-patterns-architecturaux/05-microservices.md` | 1h30 |
| 12 | Vertical Slice Architecture | `01-patterns-architecturaux/06-vertical-slice.md` | 1h |
| 13 | 12-Factor App & Idempotency | `01-patterns-architecturaux/07-twelve-factor-idempotency.md` | 1h |

**Cours 10** : Headless architecture (séparation contenu/rendu), API-First / Contract-First design, architecture stateless-by-design pour containers. Quand le monolithe modulaire est le BON choix (spoiler : souvent).

**Cours 11** : Decomposition par domaine vs par capacité technique. Data per service. Service boundaries — quand couper, quand NE PAS couper. Service discovery (Kubernetes DNS, Consul). Anti-patterns : distributed monolith, nano-services, shared database. Decision framework : "as-tu VRAIMENT besoin de microservices ?" Analogie : la chaine de restaurants vs le restaurant unique avec plusieurs cuisines.

**Cours 13** : Les 12 facteurs (codebase, dependencies, config, backing services, build/release/run, processes, port binding, concurrency, disposability, dev/prod parity, logs, admin processes). Idempotency keys pour mutations API. Exactly-once processing. Retry-safe opérations. Pourquoi l'idempotence est critique pour le paiement e-commerce (fil rouge).

| Exercice | Fichier | Temps |
|---|---|---|
| 05 — Layered to Hexagonal | `exercices/05-layered-to-hexagonal/` | 1h |
| 06 — Vertical Slice d'un module | `exercices/06-vertical-slice-module/` | 1h |
| 07 — Decomposer un monolithe (microservices) | `exercices/07-decomposer-monolithe/` | 1h15 |
| 07b — Quand NE PAS decomposer | `exercices/07b-quand-ne-pas-decomposer/` | 45 min |
| 08 — 12-Factor checklist | `exercices/08-twelve-factor-checklist/` | 45 min |

---

## Module 02 — Domain-Driven Design (~8h)

> Le DDD, c'est apprendre a parler la langue de ton client avant d'écrire la moindre ligne de code.

| # | Cours | Fichier | Temps |
|---|---|---|---|
| 14 | Introduction au DDD & Ubiquitous Language | `02-domain-driven-design/01-introduction-ddd.md` | 1h |
| 15 | Bounded Contexts & Context Map | `02-domain-driven-design/02-bounded-contexts.md` | 1h15 |
| 16 | Entités, Value Objects, Agregats | `02-domain-driven-design/03-entites-vo-agregats.md` | 1h30 |
| 17 | Domain Events, Services & Workflows | `02-domain-driven-design/04-domain-events-services.md` | 1h15 |
| 18 | Repositories & Specifications | `02-domain-driven-design/05-repositories-specifications.md` | 1h |

**Cours 16** couvre aussi : UUID v4 comme identifiant (protection IDOR vs IDs sequentiels), Soft Deletes (status field vs suppression physique), champs `version` pour optimistic locking, colonnes JSON pour i18n (MultiLangField).

**Cours 17** couvre aussi : Finite State Machine pour workflows métier (Draft → Scheduled → Published → Archived avec `canTransitionTo()`), audit trail immutable (append-only log), cache invalidation déclenchée par les transitions d'état.

| Exercice | Fichier | Temps |
|---|---|---|
| 09 — Modéliser un domaine e-commerce | `exercices/09-modeliser-domaine/` | 1h |
| 10 — Bounded Contexts : ou couper ? | `exercices/10-bounded-contexts-pratique/` | 1h |
| 10b — Context Map entre 4 bounded contexts | `exercices/10b-context-map/` | 45 min |
| 11 — Implémenter une FSM de commande | `exercices/11-fsm-commande/` | 1h |

---

## Module 03 — Architecture Back-end (~13h)

> Le back-end, c'est la cuisine d'un restaurant : le client ne la voit pas, mais c'est la que tout se joue.

| # | Cours | Fichier | Temps |
|---|---|---|---|
| 19 | API Design REST | `03-architecture-backend/01-api-design-rest.md` | 1h15 |
| 20 | Middleware & Pipeline | `03-architecture-backend/02-middleware-pipeline.md` | 1h |
| 21 | Architecture d'authentification (OIDC, JWT, RBAC) | `03-architecture-backend/03-auth-architecture.md` | 1h30 |
| 22 | Multi-tenancy | `03-architecture-backend/04-multi-tenancy.md` | 1h15 |
| 23 | Data Access Patterns | `03-architecture-backend/05-data-access-patterns.md` | 1h15 |
| 24 | Validation & Error Handling | `03-architecture-backend/06-validation-error-handling.md` | 1h |
| 25 | Background Jobs & Queues | `03-architecture-backend/07-background-jobs-queues.md` | 1h |
| 26 | Concurrence & Asynchronisme | `03-architecture-backend/08-concurrence-asynchronisme.md` | 1h15 |

**Cours 19** : Conventions REST, ETag / optimistic locking (`If-Match`, `412 Precondition Failed`), serialization groups (`entity:read`, `entity:write`), RFC 7807 Problem Details, presigned URL upload flow (S3 direct upload), pagination serveur (cap 20-24 items). Analogie : le menu du restaurant (l'API) vs la cuisine (l'implémentation).

**Cours 21** : OAuth 2.0 / OIDC, Authorization Code + PKCE (pourquoi pas implicit flow), RS256 JWT validation, JWKS endpoint caching (Redis TTL + forced refresh on failure), role hierarchy, custom voters, auth adapter pattern (production OIDC vs mock dev), `SessionStorage` vs `localStorage` pour tokens, navigation guards ordonnees (restore session → check auth → check RBAC → allow → update title).

**Cours 22** : Schema-per-tenant (PostgreSQL `SET search_path`), Doctrine/TypeORM SQL Filters automatiques, 3 couches d'isolation (DB schema + query filter + storage prefix S3), multi-site dans un tenant (`X-Site-Id`), tenant extraction (JWT claim → header fallback), per-tenant backup (`pg_dump -n`), storage quota enforcement, per-tenant observability tagging.

**Cours 23** : Repository pattern, Unit of Work, DAO, Active Record vs Data Mapper. Content versioning diff-based (snapshot v1 + diffs v2+, reconstruction O(n) ~5ms pour v10, 92% storage réduction). Rollback non-destructif (créer une nouvelle version, jamais supprimer l'historique). Presigned URL flow (request → upload → confirm → deduplicate SHA256).

**Cours 24** : Validation en couches (DTO → domain → persistence), RFC 7807 error format, field-level violations, error handling par code HTTP (412→ETag refresh, 422→violations, 401→logout, 429→retry-after). Fail-fast principle.

**Cours 26 (NOUVEAU)** : Event loop Node.js, thread pool, process model (PHP-FPM, Gunicorn). Race conditions, deadlocks, starvation. Locks : optimistic (version field) vs pessimistic (`SELECT FOR UPDATE`), advisory locks PostgreSQL, Redis `SETNX` pour distributed locking. `async/await`, Promises, backpressure. Database isolation levels (Read Committed, Repeatable Read, Serializable) — quand utiliser lequel. Worker threads vs cluster mode. Analogie : la cuisine avec 1 chef (single-thread event loop) vs 10 chefs (multi-process) vs 10 cuisines (multi-node).

| Exercice | Fichier | Temps |
|---|---|---|
| 12 — API REST NestJS (CRUD + ETag) | `exercices/12-api-rest-nestjs/` | 1h |
| 13 — Auth OIDC + RBAC | `exercices/13-auth-oidc-rbac/` | 1h |
| 14 — Multi-tenant isolation | `exercices/14-multi-tenant-isolation/` | 1h |
| 14b — Multi-site dans un tenant | `exercices/14b-multi-site/` | 45 min |
| 15 — Job queue avec BullMQ | `exercices/15-job-queue-bullmq/` | 45 min |
| 16 — Race condition & locking | `exercices/16-race-condition-locking/` | 1h |

---

## Module 04 — Architecture Base de Données (~10h)

> La base de données, c'est la mémoire a long terme de ton application. Si elle est mal organisee, tout ralentit.

| # | Cours | Fichier | Temps |
|---|---|---|---|
| 27 | Modélisation relationnelle avancee | `04-architecture-bdd/01-modelisation-relationnelle.md` | 1h15 |
| 28 | Migrations & Content Versioning | `04-architecture-bdd/02-migrations-versioning.md` | 1h |
| 29 | Indexation & Performance | `04-architecture-bdd/03-indexation-performance.md` | 1h15 |
| 30 | Patterns lecture/écriture | `04-architecture-bdd/04-patterns-lecture-ecriture.md` | 1h15 |
| 31 | NoSQL & Polyglot Persistence | `04-architecture-bdd/05-nosql-polyglot-persistence.md` | 1h |
| 32 | Search Architecture | `04-architecture-bdd/06-search-architecture.md` | 1h15 |

**Cours 27** : UUID v4 comme PK (IDOR prevention), colonnes JSON pour i18n (`MultiLangField { fr, en, nl }`), champs partages obligatoires (`id`, `site`, `created_at`, `updated_at`, `version`), soft deletes via champ `status`, dual-database architecture (master DB + tenant schemas).

**Cours 28** : Migrations up/down, schema versioning, zero-downtime migrations (expand-contract). Content versioning pattern (diff-based : snapshot v1 + diffs v2+, 92% réduction, O(n) ~5ms reconstruction). Schema-per-tenant migration stratégies.

**Cours 29** : B-tree, GIN, GiST. `tsvector` + GIN pour full-text search. `EXPLAIN ANALYZE`. Partial indexes. Covering indexes. Query planner. Analogie : l'index d'un livre vs lire page par page.

**Cours 30** : Read replicas, materialized views, séparation lecture/écriture. Redis namespace convention (`{app}:{feature}:{key}`). Quand denormaliser. CQRS côté DB (preview avant le cours dédié Module 07).

**Cours 31** : Document stores (MongoDB), key-value (Redis), column-family (Cassandra), graph (Neo4j), time-series (TimescaleDB). Polyglot persistence : chaque problème sa BDD. Quand NE PAS utiliser NoSQL.

**Cours 32 (NOUVEAU)** : PostgreSQL full-text search (`tsvector`, `plainto_tsquery`, `ts_rank`). Elasticsearch : BM25, field boosting (title 3x, body 1x), per-tenant indices (`cms_{tenant}_{site}`), RBAC au query time. Search abstraction layer (`SearchProvider` interface pour swap Elasticsearch → Meilisearch). Semantic/vector search (embeddings, ANN, reciprocal rank fusion BM25 + vector). Search debounce (300ms), cache Redis 5min. Analogie : la bibliothecaire (full-text) vs le GPS (vector search).

| Exercice | Fichier | Temps |
|---|---|---|
| 17 — Schema e-commerce PostgreSQL | `exercices/17-schema-ecommerce/` | 1h |
| 18 — Optimisation de requêtes (EXPLAIN) | `exercices/18-optimisation-requetes/` | 45 min |
| 18b — Full-text search PostgreSQL | `exercices/18b-fulltext-search/` | 45 min |
| 19 — Polyglot persistence : quel store pour quel besoin ? | `exercices/19-polyglot-persistence/` | 45 min |
| 20 — Search abstraction layer | `exercices/20-search-abstraction/` | 1h |

---

## Module 05 — Architecture Front-end (~16h)

> Le front-end, c'est la salle du restaurant : l'experience client dépend de l'agencement, de la fluidite du service, de l'ambiance.

| # | Cours | Fichier | Temps |
|---|---|---|---|
| 33 | Component Architecture | `05-architecture-frontend/01-component-architecture.md` | 1h15 |
| 34 | State Management Patterns | `05-architecture-frontend/02-state-management.md` | 1h30 |
| 35 | Routing & Navigation | `05-architecture-frontend/03-routing-navigation.md` | 1h |
| 36 | Data Fetching Patterns | `05-architecture-frontend/04-data-fetching-patterns.md` | 1h15 |
| 37 | Design Tokens & Design Systems | `05-architecture-frontend/05-design-tokens-systems.md` | 1h30 |
| 38 | Stratégies de rendu (SSR, SSG, ISR, Hybride) | `05-architecture-frontend/06-strategies-de-rendu.md` | 1h30 |
| 39 | Performance Front-end | `05-architecture-frontend/07-performance-frontend.md` | 1h15 |
| 40 | i18n & SEO Architecture | `05-architecture-frontend/08-i18n-seo-architecture.md` | 1h15 |
| 41 | Micro-frontends | `05-architecture-frontend/09-micro-frontends.md` | 1h15 |
| 42 | Offline-first & PWA | `05-architecture-frontend/10-offline-first-pwa.md` | 1h |

**Cours 33** : Headless components (logique sans style), atom design (27 primitives UI typées), component registry (blockType → component), block/plugin component system, composants fonctionnels + hooks React, Adapter pattern (Unlayer adapter boundary : découpler un éditeur tiers sans ralentir la livraison). Error Boundaries & graceful degradation.

**Cours 34** : Store patterns (Zustand/Redux Toolkit/Jotai), réactive state via `useState`/`useMemo`, ETag tracking par entité (`Map<string, string>`), error handling par code HTTP (412→refresh, 422→violations, 401→logout), BroadcastChannel pour synchronisation cross-tab (theme, dark mode), `localStorage` vs `SessionStorage` stratégies. SpeedDial context-aware pattern.

**Cours 35** : Route-level code splitting (`import()` dynamique), route guards ordonnees (auth → RBAC → title), `RouteMeta` typing pour RBAC, protected routes (`noindex, nofollow` + exclusion sitemap), breadcrumbs depuis la hiérarchie de routes (pas depuis les menus), canonical URLs per-page.

**Cours 36** : AbortController (cancel on unmount/route change), debounce patterns (300ms search, 800ms BO), Stale-While-Revalidate (servir le cache stale pendant revalidation), request priority system (critical/high/normal/low + timeouts adaptatifs SSR 2s vs client 10s), retry avec exponential backoff (1s→2s→5s, max 2), `ApiResponse<T>` wrapper, `HydraCollection<T>` envelope.

**Cours 37** : Architecture Design Tokens complete : JSON source files → build pipeline (`generate-design-tokens.mjs`) → CSS custom properties. Token layering (global → semantic → component). Génération de palettes OKLCH depuis une couleur brand (50-950 shades). Theme = token set + templates structurels. Theme résolution cascade (defaults → variation overrides → site settings → custom CSS). Hot-swapping runtime (CSS vars, zero rebuild). Zero hardcoded hex colors rule. Dark mode via semantic token switching + `.dark` class + `color-scheme` + `data-theme`. BroadcastChannel cross-tab theme sync. Flowbite adapter pattern. Custom fonts avec `font-display: swap` obligatoire (max 5 familles). CSS logical properties pour RTL.

**Cours 38** : SSR — rendu côté serveur, TTFB, SEO. SSG — pre-rendu build-time, pages immuables, CDN-cacheable. ISR — revalidation on-demand. Hybride — classification par type de route (ultra-statique / editorial / dynamique / authentifie). Hydration stratégies : `on-visible` (Intersection Observer), `on-idle` (requestIdleCallback), `on-interaction` (user event), partial hydration / islands architecture. **FOUC prevention** : injection des tokens CSS dans `<head>` côté serveur AVANT le paint (`utils/inlineTokensCSS.ts`). **Personalization Shell Pattern** : HTML public CDN-cache + skeleton placeholders → client-side fetch pour widgets prives (évité `Vary: Cookie`). Streaming SSR. React Server Components (RSC). Delay hydration (2s defer production). Anti-unfurl middleware pour preview tokens. Next.js App Router / Remix comparaison.

**Cours 39** : Performance budgets (HTML ≤80KB gzip, JS ≤200KB gzip, TTFB ≤600ms). Core Web Vitals (LCP <2.5s, CLS <0.1, INP <200ms). Code splitting en vendor chunks nommés (react, react-dom, router, i18n, charts...). Blurhash placeholders. `<link rel="preconnect">` hints. Lazy loading images (defaut) + eager pour LCP. Critical CSS inline (above-fold). `useWebVitals` hook pour RUM. Lighthouse CI gates (score ≥90). `web-vitals` library, `useAboveFold`. Analogie : le temps de chargement d'un journal (above the fold = ce qu'on voit avant de deplier).

**Cours 40 (NOUVEAU)** : Deux concepts d'i18n (UI locale vs content locale). `MultiLangField` JSON (per-field switcher). Per-locale slugs avec transliteration fallback. URL prefix strategy (`/{locale}/...`). `hreflang` tags automatiques (`useHead`). XML sitemaps per-locale avec sitemap index. Locale fallback composable (`useLocaleFallback`). Published slug protection + auto-301 redirect. AI-powered translations (human-correctable). GMT storage + client-side timezone détection. **SEO** : canonical URLs (`<link rel="canonical">`), structured data schema.org, Open Graph + Twitter Cards auto-générés, breadcrumbs depuis route hierarchy, `noindex` pages protégées, redirect chain collapsing (post-persist listener).

**Cours 41 (NOUVEAU)** : Module Federation (Webpack 5 / Vite), Single-SPA, iframe composition. Shared dependencies. Routing inter-micro-frontends. Web Components comme frontiere. Communication inter-apps (Custom Events, shared state). Quand NE PAS faire de micro-frontends. Analogie : le centre commercial (chaque boutique est independante mais partage le batiment).

**Cours 42 (NOUVEAU)** : Service Workers (lifecycle : install, activate, fetch). Cache stratégies (Cache First, Network First, Stale-While-Revalidate au niveau SW). Background Sync. IndexedDB pour données locales. Push notifications. Manifest.json. `navigator.onLine`. Conflict résolution (last-write-wins vs merge). Analogie : l'avion en mode avion — tout doit marcher sans réseau.

| Exercice | Fichier | Temps |
|---|---|---|
| 21 — Component tree e-commerce | `exercices/21-component-tree/` | 1h |
| 22 — Design tokens + theme switcher dark/light | `exercices/22-design-tokens-theme/` | 1h15 |
| 23 — SSR/ISR hybrid routing | `exercices/23-ssr-isr-hybrid/` | 1h |
| 24 — Performance audit Lighthouse | `exercices/24-performance-audit/` | 45 min |
| 25 — i18n + hreflang + sitemap | `exercices/25-i18n-hreflang/` | 1h |
| 25b — SEO audit (canonical, OG, structured data) | `exercices/25b-seo-audit/` | 45 min |
| 26 — Micro-frontend avec Module Federation | `exercices/26-micro-frontend/` | 1h |
| 27 — PWA offline-first | `exercices/27-pwa-offline/` | 1h |

---

## Module 06 — Communication & Intégration (~10h)

> L'intégration, c'est le réseau routier entre les villes : peu importe la beaute de chaque ville, sans routes, rien ne circule.

| # | Cours | Fichier | Temps |
|---|---|---|---|
| 43 | Fondamentaux réseau pour architectes | `06-communication-integration/01-fondamentaux-reseau.md` | 1h15 |
| 44 | REST avance (ETag, versioning, pagination) | `06-communication-integration/02-rest-avance.md` | 1h15 |
| 45 | GraphQL & gRPC | `06-communication-integration/03-graphql-grpc.md` | 1h30 |
| 46 | WebSockets & Real-time | `06-communication-integration/04-websockets-realtime.md` | 1h |
| 47 | Event-driven, Webhooks & Message Queues | `06-communication-integration/05-event-driven-messaging.md` | 1h15 |
| 48 | API Gateway & BFF | `06-communication-integration/06-api-gateway-bff.md` | 1h |

**Cours 43 (NOUVEAU)** : HTTP/1.1 (head-of-line blocking) vs HTTP/2 (multiplexing, server push, HPACK) vs HTTP/3 (QUIC, 0-RTT, UDP). TLS 1.3 handshake (1-RTT vs 0-RTT), certificate pinning, mTLS inter-services. DNS résolution, TTL, failover DNS. TCP connection pooling, keep-alive. WebSocket upgrade handshake. SSE vs long polling (le "pourquoi" réseau). Analogie : HTTP/1.1 = une autoroute a 1 voie, HTTP/2 = 6 voies, HTTP/3 = un helicoptere.

**Cours 44** : HATEOAS, URL versioning (`/v1/`), déprécation headers. ETag conditionnel (`If-Match`, `If-None-Match`). Pagination cursor vs offset (cap serveur). `Vary` header stratégies. Content negotiation (JSON-LD, Hydra). API governance (style guides, changelog, backward compatibility). Analogie : le menu avec versions saisonnieres.

**Cours 45** : GraphQL (schema, resolvers, N+1 DataLoader, subscriptions, persisted queries, security : depth limiting, cost analysis). gRPC (Protocol Buffers, unary/streaming, code génération, HTTP/2 obligatoire, quand gRPC vs REST vs GraphQL). Analogie : REST = courrier postal, GraphQL = liste de courses, gRPC = talkie-walkie.

**Cours 47** : Architecture webhook complete : HMAC-SHA256 signature (`X-Webhook-Signature`), exponential backoff retry (3 tentatives), auto-disable après 10 echecs consecutifs, vocabulaire standard (`content.published`, `media.uploaded`, `form.submitted`). Symfony Messenger / BullMQ pour dispatch async. Kafka event bus. n8n intégration middleware (éviter le connector sprawl). AsyncAPI spécification.

**Cours 48** : BFF pour tokens d'authentification (garder les tokens côté serveur). API Gateway patterns (routing, auth, rate limiting, response aggregation). Délégation OIDC vers un espace prive. Service mesh (Istio/Linkerd) — mTLS transparent, observabilité via sidecar.

| Exercice | Fichier | Temps |
|---|---|---|
| 28 — HTTP/2 vs HTTP/1.1 benchmark | `exercices/28-http2-benchmark/` | 45 min |
| 29 — API REST avancee (ETag + pagination cursor) | `exercices/29-api-rest-avancee/` | 1h |
| 30 — Webhook system avec HMAC | `exercices/30-webhook-hmac/` | 1h |
| 30b — Consumer webhook avec retry | `exercices/30b-webhook-consumer/` | 45 min |
| 31 — BFF pour e-commerce | `exercices/31-bff-ecommerce/` | 1h |

---

## Module 07 — Patterns distribues (~11h)

> Les systèmes distribues, c'est comme gérer une chaine de restaurants : chaque site est autonome, mais il faut que les recettes et les stocks restent cohérents.
>
> **Chevauchement avec 11-Distributed Systems** : les cours CQRS, saga et circuit breaker sont aussi traites dans le cours 11. Ici l'angle est architectural (quand les utiliser, patterns de conception). Dans le cours 11, l'angle est implementation distribuee (CAP, consensus, CRDTs). Les deux se completent.

| # | Cours | Fichier | Temps |
|---|---|---|---|
| 49 | Théorie des systèmes distribues (CAP, PACELC) | `07-patterns-distribues/01-theorie-systemes-distribues.md` | 1h15 |
| 50 | CQRS | `07-patterns-distribues/02-cqrs.md` | 1h15 |
| 51 | Event Sourcing & Outbox Pattern | `07-patterns-distribues/03-event-sourcing-outbox.md` | 1h30 |
| 52 | Saga Pattern | `07-patterns-distribues/04-saga-pattern.md` | 1h15 |
| 53 | Résilience, Chaos Engineering & Disaster Recovery | `07-patterns-distribues/05-resilience-chaos-dr.md` | 1h30 |
| 54 | Strangler Fig & Migration progressive | `07-patterns-distribues/06-strangler-fig-migration.md` | 1h |
| 55 | Consistency Patterns avances | `07-patterns-distribues/07-consistency-patterns.md` | 1h |

**Cours 49 (NOUVEAU)** : CAP theorem (Consistency, Availability, Partition tolerance — pick 2). PACELC (extension : en cas de Partition, choix A/C ; sinon, choix Latency/Consistency). Modèles de consistance : strong (linearizable), eventual, causal, session consistency. Consensus algorithms (Raft — conceptuel). Two Generals Problem. Fallacies of distributed computing. Analogie : les horloges dans les gares — comment synchroniser 100 gares sans telephone fiable.

**Cours 50** : Séparation Command (écriture) / Query (lecture). Surrogate-key cache invalidation (tag-based purge CDN). Modèles de read store (même DB denormalisee, read replica, projection Elasticsearch). Quand CQRS est overkill (spoiler : pour la plupart des CRUDs).

**Cours 51** : Event Sourcing (stocker les events, pas l'état). Event store, snapshots, replay, projection. **Outbox Pattern** : transactional outbox pour event publishing fiable (INSERT event dans la même transaction que la modification). Change Data Capture (CDC) avec Debezium. Quand Event Sourcing fait plus de mal que de bien.

**Cours 53 (ENRICHI)** : Circuit Breaker (states: closed → open → half-open). Bulkhead pattern. Timeout cascading. Retry avec backoff + jitter. **Chaos Engineering** : principes Netflix, fault injection, game days, Litmus/Gremlin. **Disaster Recovery** : RPO (Recovery Point Objective), RTO (Recovery Time Objective), failover automatique, backup stratégies, runbooks. Circuit breaker sur endpoints externes (JWKS, webhooks). Analogie : le disjoncteur electrique — il coupe le courant AVANT que la maison brule.

**Cours 55 (NOUVEAU)** : Distributed locking (Redis SETNX, advisory locks PG). Leader election. Distributed clock : Lamport timestamps (conceptuel). Eventual consistency in practice : conflict résolution stratégies (last-write-wins, merge, CRDT preview). Idempotent consumers. Exactly-once delivery (myth vs reality).

| Exercice | Fichier | Temps |
|---|---|---|
| 32 — CAP : classifier des systèmes réels | `exercices/32-cap-classifier/` | 45 min |
| 33 — CQRS catalogue/commandes | `exercices/33-cqrs-catalogue-commandes/` | 1h |
| 34 — Saga de commande e-commerce | `exercices/34-saga-commande/` | 1h15 |
| 35 — Outbox pattern implémentation | `exercices/35-outbox-pattern/` | 1h |
| 36 — Game day : simuler une panne | `exercices/36-game-day-panne/` | 1h |

---

## Module 08 — Sécurité (~10h)

> La sécurité, c'est le système immunitaire de ton application : invisible quand tout va bien, vital quand une menace arrive.

| # | Cours | Fichier | Temps |
|---|---|---|---|
| 56 | OWASP Top 10 & Threat Modeling (STRIDE) | `08-securite/01-owasp-stride.md` | 1h30 |
| 57 | Architecture Zero Trust | `08-securite/02-zero-trust.md` | 1h15 |
| 58 | CSP, Trusted Types, SRI & Security Headers | `08-securite/03-csp-trusted-types-sri.md` | 1h15 |
| 59 | Rate Limiting & CORS | `08-securite/04-rate-limiting-cors.md` | 1h |
| 60 | Sandboxing & Extension Security | `08-securite/05-sandboxing-extensions.md` | 1h |
| 61 | Privacy by Design & GDPR | `08-securite/06-privacy-by-design.md` | 1h |

**Cours 56 (ENRICHI)** : Les 10 vulnérabilités OWASP + prevention concrete. IDOR (UUIDs vs IDs sequentiels), injection (parameterized queries + ORM filters), XSS (sanitization double : client + serveur, HTMLPurifier), CSRF (state param + `crypto.getRandomValues()`). **Threat Modeling STRIDE** : Spoofing, Tampering, Repudiation, Information Disclosure, DoS, Elevation of Privilege. Data flow diagrams, trust boundaries, menace par composant. L'architecte identifie les menaces AVANT qu'elles existent.

**Cours 57** : Never trust, always verify. Microsegmentation. mTLS entre services. Least privilege. Default-deny network egress (Kubernetes namespace). Zero trust networking vs perimeter security. Identity-based access (pas IP-based). Analogie : l'aeroport — chaque zone a son propre controle de sécurité.

**Cours 58** : CSP hash-only (SHA-256 computed at build time, zero `unsafe-inline`/`unsafe-eval`), Next.js middleware `middleware.ts` pour injection CSP. Trusted Types (report-only en v1, enforcement futur, `require-trusted-types-for 'script'`). Subresource Integrity (SRI hashes sur assets tiers). CSP violation reporting endpoint avec rate limiting. Security headers complets (`X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, `Strict-Transport-Security`).

**Cours 59** : Sliding window rate limiting, Redis INCR+EXPIRE, compteurs per-tenant, GDPR-safe keys (`SHA-256(IP + pepper)`), headers `X-Rate-Limit-*`. CORS : `Access-Control-Allow-Origin`, preflight requests, allowed/exposed headers, `nelmio/cors` pattern. Supply chain security (SBOM, lockfile integrity, Sigstore).

**Cours 60** : Sandboxed iframes (`sandbox` attributes restrictifs), Shadow DOM encapsulation, `postMessage` avec origin checks stricts. Plugin manifest trust (HMAC challenge-response, auto-disable on failure). CSP-scoped plugin assets (hosts declares dans le manifest). Custom CSS guardrails (15KB limit, patterns interdits : `!important` sur tokens, `*{}`, `@import`, `url(http...)`, scope `#site-root`). Feature flags pour activer/désactiver des capacités.

**Cours 61** : Privacy by Design (7 principes de Cavoukian). GDPR architecture (data residency EU, retention 90j logs, pseudonymisation PII, droit a l'oubli technique). CMP : collecte consentement par categorie, aucun script avant consentement, cookie first-party + audit log serveur, évolution ePrivacy/DSA. PII-free analytics (`crypto.randomUUID()` session). FinOps AI metering (par feature/site/client). EU AI Act risk register.

| Exercice | Fichier | Temps |
|---|---|---|
| 37 — Threat model STRIDE d'une feature | `exercices/37-threat-model-stride/` | 1h |
| 38 — Sécuriser une API NestJS | `exercices/38-securiser-api/` | 1h |
| 39 — CSP hash-only implémentation | `exercices/39-csp-hash-only/` | 1h |
| 40 — Audit de sécurité complet | `exercices/40-audit-securite/` | 1h |
| 41 — Implémenter un CMP | `exercices/41-implementer-cmp/` | 45 min |

---

## Module 09 — Performance & Scalabilite (~9h)

> La scalabilité, c'est construire un pont qui tient a 10 voitures, mais qui peut s'elargir a 10 000 sans tout reconstruire.

| # | Cours | Fichier | Temps |
|---|---|---|---|
| 62 | Caching multi-niveaux | `09-performance-scalabilite/01-caching-multi-niveaux.md` | 1h15 |
| 63 | CDN, Edge Computing & Image Pipeline | `09-performance-scalabilite/02-cdn-edge-images.md` | 1h15 |
| 64 | Load Balancing | `09-performance-scalabilite/03-load-balancing.md` | 1h |
| 65 | Scaling, Capacity Planning & Cloud-Native | `09-performance-scalabilite/04-scaling-cloud-native.md` | 1h30 |
| 66 | Sharding & Réplication | `09-performance-scalabilite/05-sharding-replication.md` | 1h |
| 67 | Serverless Architecture | `09-performance-scalabilite/06-serverless.md` | 1h |

**Cours 62** : 3 layers (Nitro/Redis server + in-memory Map + localStorage 5MB). Tag-aware Redis cache pools (TTL par type). Surrogate-key invalidation (purge CDN selective). ETag / `If-None-Match` à chaque couche. Stale-While-Revalidate fallback. Cache par route (public CDN / private browser / none). Redis namespace convention (`{app}:{feature}:{key}`). Analogie : les 3 mémoires humaines (registres CPU = mémoire de travail, RAM = mémoire court terme, disque = mémoire long terme).

**Cours 63** : Edge-first delivery (cache-first SSR, sub-600ms TTFB EU). Surrogate-key response headers. CDN cache purge on publish. Image optimization pipeline : WebP/AVIF conversion automatique, `srcset` responsive, lazy loading par defaut, on-the-fly resizing (imgproxy/Thumbor, `?w=800&h=600&fit=cover`), focal-point cropping metadata (`object-position` CSS), SHA256 deduplication, S3 presigned URLs. `<link rel="preconnect">` hints.

**Cours 64** : Round-robin, least connections, IP hash, weighted. Layer 4 vs Layer 7. Health checks. Session affinity (sticky sessions — quand c'est nécessaire, quand c'est un anti-pattern). Kubernetes Services et Ingress.

**Cours 65 (ENRICHI)** : Horizontal vs vertical. Stateless containers (pas d'état in-process, tout dans services externes : PG, Redis, S3). Horizontal pod autoscaling Kubernetes (CPU, memory, custom metrics). Per-tenant observability pour scaling decisions. **Capacity planning** : Little's Law (L = lambda * W), throughput, backpressure. **Cloud-Native patterns** : Sidecar, Ambassador, Init Container. **Multi-region** : geo-distribution, data sovereignty, latency-based routing.

**Cours 67 (NOUVEAU)** : Lambda / Cloud Functions, cold starts, provisioned concurrency. Event-driven compute (S3 triggers, queue triggers, HTTP triggers). FaaS vs CaaS (containers). Quand serverless vs containers (decision framework). Edge Functions (Cloudflare Workers, Vercel Edge). Cout : pay-per-invocation vs reserved. Analogie : le taxi (serverless — tu paies la course) vs la voiture de fonction (container — tu paies le parking même quand tu roules pas).

| Exercice | Fichier | Temps |
|---|---|---|
| 42 — Stratégie de cache multi-niveaux | `exercices/42-cache-multi-niveaux/` | 1h |
| 43 — CDN + image pipeline | `exercices/43-cdn-image-pipeline/` | 1h |
| 44 — Capacity planning : dimensionner un système | `exercices/44-capacity-planning/` | 1h |
| 45 — Serverless vs containers : decision framework | `exercices/45-serverless-vs-containers/` | 45 min |

---

## Module 10 — Observabilité & DevOps (~8h)

> L'observabilité, c'est le tableau de bord d'un avion : sans instruments, tu voles a l'aveugle.

| # | Cours | Fichier | Temps |
|---|---|---|---|
| 68 | Logging structure | `10-observabilite-devops/01-logging-structure.md` | 1h15 |
| 69 | Monitoring, Alerting & SLOs | `10-observabilite-devops/02-monitoring-alerting-slos.md` | 1h15 |
| 70 | Distributed Tracing | `10-observabilite-devops/03-distributed-tracing.md` | 1h15 |
| 71 | Architecture CI/CD, Feature Flags & Deployment Stratégies | `10-observabilite-devops/04-cicd-feature-flags-deploy.md` | 1h15 |
| 72 | Infrastructure as Code | `10-observabilite-devops/05-infrastructure-as-code.md` | 1h |

**Cours 68** : Logging structure JSON. Resource attributes (`service.name`, `tenant.id`, `environment`). PII-free logging (hash/pseudonymisation, retention 90j). `entity.action` event naming convention. Standard payload fields (`siteId`, `userRole`, `timestamp` ISO 8601, `locale`, `sessionId`). Log levels (quand ERROR vs WARN vs INFO). Correlation IDs.

**Cours 69** : OpenTelemetry 3 signaux (metrics Prometheus/Mimir, traces Tempo, logs Loki). SLOs formels : API p95 ≤300ms, disponibilité ≥99.9%, Lighthouse ≥90, TTFB ≤600ms, cache hit ratio ≥85%, error rate ≤1%/5min. Error-budget burn alerts (multi-window, multi-burn-rate). RUM via `useWebVitals` → OpenTelemetry. Dashboards Grafana par tenant/page/geo. FinOps metering hooks. Analogie : le SLO = la promesse au client, l'error budget = le credit de confiance.

**Cours 70** : Sampling strategy (1% prod, 100% staging). Correlation cross-service. Trace context propagation (W3C Trace Context). Spans, traces, baggage. Jaeger / Tempo. Quand le tracing resout des problèmes que le logging seul ne peut pas.

**Cours 71 (ENRICHI)** : Helm charts (per-environment values files). Init containers pour migrations DB. Health checks (liveness/readiness/startup probes). Container security scanning (Trivy, Grype). k6 load testing en CI (smoke 2min sur MR, full nightly). Lighthouse CI quality gates. GitOps (egress policy via merge request). **Feature flags** : env variable (`NEXT_PUBLIC_*`), middleware guard (`403` si flag off), incremental rollout, kill switch. **Deployment stratégies** : Blue/Green, Canary (progressive traffic shifting), Rolling update, A/B deploy. Zero-downtime deployment. **Branching stratégies** : trunk-based development vs GitFlow vs GitHub Flow.

**Cours 72** : Terraform / Pulumi / CDK. State management. Modules reusables. Drift détection. Immutable infrastructure vs mutable. GitOps (ArgoCD, Flux). Analogie : le plan de l'architecte (IaC) vs construire a l'intuition (click-ops).

| Exercice | Fichier | Temps |
|---|---|---|
| 46 — Pipeline d'observabilité (logs + traces + metrics) | `exercices/46-pipeline-observabilite/` | 1h |
| 47 — Définir des SLOs et error budgets | `exercices/47-slos-error-budgets/` | 45 min |
| 48 — Pipeline CI/CD avec feature flags | `exercices/48-cicd-feature-flags/` | 1h |
| 49 — Blue/Green deployment | `exercices/49-blue-green-deploy/` | 45 min |

---

## Module 11 — Testing Architecture (~7h)

> Les tests, c'est le filet de sécurité sous le trapeziste : ils ne l'empechent pas de tomber, mais ils lui permettent d'oser.

| # | Cours | Fichier | Temps |
|---|---|---|---|
| 73 | Pyramide de tests & Accessibilité | `11-testing-architecture/01-pyramide-tests-a11y.md` | 1h15 |
| 74 | Test doubles & patterns | `11-testing-architecture/02-test-doubles-patterns.md` | 1h15 |
| 75 | Contract Testing | `11-testing-architecture/03-contract-testing.md` | 1h |
| 76 | Load Testing & Testing in Production | `11-testing-architecture/04-load-testing-production.md` | 1h |

**Cours 73** : Pyramide (unit → intégration → E2E). Quand inverser la pyramide (honeycomb). Accessibility testing : axe-core WCAG 2.1 AA, RGAA compliance, keyboard a11y (skip links, focus traps, touch targets WCAG 2.5.8), `prefers-reduced-motion` respect, Playwright + axe intégration. 3 niveaux E2E : user flows critiques, SEO meta tags, security headers (CSP, K8s probes).

**Cours 74** : Mocks, stubs, spies, fakes, dummy. MSW (Mock Service Worker) pour tests API. Auth mock pattern (prod OIDC vs dev mock auth via env variable). Test containers. Quand mocker, quand ne PAS mocker.

**Cours 75** : Consumer-driven contract testing (Pact). Provider vérification. Schema testing (OpenAPI). Quand les contract tests remplacent les tests d'intégration. Analogie : le contrat entre le restaurateur et le fournisseur — les deux s'engagent sur un format.

**Cours 76** : k6 profiles (smoke/load/stress/spike/soak). Synthetic monitoring. Matomo RUM. AI quality testing (BLEU/ROUGE baselines, cross-model grading). Testing in production : feature flags, canary analysis, observability-driven testing. Analogie : tester le pont avec des camions charges AVANT l'ouverture au public.

| Exercice | Fichier | Temps |
|---|---|---|
| 50 — Stratégie de test e-commerce (pyramide) | `exercices/50-strategie-test-ecommerce/` | 1h |
| 51 — Contract tests API (Pact) | `exercices/51-contract-tests-pact/` | 1h |
| 51b — MSW mock layer | `exercices/51b-msw-mock-layer/` | 45 min |
| 52 — Load test k6 | `exercices/52-load-test-k6/` | 45 min |

---

## Module 12 — Architecture dans la vraie vie (~10h)

> L'architecture, ce n'est pas un dessin sur un tableau blanc — c'est un processus vivant qui evolue avec l'équipe et le produit.

| # | Cours | Fichier | Temps |
|---|---|---|---|
| 77 | Documentation d'architecture (ADR, C4) | `12-architecture-pratique/01-documentation-architecture.md` | 1h15 |
| 78 | Architecture Review & Code Review | `12-architecture-pratique/02-architecture-review.md` | 1h |
| 79 | Dette technique & Refactoring stratégique | `12-architecture-pratique/03-dette-technique.md` | 1h |
| 80 | Stratégies de migration | `12-architecture-pratique/04-strategies-migration.md` | 1h |
| 81 | Plugin & Extension Architecture | `12-architecture-pratique/05-plugin-extension-architecture.md` | 1h15 |
| 82 | Conway's Law, Team Topologies & Communication | `12-architecture-pratique/06-conway-team-topologies.md` | 1h15 |
| 83 | Evolutionary Architecture, FinOps & Wardley Mapping | `12-architecture-pratique/07-evolutionary-finops-wardley.md` | 1h15 |

**Cours 77** : Architecture Decision Records (ADR) — template, quand écrire, historique des decisions. Modèle C4 (Context, Container, Component, Code). Documentation as product (living contracts, pas de doc morte). Three-audience documentation (AI agents, developers, non-tech users). Monorepo vs polyrepo (Nx, Turborepo, pnpm workspaces).

**Cours 78** : Architecture review checklist. ATAM (Architecture Tradeoff Analysis Method). Code review vs architecture review. Fitness functions automatisees (tests qui verifient les invariants archi). Lightweight Architecture Decision Records (LADR) en pull request.

**Cours 79** : Types de dette (deliberee vs accidentelle, prudente vs imprudente — quadrant de Fowler). Mesurer la dette (code coverage, cyclomatic complexity, coupling). Prioriser : matrice impact/effort. Refactoring stratégique vs tactique. Boy Scout Rule.

**Cours 80** : Strangler Fig pattern. Pre-flight diff report (analyse avant migration : pages, broken links, redirect map). AI HTML-to-block conversion (~95% quality target). Redirect seeding (legacy URLs → new URLs). Redirect chain collapsing (post-persist listener). Zero-downtime migration stratégies.

**Cours 81** : Plugin manifest schema (YAML declaratif : routes, widgets, rbacScopes, endpoints, events emits/listens, egress hosts). Route mount blocks (nested routes dans une page CMS). Block variant system (`variantResolver(blockType, template, structure) → component`). Widget registry endpoint. Challenge-based health check. Adapter boundary pattern (Unlayer — limiter le cout d'un futur remplacement). Search abstraction layer (`SearchProvider` interface).

**Cours 82 (NOUVEAU)** : Conway's Law — "les organisations conçoivent des systèmes qui sont des copies de leurs structures de communication". Inverse Conway Maneuver. **Team Topologies** : 4 types d'équipe (stream-aligned, platform, enabling, complicated-subsystem). 3 modes d'interaction (collaboration, X-as-a-Service, facilitation). Impact sur l'architecture (si 4 équipes → 4 services). Architecture Communication : présenter au CTO ≠ aux devs ≠ au PO. Pitcher un ADR, defendre un trade-off, vulgariser une decision technique.

**Cours 83 (NOUVEAU)** : **Evolutionary Architecture** : architecture qui evolue avec le produit. Fitness functions (tests automatises pour invariants : "le bundle JS ne dépasse jamais 200KB", "aucune dépendance cyclique entre modules"). Guided vs unguided change. Incremental change. **FinOps** : cost architecture, right-sizing, reserved vs spot, cost per request, build vs buy decision framework. **Wardley Mapping** : chaine de valeur, évolution (genesis → custom → product → commodity), strategic plays (build, buy, outsource). Analogie : la carte geographique vs le plan de bataille.

| Exercice | Fichier | Temps |
|---|---|---|
| 53 — ADR + diagramme C4 du fil rouge | `exercices/53-adr-c4-fil-rouge/` | 1h |
| 54 — Fitness functions automatisees | `exercices/54-fitness-functions/` | 1h |
| 55 — Team Topologies : reorganiser une équipe | `exercices/55-team-topologies/` | 45 min |
| 56 — Wardley Map d'un produit SaaS | `exercices/56-wardley-map/` | 1h |

---

## Module 13 — Culture architecturale elargie (~8h)

> Un architecte expert ne connait pas que son domaine — il comprend les ecosystemes voisins pour mieux concevoir le sien.

| # | Cours | Fichier | Temps |
|---|---|---|---|
| 84 | Architecture mobile (React Native, Flutter) | `13-culture-architecturale/01-architecture-mobile.md` | 1h15 |
| 85 | MLOps & AI Systems Architecture | `13-culture-architecturale/02-mlops-ai-systems.md` | 1h15 |
| 86 | Blockchain & Consensus distribue | `13-culture-architecturale/03-blockchain-consensus.md` | 1h15 |
| 87 | IoT & Edge Architecture | `13-culture-architecturale/04-iot-edge.md` | 1h |
| 88 | Collaboration temps réel (CRDT, OT) | `13-culture-architecturale/05-crdt-collaboration.md` | 1h15 |
| 89 | Modernisation Legacy & Anti-Corruption Layer | `13-culture-architecturale/06-modernisation-legacy.md` | 1h |

**Cours 84** : Architecture mobile : native vs cross-platform (React Native, Flutter). Offline-first mandatory (réseau intermittent). Sync bidirectionnel (conflict résolution, queue de mutations). Bridge vs FFI. Impact sur le design d'API (pagination stable, delta sync, compression). App Store constraints (review, updates, rollback impossible). Analogie : l'application mobile = l'ambassade — elle represente le pays mais opere en territoire etranger avec ses propres règles.

**Cours 85** : ML pipeline (data → features → training → serving → monitoring). Feature stores. Model versioning (MLflow, Weights & Biases). A/B testing ML (champion/challenger). Model serving (batch vs real-time, GPU vs CPU). MLOps CI/CD (data validation, model validation, deployment). Intégration web : recommandations, search semantique, AI-powered features. Cout inference vs fine-tuning. EU AI Act risk categories. Analogie : le chef cuisinier (ML engineer) teste des recettes (modèles) avec des ingredients (data) — le restaurant (prod) ne sert que les recettes validees.

**Cours 86** : Blockchain : registre distribue, immutable, sans tiers de confiance. Consensus : Proof of Work, Proof of Stake, BFT. Smart contracts (Solidity — concept). Quand la blockchain fait sens (traçabilité supply chain, tokens, identité decentralisee). Quand elle NE fait PAS sens (spoiler : la plupart du temps — si tu as un tiers de confiance, tu n'as pas besoin de blockchain). Web3 : wallets, DApps, IPFS. Analogie : la blockchain = le grand livre comptable public de la ville — tout le monde peut vérifier, personne ne peut falsifier.

**Cours 87** : IoT architecture : devices contraints (mémoire, CPU, batterie). MQTT (pub/sub lightweight, QoS levels). Edge processing (filtrer/agreger avant d'envoyer au cloud). Time-series databases. Digital twins. Sécurité IoT (firmware updates, certificate rotation, constrained DTLS). Les memes patterns que le web, pousses a l'extreme (résilience, async, offline). Analogie : le réseau de capteurs dans un vignoble — chaque capteur est autonome, mais l'ensemble donne une vue globale.

**Cours 88** : Collaboration temps réel : le problème de la concurrence d'edition. Operational Transform (OT) — l'approche Google Docs (transformations sequentielles, serveur central). CRDT (Conflict-free Replicated Data Types) — l'approche Figma/Yjs (convergence mathematique, pas besoin de serveur central). Types de CRDT (G-Counter, LWW-Register, OR-Set). Quand OT vs CRDT. Libraries (Yjs, Automerge). Impact sur l'architecture (WebSocket obligatoire, awareness protocol, undo/redo distribue). Analogie : deux personnes qui ecrivent sur le même tableau blanc — OT = un arbitre decide de l'ordre, CRDT = les stylos sont magiques et se resolvent tout seuls.

**Cours 89** : Legacy systems : mainframe, COBOL, monolithes vieillissants. Anti-Corruption Layer (DDD) : facade qui traduit entre le legacy et le nouveau système. Strangler Fig applique au legacy. Intégration patterns : fichiers batch, MQ (IBM MQ, RabbitMQ), API wrapper, database-level intégration (a éviter). Migration incrementale vs Big Bang (le Big Bang échoué presque toujours). Cohabitation longue durée. Analogie : renover un immeuble habite — tu ne peux pas demander a tout le monde de demenager pendant les travaux.

| Exercice | Fichier | Temps |
|---|---|---|
| 57 — Designer une API mobile-friendly | `exercices/57-api-mobile-friendly/` | 1h |
| 58 — CRDT : editeur collaboratif minimal | `exercices/58-crdt-editeur/` | 1h |
| 59 — Anti-corruption layer pour un legacy | `exercices/59-anti-corruption-layer/` | 1h |

---

## Projet Fil Rouge : ShopArch — E-commerce simplifie

> Un projet e-commerce construit incrementalement a travers les 14 modules.

### Description

ShopArch est une plateforme e-commerce simplifiee comprenant :
- **Catalogue** : produits, categories, recherche, filtres
- **Panier** : ajout, modification, persistance
- **Commande** : checkout, paiement (simule), historique
- **Compte** : inscription, connexion, profil, adresses
- **Admin** : gestion produits, commandes, dashboard

### Progression par module

| Module | Increment fil rouge |
|---|---|
| 00 | Types TypeScript du domaine (Product, Cart, Order, User). Design tokens types. Trade-off analysis du projet. |
| 01 | Architecture hexagonale du back (ports & adapters). API-First contract (OpenAPI). 12-Factor checklist. |
| 02 | Bounded Contexts : Catalog, Cart, Order, Payment, User. FSM commande (Created → Paid → Shipped → Delivered → Cancelled). |
| 03 | API REST NestJS — CRUD produits + auth OIDC + tenant isolation + idempotency key sur paiement. Concurrence : lock optimiste sur le stock. |
| 04 | Schema PostgreSQL — migrations, UUID PKs, index GIN full-text, JSON i18n. Search avec Elasticsearch. |
| 05 | Front React — component tree, design tokens OKLCH, theme switcher dark/light, SSR catalogue + ISR fiches produit + SPA panier. i18n (FR/EN) + hreflang + canonical URLs. |
| 06 | Fondamentaux réseau (HTTP/2). Webhooks HMAC pour notifications commande vers n8n. BFF pour auth tokens. |
| 07 | CQRS séparation lecture catalogue / écriture commandes. Outbox pattern pour events fiables. Circuit breaker sur payment gateway. |
| 08 | CSP hash-only. Rate limiting per-tenant. Threat model STRIDE du checkout. CMP consentement analytics. |
| 09 | Cache Redis 3-niveaux. CDN images WebP/AVIF + focal-point. Capacity planning. Serverless pour thumbnails. |
| 10 | Logging OTel. SLOs Prometheus. CI/CD Helm + k6 + Lighthouse. Feature flag pour promo flash. Blue/Green deploy. |
| 11 | Tests E2E + a11y axe-core. Contract tests Pact. Load testing k6. MSW mock layer. |
| 12 | ADR. Diagrammes C4. Fitness functions. Plugin "produits recommandes". Conway's Law analysis. Wardley Map du produit. |
| 13 | API mobile-friendly (delta sync). Editeur de fiches produit collaboratif (CRDT). Anti-corruption layer vers un ERP legacy. |

Voir : `projet-fil-rouge/README.md`

---

## Index des patterns CMS theorises

> Référence croisee : chaque pattern réel du CMS Givexpert et le cours ou il est enseigne.

### Multi-tenancy & isolation
| Pattern | Cours |
|---|---|
| Schema-per-tenant isolation (PostgreSQL `SET search_path`) | 22 |
| Doctrine SQL Filters automatiques (`TenantFilter`, `SiteFilter`) | 22 |
| 3 couches d'isolation (DB schema + query filter + S3 prefix) | 22 |
| Multi-site dans un tenant (`X-Site-Id` header) | 22 |
| Per-tenant backup (`pg_dump -n tenant_{slug}`) | 22 |
| Per-tenant observability tagging | 22, 69 |

### Authentification & autorisation
| Pattern | Cours |
|---|---|
| JWT RS256 + JWKS Redis caching (TTL + forced refresh) | 21 |
| OIDC Authorization Code + PKCE | 21 |
| RBAC role hierarchy + custom voters | 21 |
| Auth adapter pattern (prod OIDC / mock dev) | 21, 74 |
| SessionStorage vs localStorage pour tokens | 21, 34 |
| Navigation guards ordonnees (restore → auth → RBAC → allow → title) | 35 |
| BFF pour tokens côté serveur | 48 |

### API Design
| Pattern | Cours |
|---|---|
| ETag optimistic locking (`If-Match`, `412 Precondition Failed`) | 19, 44 |
| RFC 7807 Problem Details | 19, 24 |
| Serialization groups (`entity:read`, `entity:write`) | 19 |
| Presigned URL upload flow (S3 direct upload) | 19, 23 |
| JSON-LD / Hydra envelope (`HydraCollection<T>`) | 44 |
| Pagination serveur cap 20-24 items | 19 |
| URL versioning (`/v1/`) + déprécation headers | 44 |
| API governance (style guides, changelog) | 44 |

### Data Model
| Pattern | Cours |
|---|---|
| UUID v4 IDOR prevention | 16, 27, 56 |
| Soft deletes via status field | 16, 27 |
| Colonnes JSON pour i18n (MultiLangField) | 16, 27, 40 |
| Version field (optimistic locking) | 16, 26 |
| Dual-database (master DB + tenant schemas) | 27 |
| Content versioning diff-based (snapshot v1 + diffs v2+) | 23, 28 |

### Workflows & state machines
| Pattern | Cours |
|---|---|
| Finite State Machine editorial (Draft → Scheduled → Published → Archived) | 17 |
| `canTransitionTo()` guard method | 17 |
| Audit trail immutable (append-only log) | 17 |
| Cache invalidation déclenchée par transitions | 17 |
| Cron-based auto-publication | 25 |
| Preview tokens (SHA256 hex, `X-Preview-Token`) | 23 |

### Design Tokens & theming
| Pattern | Cours |
|---|---|
| Design tokens JSON → CSS custom properties | 37 |
| Token layering (global → semantic → component) | 37 |
| OKLCH palette génération depuis brand color (50-950 shades) | 37 |
| Theme = token set + structural templates | 37 |
| Theme résolution cascade (defaults → overrides → settings → custom CSS) | 37 |
| Hot-swapping runtime (CSS vars, zero rebuild) | 37 |
| Zero hardcoded hex colors rule | 37 |
| Dark mode via semantic token switching + `.dark` class | 37 |
| BroadcastChannel cross-tab theme sync | 34, 37 |
| Flowbite adapter pattern | 37 |
| `font-display: swap` enforcement (max 5 familles) | 37 |
| CSS logical properties pour RTL | 37 |

### Rendering & hydration
| Pattern | Cours |
|---|---|
| SSR / SSG / ISR / Hybride (classification par type de route) | 38 |
| Hydration stratégies (on-visible, on-idle, on-interaction) | 38 |
| FOUC prevention (SSR token injection dans `<head>`) | 38 |
| Personalization Shell Pattern (CDN shell + client hydration) | 38 |
| Delay hydration (2s defer production) | 38, 39 |
| Anti-unfurl middleware pour preview tokens | 38 |
| Streaming SSR | 38 |

### Performance front-end
| Pattern | Cours |
|---|---|
| Performance budgets (HTML ≤80KB, JS ≤200KB, TTFB ≤600ms) | 39 |
| Core Web Vitals targets (LCP <2.5s, CLS <0.1, INP <200ms) | 39 |
| Vendor chunk splitting (react, react-dom, router, i18n, charts...) | 39 |
| Blurhash placeholders | 39 |
| `<link rel="preconnect">` hints | 39 |
| Critical CSS inline (above-fold) | 39 |
| `useWebVitals` hook RUM | 39, 69 |
| Lighthouse CI gates (≥90) | 39, 71 |

### Data fetching & state
| Pattern | Cours |
|---|---|
| AbortController request cancellation (unmount/route change) | 36 |
| Debounce patterns (300ms search, 800ms BO) | 36 |
| Stale-While-Revalidate | 36, 62 |
| Request priority system (critical/high/normal/low) | 36 |
| Exponential backoff retry (1s→2s→5s, max 2) | 36, 47 |
| ETag tracking par entité (`Map<string, string>`) | 34 |
| Error handling par code HTTP (412/422/401/429) | 34, 24 |
| SpeedDial context-aware pattern | 34 |

### i18n & SEO
| Pattern | Cours |
|---|---|
| Dual locale concept (UI locale vs content locale) | 40 |
| Per-locale slugs + transliteration fallback | 40 |
| `hreflang` tags automatiques (`useHead`) | 40 |
| XML sitemaps per-locale + sitemap index | 40 |
| Locale fallback composable (`useLocaleFallback`) | 40 |
| Auto-301 redirect on slug change | 40, 80 |
| Canonical URLs (`<link rel="canonical">`) | 40 |
| Structured data schema.org | 40 |
| Open Graph + Twitter Cards auto-générés | 40 |
| `noindex, nofollow` pages protégées | 40, 35 |
| Redirect chain collapsing | 40, 80 |

### Communication & intégration
| Pattern | Cours |
|---|---|
| Webhook HMAC-SHA256 (`X-Webhook-Signature`) | 47 |
| Auto-disable webhooks après 10 echecs | 47, 60 |
| Event vocabulary standard (`content.published`, etc.) | 47 |
| Symfony Messenger / BullMQ async dispatch | 47 |
| Kafka event bus | 47 |
| n8n intégration middleware | 47 |

### Caching & CDN
| Pattern | Cours |
|---|---|
| 3-layer caching (Nitro + in-memory + localStorage) | 62 |
| Tag-aware Redis cache pools (TTL par type) | 62 |
| Surrogate-key cache invalidation | 50, 62 |
| Redis namespace convention (`{app}:{feature}:{key}`) | 30, 62 |
| Cache par route (public CDN / private browser / none) | 62 |
| Edge-first delivery (cache-first SSR, sub-600ms TTFB) | 63 |
| CDN cache purge on publish | 63 |

### Image & media
| Pattern | Cours |
|---|---|
| Image pipeline (WebP/AVIF, srcset, on-the-fly resizing) | 63 |
| Focal-point cropping metadata (`object-position`) | 63 |
| SHA256 deduplication | 63 |
| S3 presigned URLs (bucket prive → 302 redirect) | 63, 19 |
| 3 thumbnail sizes (150x150, 800x600, 1920x1080) | 63 |
| Automatic cleanup pending media (24h) | 25 |

### Sécurité
| Pattern | Cours |
|---|---|
| CSP hash-only (SHA-256, zero `unsafe-inline`) | 58 |
| Trusted Types (report-only) | 58 |
| SRI (Subresource Integrity) | 58 |
| CSP violation reporting + rate limiting | 58 |
| Sandboxed iframes + Shadow DOM | 60 |
| Plugin manifest trust (HMAC challenge-response) | 60 |
| Custom CSS guardrails (15KB, patterns interdits) | 60 |
| Network egress default-deny (Kubernetes) | 57, 60 |
| GDPR-safe rate limit keys (SHA-256 IP+pepper) | 59 |
| Supply chain security (SBOM, lockfile integrity) | 59 |

### Privacy & compliance
| Pattern | Cours |
|---|---|
| CMP (Consent Management Platform) | 61 |
| PII-free analytics (`crypto.randomUUID()` session) | 61, 68 |
| EU data residency | 61 |
| FinOps metering hooks (storage, bandwidth, AI) | 61, 83 |
| EU AI Act risk register | 61 |

### Observabilité & DevOps
| Pattern | Cours |
|---|---|
| OpenTelemetry 3 signaux (metrics, traces, logs) | 68, 69, 70 |
| SLOs codifies (Prometheus rules) | 69 |
| Error-budget burn alerts (multi-window, multi-burn-rate) | 69 |
| RUM via `useWebVitals` → OpenTelemetry | 69 |
| OTel sampling (1% prod, 100% staging) | 70 |
| Helm charts + init containers | 71 |
| k6 load testing CI (smoke + nightly) | 71, 76 |
| Container security scanning (Trivy/Grype) | 71 |
| Feature flags (env variable + middleware guard) | 71 |
| Deployment stratégies (Blue/Green, Canary, Rolling) | 71 |

### Testing
| Pattern | Cours |
|---|---|
| axe-core WCAG 2.1 AA | 73 |
| RGAA compliance | 73 |
| Auth mock pattern (prod/dev switch) | 74 |
| AI quality testing (BLEU/ROUGE baselines) | 76 |

### Architecture practice
| Pattern | Cours |
|---|---|
| ADR (Architecture Decision Records) | 77 |
| C4 Model (Context, Container, Component, Code) | 77 |
| Documentation as product (living contracts) | 77 |
| Monorepo vs polyrepo | 77 |
| Fitness functions automatisees | 78, 83 |
| Pre-flight diff report (migration) | 80 |
| Plugin manifest schema (YAML declaratif) | 81 |
| Block variant system (`variantResolver`) | 81 |
| Route mount blocks (nested routes) | 81 |
| Adapter boundary pattern (Unlayer) | 81 |
| Search abstraction layer (`SearchProvider`) | 81, 32 |
| Conway's Law + Inverse Conway Maneuver | 82 |
| Team Topologies (4 types, 3 interactions) | 82 |
| Evolutionary architecture | 83 |
| Wardley Mapping | 83 |
| FinOps / cost architecture | 83 |

---

## Tableau de révision espacee

> Coche chaque case après révision. J+1 = lendemain, J+7 = une semaine après, J+30 = un mois après.

### Module 00 — Fondamentaux du design
| # | Cours | J+1 | J+7 | J+30 |
|---|---|---|---|---|
| 1 | Qu'est-ce que l'architecture logicielle ? | [ ] | [ ] | [ ] |
| 2 | Principes SOLID | [ ] | [ ] | [ ] |
| 3 | Design patterns essentiels | [ ] | [ ] | [ ] |
| 4 | Principes de clean code | [ ] | [ ] | [ ] |
| 5 | Code smells et refactoring | [ ] | [ ] | [ ] |
| 6 | Dependency Injection & IoC | [ ] | [ ] | [ ] |
| 7 | Raisonner en architecte (trade-offs) | [ ] | [ ] | [ ] |

### Module 01 — Patterns architecturaux
| # | Cours | J+1 | J+7 | J+30 |
|---|---|---|---|---|
| 7 | Architecture en couches | [ ] | [ ] | [ ] |
| 8 | Architecture hexagonale | [ ] | [ ] | [ ] |
| 9 | Clean Architecture | [ ] | [ ] | [ ] |
| 10 | Monolithe modulaire & API-First | [ ] | [ ] | [ ] |
| 11 | Microservices Architecture | [ ] | [ ] | [ ] |
| 12 | Vertical Slice Architecture | [ ] | [ ] | [ ] |
| 13 | 12-Factor App & Idempotency | [ ] | [ ] | [ ] |

### Module 02 — Domain-Driven Design
| # | Cours | J+1 | J+7 | J+30 |
|---|---|---|---|---|
| 14 | Introduction au DDD | [ ] | [ ] | [ ] |
| 15 | Bounded Contexts & Context Map | [ ] | [ ] | [ ] |
| 16 | Entités, Value Objects, Agregats | [ ] | [ ] | [ ] |
| 17 | Domain Events, Services & Workflows | [ ] | [ ] | [ ] |
| 18 | Repositories & Specifications | [ ] | [ ] | [ ] |

### Module 03 — Architecture Back-end
| # | Cours | J+1 | J+7 | J+30 |
|---|---|---|---|---|
| 19 | API Design REST | [ ] | [ ] | [ ] |
| 20 | Middleware & Pipeline | [ ] | [ ] | [ ] |
| 21 | Auth (OIDC, JWT, RBAC) | [ ] | [ ] | [ ] |
| 22 | Multi-tenancy | [ ] | [ ] | [ ] |
| 23 | Data Access Patterns | [ ] | [ ] | [ ] |
| 24 | Validation & Error Handling | [ ] | [ ] | [ ] |
| 25 | Background Jobs & Queues | [ ] | [ ] | [ ] |
| 26 | Concurrence & Asynchronisme | [ ] | [ ] | [ ] |

### Module 04 — Architecture Base de Données
| # | Cours | J+1 | J+7 | J+30 |
|---|---|---|---|---|
| 27 | Modélisation relationnelle avancee | [ ] | [ ] | [ ] |
| 28 | Migrations & Content Versioning | [ ] | [ ] | [ ] |
| 29 | Indexation & Performance | [ ] | [ ] | [ ] |
| 30 | Patterns lecture/écriture | [ ] | [ ] | [ ] |
| 31 | NoSQL & Polyglot Persistence | [ ] | [ ] | [ ] |
| 32 | Search Architecture | [ ] | [ ] | [ ] |

### Module 05 — Architecture Front-end
| # | Cours | J+1 | J+7 | J+30 |
|---|---|---|---|---|
| 33 | Component Architecture | [ ] | [ ] | [ ] |
| 34 | State Management Patterns | [ ] | [ ] | [ ] |
| 35 | Routing & Navigation | [ ] | [ ] | [ ] |
| 36 | Data Fetching Patterns | [ ] | [ ] | [ ] |
| 37 | Design Tokens & Design Systems | [ ] | [ ] | [ ] |
| 38 | Stratégies de rendu (SSR/SSG/ISR) | [ ] | [ ] | [ ] |
| 39 | Performance Front-end | [ ] | [ ] | [ ] |
| 40 | i18n & SEO Architecture | [ ] | [ ] | [ ] |
| 41 | Micro-frontends | [ ] | [ ] | [ ] |
| 42 | Offline-first & PWA | [ ] | [ ] | [ ] |

### Module 06 — Communication & Intégration
| # | Cours | J+1 | J+7 | J+30 |
|---|---|---|---|---|
| 43 | Fondamentaux réseau | [ ] | [ ] | [ ] |
| 44 | REST avance | [ ] | [ ] | [ ] |
| 45 | GraphQL & gRPC | [ ] | [ ] | [ ] |
| 46 | WebSockets & Real-time | [ ] | [ ] | [ ] |
| 47 | Event-driven, Webhooks & MQ | [ ] | [ ] | [ ] |
| 48 | API Gateway & BFF | [ ] | [ ] | [ ] |

### Module 07 — Patterns distribues
| # | Cours | J+1 | J+7 | J+30 |
|---|---|---|---|---|
| 49 | Théorie (CAP, PACELC, consistance) | [ ] | [ ] | [ ] |
| 50 | CQRS | [ ] | [ ] | [ ] |
| 51 | Event Sourcing & Outbox | [ ] | [ ] | [ ] |
| 52 | Saga Pattern | [ ] | [ ] | [ ] |
| 53 | Résilience, Chaos Engineering & DR | [ ] | [ ] | [ ] |
| 54 | Strangler Fig & Migration | [ ] | [ ] | [ ] |
| 55 | Consistency Patterns avances | [ ] | [ ] | [ ] |

### Module 08 — Sécurité
| # | Cours | J+1 | J+7 | J+30 |
|---|---|---|---|---|
| 56 | OWASP Top 10 & STRIDE | [ ] | [ ] | [ ] |
| 57 | Architecture Zero Trust | [ ] | [ ] | [ ] |
| 58 | CSP, Trusted Types, SRI | [ ] | [ ] | [ ] |
| 59 | Rate Limiting & CORS | [ ] | [ ] | [ ] |
| 60 | Sandboxing & Extensions | [ ] | [ ] | [ ] |
| 61 | Privacy by Design & GDPR | [ ] | [ ] | [ ] |

### Module 09 — Performance & Scalabilite
| # | Cours | J+1 | J+7 | J+30 |
|---|---|---|---|---|
| 62 | Caching multi-niveaux | [ ] | [ ] | [ ] |
| 63 | CDN, Edge & Image Pipeline | [ ] | [ ] | [ ] |
| 64 | Load Balancing | [ ] | [ ] | [ ] |
| 65 | Scaling & Cloud-Native | [ ] | [ ] | [ ] |
| 66 | Sharding & Réplication | [ ] | [ ] | [ ] |
| 67 | Serverless Architecture | [ ] | [ ] | [ ] |

### Module 10 — Observabilité & DevOps
| # | Cours | J+1 | J+7 | J+30 |
|---|---|---|---|---|
| 68 | Logging structure | [ ] | [ ] | [ ] |
| 69 | Monitoring, Alerting & SLOs | [ ] | [ ] | [ ] |
| 70 | Distributed Tracing | [ ] | [ ] | [ ] |
| 71 | CI/CD, Feature Flags & Deploy | [ ] | [ ] | [ ] |
| 72 | Infrastructure as Code | [ ] | [ ] | [ ] |

### Module 11 — Testing Architecture
| # | Cours | J+1 | J+7 | J+30 |
|---|---|---|---|---|
| 73 | Pyramide de tests & Accessibilité | [ ] | [ ] | [ ] |
| 74 | Test doubles & patterns | [ ] | [ ] | [ ] |
| 75 | Contract Testing | [ ] | [ ] | [ ] |
| 76 | Load Testing & Production | [ ] | [ ] | [ ] |

### Module 12 — Architecture dans la vraie vie
| # | Cours | J+1 | J+7 | J+30 |
|---|---|---|---|---|
| 77 | Documentation d'architecture (ADR, C4) | [ ] | [ ] | [ ] |
| 78 | Architecture Review | [ ] | [ ] | [ ] |
| 79 | Dette technique | [ ] | [ ] | [ ] |
| 80 | Stratégies de migration | [ ] | [ ] | [ ] |
| 81 | Plugin & Extension Architecture | [ ] | [ ] | [ ] |
| 82 | Conway's Law & Team Topologies | [ ] | [ ] | [ ] |
| 83 | Evolutionary Architecture & FinOps & Wardley | [ ] | [ ] | [ ] |

### Module 13 — Culture architecturale elargie
| # | Cours | J+1 | J+7 | J+30 |
|---|---|---|---|---|
| 84 | Architecture mobile | [ ] | [ ] | [ ] |
| 85 | MLOps & AI Systems | [ ] | [ ] | [ ] |
| 86 | Blockchain & Consensus | [ ] | [ ] | [ ] |
| 87 | IoT & Edge | [ ] | [ ] | [ ] |
| 88 | Collaboration temps réel (CRDT) | [ ] | [ ] | [ ] |
| 89 | Modernisation Legacy | [ ] | [ ] | [ ] |
