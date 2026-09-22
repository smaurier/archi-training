// EmailGateway.ts — DONNÉ, ne se modifie pas. Un vrai souci d'infrastructure (en prod : un
// appel réseau réel vers le fournisseur d'emails). Ici, simplifié à une fonction pure pour
// le lab — ce qui compte, c'est QUI a le droit de l'appeler.
export function isEmailGatewayUp(): boolean {
  return true;
}
