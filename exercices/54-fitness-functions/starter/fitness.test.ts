// fitness.test.ts — Tests pour ArchitectureFitnessRunner
// Lance: pnpm test:ex54 (depuis exercices/)

import { describe, it, expect } from 'vitest';
import { ArchitectureFitnessRunner } from './fitness.js';
import type { DependencyGraph, FileAnalysis } from './fitness.js';

const runner = new ArchitectureFitnessRunner();

describe('checkNoCycles', () => {
  it('retourne [] si pas de cycle', () => {
    const graph: DependencyGraph = {
      modules: ['A', 'B', 'C'],
      dependencies: [{ from: 'A', to: 'B' }, { from: 'B', to: 'C' }],
    };
    expect(runner.checkNoCycles(graph)).toEqual([]);
  });

  it('détecte un cycle direct A→B→A', () => {
    const graph: DependencyGraph = {
      modules: ['A', 'B'],
      dependencies: [{ from: 'A', to: 'B' }, { from: 'B', to: 'A' }],
    };
    const violations = runner.checkNoCycles(graph);
    expect(violations.length).toBeGreaterThan(0);
    expect(violations[0].rule).toBe('no-cycles');
  });

  it('détecte un cycle indirect A→B→C→A', () => {
    const graph: DependencyGraph = {
      modules: ['A', 'B', 'C'],
      dependencies: [
        { from: 'A', to: 'B' },
        { from: 'B', to: 'C' },
        { from: 'C', to: 'A' },
      ],
    };
    expect(runner.checkNoCycles(graph).length).toBeGreaterThan(0);
  });
});

describe('checkNoBusinessLogicInControllers', () => {
  it('retourne [] pour un controller sans logique métier', () => {
    const files: FileAnalysis[] = [{
      path: 'catalog.controller.ts',
      module: 'controller',
      content: `
        import { CatalogService } from './catalog.service';
        async getProducts() { return this.service.findAll(); }
      `,
    }];
    expect(runner.checkNoBusinessLogicInControllers(files)).toEqual([]);
  });

  it('détecte un import direct de repository dans un controller', () => {
    const files: FileAnalysis[] = [{
      path: 'catalog.controller.ts',
      module: 'controller',
      content: `import { ProductRepository } from './product.repository';`,
    }];
    const violations = runner.checkNoBusinessLogicInControllers(files);
    expect(violations.length).toBeGreaterThan(0);
  });

  it('ignore les fichiers non-controller', () => {
    const files: FileAnalysis[] = [{
      path: 'catalog.service.ts',
      module: 'service',
      content: `const total = price * 100; // calcul de prix`,
    }];
    expect(runner.checkNoBusinessLogicInControllers(files)).toEqual([]);
  });
});

describe('checkTenantIsolation', () => {
  it('retourne [] pour des requêtes avec filtre tenant_id', () => {
    const queries = [
      'SELECT * FROM products WHERE tenant_id = $1',
      'SELECT id, name FROM orders WHERE tenant_id = $1 AND status = $2',
    ];
    expect(runner.checkTenantIsolation(queries)).toEqual([]);
  });

  it('détecte un SELECT sans filtre tenant_id', () => {
    const queries = ['SELECT * FROM products WHERE id = $1'];
    const violations = runner.checkTenantIsolation(queries);
    expect(violations.length).toBeGreaterThan(0);
    expect(violations[0].rule).toBe('tenant-isolation');
  });

  it('ignore les requêtes non-SELECT (INSERT, UPDATE, etc.)', () => {
    const queries = ['INSERT INTO products (name) VALUES ($1)'];
    // Optionnel : peut détecter ou non les INSERT sans tenant_id selon l'implémentation
    // On vérifie juste que ça ne plante pas
    expect(() => runner.checkTenantIsolation(queries)).not.toThrow();
  });
});
