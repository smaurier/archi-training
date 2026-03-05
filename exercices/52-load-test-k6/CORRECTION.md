# Correction — Exercice 52 : Load test avec k6

## Scénario utilisateur

```javascript
// load-test.js
import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
const checkoutDuration = new Trend('checkout_duration');
const errorRate = new Rate('errors');

// Configuration
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const TENANT_ID = 'tenant-test-123';

export const options = {
  scenarios: {
    // Smoke test
    smoke: {
      executor: 'constant-vus',
      vus: 1,
      duration: '30s',
      tags: { test_type: 'smoke' },
      exec: 'userJourney',
    },
    // Load test
    load: {
      executor: 'constant-vus',
      vus: 100,
      duration: '5m',
      startTime: '1m', // apres le smoke test
      tags: { test_type: 'load' },
      exec: 'userJourney',
    },
    // Stress test
    stress: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '5m', target: 500 },  // rampe
        { duration: '5m', target: 500 },  // plateau
        { duration: '5m', target: 0 },    // descente
      ],
      startTime: '7m', // apres le load test
      tags: { test_type: 'stress' },
      exec: 'userJourney',
    },
  },

  thresholds: {
    http_req_duration: [
      'p(95)<500',   // p95 < 500ms
      'p(99)<1000',  // p99 < 1s
    ],
    http_req_failed: ['rate<0.01'], // < 1% d'erreurs
    errors: ['rate<0.01'],
    checkout_duration: ['p(95)<2000'], // checkout p95 < 2s
  },
};

export function userJourney() {
  const headers = {
    'Content-Type': 'application/json',
    'X-Tenant-ID': TENANT_ID,
  };

  // 1. Page d'accueil (60% des users)
  group('Homepage', () => {
    const res = http.get(`${BASE_URL}/api/products?limit=16`, { headers });
    check(res, {
      'homepage status 200': (r) => r.status === 200,
      'homepage has products': (r) => JSON.parse(r.body).data.length > 0,
    }) || errorRate.add(1);
  });

  sleep(randomBetween(1, 3));

  // 2. Recherche (40% des users)
  let productId;
  if (Math.random() < 0.4) {
    group('Search', () => {
      const terms = ['book', 'course', 'shirt', 'mug', 'sticker'];
      const term = terms[Math.floor(Math.random() * terms.length)];
      const res = http.get(`${BASE_URL}/api/products?q=${term}&limit=10`, { headers });
      check(res, { 'search status 200': (r) => r.status === 200 }) || errorRate.add(1);

      const products = JSON.parse(res.body).data;
      if (products.length > 0) {
        productId = products[Math.floor(Math.random() * products.length)].id;
      }
    });
    sleep(randomBetween(1, 2));
  }

  // 3. Page produit (80% des users)
  if (productId || Math.random() < 0.8) {
    group('Product page', () => {
      const id = productId || 'default-product-id';
      const res = http.get(`${BASE_URL}/api/products/${id}`, { headers });
      check(res, {
        'product status 200': (r) => r.status === 200,
        'product has price': (r) => JSON.parse(r.body).price > 0,
      }) || errorRate.add(1);

      if (!productId) productId = id;
    });
    sleep(randomBetween(2, 5));
  }

  // 4. Ajout au panier (30% des users)
  if (productId && Math.random() < 0.3) {
    group('Add to cart', () => {
      const res = http.post(`${BASE_URL}/api/cart`, JSON.stringify({
        productId,
        quantity: Math.floor(Math.random() * 3) + 1,
      }), { headers });
      check(res, {
        'cart status 201': (r) => r.status === 201,
      }) || errorRate.add(1);
    });
    sleep(randomBetween(1, 3));

    // 5. Checkout (10% des users qui ajoutent au panier)
    if (Math.random() < 0.1) {
      group('Checkout', () => {
        const start = Date.now();
        const res = http.post(`${BASE_URL}/api/checkout`, JSON.stringify({
          address: { line1: '123 Test St', city: 'Paris', zip: '75001' },
          paymentMethod: 'card_test',
        }), { headers });

        checkoutDuration.add(Date.now() - start);

        check(res, {
          'checkout status 2xx': (r) => r.status >= 200 && r.status < 300,
        }) || errorRate.add(1);
      });
    }
  }
}

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}
```

## Spike test (profil séparé)

```javascript
// spike-test.js
export const options = {
  scenarios: {
    spike: {
      executor: 'ramping-vus',
      startVUs: 10,
      stages: [
        { duration: '10s', target: 10 },   // baseline
        { duration: '10s', target: 500 },   // spike
        { duration: '1m', target: 500 },    // maintien
        { duration: '10s', target: 10 },    // retour normal
        { duration: '1m', target: 10 },     // recovery
      ],
    },
  },
  thresholds: {
    http_req_duration: ['p(99)<2000'], // plus tolerant pour le spike
    http_req_failed: ['rate<0.05'],    // < 5% d'erreurs accepte
  },
};
```

## Analyse des résultats

```
# Execution
k6 run --out json=results.json load-test.js

# Rapport attendu
# scenarios...........: 3 (smoke, load, stress)
# http_reqs..........: 45,230  284.9/s
# http_req_duration..: avg=45ms p95=180ms p99=450ms
# http_req_failed....: 0.3%
# errors.............: 0.3%
# checkout_duration..: avg=320ms p95=890ms
# vus................: max=500
```

### Analyse type

| Metrique | Smoke (1 VU) | Load (100 VU) | Stress (500 VU) |
|---|---|---|---|
| p95 latence | 25ms | 180ms | 850ms |
| p99 latence | 40ms | 450ms | 2100ms ❌ |
| Error rate | 0% | 0.1% | 3.2% ❌ |
| Throughput | 15 req/s | 284 req/s | 380 req/s |

**Point de rupture** : ~350 VU (p99 depasse 1s, error rate depasse 1%)

**Bottlenecks identifies** :
1. Endpoint `/api/products?q=*` : p99 = 1.2s a 500 VU (manque d'index)
2. Connexions DB saturees a 400 VU (pool size = 50, besoin 100)
3. Checkout p95 OK mais p99 degradee (service paiement externe)

**Recommandations** :
1. Ajouter un index sur le champ de recherche full-text
2. Augmenter le pool de connexions DB (50 → 150)
3. Circuit breaker sur le service de paiement + timeout 5s
4. Cache Redis pour les recherches fréquentes (TTL 1 min)

## Ce que tu aurais pu oublier

### 1. Distribution non realiste
```
FAUX — chaque VU fait search → product → cart → checkout (100% de conversion)
CORRECT — distribution realiste : 60% homepage, 40% search, 30% cart, 3% checkout
         Le vrai taux de conversion e-commerce est 2-5%
```

### 2. Pas de think time
```
FAUX — les requetes sont enchaines sans pause (charge artificielle)
CORRECT — sleep(1-5s) entre les etapes pour simuler un vrai utilisateur
```

### 3. Thresholds dans le rapport seulement
```
FAUX — regarder les resultats manuellement apres le test
CORRECT — thresholds dans le script k6 → exit code 1 si rate → bloque le CI
```

### 4. Un seul profil de charge
```
FAUX — un test a 500 VU constant
CORRECT — smoke (ca marche?) → load (charge normale) → stress (limites) → spike (resilience)
         Chaque profil repond a une question differente
```
