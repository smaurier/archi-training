// Oracle DOMAINE. Ne pas modifier. Test unitaire pur — aucun mock, aucun framework, juste la
// logique métier.
import { describe, expect, it } from "vitest";
import { DuplicateMemberError, Family, FamilyFullError, MAX_MEMBERS } from "@lab/domain/Family";

describe("Family — règles métier", () => {
  it("accepte un nouveau membre tant qu'elle n'est pas pleine", () => {
    const famille = new Family("f1", "Dupont");
    expect(famille.canAcceptNewMember()).toBe(true);
    famille.addMember("a@t.fr");
    expect(famille.hasMember("a@t.fr")).toBe(true);
    expect(famille.hasMember("A@T.FR")).toBe(true);
  });

  it(`refuse un ${MAX_MEMBERS + 1}e membre (FamilyFullError)`, () => {
    const membres = Array.from({ length: MAX_MEMBERS }, (_, i) => `m${i}@t.fr`);
    const famille = new Family("f1", "Dupont", membres);
    expect(famille.canAcceptNewMember()).toBe(false);
    expect(() => famille.addMember("nouveau@t.fr")).toThrow(FamilyFullError);
  });

  it("refuse un email déjà membre (DuplicateMemberError), avant même de vérifier la place", () => {
    const famille = new Family("f1", "Dupont", ["a@t.fr"]);
    expect(() => famille.addMember("a@t.fr")).toThrow(DuplicateMemberError);
  });
});
