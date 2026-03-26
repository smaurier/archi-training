// fitness.ts — Fitness functions pour vérifier les invariants architecturaux
// Détecte automatiquement les régressions architecturals dans le codebase.

// Types

export interface ModuleDependency {
  from: string;  // module source
  to: string;    // module cible
}

export interface DependencyGraph {
  modules: string[];
  dependencies: ModuleDependency[];
}

export interface FileAnalysis {
  path: string;
  content: string;
  module: string; // 'controller' | 'service' | 'repository' | 'domain' ...
}

export interface FitnessViolation {
  rule: string;
  location: string;
  message: string;
}

// ---- À IMPLÉMENTER ----

export class ArchitectureFitnessRunner {
  /**
   * Règle 1 : Détecte les cycles de dépendances.
   * Un cycle = A→B→C→A.
   * Retourne les chemins cycliques détectés.
   * Algorithme : DFS avec stack de visite.
   */
  checkNoCycles(graph: DependencyGraph): FitnessViolation[] {
    // TODO:
    // 1. Construire une adjacency Map depuis graph.dependencies
    // 2. DFS depuis chaque nœud, détecter les back-edges
    // 3. Pour chaque cycle détecté, créer une FitnessViolation :
    //    { rule: 'no-cycles', location: cyclePath, message: 'Circular dependency: A → B → A' }
    throw new Error('Not implemented');
  }

  /**
   * Règle 2 : Pas de logique métier dans les controllers.
   * Détecte les patterns suspects dans les fichiers *.controller.ts :
   * - Appels à if/switch avec plus de 3 branches imbriquées (logique dans controller)
   * - Import direct de repositories dans les controllers (bypass du service)
   * - Calculs de prix/montants (pattern: * CENTS, * 100, Math.round)
   */
  checkNoBusinessLogicInControllers(files: FileAnalysis[]): FitnessViolation[] {
    // TODO:
    // Filtrer les fichiers module === 'controller'
    // Pour chaque fichier, chercher :
    //   1. Imports de repository : /import.*Repository.*from/
    //   2. Calculs numériques suspects : /\*\s*(100|CENTS|price|amount)/i
    //   3. Logique de domaine : /(discount|coupon|tax|shipping)/i
    // Créer une violation pour chaque match
    throw new Error('Not implemented');
  }

  /**
   * Règle 3 : Isolation multi-tenant.
   * Vérifie que toutes les requêtes SQL ont un filtre tenant_id.
   * Cherche les SELECT sans WHERE tenant_id qui pourraient fuir entre tenants.
   */
  checkTenantIsolation(queries: string[]): FitnessViolation[] {
    // TODO:
    // Pour chaque query :
    //   Si elle commence par SELECT et ne contient pas 'tenant_id' dans le WHERE
    //   → FitnessViolation { rule: 'tenant-isolation', ... }
    //   Ignorer les COUNT(*) sans FROM, les requêtes de schema setup
    throw new Error('Not implemented');
  }

  /**
   * Règle 4 : Pas de couplage entre bounded contexts.
   * Le module Catalogue ne doit pas importer directement depuis le module Commandes.
   */
  checkBoundedContextIsolation(
    graph: DependencyGraph,
    contextBoundaries: Record<string, string[]>, // { 'catalogue': ['product', 'category'], ... }
  ): FitnessViolation[] {
    // TODO:
    // Pour chaque dépendance A→B :
    //   Trouver le contexte de A et le contexte de B
    //   Si contexte(A) !== contexte(B) et pas d'ACL/port entre eux → violation
    throw new Error('Not implemented');
  }

  /** Lance toutes les règles et retourne la liste complète des violations. */
  runAll(
    graph: DependencyGraph,
    files: FileAnalysis[],
    queries: string[],
    contextBoundaries: Record<string, string[]>,
  ): FitnessViolation[] {
    return [
      ...this.checkNoCycles(graph),
      ...this.checkNoBusinessLogicInControllers(files),
      ...this.checkTenantIsolation(queries),
      ...this.checkBoundedContextIsolation(graph, contextBoundaries),
    ];
  }
}
