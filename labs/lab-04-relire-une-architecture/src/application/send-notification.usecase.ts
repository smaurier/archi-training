// send-notification.usecase.ts — L'EXISTANT, EN PRODUCTION. Appelle la règle de domaine
// `shouldNotify`. Si tu changes la signature de `shouldNotify` (voir FINDINGS.md et le
// commentaire de `NotificationPolicy.ts`), CE fichier est l'endroit qui doit s'adapter pour
// lui fournir ce dont elle a besoin — pas l'inverse.
import { shouldNotify } from "../domain/NotificationPolicy";

export function decideNotification(user: { optedIn: boolean }): boolean {
  return shouldNotify(user);
}
