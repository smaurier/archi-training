# Cours 68 — Logging structure

> **Objectif** : Maîtriser le logging structure JSON, définir les resource attributes standard, assurer un logging PII-free, et implémenter les correlation IDs pour le tracing cross-service.

---

## Rappel du cours précédent

<details>
<summary>1. Quelle est la différence entre FaaS et CaaS ?</summary>

**FaaS** (Function as a Service) : tu deploies une fonction, le cloud géré tout le reste (scaling, OS, runtime). Pay-per-invocation. Cold starts possibles. Exemple : AWS Lambda. **CaaS** (Container as a Service) : tu deploies un container Docker, le cloud géré l'orchestration. Tu gardes le controle du runtime. Exemple : AWS ECS, GKE.
</details>

<details>
<summary>2. A partir de combien d'invocations les containers deviennent plus rentables que le serverless ?</summary>

Environ **3-5 millions d'invocations par mois**. En dessous, le serverless est quasi gratuit (pay-per-invocation). Au-dela, le cout par invocation dépasse celui d'un container tourne 24/7. Le break-even exact dépend du runtime, de la mémoire allouee et de la durée d'exécution.
</details>

---

## Analogie — Le carnet de bord du pilote

Un pilote d'avion ne note pas "ça va bien" dans son carnet. Il écrit :
- **Quand** : 14:32 UTC
- **Quoi** : "Altitude 35000ft atteinte"
- **Contexte** : Vol AF123, Paris-Tokyo, Airbus A350
- **Severite** : INFO (nominal) vs WARNING (turbulence) vs CRITICAL (panne moteur)

Un log non structure (`console.log("Order created")`) est comme écrire "quelque chose s'est passe" — inutile pour deboguer a 3h du matin.

---

## Théorie

### 1. Logging structure JSON

```
MAUVAIS (non structure) :
  [2024-03-01 14:32:00] INFO: Order abc-123 created for user user-456

BON (structure JSON) :
  {
    "timestamp": "2024-03-01T14:32:00.123Z",
    "level": "info",
    "message": "order.created",
    "service": "order-service",
    "traceId": "abc-trace-123",
    "tenantId": "acme",
    "orderId": "abc-123",
    "total": 99.90,
    "currency": "EUR"
  }

Pourquoi :
  → Parsable par machine (Loki, Elasticsearch)
  → Filtrable (tous les logs du tenant "acme")
  → Aggregable (combien de order.created par heure ?)
  → Alertable (si error rate > 1% → alerte)
```

### 2. Resource attributes standard

| Attribut | Exemple | Obligatoire |
|---|---|---|
| `timestamp` | `2024-03-01T14:32:00.123Z` (ISO 8601) | Oui |
| `level` | `debug`, `info`, `warn`, `error` | Oui |
| `message` | `entity.action` (`order.created`) | Oui |
| `service.name` | `order-service` | Oui |
| `environment` | `production`, `staging` | Oui |
| `traceId` | `abc-trace-123` | Oui |
| `spanId` | `span-456` | Si tracing |
| `tenantId` | `acme` | Si multi-tenant |
| `siteId` | `site-paris` | Si multi-site |
| `userId` | ~~`user-456`~~ → **hash** | PII-free |
| `userRole` | `admin`, `editor` | Optionnel |
| `locale` | `fr-FR` | Si i18n |

### 3. Log levels — quand utiliser quoi

| Level | Quand | Exemple |
|---|---|---|
| **ERROR** | Erreur inattendue, action requise | DB connection lost, payment failed |
| **WARN** | Anormal mais géré | Rate limit proche, cache miss élevé |
| **INFO** | Événement métier normal | Order created, user logged in |
| **DEBUG** | Detail technique (dev/staging) | SQL query, cache hit/miss |

```
Regle : si le pager sonne a 3h du matin → ERROR
         si l'equipe doit regarder demain → WARN
         si c'est un evenement attendu → INFO
         si c'est pour le debugging → DEBUG
```

### 4. PII-free logging

```
INTERDIT en production :
  { "email": "alice@example.com" }       → PII
  { "name": "Alice Dupont" }             → PII
  { "ip": "192.168.1.42" }              → PII (GDPR)
  { "phone": "+33612345678" }            → PII

AUTORISE :
  { "userId": "sha256(alice@example.com)" }  → Pseudonymise
  { "sessionId": "random-uuid" }             → Non-PII
  { "userRole": "admin" }                    → Non-PII
  { "tenantId": "acme" }                     → Non-PII

Retention : 90 jours max (GDPR)
```

### 5. Correlation IDs

```
Client → API Gateway → Order Service → Payment Service → Email Service
         │                │                │                 │
         │ traceId: T1    │ traceId: T1    │ traceId: T1    │ traceId: T1
         │ spanId: S1     │ spanId: S2     │ spanId: S3     │ spanId: S4
         │                │ parentSpan: S1 │ parentSpan: S2 │ parentSpan: S3

Tous les logs avec traceId=T1 → une seule requete utilisateur
  → Reconstituer le parcours complet dans Grafana/Jaeger
```

### 6. Event naming convention

```
Format : entity.action

Exemples :
  order.created
  order.paid
  order.shipped
  user.logged_in
  user.password_reset
  content.published
  content.archived
  media.uploaded
  webhook.delivered
  webhook.failed
```

---

## Pratique

### Logger structure (NestJS)

```typescript
@Injectable()
export class StructuredLogger {
  private readonly baseContext: Record<string, string>;

  constructor(private readonly config: ConfigService) {
    this.baseContext = {
      service: config.get('SERVICE_NAME', 'unknown'),
      environment: config.get('NODE_ENV', 'development'),
    };
  }

  info(message: string, data: Record<string, unknown> = {}): void {
    this.log('info', message, data);
  }

  warn(message: string, data: Record<string, unknown> = {}): void {
    this.log('warn', message, data);
  }

  error(message: string, error?: Error, data: Record<string, unknown> = {}): void {
    this.log('error', message, {
      ...data,
      error: error
        ? {
            name: error.name,
            message: error.message,
            stack: error.stack,
          }
        : undefined,
    });
  }

  private log(
    level: string,
    message: string,
    data: Record<string, unknown>,
  ): void {
    const entry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...this.baseContext,
      ...data,
    };

    // JSON sur stdout — le collecteur (Fluentd, Vector) gere le routing
    process.stdout.write(JSON.stringify(entry) + '\n');
  }
}
```

### Correlation ID middleware

```typescript
@Injectable()
export class CorrelationMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    // Propager le trace ID entrant ou en creer un nouveau
    const traceId =
      (req.headers['x-trace-id'] as string) ?? crypto.randomUUID();
    const spanId = crypto.randomUUID();

    // Injecter dans le contexte de la requete
    req['traceId'] = traceId;
    req['spanId'] = spanId;

    // Propager dans la reponse (pour le debugging client)
    res.setHeader('X-Trace-Id', traceId);

    next();
  }
}

// Usage dans le logger
@Injectable({ scope: Scope.REQUEST })
export class RequestLogger extends StructuredLogger {
  constructor(
    config: ConfigService,
    @Inject(REQUEST) private readonly req: Request,
  ) {
    super(config);
  }

  info(message: string, data: Record<string, unknown> = {}): void {
    super.info(message, {
      traceId: this.req['traceId'],
      spanId: this.req['spanId'],
      tenantId: this.req['tenantId'],
      ...data,
    });
  }
}
```

### Request logging interceptor

```typescript
@Injectable()
export class RequestLogInterceptor implements NestInterceptor {
  constructor(private readonly logger: StructuredLogger) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest();
    const start = Date.now();

    return next.handle().pipe(
      tap(() => {
        const duration = Date.now() - start;
        this.logger.info('http.request', {
          method: req.method,
          path: req.path,
          statusCode: context.switchToHttp().getResponse().statusCode,
          durationMs: duration,
          traceId: req['traceId'],
          tenantId: req['tenantId'],
          userRole: req.user?.role,
        });
      }),
      catchError((error) => {
        const duration = Date.now() - start;
        this.logger.error('http.request.error', error, {
          method: req.method,
          path: req.path,
          durationMs: duration,
          traceId: req['traceId'],
        });
        throw error;
      }),
    );
  }
}
```

---

## Résumé

1. **Logging structure JSON** : machine-parsable, filtrable, aggregable — jamais de `console.log("texte libre")`
2. **Resource attributes** : `timestamp`, `level`, `message` (entity.action), `service`, `traceId`, `tenantId` — obligatoires sur chaque log
3. **PII-free** : hasher les emails/IPs, utiliser des UUIDs de session, retention 90 jours max (GDPR)
4. **Correlation IDs** : `traceId` propage de service en service — reconstituer le parcours complet d'une requête
5. **Log levels** : ERROR = pager a 3h, WARN = regarder demain, INFO = événement attendu, DEBUG = dev/staging uniquement

---

> **Prochain cours** : [Cours 69 — Monitoring, Alerting & SLOs](./02-monitoring-alerting-slos.md)

---

> **Lien fil rouge — ShopArch**
>
> - Implémente les logs structurés JSON avec correlationId dans ShopArch
> - Chaque requête HTTP génère un trace_id propagé à travers tous les services
> - Exercice(s) associé(s) : `exercices/46-pipeline-observabilite/`
> - Checkpoint : Module 10, critère 1
