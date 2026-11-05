// Oracle du lab 06, LE cœur : un invariant qui porte sur DEUX agrégats.
// Ne pas modifier. Ces tests ne disent pas "comment" coordonner, ils disent ce qu'aucune
// coordination correcte ne peut violer.
import { describe, expect, it } from "vitest";
import { Famille } from "@lab/famille/Famille";
import { Invitation } from "@lab/invitation/Invitation";
import { ProcessusAdhesion } from "@lab/adhesion/ProcessusAdhesion";

const kinds = (faits: { kind: string }[]): string[] => faits.map((f) => f.kind);

describe("Chemin normal : la place existe", () => {
  it("accepter fait entrer le candidat dans la famille, et raconte les deux faits dans l'ordre", () => {
    const famille = new Famille("fam-1", 3, ["alice"]);
    const invitation = new Invitation("inv-1", "fam-1", "carla");
    const processus = new ProcessusAdhesion(famille, [invitation]);

    const faits = processus.accepter("inv-1");

    expect(kinds(faits)).toEqual(["InvitationAcceptee", "MembreAccueilli"]);
    expect(famille.membres).toContain("carla");
    expect(invitation.statut).toBe("acceptee");
  });
});

describe("La dernière place : deux acceptations, une seule issue", () => {
  it("la deuxième acceptation est COMPENSÉE, jamais honorée", () => {
    const famille = new Famille("fam-1", 3, ["alice", "bob"]);
    const premiere = new Invitation("inv-1", "fam-1", "carla");
    const seconde = new Invitation("inv-2", "fam-1", "dani");
    const processus = new ProcessusAdhesion(famille, [premiere, seconde]);

    const faits1 = processus.accepter("inv-1");
    const faits2 = processus.accepter("inv-2");

    expect(kinds(faits1)).toEqual(["InvitationAcceptee", "MembreAccueilli"]);
    expect(kinds(faits2)).toEqual(["InvitationAcceptee", "AdhesionRefuseeFautePlace"]);

    // L'invariant de la famille n'est JAMAIS violé, même transitoirement observable.
    expect(famille.membres).toHaveLength(3);
    expect(famille.membres).toContain("carla");
    expect(famille.membres).not.toContain("dani");

    // Et le refus est un fait inscrit dans l'invitation, pas un silence.
    expect(premiere.statut).toBe("acceptee");
    expect(seconde.statut).toBe("refusee");
  });

  it("l'acceptation elle-même n'échoue pas : elle a eu lieu, le refus vient après", () => {
    const famille = new Famille("fam-1", 1, ["alice"]);
    const invitation = new Invitation("inv-1", "fam-1", "carla");
    const processus = new ProcessusAdhesion(famille, [invitation]);

    expect(() => processus.accepter("inv-1")).not.toThrow();
    expect(invitation.statut).toBe("refusee");
    expect(famille.membres).toEqual(["alice"]);
  });
});

describe("Au moins une fois : le même fait livré deux fois", () => {
  it("rejouer une acceptation honorée n'accueille pas deux fois", () => {
    const famille = new Famille("fam-1", 3, ["alice"]);
    const invitation = new Invitation("inv-1", "fam-1", "carla");
    const processus = new ProcessusAdhesion(famille, [invitation]);

    const faits = processus.accepter("inv-1");
    const acceptation = faits.find((f) => f.kind === "InvitationAcceptee")!;

    expect(processus.reagir(acceptation)).toEqual([]);
    expect(famille.membres).toEqual(["alice", "carla"]);
  });

  it("rejouer une acceptation COMPENSÉE ne lève pas et ne re-refuse pas", () => {
    const famille = new Famille("fam-1", 1, ["alice"]);
    const invitation = new Invitation("inv-1", "fam-1", "carla");
    const processus = new ProcessusAdhesion(famille, [invitation]);

    const faits = processus.accepter("inv-1");
    const acceptation = faits.find((f) => f.kind === "InvitationAcceptee")!;

    // Sans mémoire des faits traités, ce rejeu tente un second refus et explose :
    // une panne provoquée par le transport, pas par le métier.
    expect(() => processus.reagir(acceptation)).not.toThrow();
    expect(processus.reagir(acceptation)).toEqual([]);
    expect(invitation.statut).toBe("refusee");
  });

  it("un fait d'un autre genre ne déclenche rien", () => {
    const famille = new Famille("fam-1", 3);
    const processus = new ProcessusAdhesion(famille, []);

    expect(processus.reagir({ kind: "MembreAccueilli", id: "f-99" })).toEqual([]);
    expect(famille.membres).toEqual([]);
  });
});
