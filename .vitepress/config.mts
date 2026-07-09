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

  // Docs statiques : neutralise l'interpolation Vue `{{ }}` en prose (SSR).
  // NB : override `delimiters` retiré (il cassait le {{ }} du thème par défaut).
  // cf docs/curriculum/DETTE-vitepress-delimiters.md


  ignoreDeadLinks: true,

  // Refonte v1 : le cours vit dans modules/ (théorie) + labs/ (exercices de conception).
  // L'ancien contenu (cours/, exercices/, quizzes/, projet-fil-rouge/, src/) est conservé
  // sur disque comme archive/source d'audit mais EXCLU du build.
  srcExclude: [
    'cours/**',
    'exercices/**',
    'quizzes/**',
    'projet-fil-rouge/**',
    'src/**'
  ],

  themeConfig: {
    nav: [
      { text: 'Modules', link: '/modules/00-quest-ce-que-architecture-et-posture' },
      { text: 'Labs', link: '/labs/lab-00-quest-ce-que-architecture-et-posture/README' }
    ],

    sidebar: {
      '/modules/': [
        {
          text: 'Fondations',
          items: [
            { text: '00 · Qu\'est-ce que l\'architecture', link: '/modules/00-quest-ce-que-architecture-et-posture' },
            { text: '01 · Principes SOLID', link: '/modules/01-principes-solid' },
            { text: '02 · Design patterns essentiels', link: '/modules/02-design-patterns-essentiels' },
            { text: '03 · Clean code, smells & refactoring', link: '/modules/03-clean-code-code-smells-refactoring' },
            { text: '04 · Injection de dépendances & IoC', link: '/modules/04-dependency-injection-ioc' }
          ]
        },
        {
          text: 'Patterns architecturaux',
          items: [
            { text: '05 · Architecture en couches', link: '/modules/05-architecture-en-couches' },
            { text: '06 · Architecture hexagonale', link: '/modules/06-architecture-hexagonale' },
            { text: '07 · Clean architecture', link: '/modules/07-clean-architecture' },
            { text: '08 · Monolithe modulaire vs microservices', link: '/modules/08-monolithe-modulaire-vs-microservices' }
          ]
        },
        {
          text: 'Domain-Driven Design',
          items: [
            { text: '09 · DDD stratégique', link: '/modules/09-ddd-strategique' },
            { text: '10 · DDD tactique', link: '/modules/10-ddd-tactique' }
          ]
        },
        {
          text: 'Backend & données',
          items: [
            { text: '11 · API design & backend patterns', link: '/modules/11-api-design-et-backend-patterns' },
            { text: '12 · Jobs, concurrence & async', link: '/modules/12-jobs-concurrence-async' },
            { text: '13 · Architecture des données', link: '/modules/13-architecture-donnees' }
          ]
        },
        {
          text: 'Frontend',
          items: [
            { text: '14 · Architecture frontend', link: '/modules/14-architecture-frontend' },
            { text: '15 · Frontend avancé (micro, offline)', link: '/modules/15-frontend-avance-micro-offline' }
          ]
        },
        {
          text: 'Communication & distribué',
          items: [
            { text: '16 · Communication & intégration', link: '/modules/16-communication-et-integration' },
            { text: '17 · Event-driven & messaging', link: '/modules/17-event-driven-et-messaging' },
            { text: '18 · Distribués : CQRS, ES, Saga', link: '/modules/18-patterns-distribues-cqrs-es-saga' },
            { text: '19 · Résilience, cohérence & migration', link: '/modules/19-resilience-consistency-migration' }
          ]
        },
        {
          text: 'Qualités transverses & culture',
          items: [
            { text: '20 · Sécurité architecturale', link: '/modules/20-securite-architecturale' },
            { text: '21 · Performance & scalabilité', link: '/modules/21-performance-scalabilite' },
            { text: '22 · Observabilité & testabilité', link: '/modules/22-observabilite-et-testing-archi' },
            { text: '23 · Décisions, culture & capstone', link: '/modules/23-decisions-culture-et-capstone' }
          ]
        }
      ],
      '/labs/': [
        {
          text: 'Labs — exercices de conception',
          items: [
            { text: 'Lab 00 · Qu\'est-ce que l\'architecture', link: '/labs/lab-00-quest-ce-que-architecture-et-posture/README' },
            { text: 'Lab 01 · SOLID', link: '/labs/lab-01-principes-solid/README' },
            { text: 'Lab 02 · Design patterns', link: '/labs/lab-02-design-patterns-essentiels/README' },
            { text: 'Lab 03 · Clean code & refactoring', link: '/labs/lab-03-clean-code-code-smells-refactoring/README' },
            { text: 'Lab 04 · DI & IoC', link: '/labs/lab-04-dependency-injection-ioc/README' },
            { text: 'Lab 05 · Architecture en couches', link: '/labs/lab-05-architecture-en-couches/README' },
            { text: 'Lab 06 · Hexagonale', link: '/labs/lab-06-architecture-hexagonale/README' },
            { text: 'Lab 07 · Clean architecture', link: '/labs/lab-07-clean-architecture/README' },
            { text: 'Lab 08 · Mono vs microservices', link: '/labs/lab-08-monolithe-modulaire-vs-microservices/README' },
            { text: 'Lab 09 · DDD stratégique', link: '/labs/lab-09-ddd-strategique/README' },
            { text: 'Lab 10 · DDD tactique', link: '/labs/lab-10-ddd-tactique/README' },
            { text: 'Lab 11 · API & backend patterns', link: '/labs/lab-11-api-design-et-backend-patterns/README' },
            { text: 'Lab 12 · Jobs & concurrence', link: '/labs/lab-12-jobs-concurrence-async/README' },
            { text: 'Lab 13 · Architecture des données', link: '/labs/lab-13-architecture-donnees/README' },
            { text: 'Lab 14 · Architecture frontend', link: '/labs/lab-14-architecture-frontend/README' },
            { text: 'Lab 15 · Frontend avancé', link: '/labs/lab-15-frontend-avance-micro-offline/README' },
            { text: 'Lab 16 · Communication', link: '/labs/lab-16-communication-et-integration/README' },
            { text: 'Lab 17 · Event-driven', link: '/labs/lab-17-event-driven-et-messaging/README' },
            { text: 'Lab 18 · CQRS, ES, Saga', link: '/labs/lab-18-patterns-distribues-cqrs-es-saga/README' },
            { text: 'Lab 19 · Résilience & migration', link: '/labs/lab-19-resilience-consistency-migration/README' },
            { text: 'Lab 20 · Sécurité architecturale', link: '/labs/lab-20-securite-architecturale/README' },
            { text: 'Lab 21 · Performance & scalabilité', link: '/labs/lab-21-performance-scalabilite/README' },
            { text: 'Lab 22 · Observabilité & testabilité', link: '/labs/lab-22-observabilite-et-testing-archi/README' },
            { text: 'Lab 23 · Capstone', link: '/labs/lab-23-decisions-culture-et-capstone/README' }
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
