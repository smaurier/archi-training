// Oracle de NON-RÉGRESSION. Ne pas modifier. Passe déjà sur l'existant AVANT extraction —
// c'est la preuve que rien n'est cassé au départ, et que ça doit RESTER vrai après.
import { describe, expect, it } from "vitest";
import { FamilyService } from "@lab/FamilyService";
import { runInviteFlow } from "../InviteFlow";

function service() {
  return new FamilyService([
    { id: "f1", name: "Dupont", memberEmails: ["a@t.fr"], billingTier: "plus" },
  ]);
}

describe("FamilyService — via le VRAI appelant InviteFlow.ts (inchangé)", () => {
  it("invite un membre et renvoie le prix mensuel de la famille", () => {
    const prix = runInviteFlow(service(), "f1", "b@t.fr");
    expect(prix).toBe(499);
  });

  it("refuse un email déjà membre", () => {
    expect(() => runInviteFlow(service(), "f1", "a@t.fr")).toThrow(/déjà membre/);
  });

  it("refuse une 9e adhésion (famille pleine)", () => {
    const s = new FamilyService([
      {
        id: "f1",
        name: "Dupont",
        memberEmails: Array.from({ length: 8 }, (_, i) => `m${i}@t.fr`),
        billingTier: "free",
      },
    ]);
    expect(() => runInviteFlow(s, "f1", "nouveau@t.fr")).toThrow(/8 membres/);
  });

  it("les trois paliers de facturation renvoient le bon prix", () => {
    const s = new FamilyService([
      { id: "free", name: "F", memberEmails: [], billingTier: "free" },
      { id: "plus", name: "P", memberEmails: [], billingTier: "plus" },
      { id: "family", name: "Fa", memberEmails: [], billingTier: "family" },
    ]);
    expect(s.monthlyPriceCents("free")).toBe(0);
    expect(s.monthlyPriceCents("plus")).toBe(499);
    expect(s.monthlyPriceCents("family")).toBe(999);
  });
});
