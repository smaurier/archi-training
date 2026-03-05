# Cours 67 — Serverless Architecture

> **Objectif** : Comprendre l'architecture serverless (FaaS, BaaS), savoir quand utiliser serverless vs containers, maîtriser les patterns event-driven compute, et évaluer les couts (pay-per-invocation vs reserved).

---

## Rappel du cours précédent

<details>
<summary>1. Quelle est la différence entre sharding et réplication ?</summary>

La **réplication** duplique les memes données sur plusieurs noeuds (primary pour les écritures, replicas pour les lectures). Le **sharding** divise les données horizontalement — chaque shard contient un sous-ensemble des données (ex: tenant A sur shard 1, tenant B sur shard 2). Réplication = plus de lectures, sharding = plus de capacité totale.
</details>

<details>
<summary>2. Pourquoi tenant_id est-il souvent le meilleur shard key ?</summary>

Il a une haute cardinalite (beaucoup de tenants), une distribution relativement uniforme, et il est present dans pratiquement toutes les requêtes (filtre obligatoire en multi-tenant). Cela signifie que chaque requête va directement au bon shard (targeted query) au lieu de scanner tous les shards (scatter-gather).
</details>

---

## Analogie — Le taxi vs la voiture de fonction

- **Containers** = voiture de fonction : tu paies le parking (infra), l'assurance (maintenance), l'essence (compute) meme quand tu roules pas. Mais elle est toujours prete, pas de temps d'attente.
- **Serverless** = taxi : tu paies uniquement la course. Pas de frais fixes. Mais il faut parfois attendre qu'un taxi soit disponible (cold start). Et si tu prends 50 courses par jour, le taxi coute plus cher que la voiture.

---

## Théorie

### 1. FaaS vs BaaS vs CaaS

| Modèle | Tu gérés | Le cloud géré | Exemple |
|---|---|---|---|
| **IaaS** | OS, runtime, app | Hardware, réseau | AWS EC2 |
| **CaaS** | App, container | Orchestration, OS | AWS ECS, GKE |
| **FaaS** | Code (fonction) | Tout le reste | AWS Lambda, Cloudflare Workers |
| **BaaS** | Configuration | Backend complet | Firebase, Supabase |

### 2. Event-driven compute

```
Trigger                     Function                 Output
────────                    ─────────                ──────

HTTP Request ──────────────> processOrder() ────────> Response
S3 Upload   ──────────────> generateThumbnail() ───> S3 (resized)
Queue Message ─────────────> sendEmail() ──────────> Email sent
Cron Schedule ─────────────> cleanupExpired() ─────> DB cleanup
DB Change (CDC) ──────────> updateSearchIndex() ───> Elasticsearch
```

### 3. Cold starts

```
Premier appel (cold start) :
  ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐
  │ Download │──>│  Init    │──>│  Load    │──>│ Execute  │
  │ code     │   │ runtime  │   │ handler  │   │ function │
  │ ~200ms   │   │ ~300ms   │   │ ~100ms   │   │ ~50ms    │
  └──────────┘   └──────────┘   └──────────┘   └──────────┘
  Total : ~650ms (Node.js)     Total : ~2-5s (Java, .NET)

Appels suivants (warm) :
  ┌──────────┐
  │ Execute  │  → ~50ms (instance reutilisee)
  │ function │
  └──────────┘

Mitigations :
  - Provisioned concurrency (instances pre-chauffees)
  - Keep-alive pings (warmup cron)
  - Runtime leger (Node.js, Go > Java, .NET)
  - Bundle size minimal
```

### 4. Decision framework : Serverless vs Containers

| Critère | Serverless | Containers |
|---|---|---|
| **Trafic** | Sporadique, imprevisible | Constant, previsible |
| **Latence** | Cold start acceptable (API non-critique) | Latence constante requise |
| **Duree d'exécution** | < 15min (limite Lambda) | Long-running (heures) |
| **État** | Stateless uniquement | Stateful possible |
| **Cout a faible trafic** | Quasi gratuit | Minimum 1 container |
| **Cout a fort trafic** | Explose | Previsible |
| **Vendor lock-in** | Fort (API proprietaire) | Faible (Docker partout) |
| **Debugging** | Difficile (pas de SSH) | Standard (logs, shell) |

### 5. Edge Functions

```
Cloudflare Workers / Vercel Edge Functions :
  - Code execute sur l'edge node le plus proche
  - Cold start < 5ms (V8 isolates, pas de container)
  - Pas de Node.js complet (Web APIs seulement)
  - Ideal pour : redirects, auth checks, A/B testing, headers

Vercel Edge middleware :
  export const config = { matcher: '/api/:path*' };

  export default function middleware(req) {
    // Execute en 1-2ms sur l'edge
    const token = req.headers.get('Authorization');
    if (!token) return new Response('Unauthorized', { status: 401 });
    return NextResponse.next();
  }
```

### 6. Modèle de cout

```
Pay-per-invocation (Lambda) :
  1M invocations/mois × $0.20/1M = $0.20
  + 1M × 128MB × 100ms × $0.0000166667/GB-s = $0.21
  Total : ~$0.41/mois pour 1M requetes

vs Container (ECS Fargate) :
  1 vCPU + 2GB, 24/7 = ~$30/mois
  Meme si 0 requetes → $30

Break-even :
  ~3-5M invocations/mois ≈ cout d'un petit container
  Au-dela → container plus rentable
```

---

## Pratique

### Serverless image resizing (AWS Lambda)

```typescript
// handler.ts — Lambda triggered by S3 upload
import sharp from 'sharp';
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';

const s3 = new S3Client({ region: process.env.AWS_REGION });

interface S3Event {
  Records: Array<{
    s3: { bucket: { name: string }; object: { key: string } };
  }>;
}

export async function handler(event: S3Event): Promise<void> {
  for (const record of event.Records) {
    const bucket = record.s3.bucket.name;
    const key = record.s3.object.key;

    // Skip si deja un thumbnail
    if (key.startsWith('thumbnails/')) continue;

    // Telecharger l'original
    const original = await s3.send(
      new GetObjectCommand({ Bucket: bucket, Key: key }),
    );
    const buffer = Buffer.from(await original.Body!.transformToByteArray());

    // Generer les variantes
    const sizes = [
      { width: 200, suffix: 'thumb' },
      { width: 800, suffix: 'medium' },
      { width: 1200, suffix: 'large' },
    ];

    for (const size of sizes) {
      const resized = await sharp(buffer)
        .resize(size.width)
        .webp({ quality: 80 })
        .toBuffer();

      await s3.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: `thumbnails/${size.suffix}/${key}.webp`,
          Body: resized,
          ContentType: 'image/webp',
          CacheControl: 'public, max-age=31536000, immutable',
        }),
      );
    }
  }
}
```

### Serverless cron — cleanup expired data

```typescript
// Triggered par CloudWatch Events / EventBridge toutes les heures
export async function cleanupHandler(): Promise<{ deleted: number }> {
  const db = await getConnection(); // Connection pool reutilise si warm

  const result = await db.query(
    `DELETE FROM password_reset_tokens
     WHERE expires_at < NOW()
     RETURNING id`,
  );

  const deleted = result.rowCount ?? 0;

  console.log(JSON.stringify({
    event: 'cleanup.expired_tokens',
    deleted,
    timestamp: new Date().toISOString(),
  }));

  return { deleted };
}
```

### Hybrid architecture

```typescript
// Les APIs principales restent en containers (latence constante)
// Les taches event-driven vont en serverless (cout optimise)

// Container : API principale
@Controller('api/products')
export class ProductController {
  @Post()
  async create(@Body() dto: CreateProductDto): Promise<Product> {
    const product = await this.service.create(dto);
    // Emettre un event → la Lambda generera les thumbnails
    await this.eventBus.emit('product.image.uploaded', {
      productId: product.id,
      imageKey: product.imageKey,
    });
    return product;
  }
}

// Lambda : traitement asynchrone
// Triggered par SQS queue alimentee par l'event bus
export async function thumbnailHandler(event: SQSEvent): Promise<void> {
  for (const record of event.Records) {
    const { productId, imageKey } = JSON.parse(record.body);
    await generateThumbnails(imageKey);
    await updateProductWithThumbnails(productId);
  }
}
```

---

## Resume

1. **FaaS** (Lambda, Workers) : code exécuté a la demande, pay-per-invocation — ideal pour trafic sporadique et taches event-driven
2. **Cold start** : 500ms-5s selon le runtime — mitigable avec provisioned concurrency ou runtimes légers (Node.js, Go)
3. **Break-even** ~3-5M invocations/mois : en dessous serverless gagne, au dessus containers sont plus rentables
4. **Edge Functions** : code exécuté sur le CDN edge node (~1ms cold start) — ideal pour auth, redirects, A/B testing
5. **Hybrid** : API principals en containers (latence constante) + taches asynchrones en serverless (cout optimise)

---

> **Prochain cours** : [Cours 68 — Logging structure](../10-observabilité-devops/01-logging-structure.md)

---

> **Lien fil rouge — ShopArch**
>
> - Implémente la génération de thumbnails en serverless (Lambda/Cloud Function)
> - Compare le coût serverless vs container pour le pipeline d'images ShopArch
> - Exercice(s) associé(s) : `exercices/45-serverless-vs-containers/`
> - Checkpoint : Module 09, critère 2
