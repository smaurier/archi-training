import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

/**
 * Point d'entrée de l'API NestJS.
 *
 * - Port 3001 (pour ne pas entrer en conflit avec Next.js sur le port 3000)
 * - CORS activé pour permettre les appels depuis le front-end
 * - Préfixe global "/api" pour toutes les routes
 */
async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  // Activer CORS pour le développement local
  app.enableCors();

  // Toutes les routes seront préfixées par /api
  // Exemple : GET /api/health/liveness
  app.setGlobalPrefix('api');

  const port = process.env.PORT ?? 3001;
  await app.listen(port);

  console.log(`🚀 API ShopArch démarrée sur http://localhost:${port}/api`);
}

bootstrap();
