// cap.ts — CAP Theorem Classifier
// Aide à choisir la stratégie de cohérence pour chaque composant de ShopArch.

// Types

export type ConsistencyModel = 'strong' | 'eventual' | 'causal' | 'read-your-writes';
export type AvailabilityLevel = 'high' | 'medium' | 'degraded-ok';
export type PartitionTolerance = 'required' | 'optional';

export interface SystemComponent {
  name: string;
  description: string;
  /** Accepte-t-on de lire des données légèrement obsolètes ? */
  staleReadsAcceptable: boolean;
  /** La donnée est-elle critique pour le business (paiements, stocks) ? */
  businessCritical: boolean;
  /** Doit fonctionner même si un nœud est indisponible ? */
  mustWorkDuringPartition: boolean;
  /** Opérations par seconde attendues */
  expectedOps: number;
}

export type CAPChoice = 'CP' | 'AP' | 'CA';

export interface CAPAnalysis {
  component: string;
  choice: CAPChoice;
  consistencyModel: ConsistencyModel;
  recommendedTechnology: string;
  rationale: string;
  tradeoffs: string[];
}

// ---- À IMPLÉMENTER ----

/**
 * ClassifiesSystem selon le théorème CAP.
 * Implémente la logique de décision architecturale.
 */
export class CAPClassifier {
  /**
   * Analyse un composant et retourne sa classification CAP avec recommandations.
   *
   * Règles de décision :
   * - businessCritical + !staleReadsAcceptable → CP (PostgreSQL, strong consistency)
   * - mustWorkDuringPartition + staleReadsAcceptable → AP (Redis eventual, Elasticsearch)
   * - mustWorkDuringPartition + !staleReadsAcceptable + highOps → CP (Redis avec locks)
   * - !mustWorkDuringPartition + !staleReadsAcceptable → CA (PostgreSQL single-node)
   */
  classify(component: SystemComponent): CAPAnalysis {
    // TODO:
    // Implémenter la logique de décision avec des if/else sur les propriétés
    // Retourner un CAPAnalysis avec choice, consistencyModel, recommendedTechnology, rationale, tradeoffs
    throw new Error('Not implemented');
  }

  /**
   * Analyse plusieurs composants et détecte les incohérences.
   * Ex: si deux composants qui communiquent ont des modèles de cohérence incompatibles.
   */
  analyzeSystem(components: SystemComponent[]): CAPAnalysis[] {
    // TODO: components.map(c => this.classify(c))
    throw new Error('Not implemented');
  }

  /**
   * Génère un rapport de cohérence globale.
   * Retourne le nombre de composants CP, AP, CA et les recommandations globales.
   */
  generateReport(analyses: CAPAnalysis[]): {
    cpCount: number;
    apCount: number;
    caCount: number;
    recommendations: string[];
  } {
    // TODO:
    // cpCount = analyses.filter(a => a.choice === 'CP').length
    // apCount = analyses.filter(a => a.choice === 'AP').length
    // caCount = analyses.filter(a => a.choice === 'CA').length
    // recommendations: si beaucoup d'AP sans message queue → recommander un broker
    throw new Error('Not implemented');
  }
}
