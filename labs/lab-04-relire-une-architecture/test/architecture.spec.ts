// Oracle de la REVUE D'ARCHITECTURE. Ne pas modifier. RED tant que le domaine importe
// l'infrastructure. La preuve est double : statique (relecture des imports) ET
// comportementale (la fonction doit vraiment UTILISER le fait qu'on lui passe, pas
// l'ignorer et aller le rechercher elle-même).
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { shouldNotify } from "@lab/domain/NotificationPolicy";

const ROOT = process.env.LAB_ROOT!;

describe("domain/NotificationPolicy.ts — plus d'import infrastructure (relecture du source)", () => {
  it("n'importe plus rien depuis infrastructure/", () => {
    const source = readFileSync(`${ROOT}/domain/NotificationPolicy.ts`, "utf8")
      .split("\n")
      .filter((l) => !l.trim().startsWith("//"))
      .join("\n");
    expect(source).not.toMatch(/infrastructure/);
  });
});

describe("shouldNotify — fonction PURE, utilise vraiment le paramètre reçu", () => {
  const appel = shouldNotify as unknown as (user: { optedIn: boolean }, disponible: boolean) => boolean;

  it("retourne true quand opted-in ET la gateway (passée en paramètre) est disponible", () => {
    expect(appel({ optedIn: true }, true)).toBe(true);
  });

  it("retourne false quand la gateway (passée en paramètre) est indisponible — même opted-in", () => {
    expect(appel({ optedIn: true }, false)).toBe(false);
  });

  it("retourne false quand non opted-in, quelle que soit la gateway", () => {
    expect(appel({ optedIn: false }, true)).toBe(false);
  });
});
