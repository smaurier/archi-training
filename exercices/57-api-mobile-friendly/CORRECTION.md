# Correction — Exercice 57 : API mobile-friendly

## Response shaping

```typescript
// field-selection.interceptor.ts
@Injectable()
export class FieldSelectionInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler) {
    const req = context.switchToHttp().getRequest();
    const fields = req.query.fields?.split(',').map((f: string) => f.trim());
    const preferMinimal = req.headers['prefer']?.includes('return=minimal');

    return next.handle().pipe(
      map((body) => {
        if (!fields && !preferMinimal) return body;

        const fieldSet = fields ?? (preferMinimal ? ['id', 'name', 'price'] : null);
        if (!fieldSet) return body;

        if (Array.isArray(body?.data)) {
          return { ...body, data: body.data.map((item: any) => pick(item, fieldSet)) };
        }
        return pick(body, fieldSet);
      }),
    );
  }
}

function pick(obj: Record<string, any>, fields: string[]): Record<string, any> {
  const result: Record<string, any> = {};
  for (const field of fields) {
    if (field in obj) result[field] = obj[field];
  }
  return result;
}
```

## Batch endpoint

```typescript
// batch.controller.ts
interface BatchRequest {
  id: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  body?: unknown;
  headers?: Record<string, string>;
}

interface BatchResponse {
  id: string;
  status: number;
  body: unknown;
  headers?: Record<string, string>;
}

@Controller('api/batch')
export class BatchController {
  constructor(private readonly httpAdapter: HttpAdapterHost) {}

  @Post()
  async batch(
    @Body() requests: BatchRequest[],
    @Headers('x-tenant-id') tenantId: string,
    @CurrentUser() user: AuthUser,
  ): Promise<BatchResponse[]> {
    if (requests.length > 10) {
      throw new BadRequestException('Maximum 10 requests per batch');
    }

    const results = await Promise.all(
      requests.map(async (req) => {
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 5000);

          const response = await fetch(`http://localhost:${this.port}${req.path}`, {
            method: req.method,
            headers: {
              'Content-Type': 'application/json',
              'X-Tenant-ID': tenantId,
              Authorization: `Bearer ${user.token}`,
              ...req.headers,
            },
            body: req.body ? JSON.stringify(req.body) : undefined,
            signal: controller.signal,
          });
          clearTimeout(timeout);

          return {
            id: req.id,
            status: response.status,
            body: await response.json(),
          };
        } catch (error) {
          return {
            id: req.id,
            status: 500,
            body: { error: 'Request failed' },
          };
        }
      }),
    );

    return results;
  }
}
```

## Idempotency keys

```typescript
// idempotency.guard.ts
@Injectable()
export class IdempotencyGuard implements CanActivate {
  private readonly TTL = 24 * 3600; // 24h

  constructor(private readonly redis: Redis) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const res = context.switchToHttp().getResponse();

    // Seulement pour les mutations
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return true;

    const idempotencyKey = req.headers['idempotency-key'];
    if (!idempotencyKey) return true; // pas de cle = pas d'idempotence

    const cached = await this.redis.get(`idempotency:${idempotencyKey}`);

    if (cached) {
      // Replay la reponse cachee
      const { status, body, headers } = JSON.parse(cached);
      for (const [key, value] of Object.entries(headers ?? {})) {
        res.setHeader(key, value as string);
      }
      res.status(status).json(body);
      return false; // court-circuite le controller
    }

    // Marquer comme en cours (eviter les executions paralleles)
    const acquired = await this.redis.set(
      `idempotency:${idempotencyKey}`,
      JSON.stringify({ status: 'processing' }),
      'EX', this.TTL, 'NX',
    );

    if (!acquired) {
      // Une autre requete avec la meme cle est en cours
      res.status(409).json({ error: 'Request already in progress' });
      return false;
    }

    return true;
  }
}

// Apres l'execution : stocker la reponse
@Injectable()
export class IdempotencyCacheInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler) {
    const req = context.switchToHttp().getRequest();
    const idempotencyKey = req.headers['idempotency-key'];
    if (!idempotencyKey) return next.handle();

    return next.handle().pipe(
      tap((body) => {
        const res = context.switchToHttp().getResponse();
        this.redis.set(
          `idempotency:${idempotencyKey}`,
          JSON.stringify({ status: res.statusCode, body }),
          'EX', 86400,
        );
      }),
    );
  }
}
```

## Sync delta endpoint

```typescript
// products-sync.controller.ts
@Get('products/changes')
async getChanges(
  @Query('since') since: string, // ISO timestamp
  @Headers('x-tenant-id') tenantId: string,
) {
  const sinceDate = new Date(since);

  const changes = await this.productRepo.find({
    where: { tenantId, updatedAt: MoreThan(sinceDate) },
    select: ['id', 'name', 'price', 'inStock', 'updatedAt', 'deletedAt'],
    withDeleted: true, // inclure les produits supprimes
    order: { updatedAt: 'ASC' },
    take: 100,
  });

  return {
    changes: changes.map((p) => ({
      id: p.id,
      action: p.deletedAt ? 'deleted' : 'upserted',
      data: p.deletedAt ? { id: p.id } : p,
      updatedAt: p.updatedAt,
    })),
    syncToken: changes.at(-1)?.updatedAt.toISOString() ?? since,
    hasMore: changes.length === 100,
  };
}
```

## Ce que tu aurais pu oublier

### 1. Même payload mobile et desktop
```
FAUX — envoyer 20 produits avec description complete + 5 images chacun au mobile
CORRECT — field selection + pagination reduite + thumbnails
         La reponse mobile doit etre < 5 KB en moyenne
```

### 2. N requêtes au lieu d'un batch
```
FAUX — le mobile fait 6 requetes sequentielles pour la page d'accueil
CORRECT — batch endpoint OU BFF pour regrouper en 1 seul round-trip
```

### 3. Retry sans idempotence
```
FAUX — le mobile retry une requete POST apres un timeout (double commande)
CORRECT — idempotency key sur chaque mutation
         Le retry produit le meme resultat que la premiere requete
```

### 4. Pas de gestion offline
```
FAUX — erreur blanche quand le reseau est coupe
CORRECT — health check leger + sync delta pour le mode offline
         Le mobile cache les donnees et synchronise quand le reseau revient
```
