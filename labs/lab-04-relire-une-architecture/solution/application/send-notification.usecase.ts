// send-notification.usecase.ts — SOLUTION DE RÉFÉRENCE (commentée). Ne l'ouvre pas avant ton GREEN.
// C'est l'application qui appelle l'infrastructure et transmet le fait au domaine — jamais
// l'inverse.
import { isEmailGatewayUp } from "../infrastructure/EmailGateway";
import { shouldNotify } from "../domain/NotificationPolicy";

export function decideNotification(user: { optedIn: boolean }): boolean {
  return shouldNotify(user, isEmailGatewayUp());
}
