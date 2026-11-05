// Oracle du lab 06, agrégat FAMILLE. Ne pas modifier.
// L'invariant de plafond est tenu par l'agrégat seul, sans aucun collaborateur.
import { describe, expect, it } from "vitest";
import { Famille, MembreAccueilli, PlafondAtteintError } from "@lab/famille/Famille";

describe("Famille : invariant de plafond, tenu seule", () => {
  it("accueille un membre sous le plafond et raconte le fait", () => {
    const famille = new Famille("fam-1", 3);
    const faits = famille.accueillir("alice");

    expect(famille.membres).toEqual(["alice"]);
    expect(faits).toHaveLength(1);
    expect(faits[0]).toBeInstanceOf(MembreAccueilli);
    expect(faits[0].kind).toBe("MembreAccueilli");
  });

  it("refuse le membre de trop et ne change RIEN", () => {
    const famille = new Famille("fam-1", 2, ["alice", "bob"]);

    expect(() => famille.accueillir("carla")).toThrow(PlafondAtteintError);
    expect(famille.membres).toHaveLength(2);
    expect(famille.membres).not.toContain("carla");
  });

  it("accueillir deux fois la même personne est un NON-ÉVÉNEMENT, pas une erreur", () => {
    const famille = new Famille("fam-1", 3, ["alice"]);

    expect(famille.accueillir("alice")).toEqual([]);
    expect(famille.membres).toEqual(["alice"]);
  });

  it("un membre déjà présent ne consomme pas de place, même famille pleine", () => {
    const famille = new Famille("fam-1", 1, ["alice"]);

    expect(famille.accueillir("alice")).toEqual([]);
    expect(famille.membres).toEqual(["alice"]);
  });
});
