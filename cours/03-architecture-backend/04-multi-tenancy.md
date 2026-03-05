# Cours 22 — Multi-tenancy

**Objectif :** Comprendre les stratégies d'isolation multi-tenant, implémenter le schema-per-tenant avec PostgreSQL (`SET search_path`), sécuriser l'accès aux données avec des filtres SQL automatiques, gérer le multi-site au sein d'un tenant, configurer l'isolation du stockage S3, et mettre en place les backups et l'observabilité par tenant.

---

## Rappel du cours précédent

> Cours 21 — Architecture d'authentification (OIDC, JWT, RBAC).

**Question 1 — Pourquoi le flux Authorization Code + PKCE est-il préféré au flux Implicit pour les SPA ?**

<details>
<summary>Réponse</summary>

Le flux Implicit expose le token dans le fragment de l'URL (`#access_token=...`), ce qui le rend visible dans l'historique du navigateur, les logs des proxys, et les headers Referer. Il ne supporte pas les refresh tokens, ce qui force une re-authentification a chaque expiration. Le flux Authorization Code + PKCE echange le code d'autorisation via un POST (jamais dans l'URL), prouve l'identité du client avec un `code_verifier` (protection contre l'interception du code), et supporte les refresh tokens. Le flux Implicit est officiellement deprecie dans OAuth 2.1.

</details>

**Question 2 — Comment le cache JWKS géré-t-il la rotation de cle ?**

<details>
<summary>Réponse</summary>

Le cache JWKS stocke les cles publiques de Keycloak dans Redis avec un TTL d'1 heure. Quand un JWT arrive avec un `kid` inconnu ou que la validation de signature échoué, le service force un refresh du cache (ignore le TTL) et retelecharge les cles depuis le JWKS endpoint de Keycloak. Si la nouvelle cle fonctionne, c'est une rotation de cle réussie. Si elle échoué aussi, le token est rejete. Cela garantit zero downtime lors des rotations de cle.

</details>

---

## Analogie

**L'immeuble de bureaux — chaque etage est un tenant, chaque bureau est un site.**

Imaginez un immeuble de bureaux partage par plusieurs entreprises. Chaque entreprise occupe un etage entier : elle a ses propres bureaux, sa propre decoration, son propre réseau Wi-Fi, et ses propres armoires de stockage. L'entreprise du 3eme etage ne peut jamais accéder aux dossiers du 5eme etage, meme si les deux utilisent la meme cage d'escalier et le meme ascenseur.

C'est le **multi-tenancy** : un seul immeuble (une seule application), mais chaque etage (tenant) est complètement isole. Le gardien dans le hall (le middleware tenant) vérifié votre badge et vous dirige vers le bon etage.

Au sein d'un etage, l'entreprise peut avoir plusieurs bureaux pour différents departements : marketing, ventes, support. C'est le **multi-site** au sein d'un tenant : chaque bureau (site) a ses propres affichages et sa propre organisation, mais partage les ressources de l'etage.

---

## Théorie

### 1. Stratégies d'isolation multi-tenant

| Stratégie | Isolation | Complexite | Cout | Utilisation |
|---|---|---|---|---|
| Base de données séparée | Maximale | Haute | Eleve (1 BDD par tenant) | Reglementaire (sante, finance) |
| Schema-per-tenant | Forte | Moyenne | Moyen (1 schema par tenant) | SaaS B2B (notre choix) |
| Shared schema + colonne tenant_id | Faible | Basse | Faible | SaaS B2C grand volume |

```
SCHEMA-PER-TENANT — PostgreSQL

  Base de donnees unique : cms_production
  ┌──────────────────────────────────────────────────────┐
  │                                                      │
  │  Schema "tenant_acme"          Schema "tenant_globex" │
  │  ┌─────────────────────┐      ┌─────────────────────┐│
  │  │ articles             │      │ articles             ││
  │  │ categories           │      │ categories           ││
  │  │ media                │      │ media                ││
  │  │ users_preferences    │      │ users_preferences    ││
  │  └─────────────────────┘      └─────────────────────┘│
  │                                                      │
  │  Schema "public" (partage)                            │
  │  ┌─────────────────────┐                              │
  │  │ tenants (registre)   │                              │
  │  │ migrations           │                              │
  │  │ shared_config        │                              │
  │  └─────────────────────┘                              │
  │                                                      │
  └──────────────────────────────────────────────────────┘

  SET search_path TO tenant_acme, public;
  → Toutes les requetes touchent automatiquement les tables de tenant_acme
```

### 2. Les 3 couches d'isolation

L'isolation repose sur 3 couches independantes qui se renforcent mutuellement. Si une couche échoué, les autres bloquent toujours la fuite.

```
3 COUCHES D'ISOLATION

  Couche 1 : SCHEMA PostgreSQL
  ┌──────────────────────────────────┐
  │ SET search_path TO tenant_X      │
  │ → les tables sont physiquement   │
  │   separees entre tenants         │
  └──────────────────────────────────┘
           │
           v
  Couche 2 : FILTRE SQL AUTOMATIQUE
  ┌──────────────────────────────────┐
  │ WHERE tenant_id = :current       │
  │ → meme si search_path est mal    │
  │   configure, le filtre bloque    │
  └──────────────────────────────────┘
           │
           v
  Couche 3 : PREFIX S3 PAR TENANT
  ┌──────────────────────────────────┐
  │ s3://bucket/{tenant_id}/media/   │
  │ → les fichiers sont isoles par   │
  │   prefixe dans le stockage objet │
  └──────────────────────────────────┘

  DEFENSE EN PROFONDEUR : si une couche est contournee,
  les autres maintiennent l'isolation.
```

### 3. Extraction du tenant — JWT claim + header fallback

```
FLUX D'EXTRACTION DU TENANT

  Requete HTTP
       │
       v
  ┌─────────────────────────────────┐
  │ 1. Lire le JWT (Authorization)   │
  │    → extraire claim tenant_id    │
  └────────────┬────────────────────┘
               │
         Claim present?
         │            │
        OUI          NON
         │            │
         │            v
         │   ┌──────────────────────────┐
         │   │ 2. Lire header            │
         │   │    X-Tenant-Id            │
         │   └────────────┬─────────────┘
         │                │
         │          Header present?
         │          │            │
         │         OUI          NON → 400 Bad Request
         │          │
         v          v
  ┌─────────────────────────────────┐
  │ 3. Verifier que le tenant       │
  │    existe et est actif          │
  │    (cache Redis TTL 5min)       │
  └────────────┬────────────────────┘
               │
         Actif?
         │        │
        OUI      NON → 403 Forbidden
         │
         v
  ┌─────────────────────────────────┐
  │ 4. SET search_path TO tenant_X  │
  │    + stocker dans AsyncContext   │
  └─────────────────────────────────┘
```

### 4. Multi-site au sein d'un tenant

Un tenant peut avoir plusieurs sites (ex: site vitrine, blog, e-commerce). Le site est identifie par le header `X-Site-Id`.

```
TENANT vs SITE

  Tenant "acme" (etage 3 de l'immeuble)
  ┌────────────────────────────────────────────┐
  │                                            │
  │  Site "www"          Site "blog"            │
  │  ┌────────────┐     ┌────────────┐         │
  │  │ articles   │     │ articles   │         │
  │  │ pages      │     │ posts      │         │
  │  │ theme: A   │     │ theme: B   │         │
  │  └────────────┘     └────────────┘         │
  │                                            │
  │  Ressources partagees :                     │
  │  - media (images, fichiers)                 │
  │  - users & roles                            │
  │  - categories                               │
  │                                            │
  └────────────────────────────────────────────┘

  Les articles du site "blog" ne sont PAS visibles
  sur le site "www" et inversement (filtre site_id).
  Mais ils partagent le meme stockage media et les
  memes utilisateurs.
```

### 5. Backup et observabilité par tenant

```
BACKUP PAR TENANT

  # Sauvegarder un seul tenant (schema PostgreSQL)
  pg_dump -n tenant_acme cms_production > backup_acme_2026-03-02.sql

  # Restaurer un seul tenant
  psql cms_production < backup_acme_2026-03-02.sql

  # Avantages :
  # - Restauration granulaire (un seul tenant sans toucher les autres)
  # - Export pour migration (changer de plan, quitter le service)
  # - Conformite RGPD (suppression complete d'un tenant)


OBSERVABILITE PAR TENANT

  Chaque log, metrique et trace porte le tag tenant_id :
  - Logs : { "tenant_id": "acme", "level": "error", "msg": "..." }
  - Metriques : http_requests_total{tenant_id="acme", status="500"}
  - Traces : span.setAttribute("tenant.id", "acme")

  → Permet de debuguer un probleme specifique a un tenant
  → Permet de facturer par usage (requetes, stockage, bande passante)
  → Permet d'identifier les "noisy neighbors" (tenants gourmands)
```

### 6. Storage quota enforcement

```
QUOTA DE STOCKAGE PAR TENANT

  Chaque tenant a un quota de stockage defini dans sa configuration :
  - Plan Free   : 500 MB
  - Plan Pro    : 5 GB
  - Plan Enterprise : 50 GB

  Verification AVANT chaque upload :
  1. Calculer l'usage actuel (somme des fileSize en BDD)
  2. Ajouter la taille du fichier demande
  3. Si (usage + nouveau) > quota → 413 Payload Too Large

  L'usage est cache dans Redis (TTL 5min) et recalcule
  periodiquement via un job de reconciliation.
```

---

## Pratique

### Middleware tenant — extraction et configuration du schema

```typescript
// infrastructure/middleware/tenant.middleware.ts
import { Injectable, NestMiddleware, BadRequestException, ForbiddenException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { AsyncLocalStorage } from 'async_hooks';

// AsyncLocalStorage permet de propager le contexte tenant
// a travers toute la chaine d'appels async sans le passer explicitement
export const tenantContext = new AsyncLocalStorage<TenantContext>();

export interface TenantContext {
  tenantId: string;
  siteId?: string;
  schemaName: string;
}

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  constructor(
    private readonly tenantRegistry: TenantRegistryService,
    private readonly dbConnection: DatabaseConnectionService,
  ) {}

  async use(req: Request, res: Response, next: NextFunction): Promise<void> {
    // 1. Extraire le tenant_id depuis le JWT ou le header
    const tenantId = this.extractTenantId(req);
    if (!tenantId) {
      throw new BadRequestException({
        type: 'https://api.example.com/problems/missing-tenant',
        title: 'Missing Tenant Identifier',
        status: 400,
        detail: 'Request must include tenant_id in JWT or X-Tenant-Id header.',
      });
    }

    // 2. Verifier que le tenant existe et est actif (avec cache)
    const tenant = await this.tenantRegistry.findActive(tenantId);
    if (!tenant) {
      throw new ForbiddenException({
        type: 'https://api.example.com/problems/tenant-inactive',
        title: 'Tenant Not Found or Inactive',
        status: 403,
        detail: `Tenant "${tenantId}" does not exist or is suspended.`,
      });
    }

    // 3. Extraire le site_id (optionnel)
    const siteId = req.headers['x-site-id'] as string | undefined;

    // 4. Configurer le schema PostgreSQL pour cette requete
    const schemaName = `tenant_${tenantId}`;
    await this.dbConnection.setSearchPath(schemaName);

    // 5. Propager le contexte tenant dans l'AsyncLocalStorage
    const ctx: TenantContext = { tenantId, siteId, schemaName };

    tenantContext.run(ctx, () => {
      // Attacher aussi au request pour les Guards/Interceptors
      (req as any).tenantContext = ctx;
      next();
    });
  }

  private extractTenantId(req: Request): string | null {
    // Priorite 1 : claim JWT (deja decode par AuthGuard)
    const jwtTenantId = (req as any).user?.tenantId;
    if (jwtTenantId) return jwtTenantId;

    // Priorite 2 : header explicite
    const headerTenantId = req.headers['x-tenant-id'] as string;
    if (headerTenantId) return headerTenantId;

    return null;
  }
}
```

### Service de switching de schema

```typescript
// infrastructure/database/database-connection.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class DatabaseConnectionService {
  private readonly logger = new Logger('Database');

  constructor(private readonly dataSource: DataSource) {}

  async setSearchPath(schemaName: string): Promise<void> {
    // SECURITE : valider le nom du schema pour eviter l'injection SQL
    // Seuls les caracteres alphanumeriques et underscores sont autorises
    if (!/^tenant_[a-z0-9_]+$/.test(schemaName)) {
      throw new Error(`Invalid schema name: ${schemaName}`);
    }

    // SET search_path configure le schema pour toutes les requetes
    // de cette connexion. TypeORM utilise le pool de connexions,
    // donc on le fait a chaque requete.
    const queryRunner = this.dataSource.createQueryRunner();
    try {
      await queryRunner.query(
        `SET search_path TO ${schemaName}, public`,
      );
    } finally {
      await queryRunner.release();
    }
  }

  // Creer un nouveau schema pour un nouveau tenant
  async createTenantSchema(tenantId: string): Promise<void> {
    const schemaName = `tenant_${tenantId}`;

    if (!/^tenant_[a-z0-9_]+$/.test(schemaName)) {
      throw new Error(`Invalid schema name: ${schemaName}`);
    }

    const queryRunner = this.dataSource.createQueryRunner();
    try {
      await queryRunner.query(`CREATE SCHEMA IF NOT EXISTS ${schemaName}`);

      // Executer les migrations dans le nouveau schema
      await queryRunner.query(`SET search_path TO ${schemaName}`);
      await this.dataSource.runMigrations();

      this.logger.log(`Created tenant schema: ${schemaName}`);
    } finally {
      await queryRunner.release();
    }
  }
}
```

### S3 prefix resolver — isolation du stockage

```typescript
// infrastructure/storage/s3-prefix-resolver.ts
import { Injectable } from '@nestjs/common';
import { tenantContext } from '../middleware/tenant.middleware';

@Injectable()
export class S3PrefixResolver {
  // Resoudre le prefix S3 pour le tenant courant
  // Format : {tenant_id}/{type}/{year}/{month}/
  resolvePrefix(type: 'media' | 'exports' | 'backups'): string {
    const ctx = tenantContext.getStore();
    if (!ctx) {
      throw new Error('No tenant context available — middleware not configured?');
    }

    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');

    // Structure S3 :
    // tenants/acme/media/2026/03/image-uuid.webp
    // tenants/acme/exports/2026/03/export-uuid.csv
    return `tenants/${ctx.tenantId}/${type}/${year}/${month}/`;
  }

  // Generer la cle complete pour un fichier
  resolveKey(type: 'media' | 'exports' | 'backups', filename: string): string {
    return `${this.resolvePrefix(type)}${filename}`;
  }

  // Verifier qu'une cle S3 appartient bien au tenant courant
  // SECURITE : empeche un tenant de lire les fichiers d'un autre
  assertKeyBelongsToTenant(key: string): void {
    const ctx = tenantContext.getStore();
    if (!ctx) throw new Error('No tenant context');

    const expectedPrefix = `tenants/${ctx.tenantId}/`;
    if (!key.startsWith(expectedPrefix)) {
      throw new ForbiddenException(
        `Access denied: key "${key}" does not belong to tenant "${ctx.tenantId}"`,
      );
    }
  }
}
```

### Repository tenant-aware — filtre automatique

```typescript
// infrastructure/repositories/tenant-aware.repository.ts
import { tenantContext } from '../middleware/tenant.middleware';

// Classe de base pour tous les repositories tenant-aware
// Le filtre tenant est applique AUTOMATIQUEMENT — impossible de l'oublier
export abstract class TenantAwareRepository<T> {
  constructor(protected readonly orm: Repository<any>) {}

  protected get currentTenantId(): string {
    const ctx = tenantContext.getStore();
    if (!ctx) {
      throw new Error('No tenant context — this should never happen in production');
    }
    return ctx.tenantId;
  }

  protected get currentSiteId(): string | undefined {
    return tenantContext.getStore()?.siteId;
  }

  // Creer un query builder avec le filtre tenant pre-applique
  protected createTenantQuery(alias: string): SelectQueryBuilder<any> {
    const qb = this.orm.createQueryBuilder(alias)
      .where(`${alias}.tenantId = :tenantId`, {
        tenantId: this.currentTenantId,
      });

    // Si un site est specifie, ajouter le filtre site
    if (this.currentSiteId) {
      qb.andWhere(`${alias}.siteId = :siteId`, {
        siteId: this.currentSiteId,
      });
    }

    return qb;
  }
}

// Utilisation concrete :
export class TypeOrmArticleRepository
  extends TenantAwareRepository<Article>
  implements ArticleRepository
{
  async findById(id: string): Promise<Article | null> {
    // Le tenantId est AUTOMATIQUEMENT filtre — pas besoin de le passer
    const entity = await this.createTenantQuery('article')
      .andWhere('article.id = :id', { id })
      .andWhere('article.deletedAt IS NULL')
      .getOne();

    return entity ? this.mapper.toDomain(entity) : null;
  }

  async findAll(options: ArticleQueryOptions): Promise<PaginatedResult<Article>> {
    const qb = this.createTenantQuery('article')
      .andWhere('article.deletedAt IS NULL');

    if (options.status) {
      qb.andWhere('article.status = :status', { status: options.status });
    }

    const limit = Math.min(options.limit ?? 20, 24);
    const page = options.page ?? 1;

    qb.orderBy('article.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [entities, total] = await qb.getManyAndCount();

    return {
      items: entities.map(e => this.mapper.toDomain(e)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }
}
```

---

## Resume

- Le **schema-per-tenant** (PostgreSQL `SET search_path`) offre une isolation forte au niveau des tables, avec la possibilité de backup/restauration granulaire par tenant via `pg_dump -n`.
- L'**isolation en 3 couches** (schema BDD + filtre SQL automatique + prefix S3) fournit une defense en profondeur : si une couche est contournee, les autres maintiennent l'isolation des données.
- L'extraction du tenant suit une priorité : claim JWT d'abord, puis header `X-Tenant-Id` en fallback, avec vérification d'existence et d'activite dans un registre cache.
- Le **multi-site** (`X-Site-Id`) permet a un tenant de gérer plusieurs sites independants au sein du meme schema, avec des ressources partagees (media, users) et des contenus isoles (articles par site).
- L'**observabilité par tenant** (logs, metriques, traces tagges avec `tenant_id`) permet le diagnostic cible, la facturation par usage, et l'identification des tenants gourmands (noisy neighbors).


---

> **Lien fil rouge — ShopArch**
>
> - Implémente l'isolation tenant dans ShopArch (schema-per-tenant ou row-level security)
> - Vérifie qu'un tenant ne peut jamais voir les données d'un autre
> - Exercice(s) associé(s) : `exercices/14-multi-tenant-isolation/`
> - Checkpoint : Module 03, critère 2

## Prochain cours

[Cours 23 — Data Access Patterns](./05-data-access-patterns.md)
