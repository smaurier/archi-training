// NotificationPolicy.ts — L'EXISTANT, EN PRODUCTION. Une PR ouverte par un collègue, déjà
// mergée : ça marche, la démo passe. Ticket de relecture : « quelque chose dans ce module ne
// sent pas bon architecturalement, mais je n'arrive pas à mettre le doigt dessus — peux-tu
// relire ? »
//
// AVANT toute chose : ouvre CE fichier ET `infrastructure/EmailGateway.ts` — rien d'autre —
// et remplis `FINDINGS.md` à la racine du lab. Le correcteur le lit avant ton code.
import { isEmailGatewayUp } from "../infrastructure/EmailGateway";

export function shouldNotify(user: { optedIn: boolean }): boolean {
  return user.optedIn && isEmailGatewayUp();
}
