import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';

/**
 * Module de santé.
 *
 * Regroupe les endpoints /health/* pour vérifier que l'API fonctionne.
 * C'est une bonne pratique en architecture logicielle de toujours
 * exposer des endpoints de santé.
 */
@Module({
  controllers: [HealthController],
})
export class HealthModule {}
