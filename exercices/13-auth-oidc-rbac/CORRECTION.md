# Correction — Exercice 13 : Auth OIDC + RBAC

## Résultat attendu

Un système d'auth complet avec JWT RS256, JWKS caching, role hierarchy, et adapter pattern pour dev/prod.

## Auth adapter interface

```typescript
// auth/auth.interface.ts
export interface AuthUser {
  userId: string;
  tenantId: string;
  roles: string[];
  email: string;
}

export interface AuthProvider {
  validateToken(token: string): Promise<AuthUser>;
}
```

## OIDC Provider (production)

```typescript
// auth/oidc-auth.provider.ts
import * as jose from 'jose';

@Injectable()
export class OidcAuthProvider implements AuthProvider {
  private jwksUri: string;

  constructor(
    private readonly config: ConfigService,
    private readonly redis: RedisService,
  ) {
    this.jwksUri = this.config.getOrThrow('OIDC_JWKS_URI');
  }

  async validateToken(token: string): Promise<AuthUser> {
    const jwks = await this.getJwks();

    try {
      const { payload } = await jose.jwtVerify(token, jwks, {
        issuer: this.config.getOrThrow('OIDC_ISSUER'),
        audience: this.config.getOrThrow('OIDC_AUDIENCE'),
      });

      return {
        userId: payload.sub!,
        tenantId: payload['tenant_id'] as string,
        roles: (payload['realm_access'] as { roles: string[] })?.roles ?? [],
        email: payload['email'] as string,
      };
    } catch {
      // Force refresh JWKS et retry une fois
      await this.redis.del('auth:jwks');
      const freshJwks = await this.getJwks();
      const { payload } = await jose.jwtVerify(token, freshJwks);

      return {
        userId: payload.sub!,
        tenantId: payload['tenant_id'] as string,
        roles: (payload['realm_access'] as { roles: string[] })?.roles ?? [],
        email: payload['email'] as string,
      };
    }
  }

  private async getJwks(): Promise<jose.FlattenedJWSInput> {
    const cached = await this.redis.get('auth:jwks');
    if (cached) return JSON.parse(cached);

    const response = await fetch(this.jwksUri);
    const jwks = await response.json();

    await this.redis.set('auth:jwks', JSON.stringify(jwks), 'EX', 3600);
    return jose.createLocalJWKSet(jwks);
  }
}
```

## Mock Provider (development)

```typescript
// auth/mock-auth.provider.ts
@Injectable()
export class MockAuthProvider implements AuthProvider {
  async validateToken(token: string): Promise<AuthUser> {
    // En dev, le token est un JSON base64 simple
    try {
      const payload = JSON.parse(Buffer.from(token, 'base64').toString());
      return {
        userId: payload.sub ?? 'dev-user-1',
        tenantId: payload.tenant_id ?? 'dev-tenant',
        roles: payload.roles ?? ['admin'],
        email: payload.email ?? 'dev@example.com',
      };
    } catch {
      // Token par defaut en dev
      return {
        userId: 'dev-user-1',
        tenantId: 'dev-tenant',
        roles: ['admin'],
        email: 'dev@example.com',
      };
    }
  }
}
```

## Module avec factory

```typescript
// auth/auth.module.ts
@Module({
  providers: [
    {
      provide: 'AUTH_PROVIDER',
      useFactory: (config: ConfigService, redis: RedisService) => {
        const mode = config.get('AUTH_MODE', 'oidc');
        if (mode === 'mock') return new MockAuthProvider();
        return new OidcAuthProvider(config, redis);
      },
      inject: [ConfigService, RedisService],
    },
  ],
  exports: ['AUTH_PROVIDER'],
})
export class AuthModule {}
```

## JWT Guard

```typescript
// auth/jwt.guard.ts
@Injectable()
export class JwtGuard implements CanActivate {
  constructor(
    @Inject('AUTH_PROVIDER') private readonly auth: AuthProvider,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Check if public endpoint
    const isPublic = this.reflector.get<boolean>('isPublic', context.getHandler());
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers['authorization'];

    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing Bearer token');
    }

    const token = authHeader.slice(7);
    const user = await this.auth.validateToken(token);
    request.user = user;

    return true;
  }
}
```

## Role hierarchy + guard

```typescript
// auth/roles.ts
const ROLE_HIERARCHY: Record<string, number> = {
  viewer: 1,
  editor: 2,
  admin: 3,
  superadmin: 4,
};

export const Roles = (...roles: string[]) => SetMetadata('roles', roles);

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.get<string[]>('roles', context.getHandler());
    if (!requiredRoles) return true; // Pas de restriction

    const user: AuthUser = context.switchToHttp().getRequest().user;
    if (!user) throw new UnauthorizedException();

    const requiredLevel = Math.min(
      ...requiredRoles.map((r) => ROLE_HIERARCHY[r] ?? 999),
    );

    const userLevel = Math.max(
      ...user.roles.map((r) => ROLE_HIERARCHY[r] ?? 0),
    );

    if (userLevel < requiredLevel) {
      throw new ForbiddenException('Insufficient role');
    }

    return true;
  }
}
```

## Usage dans le controller

```typescript
@Controller('api/products')
@UseGuards(JwtGuard, RolesGuard)
export class ProductController {
  @Get()
  @Roles('viewer')
  list() { /* ... */ }

  @Post()
  @Roles('editor')
  create(@Body() dto: CreateProductDto) { /* ... */ }

  @Delete(':id')
  @Roles('admin')
  remove(@Param('id') id: string) { /* ... */ }
}
```

## Alternatives et arbitrages

> En architecture, ta valeur n'est pas de connaître UNE solution,
> mais de savoir POURQUOI tu choisis celle-ci plutôt qu'une autre.

### Option A : RBAC — Role-Based Access Control (solution présentée)
**Quand la choisir :** Rôles bien définis et stables (admin, editor, viewer), nombre limité de rôles (<20), logique d'accès simple (le rôle détermine les permissions).
**Limites :** Explosion combinatoire si beaucoup de rôles spécifiques, pas de contexte (un admin peut-il modifier TOUT produit, ou seulement ceux de son département ?).

### Option B : ABAC — Attribute-Based Access Control
**Quand la choisir :** Autorisations dépendantes du contexte (heure, localisation, département), règles complexes ("un manager peut approuver les commandes de son équipe de moins de 10K€").
**Limites :** Complexité des policies (moteur de rules type OPA/Cedar), debugging difficile ("pourquoi cet utilisateur est-il refusé ?"), performance (évaluation dynamique).

### Option C : ReBAC — Relationship-Based Access Control (Zanzibar / SpiceDB)
**Quand la choisir :** Modèle type Google Docs (partage par lien, permissions héritées), relations entre objets complexes (organization → team → project → document), besoin de "qui a accès à quoi ?".
**Limites :** Infrastructure dédiée (SpiceDB, Ory Keto), modèle mental différent (penser en relations, pas en rôles), overhead pour des cas simples.

### Matrice de décision
| Critère | RBAC | ABAC | ReBAC (Zanzibar) |
|---|---|---|---|
| Simplicité | Excellente | Moyenne | Moyenne |
| Contexte dynamique | Non | Oui | Partiel |
| Héritage de permissions | Non natif | Possible | Natif |
| Performance | Excellente | Variable | Bonne |
| "Qui a accès à X ?" | Facile | Difficile | Natif |

### Pour ShopArch, on choisit...
RBAC pour commencer car les rôles sont clairs (admin, seller, customer) et les règles simples. Si on ajoute du multi-tenant avec des permissions par organisation (un seller ne voit que SES produits), on enrichira avec du ReBAC (SpiceDB) ou des attributs ABAC. Pas besoin de Zanzibar tant qu'on n'a pas de partage de ressources entre utilisateurs.

---

## Ce que tu aurais pu oublier

### 1. Utiliser HS256 au lieu de RS256

```
FAUX — HS256 : secret partage entre l'IdP et l'API
  → Si l'API est compromise, l'attaquant peut forger des tokens

CORRECT — RS256 : cle asymetrique
  → L'API n'a que la cle publique (JWKS)
  → Meme compromise, elle ne peut pas forger de tokens
```

### 2. Ne pas cacher le JWKS

```typescript
// FAUX — fetch JWKS a chaque requete
const jwks = await fetch(keycloakUrl + '/.well-known/jwks.json');
// Latence +50ms par requete, SPOF si Keycloak est down

// CORRECT — cache Redis TTL 1h + force refresh on failure
const cached = await redis.get('auth:jwks');
if (cached) return JSON.parse(cached);
```

### 3. Comparer les roles en string

```typescript
// FAUX — pas de hierarchie
if (user.roles.includes('admin')) { ... }
// Un superadmin n'a pas le role 'admin' explicitement

// CORRECT — hierarchie numerique
const userLevel = Math.max(...user.roles.map(r => ROLE_HIERARCHY[r]));
if (userLevel >= requiredLevel) { ... }
```

### 4. Hardcoder le mode auth

```typescript
// FAUX — if/else dans le controller
if (process.env.NODE_ENV === 'development') {
  // skip auth
}

// CORRECT — adapter pattern avec injection
// Le controller ne sait pas quel provider est utilise
constructor(@Inject('AUTH_PROVIDER') private auth: AuthProvider) {}
```
