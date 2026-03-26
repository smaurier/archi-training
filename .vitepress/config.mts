import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'Architecture Logicielle',
  description: 'Architecture logicielle fullstack : SOLID, DDD, patterns, microservices, sécurité, performance et culture architecturale',
  lang: 'fr-FR',
  srcDir: '.',

  vite: {
    server: {
      port: 5173,
      strictPort: false
    }
  },

  ignoreDeadLinks: true,

  themeConfig: {
    nav: [
      { text: 'Cours', link: '/cours/00-fondamentaux/01-quest-ce-que-larchitecture' },
      { text: 'Exercices', link: '/exercices/README' },
      { text: 'Quizzes', link: '/quizzes/' },
      { text: 'Projet fil rouge', link: '/projet-fil-rouge/README' }
    ],

    sidebar: {
      '/cours/': [
        {
          text: 'Démarrage',
          items: [
            { text: 'Guide apprenant', link: '/cours/GUIDE-APPRENANT' },
            { text: 'Parcours recommandé', link: '/cours/parcours' },
            { text: 'Glossaire', link: '/cours/GLOSSAIRE' },
            { text: 'Et après ?', link: '/cours/ET-APRES' }
          ]
        },
        {
          text: 'Prérequis',
          items: [
            { text: 'Prérequis JavaScript', link: '/cours/prerequis-javascript/index' },
            { text: 'Prérequis TypeScript', link: '/cours/prerequis-typescript/index' },
            { text: 'Prérequis NestJS', link: '/cours/prerequis-nestjs/index' }
          ]
        },
        {
          text: '0. Fondamentaux',
          items: [
            { text: "Qu'est-ce que l'architecture ?", link: '/cours/00-fondamentaux/01-quest-ce-que-larchitecture' },
            { text: 'SOLID', link: '/cours/00-fondamentaux/02-solid' },
            { text: 'Clean Code', link: '/cours/00-fondamentaux/03-clean-code' },
            { text: 'Principes de design', link: '/cours/00-fondamentaux/04-principes-de-design' },
            { text: 'Refactoring', link: '/cours/00-fondamentaux/05-refactoring' },
            { text: 'Documentation vivante', link: '/cours/00-fondamentaux/06-documentation-vivante' },
            { text: 'Posture architecte', link: '/cours/00-fondamentaux/07-posture-architecte' }
          ]
        },
        {
          text: '1. Patterns Architecturaux',
          items: [
            { text: 'Architecture en couches', link: '/cours/01-patterns-architecturaux/01-couches' },
            { text: 'Clean Architecture', link: '/cours/01-patterns-architecturaux/02-clean-architecture' },
            { text: 'Hexagonale / Ports & Adapters', link: '/cours/01-patterns-architecturaux/03-hexagonale' },
            { text: 'Event-Driven', link: '/cours/01-patterns-architecturaux/04-event-driven' },
            { text: 'Microservices', link: '/cours/01-patterns-architecturaux/05-microservices' },
            { text: 'CQRS & Event Sourcing', link: '/cours/01-patterns-architecturaux/06-cqrs-event-sourcing' },
            { text: 'Twelve-Factor App', link: '/cours/01-patterns-architecturaux/07-twelve-factor' }
          ]
        },
        {
          text: '2. Domain-Driven Design',
          items: [
            { text: 'Introduction DDD', link: '/cours/02-domain-driven-design/01-intro-ddd' },
            { text: 'Ubiquitous Language', link: '/cours/02-domain-driven-design/02-ubiquitous-language' },
            { text: 'Bounded Contexts', link: '/cours/02-domain-driven-design/03-bounded-contexts' },
            { text: 'Aggregates & Entities', link: '/cours/02-domain-driven-design/04-aggregates-entities' },
            { text: 'Repositories', link: '/cours/02-domain-driven-design/05-repositories' }
          ]
        },
        {
          text: '3. Architecture Backend',
          items: [
            { text: 'API Design', link: '/cours/03-architecture-backend/01-api-design' },
            { text: 'REST avancé', link: '/cours/03-architecture-backend/02-rest-avance' },
            { text: 'GraphQL architecture', link: '/cours/03-architecture-backend/03-graphql' },
            { text: 'gRPC & Protobuf', link: '/cours/03-architecture-backend/04-grpc' },
            { text: 'Auth & Autorisation', link: '/cours/03-architecture-backend/05-auth' },
            { text: 'File Storage', link: '/cours/03-architecture-backend/06-file-storage' },
            { text: 'Emails & Notifications', link: '/cours/03-architecture-backend/07-emails' },
            { text: 'Background Jobs', link: '/cours/03-architecture-backend/08-background-jobs' }
          ]
        },
        {
          text: '4. Architecture BDD',
          items: [
            { text: 'Modélisation', link: '/cours/04-architecture-bdd/01-modelisation' },
            { text: 'PostgreSQL avancé', link: '/cours/04-architecture-bdd/02-postgresql-avance' },
            { text: 'Migrations', link: '/cours/04-architecture-bdd/03-migrations' },
            { text: 'Redis', link: '/cours/04-architecture-bdd/04-redis' },
            { text: 'NoSQL', link: '/cours/04-architecture-bdd/05-nosql' },
            { text: 'Search', link: '/cours/04-architecture-bdd/06-search' }
          ]
        },
        {
          text: '5. Architecture Frontend',
          items: [
            { text: 'Component Design', link: '/cours/05-architecture-frontend/01-component-design' },
            { text: 'State Management', link: '/cours/05-architecture-frontend/02-state-management' },
            { text: 'Micro-frontends', link: '/cours/05-architecture-frontend/03-micro-frontends' },
            { text: 'Module Federation', link: '/cours/05-architecture-frontend/04-module-federation' },
            { text: 'Design System', link: '/cours/05-architecture-frontend/05-design-system' },
            { text: 'Performance front', link: '/cours/05-architecture-frontend/06-performance' },
            { text: 'PWA', link: '/cours/05-architecture-frontend/07-pwa' },
            { text: 'SSR / SSG', link: '/cours/05-architecture-frontend/08-ssr-ssg' },
            { text: 'Core Web Vitals', link: '/cours/05-architecture-frontend/09-core-web-vitals' },
            { text: 'Offline first', link: '/cours/05-architecture-frontend/10-offline-first' }
          ]
        },
        {
          text: '6. Communication & Intégration',
          items: [
            { text: 'Réseau', link: '/cours/06-communication-integration/01-reseau' },
            { text: 'Message Queues', link: '/cours/06-communication-integration/02-message-queues' },
            { text: 'Event Bus', link: '/cours/06-communication-integration/03-event-bus' },
            { text: 'WebSockets & SSE', link: '/cours/06-communication-integration/04-websockets' },
            { text: 'API Versioning', link: '/cours/06-communication-integration/05-api-versioning' },
            { text: 'API Gateway', link: '/cours/06-communication-integration/06-api-gateway' }
          ]
        },
        {
          text: '7. Patterns Distribués',
          items: [
            { text: 'Théorie des systèmes distribués', link: '/cours/07-patterns-distribues/01-theorie' },
            { text: 'Circuit Breaker', link: '/cours/07-patterns-distribues/02-circuit-breaker' },
            { text: 'Saga Pattern', link: '/cours/07-patterns-distribues/03-saga' },
            { text: 'Outbox Pattern', link: '/cours/07-patterns-distribues/04-outbox' },
            { text: 'Service Mesh', link: '/cours/07-patterns-distribues/05-service-mesh' },
            { text: 'Résilience', link: '/cours/07-patterns-distribues/06-resilience' },
            { text: 'Consistency', link: '/cours/07-patterns-distribues/07-consistency' }
          ]
        },
        {
          text: '8. Sécurité',
          items: [
            { text: 'OWASP Top 10', link: '/cours/08-securite/01-owasp' },
            { text: 'Authentification avancée', link: '/cours/08-securite/02-auth-avance' },
            { text: 'Secrets & Config', link: '/cours/08-securite/03-secrets' },
            { text: 'RGPD & Compliance', link: '/cours/08-securite/04-rgpd' },
            { text: 'Pentest & Audit', link: '/cours/08-securite/05-pentest' },
            { text: 'Privacy by Design', link: '/cours/08-securite/06-privacy' }
          ]
        },
        {
          text: '9. Performance & Scalabilité',
          items: [
            { text: 'Caching stratégies', link: '/cours/09-performance-scalabilite/01-caching' },
            { text: 'Load Balancing', link: '/cours/09-performance-scalabilite/02-load-balancing' },
            { text: 'Profiling', link: '/cours/09-performance-scalabilite/03-profiling' },
            { text: 'Database performance', link: '/cours/09-performance-scalabilite/04-database-performance' },
            { text: 'CDN & Edge', link: '/cours/09-performance-scalabilite/05-cdn-edge' },
            { text: 'Serverless', link: '/cours/09-performance-scalabilite/06-serverless' }
          ]
        },
        {
          text: '10. Observabilité & DevOps',
          items: [
            { text: 'Logging', link: '/cours/10-observabilite-devops/01-logging' },
            { text: 'Métriques', link: '/cours/10-observabilite-devops/02-metriques' },
            { text: 'Tracing distribué', link: '/cours/10-observabilite-devops/03-tracing' },
            { text: 'Alerting', link: '/cours/10-observabilite-devops/04-alerting' },
            { text: 'IaC', link: '/cours/10-observabilite-devops/05-iac' }
          ]
        },
        {
          text: '11. Testing Architecture',
          items: [
            { text: 'Pyramide des tests', link: '/cours/11-testing-architecture/01-pyramide' },
            { text: 'Tests de contrat', link: '/cours/11-testing-architecture/02-contrats' },
            { text: 'Chaos Engineering', link: '/cours/11-testing-architecture/03-chaos' },
            { text: 'Load Testing', link: '/cours/11-testing-architecture/04-load-testing' }
          ]
        },
        {
          text: '12. Architecture Pratique',
          items: [
            { text: 'Documentation ADR', link: '/cours/12-architecture-pratique/01-documentation' },
            { text: 'Architecture Decision Records', link: '/cours/12-architecture-pratique/02-adr' },
            { text: 'Tech Radar', link: '/cours/12-architecture-pratique/03-tech-radar' },
            { text: 'Code Review', link: '/cours/12-architecture-pratique/04-code-review' },
            { text: 'Technical Debt', link: '/cours/12-architecture-pratique/05-technical-debt' },
            { text: 'Migrations', link: '/cours/12-architecture-pratique/06-migrations' },
            { text: 'FinOps', link: '/cours/12-architecture-pratique/07-finops' }
          ]
        },
        {
          text: '13. Culture Architecturale',
          items: [
            { text: 'Architecture mobile', link: '/cours/13-culture-architecturale/01-mobile' },
            { text: 'SaaS patterns', link: '/cours/13-culture-architecturale/02-saas' },
            { text: 'Platform Engineering', link: '/cours/13-culture-architecturale/03-platform' },
            { text: 'Architecture de nuit', link: '/cours/13-culture-architecturale/04-night-architecture' },
            { text: 'Présenter une architecture', link: '/cours/13-culture-architecturale/05-presenter' },
            { text: 'Legacy & Modernisation', link: '/cours/13-culture-architecturale/06-legacy' }
          ]
        }
      ]
    },

    search: {
      provider: 'local'
    },

    outline: {
      level: [2, 3],
      label: 'Sur cette page'
    },

    docFooter: {
      prev: 'Précédent',
      next: 'Suivant'
    }
  }
})
