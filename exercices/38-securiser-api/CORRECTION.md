# Correction — Exercice 38 : Sécuriser l'API

## Injection — Requetes parametrees

```typescript
// ❌ VULNERABLE — SQL injection
async findByName(name: string) {
  return this.dataSource.query(`SELECT * FROM products WHERE name = '${name}'`);
  // name = "'; DROP TABLE products; --" → catastrophe
}

// ✅ CORRECT — requete parametree
async findByName(name: string) {
  return this.dataSource.query('SELECT * FROM products WHERE name = $1', [name]);
}

// ✅ MIEUX — QueryBuilder (parametrage automatique)
async findByName(name: string) {
  return this.productRepo
    .createQueryBuilder('p')
    .where('p.name = :name', { name })
    .getOne();
}
```

## IDOR — Vérification du proprietaire

```typescript
// ❌ VULNERABLE — IDOR
@Get('orders/:id')
async getOrder(@Param('id') id: string) {
  return this.orderRepo.findOne({ where: { id } });
  // N'importe qui peut lire n'importe quelle commande
}

// ✅ CORRECT — verification du proprietaire ET du tenant
@Get('orders/:id')
async getOrder(
  @Param('id', ParseUUIDPipe) id: string,
  @CurrentUser() user: AuthUser,
  @TenantId() tenantId: string,
) {
  const order = await this.orderRepo.findOne({
    where: { id, userId: user.id, tenantId },
  });
  if (!order) throw new NotFoundException(); // 404, pas 403 (pas de leak d'info)
  return order;
}
```

## Mass Assignment — DTOs explicites

```typescript
// ❌ VULNERABLE — mass assignment
@Post('products')
async create(@Body() body: any) {
  return this.productRepo.save(body);
  // Le client peut envoyer { price: 0, isAdmin: true, tenantId: 'other-tenant' }
}

// ✅ CORRECT — DTO avec class-validator
class CreateProductDto {
  @IsString()
  @MaxLength(200)
  name: string;

  @IsString()
  @MaxLength(5000)
  description: string;

  @IsNumber()
  @Min(0.01)
  @Max(999999)
  price: number;

  @IsUUID()
  categoryId: string;

  // PAS de tenantId, isAdmin, etc. — injectes par le serveur
}

@Post('products')
async create(
  @Body(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true })) dto: CreateProductDto,
  @TenantId() tenantId: string,
) {
  return this.productRepo.save({ ...dto, tenantId });
}
```

## Security Headers

```typescript
// security-headers.middleware.ts
import helmet from 'helmet';

// Dans main.ts
app.use(helmet({
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https://cdn.shoparch.com'],
      connectSrc: ["'self'", 'https://api.shoparch.com'],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
    },
  },
  frameguard: { action: 'deny' },
  noSniff: true,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
}));

// Request ID pour la tracabilite
app.use((req, res, next) => {
  const requestId = req.headers['x-request-id'] ?? randomUUID();
  res.setHeader('X-Request-ID', requestId);
  req.requestId = requestId;
  next();
});
```

## Input Validation complete

```typescript
// global-validation.pipe.ts
app.useGlobalPipes(new ValidationPipe({
  whitelist: true,           // supprime les proprietes non decorees
  forbidNonWhitelisted: true, // erreur si propriete inconnue
  transform: true,            // transforme les types (string → number)
  transformOptions: { enableImplicitConversion: true },
}));

// Limiter la taille du body
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ limit: '1mb', extended: true }));
```

## Erreurs sécurisées en production

```typescript
// http-exception.filter.ts
@Catch()
export class SecureExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse();
    const req = ctx.getRequest();

    let status = 500;
    let message = 'Internal Server Error';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      message = exception.message;
    }

    // En production, JAMAIS de stack trace
    const response: any = {
      statusCode: status,
      message,
      timestamp: new Date().toISOString(),
      path: req.url,
      requestId: req.requestId,
    };

    if (process.env.NODE_ENV !== 'production' && exception instanceof Error) {
      response.stack = exception.stack;
      response.details = exception.message;
    }

    // Logger l'erreur complete cote serveur
    console.error(`[${req.requestId}] ${status} ${req.method} ${req.url}`, exception);

    res.status(status).json(response);
  }
}
```

## Rate Limiting par endpoint

```typescript
// Differents rate limits selon l'endpoint
@Throttle({ default: { limit: 100, ttl: 60 } }) // 100/min par defaut
@Controller('api')
export class ApiController {

  @Throttle({ default: { limit: 10, ttl: 60 } }) // 10/min pour checkout
  @Post('checkout')
  async checkout() { /* ... */ }

  @Throttle({ default: { limit: 5, ttl: 300 } }) // 5/5min pour login
  @Post('auth/login')
  async login() { /* ... */ }
}
```

## Ce que tu aurais pu oublier

### 1. Blacklist au lieu de whitelist
```
FAUX — bloquer les champs dangereux (isAdmin, tenantId)
CORRECT — whitelist des champs autorises (name, description, price)
         Un nouveau champ dangereux sera automatiquement bloque
```

### 2. 403 au lieu de 404 pour IDOR
```
FAUX — retourner 403 Forbidden (confirme que la ressource existe)
CORRECT — retourner 404 Not Found (ne leak pas l'existence de la ressource)
```

### 3. Erreurs detaillees en production
```
FAUX — { error: "Column 'tenant_id' does not exist", stack: "..." }
CORRECT — { error: "Internal Server Error", requestId: "abc-123" }
         Les details restent dans les logs serveur
```

### 4. Validation partielle
```
FAUX — valider le body mais pas les query params ni les headers
CORRECT — valider TOUT : params (ParseUUIDPipe), query, body, headers custom
```
