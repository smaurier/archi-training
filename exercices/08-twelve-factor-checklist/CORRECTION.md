# Correction — Exercice 08 : 12-Factor Checklist

## Résultat attendu

Un audit complet des 12 facteurs avec les corrections appliquees au code.

## Checklist remplie

| # | Facteur | Conforme ? | Violation | Correction |
|---|---|---|---|---|
| I | Codebase | Oui | — | 1 repo, 1 app (ok) |
| II | Dependencies | Oui | — | `package.json` + `package-lock.json` (ok) |
| III | Config | **NON** | Secrets hardcodes dans `config.ts` | Variables d'environnement |
| IV | Backing Services | **NON** | URL de DB hardcodee (pas traitee comme resource attachable) | `DATABASE_URL` env var |
| V | Build/Release/Run | **NON** | `git pull && npm install && build` sur le serveur | Docker image immutable, CI/CD |
| VI | Processes | **NON** | Fichiers sur `/var/www/uploads` | S3 + presigned URLs |
| VII | Port Binding | Oui | — | NestJS bind sur `PORT` (ok) |
| VIII | Concurrency | **NON** | Cron dans le même process | Worker process séparé |
| IX | Disposability | **NON** | Graceful shutdown non configure | `app.enableShutdownHooks()` |
| X | Dev/Prod Parity | A vérifier | Probable divergence | Docker compose identique |
| XI | Logs | **NON** | Logs dans un fichier | stdout JSON |
| XII | Admin | **NON** | Cleanup dans le process principal | CLI NestJS ou job séparé |

## Corrections

### Facteur III — Config via env vars

```typescript
// AVANT — secrets hardcodes
export const config = {
  database: 'postgres://admin:secret123@db.prod.internal:5432/shoparch',
  jwtSecret: 'my-super-secret-key',
};

// APRES — variables d'environnement
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: Joi.object({
        DATABASE_URL: Joi.string().required(),
        REDIS_URL: Joi.string().required(),
        JWT_SECRET: Joi.string().min(32).required(),
        SMTP_HOST: Joi.string().required(),
        S3_BUCKET: Joi.string().required(),
      }),
    }),
  ],
})
export class AppModule {}

// Usage
@Injectable()
export class DatabaseService {
  constructor(private readonly config: ConfigService) {
    const dbUrl = this.config.getOrThrow<string>('DATABASE_URL');
  }
}
```

### Facteur VI — Processes stateless (S3)

```typescript
// AVANT — fichiers sur le serveur
const uploadDir = '/var/www/uploads';
fs.writeFileSync(`${uploadDir}/${file.name}`, file.buffer);

// APRES — S3 presigned URL
@Injectable()
export class MediaService {
  constructor(private readonly s3: S3Client) {}

  async getUploadUrl(fileName: string): Promise<string> {
    const key = `uploads/${crypto.randomUUID()}/${fileName}`;
    const command = new PutObjectCommand({
      Bucket: process.env.S3_BUCKET,
      Key: key,
    });
    return getSignedUrl(this.s3, command, { expiresIn: 300 });
  }
}
```

### Facteur XI — Logs en stdout

```typescript
// AVANT — logs dans un fichier
import * as fs from 'fs';
const logStream = fs.createWriteStream('/var/log/shoparch/app.log');

// APRES — stdout JSON structure
import { LoggerService } from '@nestjs/common';

export class JsonLogger implements LoggerService {
  log(message: string, context?: string) {
    process.stdout.write(JSON.stringify({
      level: 'info',
      message,
      context,
      timestamp: new Date().toISOString(),
    }) + '\n');
  }

  error(message: string, trace?: string) {
    process.stdout.write(JSON.stringify({
      level: 'error',
      message,
      trace,
      timestamp: new Date().toISOString(),
    }) + '\n');
  }
}
```

### Facteur V — Build/Release/Run (Dockerfile)

```dockerfile
# AVANT : git pull sur le serveur
# APRES : Docker multi-stage

# --- Build stage ---
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# --- Production stage ---
FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "dist/main.js"]
```

### Facteur VIII — Concurrency (worker séparé)

```typescript
// AVANT — cron dans le meme process
@Module({
  imports: [ScheduleModule.forRoot()],
})
export class AppModule {} // API + Cron = meme process

// APRES — deux entrypoints
// main.ts → API HTTP
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableShutdownHooks();
  await app.listen(process.env.PORT ?? 3000);
}

// worker.ts → Jobs background
async function bootstrapWorker() {
  const app = await NestFactory.createApplicationContext(WorkerModule);
  // Le worker ne bind PAS de port HTTP
  // Il execute les crons et les jobs de queue
}
```

## Ce que tu aurais pu oublier

### 1. Mettre les secrets dans un `.env` commite

```
FAUX — .env dans le repo git
  → Les secrets sont dans l'historique Git pour toujours

CORRECT — .env.example dans le repo (sans valeurs)
  → Les vraies valeurs sont dans le CI/CD ou un vault (Doppler, AWS SSM)
```

### 2. Oublier le graceful shutdown

```typescript
// FAUX — le process est kill -9
// Les requetes en cours sont perdues

// CORRECT — graceful shutdown
app.enableShutdownHooks();

process.on('SIGTERM', async () => {
  // 1. Arreter d'accepter de nouvelles requetes
  // 2. Terminer les requetes en cours
  // 3. Fermer les connexions DB/Redis
  await app.close();
});
```

### 3. Confondre "stateless" et "pas de state"

```
FAUX — "Mon app est stateless, elle n'a pas de base de donnees"
  → Stateless = le PROCESS n'a pas d'etat entre les requetes

CORRECT — Stateless = tout l'etat est dans des backing services
  → Sessions dans Redis (pas en memoire)
  → Fichiers dans S3 (pas sur le disque)
  → Cache dans Redis (pas dans une Map locale)
```

### 4. Oublier la validation des env vars au démarrage

```typescript
// FAUX — l'app demarre sans DATABASE_URL et crash a la premiere requete
const dbUrl = process.env.DATABASE_URL; // undefined → crash tardif

// CORRECT — fail fast au demarrage
const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) throw new Error('DATABASE_URL is required');
// Ou utiliser Joi validation avec @nestjs/config
```
