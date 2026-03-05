import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HealthModule } from './health/health.module';

/**
 * Module racine de l'application.
 *
 * ConfigModule : charge les variables d'environnement (.env)
 * TypeOrmModule : connexion à PostgreSQL via les variables d'environnement
 * HealthModule : endpoints de vérification de santé
 */
@Module({
  imports: [
    // Charge automatiquement le fichier .env à la racine du projet
    ConfigModule.forRoot({
      isGlobal: true,
    }),

    // Connexion à la base de données PostgreSQL
    // La config est injectée via ConfigService pour éviter les valeurs en dur
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        url: config.get<string>(
          'DATABASE_URL',
          'postgresql://shoparch:shoparch@localhost:5432/shoparch',
        ),
        // En développement, on synchronise automatiquement le schéma
        // ATTENTION : ne jamais activer synchronize en production !
        synchronize: config.get<string>('NODE_ENV') !== 'production',
        autoLoadEntities: true,
        logging: config.get<string>('NODE_ENV') !== 'production',
      }),
    }),

    HealthModule,
  ],
})
export class AppModule {}
