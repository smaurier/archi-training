// Oracle du lab 06, agrégat INVITATION. Ne pas modifier.
// Cycle de vie à elle seule : elle ne connaît ni la famille, ni le plafond.
import { describe, expect, it } from "vitest";
import {
  AdhesionRefuseeFautePlace,
  Invitation,
  InvitationAcceptee,
  InvitationDejaTraiteeError,
} from "@lab/invitation/Invitation";

describe("Invitation : cycle de vie propre", () => {
  it("naît émise", () => {
    expect(new Invitation("inv-1", "fam-1", "carla").statut).toBe("emise");
  });

  it("acceptée une fois : statut et fait produits", () => {
    const invitation = new Invitation("inv-1", "fam-1", "carla");
    const faits = invitation.accepter();

    expect(invitation.statut).toBe("acceptee");
    expect(faits).toHaveLength(1);
    expect(faits[0]).toBeInstanceOf(InvitationAcceptee);
    expect(faits[0].kind).toBe("InvitationAcceptee");
  });

  it("acceptée deux fois : refusée, et le statut ne bouge pas", () => {
    const invitation = new Invitation("inv-1", "fam-1", "carla");
    invitation.accepter();

    expect(() => invitation.accepter()).toThrow(InvitationDejaTraiteeError);
    expect(invitation.statut).toBe("acceptee");
  });

  it("refus faute de place depuis acceptée : statut refusée, fait de compensation", () => {
    const invitation = new Invitation("inv-1", "fam-1", "carla");
    invitation.accepter();
    const faits = invitation.refuserFautePlace();

    expect(invitation.statut).toBe("refusee");
    expect(faits).toHaveLength(1);
    expect(faits[0]).toBeInstanceOf(AdhesionRefuseeFautePlace);
    expect(faits[0].kind).toBe("AdhesionRefuseeFautePlace");
  });

  it("on ne refuse pas faute de place ce qui n'a jamais été accepté", () => {
    const invitation = new Invitation("inv-1", "fam-1", "carla");

    expect(() => invitation.refuserFautePlace()).toThrow(InvitationDejaTraiteeError);
    expect(invitation.statut).toBe("emise");
  });

  it("chaque fait porte sa propre identité (deux faits ne sont jamais le même fait)", () => {
    const a = new Invitation("inv-1", "fam-1", "carla").accepter()[0];
    const b = new Invitation("inv-2", "fam-1", "dani").accepter()[0];

    expect(a.id).not.toBe(b.id);
  });
});
