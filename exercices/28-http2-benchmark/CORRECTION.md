# Correction — Exercice 28 : HTTP/2 vs HTTP/1.1 benchmark

## Serveur HTTP/2

```typescript
// server-h2.ts
import http2 from 'node:http2';
import fs from 'node:fs';
import path from 'node:path';

const LATENCY_MS = 50;

const server = http2.createSecureServer({
  key: fs.readFileSync('certs/localhost-key.pem'),
  cert: fs.readFileSync('certs/localhost-cert.pem'),
});

const MIME: Record<string, string> = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
};

// Ressources critiques a push
const PUSH_RESOURCES = ['/css/main.css', '/js/main.js'];

server.on('stream', async (stream, headers) => {
  const reqPath = headers[':path'] as string;
  const filePath = path.join('public', reqPath === '/' ? 'index.html' : reqPath);

  // Simule latence reseau
  await new Promise((r) => setTimeout(r, LATENCY_MS));

  // Server Push pour la page principale
  if (reqPath === '/') {
    for (const resource of PUSH_RESOURCES) {
      stream.pushStream({ ':path': resource }, (err, pushStream) => {
        if (err) return;
        const ext = path.extname(resource);
        pushStream.respondWithFile(path.join('public', resource), {
          'content-type': MIME[ext] ?? 'application/octet-stream',
        });
      });
    }
  }

  const ext = path.extname(filePath);
  try {
    stream.respondWithFile(filePath, {
      'content-type': MIME[ext] ?? 'application/octet-stream',
    });
  } catch {
    stream.respond({ ':status': 404 });
    stream.end('Not found');
  }
});

server.listen(8443, () => console.log('HTTP/2 on https://localhost:8443'));
```

## Serveur HTTP/1.1

```typescript
// server-h1.ts
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const LATENCY_MS = 50;

const server = http.createServer(async (req, res) => {
  const reqPath = req.url ?? '/';
  const filePath = path.join('public', reqPath === '/' ? 'index.html' : reqPath);

  await new Promise((r) => setTimeout(r, LATENCY_MS));

  try {
    const content = fs.readFileSync(filePath);
    const ext = path.extname(filePath);
    const mime: Record<string, string> = {
      '.html': 'text/html', '.css': 'text/css',
      '.js': 'application/javascript', '.png': 'image/png',
    };
    res.writeHead(200, { 'Content-Type': mime[ext] ?? 'application/octet-stream' });
    res.end(content);
  } catch {
    res.writeHead(404);
    res.end('Not found');
  }
});

server.listen(8080, () => console.log('HTTP/1.1 on http://localhost:8080'));
```

## Script de benchmark

```typescript
// benchmark.ts
import { performance } from 'node:perf_hooks';

interface BenchmarkResult {
  protocol: string;
  totalTime: number;
  ttfb: number;
  requestCount: number;
  connectionsUsed: number;
}

async function benchmarkPage(baseUrl: string, resources: string[]): Promise<BenchmarkResult> {
  const start = performance.now();
  let ttfb = 0;

  // Charge la page HTML
  const htmlStart = performance.now();
  const htmlRes = await fetch(`${baseUrl}/`);
  ttfb = performance.now() - htmlStart;
  await htmlRes.text();

  // Charge toutes les ressources en parallele
  await Promise.all(resources.map(async (r) => {
    const res = await fetch(`${baseUrl}${r}`);
    await res.arrayBuffer();
  }));

  return {
    protocol: baseUrl.startsWith('https') ? 'HTTP/2' : 'HTTP/1.1',
    totalTime: performance.now() - start,
    ttfb,
    requestCount: resources.length + 1,
    connectionsUsed: baseUrl.startsWith('https') ? 1 : 6, // H2=1, H1=6 max
  };
}

const resources = [
  '/css/main.css', '/css/vendor.css', '/css/product.css',
  '/js/main.js', '/js/vendor.js', '/js/product.js', '/js/analytics.js', '/js/cart.js',
  ...Array.from({ length: 12 }, (_, i) => `/img/product-${i + 1}.jpg`),
];

async function run() {
  const ITERATIONS = 10;
  const results: { h1: BenchmarkResult[]; h2: BenchmarkResult[] } = { h1: [], h2: [] };

  for (let i = 0; i < ITERATIONS; i++) {
    results.h1.push(await benchmarkPage('http://localhost:8080', resources));
    results.h2.push(await benchmarkPage('https://localhost:8443', resources));
  }

  const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;

  console.table({
    'HTTP/1.1': {
      'Avg Total (ms)': avg(results.h1.map((r) => r.totalTime)).toFixed(1),
      'Avg TTFB (ms)': avg(results.h1.map((r) => r.ttfb)).toFixed(1),
      'Connections': 6,
      'Multiplexing': 'No',
    },
    'HTTP/2': {
      'Avg Total (ms)': avg(results.h2.map((r) => r.totalTime)).toFixed(1),
      'Avg TTFB (ms)': avg(results.h2.map((r) => r.ttfb)).toFixed(1),
      'Connections': 1,
      'Multiplexing': 'Yes',
    },
  });
}

run();
```

## Résultats attendus (50ms latence, 20 ressources)

| Metrique | HTTP/1.1 | HTTP/2 | HTTP/2 + Push |
|---|---|---|---|
| Total load | ~750ms | ~300ms | ~250ms |
| TTFB | ~55ms | ~55ms | ~55ms |
| Connexions TCP | 6 | 1 | 1 |
| Round-trips réseau | 4 (20/6 = 4 vagues) | 1 (tout multiplexe) | 1 + push preemptif |

## Ce que tu aurais pu oublier

### 1. Pas de TLS pour HTTP/2
```
FAUX — HTTP/2 en clair (h2c) sans TLS
CORRECT — Les navigateurs n'acceptent HTTP/2 qu'avec TLS (h2)
```

### 2. Push excessif
```
FAUX — Push toutes les 20 ressources
CORRECT — Push seulement les ressources critiques (CSS/JS principal)
         Le push excessif gaspille de la bande passante si les resources sont deja en cache
```

### 3. Benchmark non reproductible
```
FAUX — un seul run, resultats variables
CORRECT — moyenne sur 10+ iterations, percentiles p50/p95/p99
```

### 4. Ignorer la latence réseau
```
FAUX — tester en localhost sans latence (tout est instantane)
CORRECT — simuler la latence reseau pour voir l'impact du multiplexage
         L'avantage HTTP/2 est surtout visible avec de la latence
```
