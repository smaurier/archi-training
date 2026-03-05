# Cours 76 — Load Testing & Testing in Production

> **Objectif** : Maîtriser les profiles de load testing k6 (smoke, load, stress, spike, soak), comprendre le synthetic monitoring, et adopter le testing in production (canary analysis, feature flags, observability-driven testing).

---

## Rappel du cours précédent

<details>
<summary>1. Qu'est-ce que le consumer-driven contract testing avec Pact ?</summary>

Le **consumer** (front) écrit un test qui définit les réponses attendues de l'API. Ce test généré un **pact file** (JSON). Le **provider** (API) exécuté ce pact file contre sa vraie API avec des state handlers pour les fixtures. Si la réponse reelle ne matche pas le contrat → le test échoué. Cela détecté les breaking changes avant le merge.
</details>

<details>
<summary>2. Quand utiliser les contract tests plutot que les tests d'intégration ?</summary>

Les contract tests sont preferables quand il y a **plusieurs consumers** (web, mobile, tiers), des **équipes séparées** (front ≠ back), ou une **API publique**. Ils sont plus rapides et moins fragiles que les tests d'intégration complets. Pour un monolithe full-stack avec une seule équipe, les tests d'intégration suffisent.
</details>

---

## Analogie — Tester le pont avant l'ouverture

Avant d'ouvrir un pont au public :
- **Smoke test** : un camion traverse — le pont tient ? (baseline)
- **Load test** : 100 camions en continu — trafic normal
- **Stress test** : 500 camions — au-dela de la capacité prevue, ou casse-t-il ?
- **Spike test** : 200 camions arrivent d'un coup — le pont absorbe-t-il le pic ?
- **Soak test** : 100 camions pendant 24h — fatigue structurelle ?

Et une fois le pont ouvert, on continue a le surveiller avec des capteurs (monitoring) et on envoie des camions de test chaque nuit (synthetic monitoring).

---

## Théorie

### 1. k6 test profiles

```
         VUs
          │
   Stress │         ╱╲
          │        ╱  ╲
   Load   │───────╱────╲──────
          │      ╱      ╲
   Smoke  │─────╱────────╲───
          │    ╱          ╲
          └────────────────────> Time

Profile   VUs      Duration    Objectif
─────── ─────── ──────────── ────────────────────
Smoke     1-5     1-2 min     Baseline, pipeline CI
Load      50-200  10-30 min   Trafic normal
Stress    300+    10-30 min   Trouver le point de rupture
Spike     0→500   2-5 min     Absorption de pic
Soak      100     2-8h        Memory leaks, connection leaks
```

### 2. Metriques a surveiller

| Metrique | Seuil acceptable | Quand alerter |
|---|---|---|
| **p95 latency** | < 300ms | > 500ms |
| **p99 latency** | < 1s | > 2s |
| **Error rate** | < 1% | > 5% |
| **Throughput** | Stable | Chute > 20% |
| **CPU** | < 70% | > 90% |
| **Memory** | Stable | Croissance continue (leak) |

### 3. Synthetic monitoring

```
Cron (toutes les 5 min) :
  1. Executer un scenario reel (login → recherche → fiche produit)
  2. Mesurer la latence, verifier le status
  3. Si echec → alerter (PagerDuty, Slack)

Avantage : detecte les pannes AVANT les utilisateurs
Outil : k6 Cloud, Checkly, Grafana Synthetic
```

### 4. Testing in production

```
Feature flags + observability = testing in production

1. Deploy le code (canary 5%)
2. Observer les metriques (error rate, latence, business KPIs)
3. Comparer canary vs baseline
4. Si OK → promote to 100%
5. Si KO → rollback automatique

Ce que tu observes :
  - Error rate : canary vs baseline (< 0.1% difference)
  - p95 latency : canary vs baseline (< 10% regression)
  - Business KPI : conversion rate, cart abandonment
```

### 5. AI quality testing

```
Pour les features IA (traductions, recommandations, search) :
  - BLEU score pour les traductions (baseline > 0.7)
  - Precision/Recall pour la recherche
  - Cross-model grading : un modele evalue la sortie d'un autre

Pipeline :
  1. Generer des predictions sur un dataset de reference
  2. Comparer avec la baseline enregistree
  3. Si regression > seuil → bloquer le deploy
```

---

## Pratique

### k6 smoke test (CI)

```javascript
// tests/load/smoke.js
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: 5,
  duration: '2m',
  thresholds: {
    http_req_duration: ['p(95)<500'],  // p95 < 500ms
    http_req_failed: ['rate<0.01'],    // < 1% erreurs
  },
};

export default function () {
  // Scenario : lister les produits → voir un produit
  const listRes = http.get(`${__ENV.BASE_URL}/api/products`);
  check(listRes, {
    'list status 200': (r) => r.status === 200,
    'list has items': (r) => JSON.parse(r.body)['hydra:totalItems'] > 0,
  });

  sleep(1);

  const products = JSON.parse(listRes.body)['hydra:member'];
  if (products.length > 0) {
    const detailRes = http.get(
      `${__ENV.BASE_URL}/api/products/${products[0].id}`,
    );
    check(detailRes, {
      'detail status 200': (r) => r.status === 200,
      'detail has name': (r) => JSON.parse(r.body).name !== undefined,
    });
  }

  sleep(1);
}
```

### k6 load test

```javascript
// tests/load/load.js
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '2m', target: 50 },   // Ramp-up
    { duration: '10m', target: 50 },   // Plateau
    { duration: '2m', target: 100 },   // Augmentation
    { duration: '10m', target: 100 },  // Plateau
    { duration: '2m', target: 0 },     // Ramp-down
  ],
  thresholds: {
    http_req_duration: ['p(95)<300', 'p(99)<1000'],
    http_req_failed: ['rate<0.01'],
  },
};

export default function () {
  const params = {
    headers: {
      Authorization: `Bearer ${__ENV.TEST_TOKEN}`,
      'X-Tenant-Id': 'load-test-tenant',
    },
  };

  // Mix de requetes realiste
  const rand = Math.random();
  if (rand < 0.5) {
    // 50% : listing produits (lecture)
    http.get(`${__ENV.BASE_URL}/api/products?page=1`, params);
  } else if (rand < 0.8) {
    // 30% : detail produit (lecture)
    http.get(`${__ENV.BASE_URL}/api/products/product-1`, params);
  } else {
    // 20% : ajout au panier (ecriture)
    http.post(
      `${__ENV.BASE_URL}/api/cart/items`,
      JSON.stringify({ productId: 'product-1', quantity: 1 }),
      { ...params, headers: { ...params.headers, 'Content-Type': 'application/json' } },
    );
  }

  sleep(Math.random() * 3 + 1); // 1-4s think time
}
```

### k6 stress test

```javascript
// tests/load/stress.js
export const options = {
  stages: [
    { duration: '2m', target: 100 },
    { duration: '5m', target: 200 },
    { duration: '5m', target: 300 },  // Au-dela de la capacite
    { duration: '5m', target: 400 },  // Point de rupture ?
    { duration: '2m', target: 0 },
  ],
  thresholds: {
    // Plus permissif : on CHERCHE le point de rupture
    http_req_duration: ['p(95)<2000'],
    http_req_failed: ['rate<0.10'],
  },
};

// Meme scenario que load test
```

### Intégration CI (k6 en smoke sur chaque MR)

```yaml
# .github/workflows/ci.yml
  load-test-smoke:
    needs: deploy-staging
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: grafana/k6-action@v0.3.1
        with:
          filename: tests/load/smoke.js
        env:
          BASE_URL: ${{ vars.STAGING_URL }}
          TEST_TOKEN: ${{ secrets.LOAD_TEST_TOKEN }}
```

---

## Resume

1. **5 profiles k6** : smoke (CI, 2min), load (trafic normal), stress (point de rupture), spike (pic soudain), soak (fuites mémoire)
2. **Metriques** : p95 < 300ms, error rate < 1%, throughput stable, CPU < 70%, mémoire stable
3. **Synthetic monitoring** : scénarios reels executes toutes les 5min — détecté les pannes AVANT les utilisateurs
4. **Testing in production** : canary 5% + observability → comparer metriques canary vs baseline → promote ou rollback
5. **CI intégration** : smoke test k6 sur chaque MR (2min), load test complet en nightly

---

> **Prochain cours** : [Cours 77 — Documentation d'architecture (ADR, C4)](../12-architecture-pratique/01-documentation-architecture.md)

---

> **Lien fil rouge — ShopArch**
>
> - Écris le scénario k6 pour ShopArch : search → product → add to cart → checkout
> - Valide les SLOs sous charge : p95 < 300ms avec 100 VUs
> - Exercice(s) associé(s) : `exercices/52-load-test-k6/`
> - Checkpoint : Module 11, critère 4
