// Oracle du lab 02 DDD. Ne pas modifier. Vérifie la distinction VALUE OBJECT (égalité par
// valeur) / ENTITÉ (égalité par identité), les invariants de l'agrégat, et les domain
// events émis.
import { describe, expect, it } from "vitest";
import {
  AlreadyCompletedError,
  Routine,
  RoutineCompleted,
  StreakMilestoneReached,
  TimeOfDay,
} from "@lab/Routine";

describe("TimeOfDay — VALUE OBJECT, égalité par VALEUR", () => {
  it("deux instances avec les mêmes hour/minute sont égales, même objets différents", () => {
    const a = TimeOfDay.of(8, 30);
    const b = TimeOfDay.of(8, 30);
    expect(a).not.toBe(b); // deux objets distincts en mémoire
    expect(a.equals(b)).toBe(true); // mais égaux PAR VALEUR
  });

  it("des heures/minutes différentes ne sont pas égales", () => {
    expect(TimeOfDay.of(8, 30).equals(TimeOfDay.of(8, 31))).toBe(false);
  });

  it("rejette une heure ou une minute hors bornes", () => {
    expect(() => TimeOfDay.of(24, 0)).toThrow();
    expect(() => TimeOfDay.of(0, 60)).toThrow();
    expect(() => TimeOfDay.of(-1, 0)).toThrow();
  });
});

describe("Routine — ENTITÉ, égalité par IDENTITÉ (contraste avec TimeOfDay)", () => {
  it("deux instances avec le même id sont égales même si label/streak diffèrent", () => {
    const a = new Routine("r1", "Brossage de dents", TimeOfDay.of(8, 0));
    const b = new Routine("r1", "Autre libellé", TimeOfDay.of(20, 0));
    b.complete("2026-01-01");
    expect(a.equals(b)).toBe(true); // même id → même entité, peu importe l'état
  });

  it("deux ids différents ne sont jamais égaux, même avec un état identique", () => {
    const a = new Routine("r1", "Brossage de dents", TimeOfDay.of(8, 0));
    const b = new Routine("r2", "Brossage de dents", TimeOfDay.of(8, 0));
    expect(a.equals(b)).toBe(false);
  });
});

describe("Routine.complete — invariants métier", () => {
  it("premier jour complété : streak = 1", () => {
    const r = new Routine("r1", "Devoirs", TimeOfDay.of(17, 0));
    r.complete("2026-01-01");
    expect(r.streak).toBe(1);
  });

  it("des jours consécutifs incrémentent le streak", () => {
    const r = new Routine("r1", "Devoirs", TimeOfDay.of(17, 0));
    r.complete("2026-01-01");
    r.complete("2026-01-02");
    r.complete("2026-01-03");
    expect(r.streak).toBe(3);
  });

  it("un jour manqué remet le streak à 1", () => {
    const r = new Routine("r1", "Devoirs", TimeOfDay.of(17, 0));
    r.complete("2026-01-01");
    r.complete("2026-01-02");
    r.complete("2026-01-05"); // saut
    expect(r.streak).toBe(1);
  });

  it("compléter deux fois le même jour lève AlreadyCompletedError", () => {
    const r = new Routine("r1", "Devoirs", TimeOfDay.of(17, 0));
    r.complete("2026-01-01");
    expect(() => r.complete("2026-01-01")).toThrow(AlreadyCompletedError);
  });
});

describe("Routine.complete — domain events", () => {
  it("émet toujours RoutineCompleted", () => {
    const r = new Routine("r1", "Devoirs", TimeOfDay.of(17, 0));
    const events = r.complete("2026-01-01");
    expect(events).toHaveLength(1);
    expect(events[0]).toBeInstanceOf(RoutineCompleted);
    expect((events[0] as RoutineCompleted).date).toBe("2026-01-01");
  });

  it("émet StreakMilestoneReached en plus quand le streak atteint EXACTEMENT 7", () => {
    const r = new Routine("r1", "Devoirs", TimeOfDay.of(17, 0));
    let dernier: ReturnType<Routine["complete"]> = [];
    const jours = ["01", "02", "03", "04", "05", "06", "07"];
    for (const j of jours) dernier = r.complete(`2026-01-${j}`);

    expect(r.streak).toBe(7);
    expect(dernier).toHaveLength(2);
    expect(dernier.some((e) => e instanceof StreakMilestoneReached)).toBe(true);
    expect((dernier.find((e) => e instanceof StreakMilestoneReached) as StreakMilestoneReached).streak).toBe(7);
  });

  it("n'émet PAS StreakMilestoneReached à streak = 8 (pas un palier)", () => {
    const r = new Routine("r1", "Devoirs", TimeOfDay.of(17, 0));
    const jours = ["01", "02", "03", "04", "05", "06", "07", "08"];
    let dernier: ReturnType<Routine["complete"]> = [];
    for (const j of jours) dernier = r.complete(`2026-01-${j}`);

    expect(r.streak).toBe(8);
    expect(dernier).toHaveLength(1);
  });
});
