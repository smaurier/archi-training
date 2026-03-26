// feature-flags.ts — Service de feature flags avec rollout progressif
// Permet d'activer/désactiver des fonctionnalités sans redéploiement.

// Types

export interface FlagConfig {
  name: string;
  enabled: boolean;
  /** Pourcentage d'utilisateurs qui voient cette feature [0..100]. 0 = désactivé. */
  rolloutPercentage?: number;
  /** Liste blanche d'userIds toujours activés (pour les tests internes). */
  allowList?: string[];
  /** Liste noire d'userIds toujours désactivés. */
  denyList?: string[];
  /** Date d'expiration automatique du flag (ISO string). */
  expiresAt?: string;
}

export interface IFlagRepository {
  findAll(): Promise<FlagConfig[]>;
  findByName(name: string): Promise<FlagConfig | null>;
  save(flag: FlagConfig): Promise<void>;
}

// ---- À IMPLÉMENTER ----

export class FeatureFlagService {
  constructor(private readonly repo: IFlagRepository) {}

  /**
   * Détermine si un flag est actif pour un utilisateur donné.
   *
   * Logique de priorité :
   *   1. Flag introuvable → false
   *   2. Flag.enabled === false → false
   *   3. Flag expiré (expiresAt < now) → false
   *   4. userId dans denyList → false
   *   5. userId dans allowList → true (bypasse le rollout)
   *   6. rolloutPercentage === 0 → false
   *   7. rolloutPercentage === 100 ou non défini → true
   *   8. Sinon → détermination stable par hash(userId + flagName) % 100 < rolloutPercentage
   */
  async isEnabled(flagName: string, userId?: string): Promise<boolean> {
    // TODO:
    // 1. findByName(flagName)
    // 2. Appliquer la logique de priorité ci-dessus
    // 3. Pour le rollout : hash stable via djb2 ou simple sum des charCodes % 100
    //    → stableHash(userId + flagName) % 100 < rolloutPercentage
    throw new Error('Not implemented');
  }

  /**
   * Crée ou met à jour un flag.
   */
  async setFlag(config: FlagConfig): Promise<void> {
    // TODO: repo.save(config)
    throw new Error('Not implemented');
  }

  /**
   * Retourne tous les flags actifs pour un utilisateur.
   * Utile pour envoyer les flags dans la réponse HTTP initiale (bootstrapping).
   */
  async getEnabledFlags(userId: string): Promise<string[]> {
    // TODO:
    // 1. repo.findAll()
    // 2. Pour chaque flag : appeler isEnabled (mais sans repo.findAll encore)
    //    → implémenter la logique directement ici pour éviter N+1
    // 3. Retourner les noms des flags actifs
    throw new Error('Not implemented');
  }
}

/**
 * Fonction de hash stable pour le rollout déterministe.
 * Même userId + flagName → même résultat dans le temps.
 */
export function stableHash(input: string): number {
  // TODO:
  // Algorithme djb2 : let hash = 5381; for each char: hash = ((hash << 5) + hash) + charCode
  // return hash >>> 0 (unsigned 32 bits → toujours positif)
  throw new Error('Not implemented');
}
