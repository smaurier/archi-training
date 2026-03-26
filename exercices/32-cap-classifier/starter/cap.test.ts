// cap.test.ts — Tests pour CAPClassifier
// Lance: pnpm test:ex32 (depuis exercices/)

import { describe, it, expect } from 'vitest';
import { CAPClassifier } from './cap.js';
import type { SystemComponent } from './cap.js';

const classifier = new CAPClassifier();

const paymentService: SystemComponent = {
  name: 'Payment Service',
  description: 'Traite les transactions de paiement',
  staleReadsAcceptable: false,
  businessCritical: true,
  mustWorkDuringPartition: false,
  expectedOps: 100,
};

const productCatalog: SystemComponent = {
  name: 'Product Catalog Cache',
  description: 'Cache Redis du catalogue produits',
  staleReadsAcceptable: true,
  businessCritical: false,
  mustWorkDuringPartition: true,
  expectedOps: 10000,
};

const orderService: SystemComponent = {
  name: 'Order Service',
  description: 'Gère la création de commandes',
  staleReadsAcceptable: false,
  businessCritical: true,
  mustWorkDuringPartition: true,
  expectedOps: 500,
};

describe('CAPClassifier.classify', () => {
  it('classifie un service business-critical et non stale-tolerant en CP', () => {
    const result = classifier.classify(paymentService);
    expect(result.choice).toBe('CP');
    expect(result.component).toBe('Payment Service');
  });

  it('classifie un cache haute-disponibilité avec stale-reads en AP', () => {
    const result = classifier.classify(productCatalog);
    expect(result.choice).toBe('AP');
  });

  it('retourne une technologie recommandée', () => {
    const result = classifier.classify(paymentService);
    expect(typeof result.recommendedTechnology).toBe('string');
    expect(result.recommendedTechnology.length).toBeGreaterThan(0);
  });

  it('retourne une rationale non vide', () => {
    const result = classifier.classify(orderService);
    expect(typeof result.rationale).toBe('string');
    expect(result.rationale.length).toBeGreaterThan(0);
  });

  it('retourne des trade-offs non vides', () => {
    const result = classifier.classify(productCatalog);
    expect(Array.isArray(result.tradeoffs)).toBe(true);
    expect(result.tradeoffs.length).toBeGreaterThan(0);
  });
});

describe('CAPClassifier.analyzeSystem', () => {
  it('analyse plusieurs composants', () => {
    const results = classifier.analyzeSystem([paymentService, productCatalog]);
    expect(results).toHaveLength(2);
    expect(results[0].component).toBe('Payment Service');
    expect(results[1].component).toBe('Product Catalog Cache');
  });
});

describe('CAPClassifier.generateReport', () => {
  it('compte correctement les CP et AP', () => {
    const analyses = [
      classifier.classify(paymentService),
      classifier.classify(productCatalog),
    ];
    const report = classifier.generateReport(analyses);
    expect(report.cpCount + report.apCount + report.caCount).toBe(2);
    expect(typeof report.recommendations).toBe('object');
  });

  it('retourne des recommandations non vides', () => {
    const analyses = classifier.analyzeSystem([paymentService, productCatalog, orderService]);
    const report = classifier.generateReport(analyses);
    expect(Array.isArray(report.recommendations)).toBe(true);
  });
});
