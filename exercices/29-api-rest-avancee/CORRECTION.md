# Correction — Exercice 29 : API REST avancee

## ETag et cache conditionnel

```typescript
// etag.interceptor.ts
import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { map } from 'rxjs/operators';

@Injectable()
export class ETagInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler) {
    const req = context.switchToHttp().getRequest();
    const res = context.switchToHttp().getResponse();

    return next.handle().pipe(
      map((body) => {
        const etag = `"${createHash('md5').update(JSON.stringify(body)).digest('hex')}"`;
        res.setHeader('ETag', etag);

        // GET — If-None-Match → 304
        if (req.method === 'GET' && req.headers['if-none-match'] === etag) {
          res.status(304).end();
          return;
        }

        return body;
      }),
    );
  }
}

// Pour PUT/PATCH — If-Match → 412
@Injectable()
export class PreconditionGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();

    if (['PUT', 'PATCH'].includes(req.method) && req.headers['if-match']) {
      const entity = req.entity; // charge par un intercepteur precedent
      const currentEtag = `"v${entity.version}"`;

      if (req.headers['if-match'] !== currentEtag) {
        throw new HttpException('Precondition Failed', 412);
      }
    }

    return true;
  }
}
```

## Pagination par curseur

```typescript
// cursor-pagination.ts
interface CursorPayload {
  id: string;
  sortField: string;
  sortValue: string | number;
}

export function encodeCursor(payload: CursorPayload): string {
  return Buffer.from(JSON.stringify(payload)).toString('base64url');
}

export function decodeCursor(cursor: string): CursorPayload {
  return JSON.parse(Buffer.from(cursor, 'base64url').toString());
}

// products.service.ts
async function findWithCursor(params: {
  cursor?: string;
  limit: number;
  sortBy: 'price' | 'name' | 'createdAt';
  sortOrder: 'ASC' | 'DESC';
}) {
  const { cursor, limit, sortBy, sortOrder } = params;
  const qb = this.repo.createQueryBuilder('p').orderBy(`p.${sortBy}`, sortOrder).addOrderBy('p.id', 'ASC');

  if (cursor) {
    const { id, sortValue } = decodeCursor(cursor);
    const op = sortOrder === 'ASC' ? '>' : '<';
    qb.where(`(p.${sortBy} ${op} :sortValue) OR (p.${sortBy} = :sortValue AND p.id > :id)`, {
      sortValue,
      id,
    });
  }

  // Fetch limit + 1 pour savoir s'il y a une page suivante
  const items = await qb.take(limit + 1).getMany();
  const hasNext = items.length > limit;
  if (hasNext) items.pop();

  const nextCursor = hasNext
    ? encodeCursor({
        id: items[items.length - 1].id,
        sortField: sortBy,
        sortValue: items[items.length - 1][sortBy],
      })
    : null;

  return { items, nextCursor, hasNext };
}

// products.controller.ts
@Get()
async findAll(
  @Query('cursor') cursor: string,
  @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  @Query('sort') sort: string = 'createdAt',
  @Res({ passthrough: true }) res: Response,
) {
  const cappedLimit = Math.min(limit, 100);
  const result = await this.service.findWithCursor({ cursor, limit: cappedLimit, sortBy: sort, sortOrder: 'ASC' });

  if (result.nextCursor) {
    res.setHeader('Link', `</products?cursor=${result.nextCursor}&limit=${cappedLimit}>; rel="next"`);
  }

  return { data: result.items, meta: { hasNext: result.hasNext } };
}
```

## Rate limiting avec Redis token bucket

```typescript
// rate-limiter.guard.ts
@Injectable()
export class RateLimiterGuard implements CanActivate {
  constructor(private readonly redis: Redis) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const res = context.switchToHttp().getResponse();
    const key = `rate:${req.headers['x-api-key'] ?? req.ip}`;

    const LIMIT = 100;
    const WINDOW = 60; // secondes

    const lua = `
      local key = KEYS[1]
      local limit = tonumber(ARGV[1])
      local window = tonumber(ARGV[2])
      local current = tonumber(redis.call('GET', key) or 0)
      if current >= limit then
        return -1
      end
      current = redis.call('INCR', key)
      if current == 1 then
        redis.call('EXPIRE', key, window)
      end
      return limit - current
    `;

    const remaining = await this.redis.eval(lua, 1, key, LIMIT, WINDOW);
    const ttl = await this.redis.ttl(key);

    res.setHeader('X-RateLimit-Limit', LIMIT);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, remaining as number));
    res.setHeader('X-RateLimit-Reset', Math.floor(Date.now() / 1000) + ttl);

    if (remaining === -1) {
      res.setHeader('Retry-After', ttl);
      throw new HttpException('Too Many Requests', 429);
    }

    return true;
  }
}
```

## Negociation de contenu

```typescript
// content-negotiation.interceptor.ts
@Injectable()
export class ContentNegotiationInterceptor implements NestInterceptor {
  private readonly SUPPORTED = ['application/json', 'application/hal+json'];

  intercept(context: ExecutionContext, next: CallHandler) {
    const req = context.switchToHttp().getRequest();
    const accept = req.headers['accept'] ?? 'application/json';

    if (!this.SUPPORTED.some((t) => accept.includes(t) || accept === '*/*')) {
      throw new HttpException('Not Acceptable', 406);
    }

    return next.handle().pipe(
      map((body) => {
        if (accept.includes('application/hal+json')) {
          return this.toHal(body, req);
        }
        return body;
      }),
    );
  }

  private toHal(body: any, req: any) {
    if (body.data && Array.isArray(body.data)) {
      return {
        _embedded: { items: body.data.map((item: any) => ({
          ...item,
          _links: { self: { href: `${req.path}/${item.id}` } },
        })) },
        _links: { self: { href: req.url } },
        meta: body.meta,
      };
    }
    return { ...body, _links: { self: { href: req.url } } };
  }
}
```

## Ce que tu aurais pu oublier

### 1. ETag base sur le timestamp
```
FAUX — ETag = Date.now() ou updatedAt (change meme si le contenu est identique)
CORRECT — ETag = hash du contenu OU numero de version de l'entite
```

### 2. Pagination offset deguisee
```
FAUX — curseur = base64(offset) → meme probleme de performance
CORRECT — curseur = position dans l'index (keyset pagination)
         La requete utilise WHERE > cursor, pas OFFSET
```

### 3. Rate limit par IP seulement
```
FAUX — rate limit par IP (proxies partagent la meme IP)
CORRECT — rate limit par API key, avec fallback IP pour les requetes non authentifiees
```

### 4. Pagination instable
```
FAUX — si un element est insere pendant la pagination, des elements sont manques/dupliques
CORRECT — curseur avec tie-breaker sur l'ID (ORDER BY sortField, id) garantit la stabilite
```
