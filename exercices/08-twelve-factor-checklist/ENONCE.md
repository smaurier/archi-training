# Exercice 08 — 12-Factor Checklist

> 🟢 **Difficulté** : Découverte | **Temps estimé** : 1h | **Ère** : 2 — Le Domaine
>
> **Prérequis** : Module 01 (cours 7)


## Objectif

Auditer une application existante contre les 12 facteurs et corriger les violations.

## Contexte

Tu rejoins une équipe qui a déployé un monolithe NestJS en production. L'app fonctionne... mais les deploys sont manuels, la config est hardcodee, et il y a des fichiers générés sur le serveur. Tu dois auditer l'app contre les 12 facteurs.

## Temps estime

45 min

## Instructions

### Étape 1 — Auditer le code

Voici des extraits du code actuel. Pour chaque extrait, identifie quel facteur est viole et propose la correction.

```typescript
// config.ts — VIOLATION
export const config = {
  database: 'postgres://admin:secret123@db.prod.internal:5432/shoparch',
  redis: 'redis://localhost:6379',
  jwtSecret: 'my-super-secret-key',
  smtpHost: 'smtp.gmail.com',
  smtpPassword: 'gmail-password-123',
  uploadDir: '/var/www/uploads', // fichiers sur le serveur
  logFile: '/var/log/shoparch/app.log', // logs dans un fichier
};
```

```typescript
// app.module.ts — VIOLATION
import { ScheduleModule } from '@nestjs/schedule';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    // Cron job dans le meme process que l'API
    // Le cron et l'API partagent la memoire
  ],
})
export class AppModule {}

@Injectable()
export class CleanupService {
  @Cron('0 2 * * *')
  async cleanupOldSessions() {
    // Supprime les sessions > 30 jours
    // Ce job tourne dans le meme process que l'API HTTP
  }
}
```

```typescript
// deploy.sh — VIOLATION
#!/bin/bash
ssh prod-server "cd /var/www/shoparch && git pull origin main && npm install && npm run build && pm2 restart all"
```

### Étape 2 — Checklist 12 facteurs

Remplis cette checklist pour l'application :

| # | Facteur | Conforme ? | Violation | Correction |
|---|---|---|---|---|
| I | Codebase | | | |
| II | Dependencies | | | |
| III | Config | | | |
| IV | Backing Services | | | |
| V | Build, Release, Run | | | |
| VI | Processes | | | |
| VII | Port Binding | | | |
| VIII | Concurrency | | | |
| IX | Disposability | | | |
| X | Dev/Prod Parity | | | |
| XI | Logs | | | |
| XII | Admin Processes | | | |

### Étape 3 — Corriger les violations

Reecris les extraits de code pour respecter les 12 facteurs.

### Bonus

- Ajouter une idempotency key pour les mutations de paiement
- Proposer un Dockerfile multi-stage pour le build

## Contraintes

- Zero secret dans le code source
- Zero fichier écrit sur le serveur (stateless)
- Logs en stdout/stderr (JSON structure)
- Config via variables d'environnement
