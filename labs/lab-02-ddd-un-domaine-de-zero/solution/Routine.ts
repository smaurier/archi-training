// Routine.ts — SOLUTION DE RÉFÉRENCE (commentée). Ne l'ouvre pas avant ton GREEN.
export class AlreadyCompletedError extends Error {}

export class TimeOfDay {
  private constructor(
    public readonly hour: number,
    public readonly minute: number,
  ) {}

  static of(hour: number, minute: number): TimeOfDay {
    if (hour < 0 || hour > 23) throw new Error(`Heure invalide : ${hour}`);
    if (minute < 0 || minute > 59) throw new Error(`Minute invalide : ${minute}`);
    return new TimeOfDay(hour, minute);
  }

  // VALUE OBJECT : égalité par VALEUR, jamais par référence.
  equals(other: TimeOfDay): boolean {
    return this.hour === other.hour && this.minute === other.minute;
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

const MILESTONES = new Set([7, 30, 100]);

function lendemainDe(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

export class Routine {
  private _streak = 0;
  private _dernierJourComplete: string | null = null;

  constructor(
    public readonly id: string,
    public readonly label: string,
    public readonly scheduledAt: TimeOfDay,
  ) {}

  get streak(): number {
    return this._streak;
  }

  complete(date: string): DomainEvent[] {
    if (this._dernierJourComplete === date) {
      throw new AlreadyCompletedError(`Routine ${this.id} déjà complétée le ${date}.`);
    }

    const consecutif = this._dernierJourComplete !== null && lendemainDe(this._dernierJourComplete) === date;
    this._streak = consecutif ? this._streak + 1 : 1;
    this._dernierJourComplete = date;

    const events: DomainEvent[] = [new RoutineCompleted(this.id, date)];
    if (MILESTONES.has(this._streak)) {
      events.push(new StreakMilestoneReached(this.id, this._streak));
    }
    return events;
  }

  // ENTITÉ : égalité par IDENTITÉ (l'id), jamais par attribut — contraste volontaire avec
  // TimeOfDay.equals, qui compare par valeur.
  equals(other: Routine): boolean {
    return this.id === other.id;
  }
}
