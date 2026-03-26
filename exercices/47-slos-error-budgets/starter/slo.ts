// slo.ts — Calcul des SLOs (Service Level Objectives) et error budgets
// Aide l'équipe à mesurer la fiabilité et à décider quand prioriser la stabilité.

// Types

export interface SLO {
  name: string;
  target: number;       // ex: 0.999 = 99.9%
  windowDays: number;   // fenêtre de mesure (ex: 30)
}

export interface ErrorBudget {
  target: number;          // SLO cible (ex: 0.999)
  windowDays: number;
  totalMinutes: number;    // minutes totales dans la fenêtre
  budgetMinutes: number;   // downtime autorisé (= totalMinutes * (1 - target))
  consumedMinutes: number; // downtime réel consommé
  remainingMinutes: number;
  percentageConsumed: number; // 0..100
  isExhausted: boolean;
}

export interface BurnRateAlert {
  window: '1h' | '6h' | '3d';
  burnRate: number;      // combien de fois plus vite que le budget est consommé
  threshold: number;     // seuil d'alerte
  isAlerting: boolean;
}

// ---- À IMPLÉMENTER ----

export class ErrorBudgetCalculator {
  /**
   * Calcule le budget d'erreur consommé et restant.
   *
   * @param slo - Définition du SLO
   * @param actualUptimePercent - Uptime mesuré sur la fenêtre (ex: 0.9985 = 99.85%)
   */
  calculate(slo: SLO, actualUptimePercent: number): ErrorBudget {
    // TODO:
    // totalMinutes = slo.windowDays * 24 * 60
    // budgetMinutes = totalMinutes * (1 - slo.target)
    // consumedMinutes = totalMinutes * (1 - actualUptimePercent)
    //   → Arrondir à 2 décimales (Math.round(x * 100) / 100)
    // remainingMinutes = Math.max(0, budgetMinutes - consumedMinutes)
    // percentageConsumed = (consumedMinutes / budgetMinutes) * 100
    //   → Clamper à [0, 100]
    // isExhausted = consumedMinutes > budgetMinutes
    throw new Error('Not implemented');
  }

  /**
   * Calcule les alertes de burn rate (Alerting sur les SRE patterns de Google).
   *
   * burnRate = (errorRate / (1 - slo.target))
   * Un burn rate de 1.0 consomme le budget PILE à temps.
   * Un burn rate de 14.4 consomme le budget 1h en 5min (alerte critique).
   *
   * @param slo - Définition du SLO
   * @param errorRateLastHour - Taux d'erreur sur la dernière heure [0..1]
   */
  getBurnRateAlerts(slo: SLO, errorRateLastHour: number): BurnRateAlert[] {
    // TODO:
    // budgetConsumptionRate = 1 - slo.target  (ex: 0.001 pour 99.9%)
    // burnRate = errorRateLastHour / budgetConsumptionRate
    // Retourner 3 alertes :
    //   - { window: '1h',  burnRate, threshold: 14.4, isAlerting: burnRate >= 14.4 }
    //   - { window: '6h',  burnRate, threshold: 6,   isAlerting: burnRate >= 6 }
    //   - { window: '3d',  burnRate, threshold: 1,   isAlerting: burnRate >= 1 }
    throw new Error('Not implemented');
  }
}

/**
 * SLODashboard : agrège plusieurs SLOs et génère un rapport de santé.
 */
export class SLODashboard {
  private readonly calculator = new ErrorBudgetCalculator();

  /**
   * Retourne le statut global de santé du service.
   * 'healthy' → aucun budget épuisé
   * 'at-risk' → au moins un budget < 20% restant
   * 'exhausted' → au moins un budget épuisé (isExhausted = true)
   */
  getStatus(entries: Array<{ slo: SLO; actualUptime: number }>): 'healthy' | 'at-risk' | 'exhausted' {
    // TODO:
    // Calculer tous les budgets
    // Si un budget isExhausted → 'exhausted'
    // Si un budget percentageConsumed > 80 → 'at-risk'
    // Sinon 'healthy'
    throw new Error('Not implemented');
  }
}
