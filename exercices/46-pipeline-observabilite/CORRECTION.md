# Correction — Exercice 46 : Pipeline d'observabilité

## Logs structures

```typescript
// logger.service.ts
import pino from 'pino';

const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  formatters: {
    level: (label) => ({ level: label }),
  },
  serializers: {
    // Masquer les PII
    email: (email: string) => email.replace(/(.{1,3})@/, (_, prefix) => `${prefix[0]}***@`),
    req: (req) => ({
      method: req.method,
      url: req.url,
      requestId: req.id,
    }),
  },
  redact: {
    paths: ['password', 'creditCard', 'token', 'authorization'],
    censor: '[REDACTED]',
  },
});

export { logger };

// logging.middleware.ts
@Injectable()
export class LoggingMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const requestId = req.headers['x-request-id'] ?? randomUUID();
    const start = performance.now();

    // Contexte automatique pour tous les logs de cette requete
    req.log = logger.child({
      requestId,
      tenantId: req.headers['x-tenant-id'],
      userId: (req as any).user?.id,
      service: 'api',
    });

    req.log.info({ method: req.method, url: req.url }, 'Request started');

    res.on('finish', () => {
      const duration = performance.now() - start;
      req.log.info({
        method: req.method,
        url: req.url,
        statusCode: res.statusCode,
        durationMs: Math.round(duration),
      }, 'Request completed');
    });

    next();
  }
}
```

## Metriques

```typescript
// metrics.service.ts
import { Registry, Counter, Histogram, Gauge, collectDefaultMetrics } from 'prom-client';

const register = new Registry();
collectDefaultMetrics({ register });

// RED Metrics
export const httpRequestsTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total HTTP requests',
  labelNames: ['method', 'path', 'status', 'tenant'],
  registers: [register],
});

export const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration',
  labelNames: ['method', 'path', 'status'],
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
  registers: [register],
});

// Business Metrics
export const ordersCreated = new Counter({
  name: 'orders_created_total',
  help: 'Total orders created',
  labelNames: ['tenant', 'payment_method'],
  registers: [register],
});

export const orderRevenue = new Counter({
  name: 'order_revenue_total',
  help: 'Total revenue in cents',
  labelNames: ['tenant', 'currency'],
  registers: [register],
});

export const cartAbandoned = new Counter({
  name: 'cart_abandoned_total',
  help: 'Total abandoned carts',
  labelNames: ['tenant'],
  registers: [register],
});

// Saturation
export const dbConnectionsActive = new Gauge({
  name: 'db_connections_active',
  help: 'Active database connections',
  registers: [register],
});

export const redisMemoryUsed = new Gauge({
  name: 'redis_memory_used_bytes',
  help: 'Redis memory usage',
  registers: [register],
});

export const bullmqQueueSize = new Gauge({
  name: 'bullmq_queue_size',
  help: 'BullMQ queue size',
  labelNames: ['queue'],
  registers: [register],
});

// Metrics interceptor
@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler) {
    const req = context.switchToHttp().getRequest();
    const timer = httpRequestDuration.startTimer({
      method: req.method,
      path: req.route?.path ?? req.url,
    });

    return next.handle().pipe(
      tap({
        next: () => {
          const res = context.switchToHttp().getResponse();
          timer({ status: res.statusCode });
          httpRequestsTotal.inc({
            method: req.method,
            path: req.route?.path ?? req.url,
            status: res.statusCode,
            tenant: req.headers['x-tenant-id'],
          });
        },
        error: (err) => {
          const status = err.status ?? 500;
          timer({ status });
          httpRequestsTotal.inc({ method: req.method, path: req.route?.path, status });
        },
      }),
    );
  }
}
```

## Traces distribuees

```typescript
// tracing.ts
import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { PgInstrumentation } from '@opentelemetry/instrumentation-pg';
import { RedisInstrumentation } from '@opentelemetry/instrumentation-redis-4';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';

const sdk = new NodeSDK({
  traceExporter: new OTLPTraceExporter({
    url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? 'http://localhost:4318/v1/traces',
  }),
  instrumentations: [
    new HttpInstrumentation({
      requestHook: (span, request) => {
        span.setAttribute('tenant.id', request.headers?.['x-tenant-id'] ?? '');
      },
    }),
    new PgInstrumentation({ enhancedDatabaseReporting: true }),
    new RedisInstrumentation(),
  ],
  serviceName: 'shoparch-api',
  // Sampling intelligent
  sampler: new ParentBasedSampler({
    root: new TraceIdRatioBasedSampler(0.1), // 10% du trafic normal
  }),
});

sdk.start();

// Pour les erreurs : toujours 100% sampled
// tracing-error.interceptor.ts
@Injectable()
export class TracingErrorInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler) {
    return next.handle().pipe(
      catchError((err) => {
        const span = trace.getActiveSpan();
        if (span) {
          span.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
          span.recordException(err);
          // Force le sampling pour les erreurs
          span.setAttribute('sampling.priority', 1);
        }
        throw err;
      }),
    );
  }
}
```

## Correlation ID dans les messages async

```typescript
// bullmq-tracing.ts
import { context, propagation, trace } from '@opentelemetry/api';

// Producer : injecter le trace context dans le job
async function enqueueWithTracing(queue: Queue, jobName: string, data: any) {
  const carrier: Record<string, string> = {};
  propagation.inject(context.active(), carrier);

  await queue.add(jobName, {
    ...data,
    _traceContext: carrier, // propagation du trace context
  });
}

// Consumer : restaurer le trace context
@Processor('orders')
export class OrderWorker {
  @Process('process')
  async handle(job: Job) {
    const carrier = job.data._traceContext;
    const parentContext = propagation.extract(context.active(), carrier);

    const tracer = trace.getTracer('shoparch-worker');
    const span = tracer.startSpan(
      `process:${job.name}`,
      { attributes: { 'job.id': job.id, 'job.name': job.name } },
      parentContext,
    );

    try {
      await context.with(trace.setSpan(parentContext, span), async () => {
        // Le code ici a le bon trace context
        await this.processOrder(job.data);
      });
    } finally {
      span.end();
    }
  }
}
```

## Alertes

```yaml
# alerting-rules.yml (Prometheus)
groups:
  - name: shoparch
    rules:
      - alert: HighLatency
        expr: histogram_quantile(0.99, rate(http_request_duration_seconds_bucket[5m])) > 0.5
        for: 2m
        labels:
          severity: warning
        annotations:
          summary: "p99 latency > 500ms"

      - alert: HighErrorRate
        expr: rate(http_requests_total{status=~"5.."}[5m]) / rate(http_requests_total[5m]) > 0.01
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Error rate > 1%"

      - alert: HighCPU
        expr: avg(rate(process_cpu_seconds_total[5m])) > 0.8
        for: 5m
        labels:
          severity: warning
```

## Ce que tu aurais pu oublier

### 1. PII dans les logs
```
FAUX — logger.info(`User ${user.email} created order ${order.id}`)
CORRECT — redact les PII automatiquement (pino redact)
         Log l'user ID, pas l'email
```

### 2. Metriques sans labels business
```
FAUX — uniquement des metriques techniques (CPU, RAM, latence)
CORRECT — metriques business : commandes/min, revenus, paniers abandonnes
         Les metriques business sont plus utiles pour detecter les problemes
```

### 3. Traces sans propagation async
```
FAUX — le trace s'arrete quand la requete HTTP se termine
CORRECT — propager le trace context dans les jobs BullMQ
         Une commande = 1 trace (HTTP → worker → email → notification)
```

### 4. 100% de sampling
```
FAUX — tracer 100% des requetes (cout de stockage + overhead)
CORRECT — sampling 10% normal + 100% erreurs
         Pour 600 req/s, 100% = 52M traces/jour
```
