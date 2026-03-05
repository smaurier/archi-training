# Correction — Exercice 14 : Multi-tenant isolation

## Résultat attendu

Une isolation multi-tenant a 3 couches, transparente pour le code métier.

## Tenant middleware

```typescript
// middleware/tenant.middleware.ts
@Injectable()
export class TenantMiddleware implements NestMiddleware {
  constructor(
    private readonly dataSource: DataSource,
    private readonly tenantRegistry: TenantRegistryService,
  ) {}

  async use(req: Request, res: Response, next: NextFunction) {
    const tenantId = this.extractTenantId(req);

    if (!tenantId) {
      throw new ForbiddenException('Tenant identification required');
    }

    // Verifier que le tenant existe
    const tenant = await this.tenantRegistry.findById(tenantId);
    if (!tenant) {
      throw new ForbiddenException(`Unknown tenant: ${tenantId}`);
    }

    // Configurer le schema PostgreSQL
    const schemaName = `tenant_${tenant.slug}`;
    await this.dataSource.query(`SET search_path TO ${schemaName}, public`);

    // Ajouter au contexte
    req['tenantId'] = tenantId;
    req['tenantSlug'] = tenant.slug;

    next();
  }

  private extractTenantId(req: Request): string | null {
    // 1. Depuis le JWT
    const user = req['user'];
    if (user?.tenantId) return user.tenantId;

    // 2. Fallback header
    const header = req.headers['x-tenant-id'];
    if (typeof header === 'string') return header;

    return null;
  }
}
```

## Tenant-aware storage

```typescript
// storage/tenant-storage.service.ts
@Injectable()
export class TenantStorageService {
  constructor(
    private readonly s3: S3Client,
    private readonly config: ConfigService,
  ) {}

  private getPrefix(tenantId: string, siteId: string): string {
    // Protection path traversal
    const safeTenant = tenantId.replace(/[^a-zA-Z0-9-]/g, '');
    const safeSite = siteId.replace(/[^a-zA-Z0-9-]/g, '');
    return `${safeTenant}/${safeSite}`;
  }

  async upload(
    tenantId: string,
    siteId: string,
    fileName: string,
    body: Buffer,
  ): Promise<string> {
    const prefix = this.getPrefix(tenantId, siteId);
    const key = `${prefix}/uploads/${crypto.randomUUID()}/${fileName}`;

    await this.s3.send(new PutObjectCommand({
      Bucket: this.config.getOrThrow('S3_BUCKET'),
      Key: key,
      Body: body,
    }));

    return key;
  }

  async getPresignedUploadUrl(
    tenantId: string,
    siteId: string,
    fileName: string,
  ): Promise<{ url: string; key: string }> {
    const prefix = this.getPrefix(tenantId, siteId);
    const key = `${prefix}/uploads/${crypto.randomUUID()}/${fileName}`;

    const command = new PutObjectCommand({
      Bucket: this.config.getOrThrow('S3_BUCKET'),
      Key: key,
    });

    const url = await getSignedUrl(this.s3, command, { expiresIn: 300 });
    return { url, key };
  }

  async getStorageUsage(tenantId: string): Promise<number> {
    const prefix = `${tenantId}/`;
    let totalSize = 0;
    let continuationToken: string | undefined;

    do {
      const result = await this.s3.send(new ListObjectsV2Command({
        Bucket: this.config.getOrThrow('S3_BUCKET'),
        Prefix: prefix,
        ContinuationToken: continuationToken,
      }));

      totalSize += (result.Contents ?? []).reduce((s, obj) => s + (obj.Size ?? 0), 0);
      continuationToken = result.NextContinuationToken;
    } while (continuationToken);

    return totalSize;
  }
}
```

## Tenant decorator

```typescript
// decorators/tenant.decorator.ts
export const CurrentTenant = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest();
    const tenantId = request['tenantId'];
    if (!tenantId) throw new ForbiddenException('No tenant context');
    return tenantId;
  },
);

// Usage dans le controller
@Get('products')
async list(@CurrentTenant() tenantId: string) {
  // Le tenantId est garanti present et valide
  // Le schema PostgreSQL est deja configure
  return this.productService.findAll();
}
```

## Test d'isolation

```typescript
describe('Multi-tenant isolation', () => {
  it('tenant A cannot see tenant B data', async () => {
    // Creer un produit pour tenant A
    const productA = await request(app.getHttpServer())
      .post('/api/products')
      .set('Authorization', `Bearer ${tokenTenantA}`)
      .send({ name: 'Product A', price: 10 })
      .expect(201);

    // Tenant B ne doit PAS voir le produit de A
    const listB = await request(app.getHttpServer())
      .get('/api/products')
      .set('Authorization', `Bearer ${tokenTenantB}`)
      .expect(200);

    const ids = listB.body.data.map((p) => p.id);
    expect(ids).not.toContain(productA.body.id);
  });

  it('rejects request without tenant', async () => {
    await request(app.getHttpServer())
      .get('/api/products')
      // Pas de header Authorization ni X-Tenant-Id
      .expect(403);
  });

  it('switches schema between concurrent requests', async () => {
    // Execute 2 requetes en parallele sur 2 tenants differents
    const [resA, resB] = await Promise.all([
      request(app.getHttpServer())
        .get('/api/products')
        .set('Authorization', `Bearer ${tokenTenantA}`),
      request(app.getHttpServer())
        .get('/api/products')
        .set('Authorization', `Bearer ${tokenTenantB}`),
    ]);

    // Chaque tenant voit ses propres donnees
    expect(resA.body.data).not.toEqual(resB.body.data);
  });
});
```

## Ce que tu aurais pu oublier

### 1. Oublier de reset le search_path

```typescript
// FAUX — le search_path reste sur tenant A pour la requete suivante
await dataSource.query(`SET search_path TO tenant_acme`);
// Si connection pooling : la prochaine requete (tenant B) voit le schema de A !

// CORRECT — reset apres chaque requete
// Ou utiliser SET LOCAL (scope = transaction)
await dataSource.query(`SET LOCAL search_path TO tenant_acme, public`);
```

### 2. Path traversal dans le storage

```typescript
// FAUX — tenantId non sanitise
const key = `${tenantId}/uploads/${fileName}`;
// tenantId = "../../admin" → acces au bucket root !

// CORRECT — sanitiser le tenantId
const safeTenant = tenantId.replace(/[^a-zA-Z0-9-]/g, '');
```

### 3. Confiance aveugle dans le header X-Tenant-Id

```typescript
// FAUX — n'importe qui peut envoyer X-Tenant-Id: other-tenant
const tenantId = req.headers['x-tenant-id']; // Spoofable !

// CORRECT — priorite au JWT, header en fallback pour des cas precis
const tenantId = req.user?.tenantId ?? req.headers['x-tenant-id'];
// Et toujours verifier que le tenant existe
```

### 4. Requête cross-tenant dans un service interne

```typescript
// FAUX — un service appelle directement la DB sans filtre
const allProducts = await this.repo.find(); // TOUS les tenants !

// CORRECT — le filtre est automatique via search_path
// Mais les services admin (migration, backup) doivent explicitement
// switcher vers le schema public ou un schema specifique
```
