import { Controller, Get } from '@nestjs/common';
import { DataSource } from 'typeorm';

/**
 * Contrôleur de santé (Health Check).
 *
 * Deux endpoints classiques en architecture micro-services :
 *
 * - /health/liveness  : "L'application est-elle démarrée ?"
 *   Retourne toujours OK si le processus tourne.
 *
 * - /health/readiness : "L'application est-elle prête à recevoir du trafic ?"
 *   Vérifie que la connexion à la base de données fonctionne.
 */
@Controller('health')
export class HealthController {
  constructor(private readonly dataSource: DataSource) {}

  /**
   * Liveness : le serveur est en vie.
   * Utilisé par Docker/Kubernetes pour savoir si le conteneur tourne.
   */
  @Get('liveness')
  liveness(): { status: string } {
    return { status: 'ok' };
  }

  /**
   * Readiness : le serveur est prêt à traiter des requêtes.
   * Vérifie la connexion à PostgreSQL.
   */
  @Get('readiness')
  async readiness(): Promise<{ status: string; database: string }> {
    try {
      // On exécute une requête simple pour vérifier la connexion
      await this.dataSource.query('SELECT 1');
      return { status: 'ok', database: 'connected' };
    } catch {
      return { status: 'error', database: 'disconnected' };
    }
  }
}
