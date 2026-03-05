# Cours 21 — Architecture d'authentification (OIDC, JWT, RBAC)

**Objectif :** Maîtriser le flux OAuth 2.0 / OIDC avec Authorization Code + PKCE, comprendre la validation JWT via RS256 et le caching JWKS, implémenter une hierarchie de roles RBAC avec des voters custom, concevoir un auth adapter (production OIDC vs mock dev), et sécuriser le stockage des tokens côté client.

---

## Rappel du cours précédent

> Cours 20 — Middleware & Pipeline.

**Question 1 — Dans quel ordre s'executent les composants du pipeline NestJS ?**

<details>
<summary>Réponse</summary>

L'ordre est : Middleware (Express) -> Guards (authentification/autorisation) -> Interceptors avant (transformation requête, timer) -> Pipes (validation/transformation parametres) -> Handler (méthode du controller) -> Interceptors apres (transformation réponse) -> Exception Filters (si erreur). Chaque étape peut court-circuiter les suivantes. Par exemple, si un Guard retourne `false`, les Pipes et le Handler ne sont jamais executes.

</details>

**Question 2 — Quelle est la différence entre un Guard et un Interceptor ?**

<details>
<summary>Réponse</summary>

Un Guard prend une decision binaire (oui/non) : il retourne `true` pour autoriser l'accès ou leve une exception (403/401). Il a accès au `ExecutionContext` et aux metadata des decorateurs (`@Roles`). Un Interceptor wrappe le handler via un Observable RxJS, ce qui lui permet d'agir avant ET apres l'exécution du handler (mesurer le temps, transformer la réponse, ajouter du cache). Un Guard ne peut pas transformer la réponse ; un Interceptor ne devrait pas prendre de decision d'autorisation.

</details>

---

## Analogie

**Le système de badges d'un immeuble de bureaux.**

Pour entrer dans un immeuble de bureaux moderne, vous passez par plusieurs controles :

1. **L'accueil** (le fournisseur d'identité / Keycloak) vérifié votre identité, vous prend en photo et vous delivre un badge avec votre nom, votre entreprise et vos accès.
2. **Le badge** (le JWT) contient toutes vos informations encodees. Il est signe par l'accueil — personne d'autre ne peut fabriquer un badge valide.
3. **Le portique** (le middleware de validation) scanne le badge, vérifié la signature (est-il bien delivre par l'accueil ?) et la date d'expiration (est-il encore valide ?).
4. **Les etages** (les roles RBAC) sont accessibles selon votre niveau de badge : badge "visiteur" pour le hall, "employe" pour les bureaux, "admin" pour la salle serveur.
5. Si votre badge expire, vous retournez a l'accueil pour en obtenir un nouveau (**refresh token**).

Vous ne montrez jamais votre mot de passe au portique — le badge suffit. Et l'immeuble n'appelle pas l'accueil a chaque passage de portique : il fait confiance a la signature.

---

## Théorie

### 1. OAuth 2.0 / OIDC — Authorization Code + PKCE

```
FLUX AUTHORIZATION CODE + PKCE

  Navigateur               Keycloak (IdP)              API Backend
      │                         │                          │
      │  1. Clic "Se connecter" │                          │
      │  Genere code_verifier   │                          │
      │  + code_challenge       │                          │
      │  (SHA256)               │                          │
      │                         │                          │
      │  2. Redirect            │                          │
      │  /auth?response_type=   │                          │
      │  code&code_challenge=   │                          │
      │  abc...&method=S256     │                          │
      │ ──────────────────>     │                          │
      │                         │                          │
      │  3. Login form          │                          │
      │ <──────────────────     │                          │
      │  (user saisit id/mdp)   │                          │
      │ ──────────────────>     │                          │
      │                         │                          │
      │  4. Redirect callback   │                          │
      │  ?code=xyz              │                          │
      │ <──────────────────     │                          │
      │                         │                          │
      │  5. POST /token         │                          │
      │  { code: xyz,           │                          │
      │    code_verifier: ... } │                          │
      │ ──────────────────>     │                          │
      │                         │                          │
      │  6. { access_token,     │                          │
      │       refresh_token,    │                          │
      │       id_token }        │                          │
      │ <──────────────────     │                          │
      │                         │                          │
      │  7. GET /articles       │                          │
      │  Authorization: Bearer  │                          │
      │  <access_token>         │                          │
      │ ─────────────────────────────────────────────>     │
      │                         │                          │
      │                         │  8. Valider JWT          │
      │                         │  (signature RS256,       │
      │                         │   expiration, issuer)    │
      │                         │                          │
      │  9. 200 OK { articles } │                          │
      │ <─────────────────────────────────────────────     │
```

**Pourquoi PKCE et pas le flux Implicit ?**

| Aspect | Implicit (obsolete) | Authorization Code + PKCE |
|---|---|---|
| Token dans l'URL | Oui (fragment #) — visible dans les logs | Non — echange via POST |
| Refresh token | Impossible | Possible |
| Sécurité | Vulnerable au vol via l'historique navigateur | code_verifier prouve l'identité du client |
| Standard actuel | Deprecie (OAuth 2.1) | Recommande pour SPA et mobile |

### 2. JWT — Structure et validation RS256

Un JWT contient 3 parties séparées par des points : `header.payload.signature`.

```
STRUCTURE JWT

  header (base64url)          payload (base64url)           signature
  ─────────────────           ──────────────────            ──────────
  {                           {                             RSASHA256(
    "alg": "RS256",             "sub": "user-uuid",          base64url(header) + "." +
    "typ": "JWT",               "iss": "https://kc.ex.com",  base64url(payload),
    "kid": "key-id-123"         "aud": "cms-api",            privateKey
  }                             "exp": 1709251200,         )
                                "iat": 1709247600,
                                "tenant_id": "tenant-01",
                                "realm_access": {
                                  "roles": ["editor", "user"]
                                }
                              }
```

**RS256 vs HS256 :**

| Aspect | HS256 (symetrique) | RS256 (asymetrique) |
|---|---|---|
| Cle | Une seule cle partagee | Cle privee (IdP) + cle publique (API) |
| Risque | Si l'API a la cle, elle peut forger des tokens | L'API ne peut QUE vérifier, pas forger |
| Multi-service | Chaque service doit avoir le secret | Chaque service telecharge la cle publique |
| Production | Deconseille | Standard |

### 3. JWKS Endpoint — Caching avec Redis

Le JWKS (JSON Web Key Set) endpoint de Keycloak fournit les cles publiques pour vérifier les signatures JWT.

```
STRATEGIE DE CACHE JWKS

  JWT arrive       Cache Redis             Keycloak JWKS
      │                 │                       │
      │  kid = "abc"    │                       │
      │ ──────────>     │                       │
      │                 │                       │
      │  Cache hit?     │                       │
      │  OUI ──> utiliser la cle en cache       │
      │                 │                       │
      │  NON ──> fetch  │                       │
      │                 │  GET /certs            │
      │                 │ ─────────────────>     │
      │                 │  { keys: [...] }       │
      │                 │ <─────────────────     │
      │                 │                       │
      │  Stocker en     │                       │
      │  cache (TTL     │                       │
      │  = 1h)          │                       │
      │                 │                       │
      │  ERREUR DE      │                       │
      │  VALIDATION ──> │                       │
      │  Force refresh  │  GET /certs            │
      │  (ignore cache) │ ─────────────────>     │
      │                 │  (rotation de cle?)    │
```

### 4. Hierarchie de roles RBAC

```
HIERARCHIE DES ROLES

  super_admin
      │
      ├── admin
      │     │
      │     ├── editor
      │     │     │
      │     │     └── contributor
      │     │
      │     └── moderator
      │
      └── analyst

REGLE : un role herite de tous les droits de ses enfants.
  - admin peut tout ce que editor et moderator peuvent faire
  - super_admin peut tout ce que admin peut faire
  - contributor ne peut QUE creer des brouillons
```

### 5. Auth Adapter Pattern

En production, l'auth passe par Keycloak OIDC. En développement, on utilise un mock qui évité de demarrer Keycloak.

```
AUTH ADAPTER PATTERN

  ┌─────────────────────────┐
  │   <<interface>>         │
  │   AuthAdapter           │
  │  ─────────────────────  │
  │  + validateToken(token) │
  │  + getUserInfo(token)   │
  │  + getJwks()            │
  └────────┬────────────────┘
           │
     ┌─────┴──────────────┐
     │                    │
┌────────────┐    ┌───────────────┐
│ KeycloakAuth│   │ MockAuthAdapter│
│ Adapter     │   │ (dev/test)    │
│             │   │               │
│ OIDC real   │   │ Token fixe,   │
│ JWKS cache  │   │ roles en dur  │
│ RS256       │   │ pas de reseau │
└─────────────┘   └───────────────┘
```

### 6. Stockage des tokens côté client

| Stockage | XSS | CSRF | Persistance | Recommandation |
|---|---|---|---|---|
| localStorage | Vulnerable | Non expose | Oui (permanent) | NON — XSS peut lire le token |
| sessionStorage | Vulnerable | Non expose | Non (onglet ferme = perdu) | Acceptable pour SPA |
| Cookie httpOnly + Secure | Protege (JS ne peut pas lire) | Vulnerable (sauf SameSite) | Oui | OUI avec SameSite=Strict |
| Memory (variable JS) | Protege (pas dans le DOM) | Non expose | Non (refresh = perdu) | OUI pour access_token court |

**Stratégie recommandee :** access_token en mémoire (variable JS, durée courte 5-15 min), refresh_token en cookie httpOnly Secure SameSite=Strict.

### 7. Navigation Guards — Flux de vérification

```
FLUX NAVIGATION GUARD (FRONT-END)

  User clique sur /admin/articles
           │
           v
  ┌─────────────────────┐
  │ 1. Restore session  │  Verifier si un token existe en memoire
  │    (token en memoire │  ou un refresh_token en cookie
  │     ou cookie?)      │
  └──────────┬──────────┘
             │
       Token existe?
       │           │
      OUI         NON ──> Redirect /login
       │
       v
  ┌─────────────────────┐
  │ 2. Check auth       │  Le token est-il encore valide ?
  │    (exp > now?)      │  Si expire, tenter un refresh
  └──────────┬──────────┘
             │
       Valide?
       │         │
      OUI       NON ──> Redirect /login
       │
       v
  ┌─────────────────────┐
  │ 3. Check RBAC       │  L'utilisateur a-t-il le role requis
  │    (route.meta.roles │  pour cette route ?
  │     vs user.roles)   │
  └──────────┬──────────┘
             │
       Autorise?
       │          │
      OUI        NON ──> Redirect /403
       │
       v
  ┌─────────────────────┐
  │ 4. Allow            │  Laisser passer
  │ 5. Update title     │  Mettre a jour document.title
  └─────────────────────┘
```

---

## Pratique

### Service de validation JWT avec cache JWKS

```typescript
// infrastructure/auth/jwt-validation.service.ts
import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import * as jose from 'jose';

@Injectable()
export class JwtValidationService {
  private readonly logger = new Logger('JwtValidation');
  private jwksCache: jose.JSONWebKeySet | null = null;
  private jwksCacheExpiry = 0;
  private readonly CACHE_TTL_MS = 3600_000; // 1 heure

  constructor(
    private readonly config: AuthConfig,
    private readonly redis: RedisService,
  ) {}

  async validate(token: string): Promise<JwtPayload> {
    // 1. Decoder le header pour obtenir le kid (key ID)
    const header = jose.decodeProtectedHeader(token);
    const kid = header.kid;

    if (!kid) {
      throw new UnauthorizedException('JWT missing kid in header');
    }

    // 2. Obtenir la cle publique (depuis le cache ou le JWKS endpoint)
    const publicKey = await this.getPublicKey(kid);

    // 3. Verifier la signature, l'expiration, l'issuer et l'audience
    try {
      const { payload } = await jose.jwtVerify(token, publicKey, {
        issuer: this.config.issuer,
        audience: this.config.audience,
        algorithms: ['RS256'],
      });

      return payload as JwtPayload;
    } catch (error) {
      // Si echec de validation, peut-etre rotation de cle -> force refresh
      if (error instanceof jose.errors.JWSSignatureVerificationFailed) {
        this.logger.warn('Signature verification failed, forcing JWKS refresh');
        const refreshedKey = await this.getPublicKey(kid, true);
        const { payload } = await jose.jwtVerify(token, refreshedKey, {
          issuer: this.config.issuer,
          audience: this.config.audience,
          algorithms: ['RS256'],
        });
        return payload as JwtPayload;
      }
      throw new UnauthorizedException('Invalid token');
    }
  }

  private async getPublicKey(
    kid: string,
    forceRefresh = false,
  ): Promise<jose.KeyLike> {
    // Strategie : Redis cache -> JWKS endpoint -> erreur
    if (!forceRefresh) {
      const cached = await this.redis.get(`jwks:${kid}`);
      if (cached) {
        return await jose.importJWK(JSON.parse(cached), 'RS256');
      }
    }

    // Telecharger le JWKS depuis Keycloak
    const jwksUrl = `${this.config.issuer}/protocol/openid-connect/certs`;
    const response = await fetch(jwksUrl);
    const jwks: jose.JSONWebKeySet = await response.json();

    // Mettre en cache chaque cle individuellement
    for (const key of jwks.keys) {
      if (key.kid) {
        await this.redis.set(
          `jwks:${key.kid}`,
          JSON.stringify(key),
          'EX',
          3600, // TTL 1 heure
        );
      }
    }

    const targetKey = jwks.keys.find(k => k.kid === kid);
    if (!targetKey) {
      throw new UnauthorizedException(`No key found for kid: ${kid}`);
    }

    return await jose.importJWK(targetKey, 'RS256');
  }
}

interface JwtPayload {
  sub: string;
  tenant_id: string;
  realm_access?: { roles: string[] };
  exp: number;
  iat: number;
  iss: string;
  aud: string;
}
```

### Guard RBAC avec hierarchie de roles

```typescript
// infrastructure/guards/rbac.guard.ts
import { CanActivate, ExecutionContext, Injectable, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

// Hierarchie des roles : chaque role herite des droits de ses enfants
const ROLE_HIERARCHY: Record<string, string[]> = {
  super_admin: ['admin', 'editor', 'contributor', 'moderator', 'analyst'],
  admin:       ['editor', 'contributor', 'moderator'],
  editor:      ['contributor'],
  moderator:   [],
  contributor: [],
  analyst:     [],
};

function expandRoles(roles: string[]): string[] {
  const expanded = new Set<string>();
  for (const role of roles) {
    expanded.add(role);
    const children = ROLE_HIERARCHY[role] ?? [];
    for (const child of children) {
      expanded.add(child);
    }
  }
  return Array.from(expanded);
}

@Injectable()
export class RbacGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      'roles',
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles?.length) return true;

    const { user } = context.switchToHttp().getRequest();
    const effectiveRoles = expandRoles(user.roles);

    const hasRole = requiredRoles.some(r => effectiveRoles.includes(r));
    if (!hasRole) {
      throw new ForbiddenException(
        `Requires one of [${requiredRoles.join(', ')}], ` +
        `user has [${user.roles.join(', ')}]`,
      );
    }
    return true;
  }
}
```

### Auth Adapter — Interface et implémentations

```typescript
// domain/ports/auth-adapter.interface.ts
// Definie dans le domaine — aucune dependance a Keycloak ou HTTP

export interface AuthAdapter {
  validateToken(token: string): Promise<AuthUser>;
  refreshToken(refreshToken: string): Promise<TokenPair>;
  logout(refreshToken: string): Promise<void>;
}

export interface AuthUser {
  sub: string;
  tenantId: string;
  roles: string[];
  email: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

// ── Implementation production : Keycloak ──────────────────────

// infrastructure/auth/keycloak-auth.adapter.ts
@Injectable()
export class KeycloakAuthAdapter implements AuthAdapter {
  constructor(
    private readonly jwtService: JwtValidationService,
    private readonly config: AuthConfig,
  ) {}

  async validateToken(token: string): Promise<AuthUser> {
    const payload = await this.jwtService.validate(token);
    return {
      sub: payload.sub,
      tenantId: payload.tenant_id,
      roles: payload.realm_access?.roles ?? [],
      email: payload.email ?? '',
    };
  }

  async refreshToken(refreshToken: string): Promise<TokenPair> {
    const response = await fetch(
      `${this.config.issuer}/protocol/openid-connect/token`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          client_id: this.config.clientId,
          refresh_token: refreshToken,
        }),
      },
    );
    const data = await response.json();
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in,
    };
  }

  async logout(refreshToken: string): Promise<void> {
    await fetch(`${this.config.issuer}/protocol/openid-connect/logout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: this.config.clientId,
        refresh_token: refreshToken,
      }),
    });
  }
}

// ── Implementation dev/test : Mock ────────────────────────────

// infrastructure/auth/mock-auth.adapter.ts
@Injectable()
export class MockAuthAdapter implements AuthAdapter {
  // En dev, on accepte un token "dev-token-admin" sans validation
  async validateToken(token: string): Promise<AuthUser> {
    const mockUsers: Record<string, AuthUser> = {
      'dev-token-admin': {
        sub: 'dev-admin-uuid',
        tenantId: 'dev-tenant',
        roles: ['admin'],
        email: 'admin@dev.local',
      },
      'dev-token-editor': {
        sub: 'dev-editor-uuid',
        tenantId: 'dev-tenant',
        roles: ['editor'],
        email: 'editor@dev.local',
      },
    };

    const user = mockUsers[token];
    if (!user) throw new Error('Unknown dev token');
    return user;
  }

  async refreshToken(): Promise<TokenPair> {
    return {
      accessToken: 'dev-token-admin',
      refreshToken: 'dev-refresh',
      expiresIn: 3600,
    };
  }

  async logout(): Promise<void> {
    // No-op en dev
  }
}

// ── Injection conditionnelle ─────────────────────────────────
// auth.module.ts
@Module({
  providers: [
    {
      provide: 'AUTH_ADAPTER',
      useFactory: (config: ConfigService) => {
        return config.get('NODE_ENV') === 'production'
          ? new KeycloakAuthAdapter(/* ... */)
          : new MockAuthAdapter();
      },
      inject: [ConfigService],
    },
  ],
  exports: ['AUTH_ADAPTER'],
})
export class AuthModule {}
```

---

## Resume

- **OAuth 2.0 Authorization Code + PKCE** est le flux recommande pour les SPA : le code_verifier prouve l'identité du client sans secret stocke dans le navigateur, et le token n'apparait jamais dans l'URL.
- **RS256** (asymetrique) est obligatoire en production : l'API ne peut que vérifier les tokens avec la cle publique, jamais en forger — contrairement a HS256 ou la cle partagee permet les deux.
- Le **cache JWKS** avec Redis (TTL 1h) évité d'appeler Keycloak a chaque requête, avec un force-refresh en cas d'echec de validation pour gérer les rotations de cle.
- Le **RBAC avec hierarchie** simplifie la gestion des permissions : un `admin` hérité automatiquement de tous les droits `editor` et `contributor`, sans duplication explicite.
- L'**auth adapter pattern** (interface + 2 implémentations) permet de développer et tester sans Keycloak reel, tout en garantissant le meme contrat d'authentification en production.


---

> **Lien fil rouge — ShopArch**
>
> - Intègre Keycloak (OIDC) dans ShopArch avec un guard JWT NestJS
> - Implémente le RBAC : admin peut tout, customer ne peut que consulter et commander
> - Exercice(s) associé(s) : `exercices/13-auth-oidc-rbac/`
> - Checkpoint : Module 03, critère 2, 5

## Prochain cours

[Cours 22 — Multi-tenancy](./04-multi-tenancy.md)
