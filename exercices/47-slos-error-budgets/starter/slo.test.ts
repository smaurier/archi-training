// slo.test.ts — Tests pour ErrorBudgetCalculator et SLODashboard
// Lance: pnpm test:ex47 (depuis exercices/)

import { describe, it, expect } from 'vitest';
import { ErrorBudgetCalculator, SLODashboard } from './slo.js';
import type { SLO } from './slo.js';

const slo99_9: SLO = { name: 'API Catalogue', target: 0.999, windowDays: 30 };

describe('ErrorBudgetCalculator.calculate', () => {
  const calc = new ErrorBudgetCalculator();

  it('calcule le budget total en minutes pour 30 jours', () => {
    const budget = calc.calculate(slo99_9, 0.999);
    expect(budget.totalMinutes).toBe(30 * 24 * 60); // 43200
  });

  it('calcule le budget autorisé (downtime autorisé)', () => {
    const budget = calc.calculate(slo99_9, 0.999);
    // 0.1% de 43200 = 43.2 minutes
    expect(budget.budgetMinutes).toBeCloseTo(43.2, 1);
  });

  it('calcule 0 downtime si uptime = 100%', () => {
    const budget = calc.calculate(slo99_9, 1.0);
    expect(budget.consumedMinutes).toBe(0);
    expect(budget.remainingMinutes).toBeCloseTo(43.2, 1);
    expect(budget.isExhausted).toBe(false);
  });

  it('détecte quand le budget est épuisé', () => {
    const budget = calc.calculate(slo99_9, 0.998); // 0.2% downtime > 0.1% budget
    expect(budget.isExhausted).toBe(true);
    expect(budget.percentageConsumed).toBeGreaterThan(100);
  });

  it('calcule le pourcentage consommé correctement (50%)', () => {
    // uptime 99.95% → 0.05% downtime → exactement 50% du budget 0.1%
    const budget = calc.calculate(slo99_9, 0.9995);
    expect(budget.percentageConsumed).toBeCloseTo(50, 0);
  });
});

describe('ErrorBudgetCalculator.getBurnRateAlerts', () => {
  const calc = new ErrorBudgetCalculator();

  it('déclenche une alerte critique (1h) si burn rate >= 14.4', () => {
    // erreurRate = 0.015 → burnRate = 0.015 / 0.001 = 15 > 14.4
    const alerts = calc.getBurnRateAlerts(slo99_9, 0.015);
    expect(alerts.find(a => a.window === '1h')?.isAlerting).toBe(true);
  });

  it('ne déclenche pas d\'alerte si le burn rate est normal', () => {
    // erreurRate = 0.0005 → burnRate = 0.5 < 1
    const alerts = calc.getBurnRateAlerts(slo99_9, 0.0005);
    expect(alerts.every(a => !a.isAlerting)).toBe(true);
  });

  it('retourne 3 fenêtres d\'alerte', () => {
    const alerts = calc.getBurnRateAlerts(slo99_9, 0.001);
    expect(alerts).toHaveLength(3);
    expect(alerts.map(a => a.window)).toContain('1h');
    expect(alerts.map(a => a.window)).toContain('6h');
    expect(alerts.map(a => a.window)).toContain('3d');
  });
});

describe('SLODashboard.getStatus', () => {
  const dashboard = new SLODashboard();

  it("retourne 'healthy' si tous les budgets sont OK", () => {
    const entries = [
      { slo: slo99_9, actualUptime: 0.9995 },
      { slo: { name: 'Cart', target: 0.99, windowDays: 30 }, actualUptime: 0.995 },
    ];
    expect(dashboard.getStatus(entries)).toBe('healthy');
  });

  it("retourne 'exhausted' si un budget est épuisé", () => {
    const entries = [
      { slo: slo99_9, actualUptime: 0.998 }, // budget épuisé
    ];
    expect(dashboard.getStatus(entries)).toBe('exhausted');
  });

  it("retourne 'at-risk' si un budget est consommé à plus de 80%", () => {
    const entries = [
      { slo: slo99_9, actualUptime: 0.9992 }, // ~80% consommé
    ];
    const status = dashboard.getStatus(entries);
    expect(['at-risk', 'exhausted']).toContain(status);
  });
});
