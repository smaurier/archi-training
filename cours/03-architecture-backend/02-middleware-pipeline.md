# Cours 20 — Middleware & Pipeline

**Objectif :** Comprendre le pattern middleware et le cycle de vie complet d'une requête dans NestJS (middleware, guards, interceptors, pipes, handler, interceptors, exception filters), les comparer avec le pipeline Symfony HttpKernel, et implémenter chaque étape avec des exemples concrets.

---

## Rappel du cours précédent

> Cours 19 — API Design REST.

**Question 1 — Comment fonctionne le mecanisme ETag/If-Match pour le verrouillage optimiste ?**

<details>
<summary>Réponse</summary>

Le serveur inclut un header `ETag` dans la réponse GET (par exemple `"v3"` base sur la version de l'entité). Lors d'une modification (PUT/PATCH), le client renvoie cette valeur dans le header `If-Match`. Le serveur compare la version attendue avec la version actuelle en base. Si elles correspondent, la modification est acceptee et le serveur renvoie un nouveau `ETag`. Si elles différent (un autre utilisateur a modifie entre temps), le serveur renvoie `412 Precondition Failed` et le client doit recharger la ressource avant de reessayer.

</details>

**Question 2 — Quel est le flux d'upload via presigned URL ?**

<details>
<summary>Réponse</summary>

Le flux comporte 3 étapes : (1) le client appelle `POST /media/upload` avec les metadonnees du fichier (nom, mime, taille), (2) le serveur généré une URL presignee S3, cree un enregistrement media en BDD avec statut "pending" et renvoie l'URL + le mediaId, (3) le client uploade directement vers S3 via l'URL presignee sans passer par le serveur API, puis appelle `POST /media/:id/confirm` pour que le serveur vérifié l'existence du fichier sur S3 et mette a jour le statut. Le serveur ne recoit jamais le fichier binaire.

</details>

---

## Analogie

**La chaine de montage automobile.**

Dans une usine automobile, la carrosserie passe par une serie de stations : controle qualité de la tole, soudure, peinture, assemblage des pieces interieures, test electrique, controle final. Chaque station a une responsabilité unique. Si une station détecté un defaut, elle peut rejeter la piece (erreur) sans que les stations suivantes soient sollicitees. L'ordre des stations est fixe et chaque station ne connait que la précédente et la suivante.

Le pipeline NestJS fonctionne exactement ainsi : la requête HTTP est la carrosserie, et chaque étape (middleware, guard, interceptor, pipe, handler) est une station. Chaque station peut laisser passer, transformer, ou rejeter la requête. Si un guard rejette (403), le pipe de validation n'est jamais atteint. Si le pipe rejette (422), le handler n'est jamais appele.

---

## Théorie

### 1. Cycle de vie complet d'une requête NestJS

```
REQUETE HTTP ENTRANTE
        │
        v
┌─────────────────┐
│   MIDDLEWARE     │  Express-compatible, executes avant le routing NestJS
│  (logging, cors, │  Peut modifier req/res, appeler next(), ou court-circuiter
│   body parser)   │
└────────┬────────┘
         │
         v
┌─────────────────┐
│     GUARDS      │  Decideur oui/non : l'utilisateur a-t-il le droit ?
│  (auth, roles,  │  Retourne true/false. Si false -> 403 Forbidden
│   tenant check) │  A acces a ExecutionContext (controller + handler metadata)
└────────┬────────┘
         │
         v
┌─────────────────┐
│  INTERCEPTORS   │  Avant le handler : transformer la requete, demarrer un timer
│  (before)       │  Peut modifier les arguments, ajouter du contexte
│                 │  Wrappent le handler via un Observable (RxJS)
└────────┬────────┘
         │
         v
┌─────────────────┐
│     PIPES       │  Transformation + validation des parametres
│  (validation,   │  class-validator, ParseIntPipe, ParseUUIDPipe
│   transform)    │  Si invalide -> 400 ou 422
└────────┬────────┘
         │
         v
┌─────────────────┐
│    HANDLER      │  La methode du controller (@Get, @Post...)
│  (controller    │  Appelle le use case / service
│   method)       │  Retourne la reponse
└────────┬────────┘
         │
         v
┌─────────────────┐
│  INTERCEPTORS   │  Apres le handler : transformer la reponse,
│  (after)        │  logger le temps d'execution, wrapper le resultat
└────────┬────────┘
         │
         v
┌─────────────────────┐
│  EXCEPTION FILTERS  │  Attrape les exceptions non gerees a n'importe
│  (si erreur)        │  quelle etape. Transforme en reponse HTTP (RFC 7807)
└────────┬────────────┘
         │
         v
    REPONSE HTTP
```

### 2. Comparaison NestJS vs Symfony HttpKernel

| Étape | NestJS | Symfony |
|---|---|---|
| Pre-routing | Middleware (Express) | kernel.request (EventSubscriber) |
| Authentification | Guard | Firewall + Authenticator |
| Autorisation | Guard (canActivate) | Voter (@IsGranted) |
| Pre-controller | Interceptor (before) | kernel.controller |
| Validation | Pipe (ValidationPipe) | ParamConverter + Validator |
| Controller | @Get / @Post handler | Controller method |
| Post-controller | Interceptor (after) | kernel.response |
| Erreurs | ExceptionFilter | kernel.exception |
| Serialisation | Interceptor (ClassSerializer) | kernel.view + Serializer |

### 3. Ordre d'exécution et portee

```
PORTEE DES COMPOSANTS

  Global ──────────────────────────────────────────────────
  │  app.useGlobalGuards(new AuthGuard())
  │  app.useGlobalPipes(new ValidationPipe())
  │  app.useGlobalInterceptors(new LoggingInterceptor())
  │  app.useGlobalFilters(new ProblemDetailsFilter())
  │
  │  Module ─────────────────────────────────────────────
  │  │  @Module({ providers: [{ provide: APP_GUARD, useClass: RolesGuard }] })
  │  │
  │  │  Controller ──────────────────────────────────────
  │  │  │  @UseGuards(TenantGuard)
  │  │  │  @UseInterceptors(CacheInterceptor)
  │  │  │
  │  │  │  Handler ────────────────────────────────────
  │  │  │  │  @UsePipes(new ParseUUIDPipe())
  │  │  │  │  @UseFilters(new SpecificFilter())
  │  │  │  └──────────────────────────────────────────
  │  │  └────────────────────────────────────────────────
  │  └───────────────────────────────────────────────────
  └──────────────────────────────────────────────────────

  Execution : Global → Module → Controller → Handler
  (du plus large au plus specifique)
```

### 4. Quand utiliser quoi ?

| Besoin | Composant | Pourquoi |
|---|---|---|
| Logging de chaque requête | Middleware | Agit avant le routing, minimal |
| CORS, compression | Middleware | Configuration Express standard |
| Vérifier l'authentification | Guard | Retourne true/false, accès au contexte |
| Vérifier les roles RBAC | Guard | Lit les metadata du decorateur @Roles |
| Valider les parametres | Pipe | Transforme et valide avant le handler |
| Mesurer le temps de réponse | Interceptor | Wrappe le handler (before + after) |
| Transformer la réponse | Interceptor | Modifie la valeur de retour |
| Gérer les erreurs | ExceptionFilter | Attrape et formate les exceptions |

---

## Pratique

### Middleware — Logging de chaque requête

```typescript
// infrastructure/middleware/request-logger.middleware.ts
import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class RequestLoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  use(req: Request, res: Response, next: NextFunction): void {
    const start = Date.now();

    // Capturer le moment ou la reponse est envoyee
    res.on('finish', () => {
      const duration = Date.now() - start;
      const { method, originalUrl } = req;
      const { statusCode } = res;

      // Format: GET /articles 200 12ms
      this.logger.log(
        `${method} ${originalUrl} ${statusCode} ${duration}ms`,
      );
    });

    next(); // Passer au middleware suivant (ou au guard)
  }
}

// Enregistrement dans le module — on l'applique a toutes les routes
// app.module.ts
import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';

@Module({ /* ... */ })
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(RequestLoggerMiddleware)
      .forRoutes('*'); // Toutes les routes
  }
}
```

### Guard — Authentification JWT

```typescript
// infrastructure/guards/auth.guard.ts
import {
  CanActivate, ExecutionContext, Injectable, UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtValidationService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Verifier si la route est marquee @Public()
    const isPublic = this.reflector.getAllAndOverride<boolean>(
      'isPublic',
      [context.getHandler(), context.getClass()],
    );
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers['authorization'];

    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing or invalid Authorization header');
    }

    const token = authHeader.substring(7);

    try {
      // Valider le JWT (signature RS256, expiration, issuer)
      const payload = await this.jwtService.validate(token);

      // Attacher l'utilisateur au request pour les etapes suivantes
      request.user = {
        sub: payload.sub,
        tenantId: payload.tenant_id,
        roles: payload.realm_access?.roles ?? [],
      };

      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}
```

### Guard — Roles RBAC

```typescript
// infrastructure/guards/roles.guard.ts
import { CanActivate, ExecutionContext, Injectable, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

// Decorateur custom pour marquer les roles requis
export const Roles = (...roles: string[]) => SetMetadata('roles', roles);

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Lire les roles requis depuis les metadata du handler
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      'roles',
      [context.getHandler(), context.getClass()],
    );

    // Pas de @Roles() = pas de restriction
    if (!requiredRoles || requiredRoles.length === 0) return true;

    const { user } = context.switchToHttp().getRequest();

    // Verifier que l'utilisateur a au moins un des roles requis
    const hasRole = requiredRoles.some(role => user.roles.includes(role));

    if (!hasRole) {
      throw new ForbiddenException(
        `Required roles: [${requiredRoles.join(', ')}]. User has: [${user.roles.join(', ')}]`,
      );
    }

    return true;
  }
}

// Utilisation dans un controller :
// @Roles('admin', 'editor')
// @Post('articles')
// async create(@Body() dto: CreateArticleDto) { ... }
```

### Interceptor — Mesure du temps et wrapping de la réponse

```typescript
// infrastructure/interceptors/response-transform.interceptor.ts
import {
  CallHandler, ExecutionContext, Injectable, NestInterceptor, Logger,
} from '@nestjs/common';
import { Observable, tap, map } from 'rxjs';

@Injectable()
export class ResponseTransformInterceptor implements NestInterceptor {
  private readonly logger = new Logger('Performance');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const start = Date.now();
    const request = context.switchToHttp().getRequest();

    return next.handle().pipe(
      // Apres le handler : transformer la reponse
      map(data => ({
        success: true,
        data,
        meta: {
          timestamp: new Date().toISOString(),
          path: request.url,
        },
      })),
      // Logger le temps d'execution
      tap(() => {
        const duration = Date.now() - start;
        if (duration > 500) {
          // Alerter si une requete prend plus de 500ms
          this.logger.warn(
            `Slow request: ${request.method} ${request.url} took ${duration}ms`,
          );
        }
      }),
    );
  }
}
```

### Pipe — Validation avec class-validator

```typescript
// infrastructure/pipes/custom-validation.pipe.ts
import {
  PipeTransform, Injectable, ArgumentMetadata, BadRequestException,
} from '@nestjs/common';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';

@Injectable()
export class CustomValidationPipe implements PipeTransform {
  async transform(value: any, { metatype }: ArgumentMetadata) {
    if (!metatype || !this.toValidate(metatype)) {
      return value;
    }

    const object = plainToInstance(metatype, value);
    const errors = await validate(object, {
      whitelist: true,            // Supprimer les proprietes non-decorees
      forbidNonWhitelisted: true, // Erreur si proprietes inconnues
      forbidUnknownValues: true,
    });

    if (errors.length > 0) {
      // Transformer les erreurs class-validator en violations RFC 7807
      const violations = errors.flatMap(err =>
        Object.values(err.constraints ?? {}).map(message => ({
          field: err.property,
          message,
        })),
      );

      throw new ValidationException(violations);
    }

    return object;
  }

  private toValidate(metatype: Function): boolean {
    const types: Function[] = [String, Boolean, Number, Array, Object];
    return !types.includes(metatype);
  }
}
```

### Exception Filter — Erreurs globales

```typescript
// infrastructure/filters/global-exception.filter.ts
import { ExceptionFilter, Catch, ArgumentsHost, HttpException, Logger } from '@nestjs/common';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();

    if (exception instanceof ValidationException) {
      response.status(422).json({
        type: 'https://api.example.com/problems/validation-error',
        title: 'Validation Error',
        status: 422,
        instance: request.url,
        violations: exception.violations,
      });
      return;
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      response.status(status).json({
        type: `https://api.example.com/problems/http-${status}`,
        title: exception.message,
        status,
        instance: request.url,
      });
      return;
    }

    // Erreur inattendue — loguer l'erreur complete mais ne pas l'exposer
    this.logger.error('Unhandled exception', exception);
    response.status(500).json({
      type: 'https://api.example.com/problems/internal-error',
      title: 'Internal Server Error',
      status: 500,
      instance: request.url,
    });
  }
}
```

---

## Resume

- Le pipeline NestJS suit un ordre strict : **Middleware -> Guards -> Interceptors (before) -> Pipes -> Handler -> Interceptors (after) -> Exception Filters** ; chaque étape peut court-circuiter les suivantes.
- Les **Middleware** (compatibles Express) agissent avant le routing NestJS pour le logging, CORS, compression — ils ne connaissent pas les decorateurs NestJS.
- Les **Guards** prennent des decisions binaires (oui/non) basees sur l'authentification et les roles, avec accès aux metadata des decorateurs (`@Roles`, `@Public`).
- Les **Interceptors** wrappent le handler via RxJS Observable, ce qui leur permet d'agir avant ET apres l'exécution (mesure de temps, transformation de réponse, cache).
- Les **Pipes** transforment et valident les parametres d'entree (DTO) avant que le handler ne soit appele, et les **Exception Filters** interceptent toute erreur pour la formater en RFC 7807.


---

> **Lien fil rouge — ShopArch**
>
> - Implémente le pipeline de middlewares ShopArch : auth → RBAC → validation → handler → error
> - Ajoute un middleware de logging structuré avec correlationId
> - Exercice(s) associé(s) : `exercices/12-api-rest-nestjs/`
> - Checkpoint : Module 03, critère 1

## Prochain cours

[Cours 21 — Architecture d'authentification (OIDC, JWT, RBAC)](./03-auth-architecture.md)
