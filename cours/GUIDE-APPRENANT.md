# Guide de l'apprenant — Parcours personnalisé

> **Ton profil** : Dev JavaScript moyen, React au quotidien mais sans maîtrise profonde,
> TypeScript encore fragile, NestJS jamais touché, architecture = terra incognita.
>
> **Temps estimé** : ~400h (8-10 mois à 10-12h/semaine)
>
> **Philosophie** : Pas de mur cognitif. Chaque session tu progresses.
> Si tu bloques, c'est que tu as sauté une étape — reviens en arrière, c'est normal.

---

## Avant de commencer — Auto-diagnostic

Avant de plonger dans la formation, fais un point honnête sur tes acquis.
Ce n'est pas un test — c'est une boussole pour savoir par où commencer.

### JavaScript — es-tu prêt ?
Coche ce que tu sais faire SANS chercher sur Google :
- [ ] Écrire une Promise et la chaîner avec `.then()` / `async await`
- [ ] Utiliser `map`, `filter`, `reduce` sur un tableau
- [ ] Expliquer la différence entre `const obj = {}` et l'immutabilité
- [ ] Destructurer un objet et un tableau
- [ ] Comprendre le spread operator (`...`)
- [ ] Écrire un `try/catch` avec un `fetch`

**6/6** -> Tu es prêt, passe aux prérequis TypeScript.
**4-5/6** -> Révise les points manquants (MDN suffit), puis prérequis TypeScript.
**< 4/6** -> Fais d'abord un refresher JavaScript (recommandé : javascript.info). Voir aussi `cours/prerequis-javascript/REFRESHER.md`.

### React — es-tu prêt ?
- [ ] Créer un composant fonctionnel avec des props typées
- [ ] Utiliser useState et useEffect correctement
- [ ] Lever l'état (lift state up) entre deux composants
- [ ] Utiliser useContext pour partager de l'état
- [ ] Créer un custom hook

**5/5** -> Le Module 05 (Front) sera ton terrain de jeu.
**3-4/5** -> Tu t'en sortiras, mais révise les hooks au besoin.
**< 3/5** -> Fais le tutoriel officiel React (react.dev/learn) d'abord.

### NestJS — pas de panique
Tu n'as jamais touché NestJS ? C'est normal et prévu.
Le Module 03 introduit NestJS progressivement. Mais avant d'y arriver :
1. Lis `cours/prerequis-nestjs/01-premiers-pas-nestjs.md` (~1h30)
2. Fais le tutorial "First steps" sur docs.nestjs.com (~2h)
3. Comprends les 3 concepts de base : Module, Controller, Service
4. C'est tout. Le reste s'apprend dans les exercices.

---

## Ordre recommandé pour ton profil

### Parcours recommandé (dev moyen, TypeScript fragile)

**Phase 0 — Mise à niveau (~30-40h)**
1. Auto-diagnostic JS/React ci-dessus
2. Refresher JavaScript si nécessaire (`cours/prerequis-javascript/REFRESHER.md`)
3. Prérequis TypeScript (6 leçons) — OBLIGATOIRE, ne skip pas
4. Crash course NestJS (`cours/prerequis-nestjs/01-premiers-pas-nestjs.md`)
5. Tutorial NestJS "First steps" (docs.nestjs.com)

**Phase 1 — Les Fondations (~30h)**
Ere 1 du parcours. Si un concept ne rentre pas, c'est OK — note-le et reviens-y plus tard.

**Phase 2 — Le Domaine (~40h)**
Ere 2. C'est ici que l'architecture commence vraiment. DDD va te sembler abstrait au début — c'est normal.

**Phase 3 — Ton terrain : le Front (~40h)**
Ere 3. Tu vas te sentir chez toi. Profite de cette confiance pour consolider.

**Phase 4 — L'autre côté : le Back (~50h)**
Ere 4. NestJS, PostgreSQL, Redis. C'est le plus dur pour toi. Prends ton temps.
Astuce : fais TOUJOURS tourner le code localement (docker compose up). Lire du code NestJS sans l'exécuter = frustration garantie.

**Phase 5-7 — La suite (~150h)**
Communication, patterns distribués, sécurité, observabilité, testing, culture archi.
A ce stade tu seras un dev différent de celui qui a commencé.

---

## Comment utiliser cette formation

### La règle d'or

**Ne lis jamais un cours passivement.** Pour chaque concept :

1. **Lis le cours** (30-45min)
2. **Tente l'exercice SANS regarder la correction** (même si c'est nul)
3. **Compare avec la correction** — l'écart entre ta tentative et la correction, c'est là que tu apprends
4. **Coche le checkpoint** dans `projet-fil-rouge/README.md`
5. **Si tu peux l'expliquer à voix haute à quelqu'un** (où à toi-même), tu as compris

### Niveaux de difficulté des exercices

| Icône | Niveau | Signification |
|---|---|---|
| 🟢 | Découverte | Tu suis le guide, tu appliques. 30-45min. |
| 🔵 | Application | Tu dois réfléchir mais le chemin est clair. 45min-1h15. |
| 🟡 | Conception | Tu dois faire des choix. Plusieurs solutions possibles. 1h-2h. |
| 🟠 | Arbitrage | Tu dois comparer des options et justifier. 1h30-2h30. |
| 🔴 | Architecture | Tu conçois un système complet. 2h+. |

### Quand tu bloques

1. **Bloqué sur TypeScript ?** → Va dans `cours/prerequis-typescript/`. C'est pas de la honte, c'est de l'efficacité.
2. **Bloqué sur un concept ?** → Relis le cours, puis essaie de dessiner le concept sur papier.
3. **Bloqué sur un exercice ?** → Regarde les 3 premiers indices de la correction, pas plus. Réessaie.
4. **Bloqué sur du tooling (Docker, NestJS...) ?** → C'est normal, ce n'est pas le but de la formation. Utilise le starter code dans `src/` et `infra/`.

---

## Ta progression — Les 7 Ères

*Comme dans EU5 : chaque ère débloque de nouvelles capacités.*

### 🏛️ Ère 1 — Les Fondations (60-80h)

> **Objectif** : Comprendre les principes, maîtriser TypeScript, écrire du code propre.
> **Quand tu auras fini** : Tu sauras expliquer SOLID, utiliser l'injection de dépendances,
> et écrire des Value Objects typés. Tu ne coderas plus "au feeling".

| # | Cours | Temps | Note |
|---|---|---|---|
| 0 | **Prérequis TypeScript** | 8-12h | ⚠️ **Commence ici.** Même si tu crois connaître. |
| | `cours/prerequis-typescript/01-types-de-base.md` | 1h30 | Types, interfaces, unions, narrowing |
| | `cours/prerequis-typescript/02-generiques-utility.md` | 2h | Generics, Pick, Omit, Record |
| | `cours/prerequis-typescript/03-classes-immutabilite.md` | 2h | Classes, readonly, private, patterns VO |
| | `cours/prerequis-typescript/04-async-error-handling.md` | 2h | Promises, async/await, try/catch, Result pattern |
| | `cours/prerequis-typescript/05-types-avances.md` | 2h | Branded types, discriminated unions, type guards |
| | `cours/prerequis-typescript/06-exercice-integratif.md` | 2h | Mini-projet : implémenter Money + Email + Cart |
| 1 | `cours/00-fondamentaux/01-quest-ce-que-architecture.md` | 1h | Pourquoi l'architecture existe |
| 2 | `cours/00-fondamentaux/04-principes-clean-code.md` | 1h | Clean code — tu le fais déjà en partie |
| 3 | `cours/00-fondamentaux/02-principes-solid.md` | 1h30 | SOLID — le vocabulaire de base |
| 4 | `cours/00-fondamentaux/03-design-patterns-essentiels.md` | 2h | Les 6 patterns que tu utiliseras tout le temps |
| 5 | `cours/00-fondamentaux/05-code-smells-et-refactoring.md` | 1h30 | Nommer les smells, les soigner par petits pas (réf. refactoring.guru) |
| 6 | `cours/00-fondamentaux/06-dependency-injection-ioc.md` | 1h30 | DI — le concept le plus important pour la suite |
| 7 | `cours/00-fondamentaux/07-raisonner-en-architecte.md` | 1h30 | **Cours clé** — comment penser en architecte |
| 8 | `cours/00-pieges-frequents-archi.md` | 1h | Les 20 erreurs classiques — tu en fais probablement 5 |
| | **Exercices Ère 1** | 8-10h | |
| | `exercices/01-refactoring-solid/` | 1h | 🟢 Refactorer du code avec SOLID |
| | `exercices/01b-refactoring-smells/` | 1h30 | 🟢 Nommer les smells, les soigner (tests golden-master fournis) |
| | `exercices/02-identifier-patterns/` | 1h30 | 🔵 Reconnaître les design patterns |
| | `exercices/03-injection-dependances/` | 1h | 🟢 Câbler de la DI |
| | `exercices/04-tradeoff-analysis/` | 1h30 | 🟡 Premier exercice de décision |

**🏆 Checkpoint Ère 1** : Tu peux expliquer les 5 principes SOLID avec un exemple chacun. Tu as implémenté Money et Email dans `src/`. Les tests passent.

---

### ⚔️ Ère 2 — Le Domaine (50-70h)

> **Objectif** : Modéliser un domaine métier, comprendre le DDD, implémenter une FSM.
> **Quand tu auras fini** : Tu sauras dessiner un domaine, distinguer Entité de VO,
> et expliquer pourquoi ton Order est un agrégat.

| # | Cours | Temps | Note |
|---|---|---|---|
| 8 | `cours/02-domain-driven-design/01-introduction-ddd.md` | 1h | Le DDD expliqué simplement |
| 9 | `cours/02-domain-driven-design/03-entites-vo-agregats.md` | 1h30 | **Cours clé** — Entités, VOs, Agrégats |
| 10 | `cours/02-domain-driven-design/02-bounded-contexts.md` | 1h30 | Bounded Contexts — découper le domaine |
| 11 | `cours/02-domain-driven-design/04-domain-events-services.md` | 1h30 | Events et services de domaine |
| 12 | `cours/02-domain-driven-design/05-repositories-specifications.md` | 1h30 | Repositories — le pont vers l'infra |
| | **Exercices Ère 2** | 10-14h | |
| | `exercices/09-modeliser-domaine/` | 2h | 🟡 **Exercice pivot** — modéliser ShopArch |
| | `exercices/10-bounded-contexts-pratique/` | 1h30 | 🔵 Identifier les bounded contexts |
| | `exercices/10b-context-map/` | 1h | 🔵 Dessiner la context map |
| | `exercices/11-fsm-commande/` | 1h30 | 🟡 Implémenter la FSM de commande |

**Intercalaire architecture** : Maintenant que tu as le domaine, apprends les patterns architecturaux.

| # | Cours | Temps | Note |
|---|---|---|---|
| 13 | `cours/01-patterns-architecturaux/01-architecture-en-couches.md` | 1h | Ce que tu fais déjà (probablement) |
| 14 | `cours/01-patterns-architecturaux/02-architecture-hexagonale.md` | 1h30 | **Cours clé** — le pattern central de la formation |
| 15 | `cours/01-patterns-architecturaux/03-clean-architecture.md` | 1h | Pour comparer avec l'hexagonale |
| 16 | `cours/01-patterns-architecturaux/04-monolithe-modulaire.md` | 1h | La structure de ShopArch |
| 17 | `cours/01-patterns-architecturaux/06-vertical-slice.md` | 1h | Alternative à l'hexagonale |
| 18 | `cours/01-patterns-architecturaux/05-microservices.md` | 1h | Pour savoir quand NE PAS les utiliser |
| 19 | `cours/01-patterns-architecturaux/07-twelve-factor-idempotency.md` | 1h | Les 12 règles du cloud-native |
| | **Exercices Ère 2 (suite)** | 8-10h | |
| | `exercices/05-layered-to-hexagonal/` | 2h | 🟡 Migrer vers l'hexagonale |
| | `exercices/06-vertical-slice-module/` | 1h30 | 🔵 Implémenter un vertical slice |
| | `exercices/07-decomposer-monolithe/` | 1h30 | 🟡 Quand décomposer |
| | `exercices/07b-quand-ne-pas-decomposer/` | 1h | 🟡 Quand NE PAS décomposer |
| | `exercices/08-twelve-factor-checklist/` | 1h | 🟢 Checklist |

**🏆 Checkpoint Ère 2** : La FSM de commande fonctionne. Tu peux dessiner la context map de ShopArch au tableau blanc. Tu sais expliquer l'architecture hexagonale à un collègue.

---

### 🎨 Ère 3 — Le Front (50-60h)

> **Ta zone.** Mais cette fois tu la vois avec des yeux d'architecte.
> **Quand tu auras fini** : Tu sauras structurer un front React comme un architecte,
> pas juste comme un dev qui empile des composants.

| # | Cours | Temps | Note |
|---|---|---|---|
| 20 | `cours/05-architecture-frontend/01-component-architecture.md` | 1h30 | Atomic design, headless components |
| 21 | `cours/05-architecture-frontend/02-state-management.md` | 1h30 | Zustand, state scoping, ETag tracking |
| 22 | `cours/05-architecture-frontend/05-design-tokens-systems.md` | 1h30 | Design tokens, theming |
| 23 | `cours/05-architecture-frontend/03-routing-navigation.md` | 1h | Routes, guards, code splitting |
| 24 | `cours/05-architecture-frontend/04-data-fetching-patterns.md` | 1h30 | React Query, SWR, AbortController |
| 25 | `cours/05-architecture-frontend/06-strategies-de-rendu.md` | 1h30 | **Cours clé** — SSR/SSG/ISR/Hybrid |
| 26 | `cours/05-architecture-frontend/07-performance-frontend.md` | 1h15 | Core Web Vitals, budgets perf |
| 27 | `cours/05-architecture-frontend/08-i18n-seo-architecture.md` | 1h15 | i18n, hreflang, SEO |
| 28 | `cours/05-architecture-frontend/09-micro-frontends.md` | 1h | Pour savoir quand NE PAS le faire |
| 29 | `cours/05-architecture-frontend/10-offline-first-pwa.md` | 1h | PWA, Service Workers |
| | **Exercices Ère 3** | 12-15h | |
| | `exercices/21-component-tree/` | 1h | 🟢 Dessiner l'arbre de composants |
| | `exercices/22-design-tokens-theme/` | 1h30 | 🔵 Implémenter les tokens + dark mode |
| | `exercices/23-ssr-isr-hybrid/` | 1h30 | 🟡 Configurer SSR/ISR |
| | `exercices/24-performance-audit/` | 1h30 | 🔵 Audit Lighthouse |
| | `exercices/25-i18n-hreflang/` | 1h | 🔵 i18n + SEO |
| | `exercices/25b-seo-audit/` | 1h | 🟢 Audit SEO |
| | `exercices/26-micro-frontend/` | 1h | 🟡 Évaluer le besoin |
| | `exercices/27-pwa-offline/` | 1h30 | 🔵 Service Worker |

**🏆 Checkpoint Ère 3** : Le front ShopArch à un design system, le catalogue est SSR, le panier est SPA, le theme switcher marche sans FOUC. Lighthouse ≥ 90.

---

### 🔧 Ère 4 — L'Autre Côté (60-80h)

> **Objectif** : Comprendre le backend et la BDD. Pas pour devenir expert, mais pour
> parler le même langage que les devs back et prendre des décisions fullstack.
> **Tu vas découvrir** l'autre côté du `fetch()`.

**Prérequis** : Si tu n'as jamais touché NestJS ou SQL, fais d'abord :
- [NestJS First Steps](https://docs.nestjs.com/first-steps) (2h)
- [PostgreSQL Tutorial](https://www.postgresqltutorial.com/) sections 1-3 (3h)

| # | Cours | Temps | Note |
|---|---|---|---|
| 30 | `cours/03-architecture-backend/01-api-design-rest.md` | 1h30 | API REST — tu consommes des APIs, maintenant tu les conçois |
| 31 | `cours/03-architecture-backend/06-validation-error-handling.md` | 1h | Validation, erreurs HTTP |
| 32 | `cours/03-architecture-backend/02-middleware-pipeline.md` | 1h | Le pipeline request → response |
| 33 | `cours/03-architecture-backend/03-auth-architecture.md` | 1h30 | Auth OIDC/JWT — tu utilises des tokens, maintenant tu comprends |
| 34 | `cours/03-architecture-backend/04-multi-tenancy.md` | 1h | Multi-tenant — isolation des données |
| 35 | `cours/03-architecture-backend/05-data-access-patterns.md` | 1h | Repository, Unit of Work |
| 36 | `cours/03-architecture-backend/07-background-jobs-queues.md` | 1h | Jobs async — emails, PDF, imports |
| 37 | `cours/03-architecture-backend/08-concurrence-asynchronisme.md` | 1h | Race conditions, locking |
| 38 | `cours/04-architecture-bdd/01-modelisation-relationnelle.md` | 1h30 | Concevoir un schéma SQL |
| 39 | `cours/04-architecture-bdd/02-migrations-versioning.md` | 1h | Migrations versionnées |
| 40 | `cours/04-architecture-bdd/03-indexation-performance.md` | 1h30 | Index, EXPLAIN ANALYZE |
| 41 | `cours/04-architecture-bdd/04-patterns-lecture-ecriture.md` | 1h | Read vs Write models |
| 42 | `cours/04-architecture-bdd/05-nosql-polyglot-persistence.md` | 1h | Quand utiliser quoi |
| 43 | `cours/04-architecture-bdd/06-search-architecture.md` | 1h | Full-text search |
| | **Exercices Ère 4** | 15-20h | |
| | `exercices/12-api-rest-nestjs/` | 2h | 🟡 Créer l'API CRUD |
| | `exercices/13-auth-oidc-rbac/` | 2h | 🟡 Auth + RBAC |
| | `exercices/14-multi-tenant-isolation/` | 1h30 | 🟠 Isolation tenant |
| | `exercices/15-job-queue-bullmq/` | 1h30 | 🔵 Job queue |
| | `exercices/16-race-condition-locking/` | 1h30 | 🟡 Gérer la concurrence |
| | `exercices/17-schema-ecommerce/` | 2h | 🟡 Schéma PostgreSQL |
| | `exercices/18-optimisation-requetes/` | 1h30 | 🔵 Optimisation SQL |
| | `exercices/18b-fulltext-search/` | 1h | 🔵 Full-text search |
| | `exercices/19-polyglot-persistence/` | 1h | 🟡 Choix de persistance |
| | `exercices/20-search-abstraction/` | 1h | 🔵 Abstraction search |

**🏆 Checkpoint Ère 4** : L'API ShopArch tourne, le schéma SQL est en place, tu sais lire un EXPLAIN ANALYZE. Tu peux discuter avec un dev back sans être perdu.

---

### 🌐 Ère 5 — La Communication (40-50h)

> **Objectif** : Comprendre comment le front et le back se parlent,
> et comment les services se parlent entre eux.

| # | Cours | Temps | Note |
|---|---|---|---|
| 44 | `cours/06-communication-integration/01-fondamentaux-reseau.md` | 1h | HTTP/1.1 vs HTTP/2, TLS |
| 45 | `cours/06-communication-integration/02-rest-avance.md` | 1h | Pagination, ETag, HATEOAS |
| 46 | `cours/06-communication-integration/03-graphql-grpc.md` | 1h | Pour comparer avec REST |
| 47 | `cours/06-communication-integration/04-websockets-realtime.md` | 1h | Temps réel |
| 48 | `cours/06-communication-integration/05-event-driven-messaging.md` | 1h30 | Events, webhooks |
| 49 | `cours/06-communication-integration/06-api-gateway-bff.md` | 1h30 | **Cours clé** — le BFF |
| 50-56 | `cours/07-patterns-distribues/` (7 cours) | 8h | CAP, CQRS, Sagas, Outbox |
| | **Exercices Ère 5** | 12-15h | |
| | `exercices/28-http2-benchmark/` | 1h | 🔵 HTTP/2 |
| | `exercices/30-webhook-hmac/` | 1h30 | 🟡 Webhooks |
| | `exercices/30b-webhook-consumer/` | 1h | 🔵 Consumer webhook |
| | `exercices/31-bff-ecommerce/` | 2h | 🟠 BFF complet |
| | `exercices/32-cap-classifier/` | 1h | 🔵 Théorème CAP |
| | `exercices/33-cqrs-catalogue-commandes/` | 2h | 🟠 CQRS |
| | `exercices/34-saga-commande/` | 2h | 🟠 Saga orchestration |
| | `exercices/35-outbox-pattern/` | 1h30 | 🟡 Outbox |
| | `exercices/36-game-day-panne/` | 1h30 | 🟡 Simuler une panne |

**🏆 Checkpoint Ère 5** : Le BFF ShopArch fonctionne. Tu sais dessiner un flow event-driven sur un tableau blanc. Tu peux expliquer CQRS sans slides.

---

### 🛡️ Ère 6 — La Défense (50-60h)

> **Objectif** : Sécurité, performance, observabilité, tests.
> Ce qui fait la différence entre un projet qui marche et un projet qui tient en production.

| # | Cours | Temps | Note |
|---|---|---|---|
| 57-62 | `cours/08-securite/` (6 cours) | 7h | OWASP, Zero Trust, CSP, Rate Limiting |
| 63-68 | `cours/09-performance-scalabilite/` (6 cours) | 7h | Cache, CDN, Load Balancing, Serverless |
| 69-73 | `cours/10-observabilite-devops/` (5 cours) | 6h | Logs, Monitoring, Tracing, CI/CD, IaC |
| 74-77 | `cours/11-testing-architecture/` (4 cours) | 5h | Pyramide tests, Contract tests, Load tests |
| | **Exercices Ère 6** | 20-25h | Tous les exercices 37-52 |

**🏆 Checkpoint Ère 6** : CSP sans unsafe-inline. SLOs définis. Pipeline CI/CD fonctionnel. Tests E2E + contract + load.

---

### 👑 Ère 7 — L'Architecte (40-50h)

> **Objectif** : Documentation, revues, fitness functions, et culture générale.
> Tu passes de "je sais faire" à "je sais décider, documenter et défendre".

| # | Cours | Temps | Note |
|---|---|---|---|
| 78-84 | `cours/12-architecture-pratique/` (7 cours) | 8h | ADR, C4, dette technique, Conway |
| 85-90 | `cours/13-culture-architecturale/` (6 cours) | 7h | Mobile, ML, IoT, CRDT, Legacy |
| | `cours/00-fondamentaux/08-posture-architecte.md` | 1h | **NOUVEAU** — Passer d'exécutant à décideur |
| | **Exercices Ère 7** | 12-15h | Exercices 53-59 + katas décisionnels |

**🏆 Checkpoint Ère 7** : Tu as au moins 3 ADRs, un diagramme C4, et tu peux défendre tes choix d'architecture à l'oral devant un CTO fictif.

---

## Indicateurs de progression

Après chaque ère, auto-évalue-toi honnêtement :

### Questions de contrôle par ère

**Ère 1** : "Un collègue utilise un singleton mutable pour stocker l'état utilisateur. Qu'est-ce que tu lui dis ?"
→ Si tu peux argumenter avec SRP et testabilité, c'est bon.

**Ère 2** : "Pourquoi l'Order est un agrégat et le Money un Value Object ?"
→ Si tu réponds instantanément avec la notion d'identité vs valeur, c'est bon.

**Ère 3** : "Le product page à un LCP de 4 secondes. Par où tu commences ?"
→ Si tu penses SSR/ISR, image optimization, code splitting — c'est bon.

**Ère 4** : "Un dev back veut stocker les sessions en mémoire du serveur. Qu'est-ce que tu lui dis ?"
→ Si tu parles de stateless, 12-Factor, Redis — c'est bon.

**Ère 5** : "Le front fait 12 appels API pour afficher la page d'accueil. Solution ?"
→ Si tu proposes un BFF et tu sais expliquer pourquoi pas GraphQL — c'est bon.

**Ère 6** : "Comment tu sais que ton app est healthy en production ?"
→ Si tu parles SLOs, alertes error budget, tracing distribué — c'est bon.

**Ère 7** : "Le CTO veut passer en microservices. Tu as 5 minutes pour le convaincre que non."
→ Si tu argumentes avec des chiffres, un ADR, et tu proposes le monolithe modulaire — bravo.

---

## Rythme recommandé

| Rythme | Par semaine | Durée totale |
|---|---|---|
| **Chill** (hobby) | 5-8h | 12-14 mois |
| **Régulier** (motivation) | 10-12h | 8-10 mois |
| **Intense** (objectif pro) | 15-20h | 5-6 mois |

**Conseil** : Mieux vaut 1h chaque jour que 7h le dimanche. La régularité bat l'intensité.

---

## Ressources complémentaires (quand tu bloques)

### Avant l'Ère 1
- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/) — la référence officielle

### Avant l'Ère 4
- [NestJS First Steps](https://docs.nestjs.com/first-steps) — 2h pour comprendre la structure
- [PostgreSQL Tutorial](https://www.postgresqltutorial.com/) sections 1-3 — 3h pour les bases SQL

### Quand tu veux approfondir
- *Fundamentals of Software Architecture* (Richards, Ford) — LE livre d'architecture
- *Domain-Driven Design Distilled* (Vernon) — DDD expliqué en 170 pages
- *A Philosophy of Software Design* (Ousterhout) — La pensée derrière le code propre

---

## Et après la formation ?

Tu as fini les 14 modules ? Félicitations — tu es passé de débutant à avancé.

Pour la suite du parcours vers l'expertise, consulte le guide **[Et après ?](./ET-APRES.md)** — roadmap 12 mois, livres recommandés, conférences, et signaux de progression.
