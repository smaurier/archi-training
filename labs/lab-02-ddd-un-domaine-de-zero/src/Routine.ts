// Routine.ts — PAGE BLANCHE. Modélise l'agrégat "Routine" (TribuZen) en DDD tactique. Ce
// fichier n'importe rien d'externe — zéro framework, zéro infrastructure. L'objectif n'est
// pas juste "que ça marche", c'est de distinguer correctement une ENTITÉ (identité, cycle de
// vie) d'un VALUE OBJECT (immuable, comparé par valeur) — voir les tests pour le contrat
// exact de chaque comparaison.
//
// ── VALUE OBJECT : TimeOfDay ────────────────────────────────────────────────────────────
// export class TimeOfDay
//   - Immuable. Construction via `TimeOfDay.of(hour, minute)` (pas de `new` public — un VO
//     se construit validé ou pas du tout).
//   - `hour` (0-23) et `minute` (0-59) hors bornes → lève une erreur.
//   - `equals(other: TimeOfDay): boolean` — COMPARÉ PAR VALEUR : deux instances avec les
//     mêmes hour/minute sont égales, même si ce sont deux objets DIFFÉRENTS en mémoire.
//
// ── EVENEMENTS DE DOMAINE (nommés au passé — un fait qui s'est produit) ────────────────
// export interface DomainEvent { readonly kind: string }
// export class RoutineCompleted implements DomainEvent — { routineId, date }
// export class StreakMilestoneReached implements DomainEvent — { routineId, streak } — émis
//   UNIQUEMENT quand streak atteint EXACTEMENT 7, 30 ou 100 (pas à chaque complétion).
//
// ── ENTITÉ / RACINE D'AGRÉGAT : Routine ─────────────────────────────────────────────────
// export class Routine
//   constructor(readonly id: string, readonly label: string, readonly scheduledAt: TimeOfDay)
//
//   get streak(): number — la série de jours consécutifs actuelle (0 au départ).
//
//   complete(date: string): DomainEvent[] — `date` au format "YYYY-MM-DD".
//     - Si `date` est le MÊME jour que la dernière complétion : lève `AlreadyCompletedError`
//       (invariant : on ne complète pas deux fois le même jour).
//     - Si `date` suit IMMÉDIATEMENT (jour calendaire suivant) la dernière complétion :
//       `streak` s'incrémente de 1.
//     - Sinon (premier jour, ou un jour manqué entre les deux) : `streak` repart à 1.
//     - Retourne TOUJOURS `[RoutineCompleted]`, PLUS `StreakMilestoneReached` si le nouveau
//       streak est exactement 7, 30 ou 100.
//
//   equals(other: Routine): boolean — COMPARÉ PAR IDENTITÉ (l'id, rien d'autre) : deux
//     instances avec le MÊME id sont égales même si `label`/`streak` diffèrent — contraste
//     volontaire avec `TimeOfDay.equals`, qui compare par valeur.
export class AlreadyCompletedError extends Error {}

export class TimeOfDay {
  private constructor(
    public readonly hour: number,
    public readonly minute: number,
  ) {}

  static of(_hour: number, _minute: number): TimeOfDay {
    throw new Error("TimeOfDay.of n'est pas encore implémenté");
  }

  equals(_other: TimeOfDay): boolean {
    throw new Error("TimeOfDay.equals n'est pas encore implémenté");
  }
}

export interface DomainEvent {
  readonly kind: string;
}

export class RoutineCompleted implements DomainEvent {
  readonly kind = "RoutineCompleted";
  constructor(
    public readonly routineId: string,
    public readonly date: string,
  ) {}
}

export class StreakMilestoneReached implements DomainEvent {
  readonly kind = "StreakMilestoneReached";
  constructor(
    public readonly routineId: string,
    public readonly streak: number,
  ) {}
}

export class Routine {
  constructor(
    public readonly id: string,
    public readonly label: string,
    public readonly scheduledAt: TimeOfDay,
  ) {}

  get streak(): number {
    throw new Error("Routine.streak n'est pas encore implémenté");
  }

  complete(_date: string): DomainEvent[] {
    throw new Error("Routine.complete n'est pas encore implémenté");
  }

  equals(_other: Routine): boolean {
    throw new Error("Routine.equals n'est pas encore implémenté");
  }
}
