---
layout: home

hero:
  name: "Architecture Logicielle"
  text: "SOLID · DDD · Microservices · Cloud Native"
  tagline: Du code au système — maîtrisez l'architecture logicielle fullstack de la conception au déploiement
  actions:
    - theme: brand
      text: Commencer le cours
      link: /cours/00-fondamentaux/01-quest-ce-que-larchitecture
    - theme: alt
      text: Guide apprenant
      link: /cours/GUIDE-APPRENANT
    - theme: alt
      text: Parcours recommandé
      link: /cours/parcours

features:
  - icon: 🏗️
    title: Fondamentaux & SOLID
    details: Clean Code, principes SOLID, refactoring et documentation vivante pour poser des bases solides.
  - icon: 🗺️
    title: Patterns Architecturaux
    details: Clean Architecture, hexagonale, event-driven, microservices, CQRS, Event Sourcing et Twelve-Factor.
  - icon: 🧩
    title: Domain-Driven Design
    details: Ubiquitous Language, Bounded Contexts, Aggregates, Entities et Repositories pour modéliser le métier.
  - icon: ⚡
    title: Performance & Scalabilité
    details: Caching, Load Balancing, CDN, profiling BDD et patterns serverless pour tenir la charge.
  - icon: 🔒
    title: Sécurité & RGPD
    details: OWASP Top 10, auth avancée, gestion des secrets, compliance RGPD et Privacy by Design.
  - icon: 🔭
    title: Observabilité & FinOps
    details: Logging, métriques, tracing distribué, IaC, ADR et culture architecturale en entreprise.
---

## Structure du cours

| Module | Thèmes |
|--------|--------|
| [0. Fondamentaux](/cours/00-fondamentaux/01-quest-ce-que-larchitecture) | SOLID, Clean Code, refactoring, posture architecte |
| [1. Patterns Architecturaux](/cours/01-patterns-architecturaux/01-couches) | Couches, Clean Archi, hexagonale, event-driven, microservices, CQRS |
| [2. DDD](/cours/02-domain-driven-design/01-intro-ddd) | Ubiquitous Language, Bounded Contexts, Aggregates, Repositories |
| [3. Architecture Backend](/cours/03-architecture-backend/01-api-design) | REST, GraphQL, gRPC, auth, jobs, file storage |
| [4. Architecture BDD](/cours/04-architecture-bdd/01-modelisation) | Modélisation, PostgreSQL avancé, Redis, NoSQL, Search |
| [5. Architecture Frontend](/cours/05-architecture-frontend/01-component-design) | Components, state, micro-frontends, PWA, SSR, Core Web Vitals |
| [6. Communication & Intégration](/cours/06-communication-integration/01-reseau) | Message Queues, Event Bus, WebSockets, API Gateway |
| [7. Patterns Distribués](/cours/07-patterns-distribues/01-theorie) | Circuit Breaker, Saga, Outbox, Service Mesh, Consistency |
| [8. Sécurité](/cours/08-securite/01-owasp) | OWASP, auth avancée, secrets, RGPD, pentest |
| [9. Performance & Scalabilité](/cours/09-performance-scalabilite/01-caching) | Caching, Load Balancing, profiling, CDN, serverless |
| [10. Observabilité & DevOps](/cours/10-observabilite-devops/01-logging) | Logging, métriques, tracing, alerting, IaC |
| [11. Testing Architecture](/cours/11-testing-architecture/01-pyramide) | Pyramide, contrats, chaos engineering, load testing |
| [12. Architecture Pratique](/cours/12-architecture-pratique/01-documentation) | ADR, Tech Radar, code review, dette technique, migrations |
| [13. Culture Architecturale](/cours/13-culture-architecturale/01-mobile) | Mobile, SaaS, platform engineering, présenter une architecture |

### Prérequis

- [JavaScript avancé](/cours/prerequis-javascript/index)
- [TypeScript](/cours/prerequis-typescript/index)
- [NestJS](/cours/prerequis-nestjs/index)

## Démarrer en local

```bash
# dans 11-architecture/
pnpm install
pnpm docs:dev    # → http://localhost:5173
```
