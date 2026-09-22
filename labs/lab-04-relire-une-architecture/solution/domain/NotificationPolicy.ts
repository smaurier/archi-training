// NotificationPolicy.ts — SOLUTION DE RÉFÉRENCE (commentée). Ne l'ouvre pas avant ton GREEN.
// Fonction PURE : elle reçoit le fait (`emailGatewayAvailable`) au lieu d'aller le chercher
// elle-même — testable sans mock, réutilisable pour n'importe quel canal.
export function shouldNotify(user: { optedIn: boolean }, emailGatewayAvailable: boolean): boolean {
  return user.optedIn && emailGatewayAvailable;
}
