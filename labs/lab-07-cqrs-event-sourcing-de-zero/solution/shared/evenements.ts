import type { StoredEvent } from "./StoredEvent";

export type Evenement =
  | { readonly kind: "ContributionEnregistree"; readonly membreId: string; readonly montantCentimes: number }
  | {
      readonly kind: "DepenseEnregistree";
      readonly depenseId: string;
      readonly membreId: string;
      readonly montantCentimes: number;
      readonly categorie: string;
    }
  | { readonly kind: "DepenseAnnulee"; readonly depenseId: string; readonly motif: string };

export const KINDS_CONNUS = [
  "ContributionEnregistree",
  "DepenseEnregistree",
  "DepenseAnnulee",
] as const;

export function estKindConnu(kind: string): boolean {
  return (KINDS_CONNUS as readonly string[]).includes(kind);
}

export const CATEGORIE_PAR_DEFAUT = "non categorisee";

export class EvenementInconnuError extends Error {}

// L'upcast, et le seul endroit du code qui sait que le passé avait une autre forme.
// Au-delà de cette fonction, plus personne ne doit soupçonner qu'il a existé une v1.
export function materialiser(stored: StoredEvent): Evenement {
  const p = stored.payload as Record<string, unknown>;

  switch (stored.kind) {
    case "ContributionEnregistree":
      return {
        kind: "ContributionEnregistree",
        membreId: String(p.membreId),
        montantCentimes: Number(p.montantCentimes),
      };

    case "DepenseEnregistree":
      return {
        kind: "DepenseEnregistree",
        depenseId: String(p.depenseId),
        membreId: String(p.membreId),
        // v1 portait des euros décimaux. L'arrondi est à l'entier le plus proche : un centime
        // perdu par troncature sur chaque vieille ligne ferait dériver tous les totaux.
        montantCentimes:
          "montantCentimes" in p
            ? Number(p.montantCentimes)
            : Math.round(Number(p.montant) * 100),
        categorie: typeof p.categorie === "string" ? p.categorie : CATEGORIE_PAR_DEFAUT,
      };

    case "DepenseAnnulee":
      return {
        kind: "DepenseAnnulee",
        depenseId: String(p.depenseId),
        motif: String(p.motif),
      };

    default:
      throw new EvenementInconnuError(stored.kind);
  }
}
