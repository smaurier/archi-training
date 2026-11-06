import type { StoredEvent } from "../shared/StoredEvent";
import type { FaitAAjouter } from "../shared/EventStore";
import type { Evenement } from "../shared/evenements";
import { estKindConnu, materialiser } from "../shared/evenements";

export class MontantInvalideError extends Error {}
export class SoldeInsuffisantError extends Error {}
export class DepenseDejaEnregistreeError extends Error {}
export class AnnulationImpossibleError extends Error {}

// Un fait produit par une commande : le même objet que l'événement, moins son `kind`, qui
// devient la discriminante du journal.
function fait(evenement: Evenement): FaitAAjouter {
  const { kind, ...payload } = evenement;
  return { kind, payload };
}

export class Cagnotte {
  // Tout ce qui suit est DÉRIVÉ des faits. Rien n'est jamais assigné depuis l'extérieur.
  private solde = 0;
  private readonly depenses = new Map<string, { membreId: string; montantCentimes: number }>();
  private readonly annulees = new Set<string>();

  static rejouer(faits: readonly StoredEvent[]): Cagnotte {
    const cagnotte = new Cagnotte();
    for (const stored of faits) {
      // Un journal vit plus longtemps que le code qui le lit : ce qu'on ne comprend pas, on
      // l'ignore, on ne lève pas.
      if (!estKindConnu(stored.kind)) continue;
      cagnotte.appliquer(materialiser(stored));
    }
    return cagnotte;
  }

  get soldeCentimes(): number {
    return this.solde;
  }

  contribuer(membreId: string, montantCentimes: number): FaitAAjouter[] {
    this.exigerMontantValide(montantCentimes);

    const evenement: Evenement = { kind: "ContributionEnregistree", membreId, montantCentimes };
    this.appliquer(evenement);
    return [fait(evenement)];
  }

  depenser(
    depenseId: string,
    membreId: string,
    montantCentimes: number,
    categorie: string,
  ): FaitAAjouter[] {
    this.exigerMontantValide(montantCentimes);
    if (this.depenses.has(depenseId)) {
      throw new DepenseDejaEnregistreeError(`dépense déjà enregistrée : ${depenseId}`);
    }
    // LA décision de l'agrégat, prise sur l'état rejoué, jamais sur un modèle de lecture.
    if (montantCentimes > this.solde) {
      throw new SoldeInsuffisantError(
        `solde ${this.solde} insuffisant pour une dépense de ${montantCentimes}`,
      );
    }

    const evenement: Evenement = {
      kind: "DepenseEnregistree",
      depenseId,
      membreId,
      montantCentimes,
      categorie,
    };
    this.appliquer(evenement);
    return [fait(evenement)];
  }

  annulerDepense(depenseId: string, motif: string): FaitAAjouter[] {
    if (!this.depenses.has(depenseId) || this.annulees.has(depenseId)) {
      throw new AnnulationImpossibleError(`annulation impossible : ${depenseId}`);
    }

    const evenement: Evenement = { kind: "DepenseAnnulee", depenseId, motif };
    this.appliquer(evenement);
    return [fait(evenement)];
  }

  private exigerMontantValide(montantCentimes: number): void {
    if (!Number.isInteger(montantCentimes) || montantCentimes <= 0) {
      throw new MontantInvalideError(`montant invalide : ${montantCentimes}`);
    }
  }

  // Le point unique où l'état bouge, utilisé par le rejeu ET par les commandes. C'est cette
// unicité qui garantit qu'un état rejoué et un état construit par des commandes sont le même.
  private appliquer(evenement: Evenement): void {
    switch (evenement.kind) {
      case "ContributionEnregistree":
        this.solde += evenement.montantCentimes;
        return;

      case "DepenseEnregistree":
        this.depenses.set(evenement.depenseId, {
          membreId: evenement.membreId,
          montantCentimes: evenement.montantCentimes,
        });
        this.solde -= evenement.montantCentimes;
        return;

      case "DepenseAnnulee": {
        const depense = this.depenses.get(evenement.depenseId);
        if (!depense || this.annulees.has(evenement.depenseId)) return;
        this.annulees.add(evenement.depenseId);
        this.solde += depense.montantCentimes;
        return;
      }
    }
  }
}
