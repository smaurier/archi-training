// Oracle de NON-RÉGRESSION. Ne pas modifier. Passe déjà sur l'existant — la décision finale
// (notifier ou pas) ne doit JAMAIS changer, seule la façon dont le domaine l'obtient change.
import { describe, expect, it } from "vitest";
import { decideNotification } from "@lab/application/send-notification.usecase";

describe("decideNotification — via le VRAI point d'entrée applicatif", () => {
  it("notifie un utilisateur opt-in quand la gateway est disponible", () => {
    expect(decideNotification({ optedIn: true })).toBe(true);
  });

  it("ne notifie jamais un utilisateur non opt-in", () => {
    expect(decideNotification({ optedIn: false })).toBe(false);
  });
});
