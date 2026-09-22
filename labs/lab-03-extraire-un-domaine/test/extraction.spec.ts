// Oracle de l'EXTRACTION. Ne pas modifier. RED tant que le domaine membership n'a pas
// vraiment quitté FamilyService — pas juste "un fichier de plus", une VRAIE séparation.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { MembershipDomain } from "@lab/MembershipDomain";

describe("MembershipDomain — utilisable SEULE, sans FamilyService ni facturation", () => {
  it("gère l'adhésion en isolation complète", () => {
    const membership = new MembershipDomain(["a@t.fr"]);
    expect(membership.hasMember("a@t.fr")).toBe(true);
    expect(membership.canAcceptNewMember()).toBe(true);

    membership.addMember("b@t.fr");
    expect(membership.memberEmails).toEqual(["a@t.fr", "b@t.fr"]);
  });

  it("refuse un doublon", () => {
    const membership = new MembershipDomain(["a@t.fr"]);
    expect(() => membership.addMember("a@t.fr")).toThrow();
  });

  it("refuse un 9e membre", () => {
    const membership = new MembershipDomain(Array.from({ length: 8 }, (_, i) => `m${i}@t.fr`));
    expect(membership.canAcceptNewMember()).toBe(false);
    expect(() => membership.addMember("nouveau@t.fr")).toThrow();
  });
});

describe("FamilyService — délègue vraiment, ne réimplémente plus la règle (relecture du source)", () => {
  const rawSource = readFileSync(process.env.LAB_ROOT + "/FamilyService.ts", "utf8");
  const source = rawSource
    .split("\n")
    .filter((line) => !line.trim().startsWith("//"))
    .join("\n");

  it("importe MembershipDomain", () => {
    expect(source).toMatch(/from ["']\.\/MembershipDomain["']/);
  });

  it("ne réimplémente plus la règle inline (plus de comparaison >= 8 ni de .includes(email) sur les emails)", () => {
    expect(source).not.toMatch(/>=\s*8/);
    expect(source).not.toMatch(/memberEmails\.includes\(email\)/);
  });
});
