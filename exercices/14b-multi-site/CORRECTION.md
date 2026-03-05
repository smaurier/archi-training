# Correction — Exercice 14b : Multi-site

## Résultat attendu

Un système multi-site transparent avec résolution automatique et filtrage par entité.

## Site resolver

```typescript
@Injectable()
export class SiteResolver {
  constructor(
    private readonly siteRepo: Repository<SiteEntity>,
    private readonly redis: RedisService,
  ) {}

  async resolve(req: Request, tenantId: string): Promise<Site> {
    // 1. Header explicite
    const headerSiteId = req.headers['x-site-id'] as string;
    if (headerSiteId) {
      const site = await this.findById(headerSiteId);
      if (site && site.tenantId === tenantId) return site;
      throw new ForbiddenException('Site does not belong to tenant');
    }

    // 2. Resolution par domaine
    const host = req.hostname;
    const site = await this.findByDomain(host);
    if (site && site.tenantId === tenantId) return site;

    // 3. Fallback : site par defaut
    const defaultSite = await this.findDefault(tenantId);
    if (defaultSite) return defaultSite;

    throw new NotFoundException('No site found for this tenant');
  }

  private async findByDomain(domain: string): Promise<Site | null> {
    // Cache Redis
    const cached = await this.redis.get(`site:domain:${domain}`);
    if (cached) return JSON.parse(cached);

    const site = await this.siteRepo.findOne({ where: { domain, isActive: true } });
    if (site) {
      await this.redis.set(`site:domain:${domain}`, JSON.stringify(site), 'EX', 300);
    }
    return site;
  }

  private async findDefault(tenantId: string): Promise<Site | null> {
    return this.siteRepo.findOne({
      where: { tenantId, isDefault: true, isActive: true },
    });
  }
}
```

## Site middleware

```typescript
@Injectable()
export class SiteMiddleware implements NestMiddleware {
  constructor(private readonly siteResolver: SiteResolver) {}

  async use(req: Request, res: Response, next: NextFunction) {
    const tenantId = req['tenantId'];
    if (!tenantId) {
      next(); // Sera gere par le tenant middleware
      return;
    }

    const site = await this.siteResolver.resolve(req, tenantId);
    req['siteId'] = site.id;
    req['site'] = site;

    next();
  }
}

// Ordre des middlewares dans AppModule
configure(consumer: MiddlewareConsumer) {
  consumer
    .apply(TenantMiddleware, SiteMiddleware) // Tenant d'abord, puis Site
    .forRoutes('*');
}
```

## Site-scoped filter

```typescript
// Decorateur pour marquer les entites site-scoped
const SITE_SCOPED = Symbol('SITE_SCOPED');
export const SiteScoped = () => SetMetadata(SITE_SCOPED, true);

// Intercepteur qui ajoute le filtre site_id
@Injectable()
export class SiteFilterInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler) {
    const req = context.switchToHttp().getRequest();
    const siteId = req['siteId'];

    // Le repository utilise ce contexte pour filtrer
    if (siteId) {
      RequestContext.set('siteId', siteId);
    }

    return next.handle();
  }
}

// Dans le repository
@Injectable()
export class ArticleRepository {
  async findAll(): Promise<Article[]> {
    const siteId = RequestContext.get('siteId');
    return this.repo.find({
      where: { siteId }, // Filtre automatique
    });
  }
}
```

## Scope par entité

```typescript
// Entites SITE-scoped (filtrees par siteId)
@Entity()
@SiteScoped()
export class Article {
  @Column() siteId: string;
  // ...
}

@Entity()
@SiteScoped()
export class Page {
  @Column() siteId: string;
  // ...
}

// Entites TENANT-scoped (pas de filtre site)
@Entity()
export class Product {
  // Pas de siteId — partage entre tous les sites du tenant
}

@Entity()
export class User {
  // Pas de siteId — un user peut acceder a tous les sites du tenant
}
```

## Ce que tu aurais pu oublier

### 1. Ne pas vérifier que le site appartient au tenant

```typescript
// FAUX — un tenant peut acceder aux sites d'un autre tenant
const site = await siteRepo.findById(siteId); // Pas de check tenant !

// CORRECT — toujours verifier
if (site.tenantId !== currentTenantId) {
  throw new ForbiddenException('Site does not belong to tenant');
}
```

### 2. Filtrer les produits par site

```
FAUX — les produits sont partages entre sites du meme tenant
  → Filtrer par siteId = les produits n'apparaissent que sur un site

CORRECT — les produits sont tenant-scoped, pas site-scoped
  → Un produit cree sur acme-fr.com est visible sur acme-de.com
```

### 3. Oublier d'invalider le cache domaine

```typescript
// FAUX — le site change de domaine mais le cache pointe encore vers l'ancien
await siteRepo.update(siteId, { domain: 'new-domain.com' });
// L'ancien domaine resout toujours vers ce site pendant 5min

// CORRECT — invalider le cache quand le domaine change
await redis.del(`site:domain:${oldDomain}`);
await redis.del(`site:domain:${newDomain}`);
```
