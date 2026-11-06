import type { StoredEvent } from "../shared/StoredEvent";
import { estKindConnu, materialiser } from "../shared/evenements";

export class SoldeParMembre {
  private pos = 0;
  private readonly contributions = new Map<string, number>();
  private readonly depensesParMembre = new Map<string, number>();
  // La mémoire propre de la projection : `DepenseAnnulee` ne porte ni membre ni montant, il
  // faut donc savoir ce qu'on avait compté pour pouvoir le décompter.
  private readonly depenses = new Map<string, { membreId: string; montantCentimes: number }>();
  private readonly annulees = new Set<string>();

  get position(): number {
    return this.pos;
  }

  appliquer(faits: readonly StoredEvent[]): void {
    for (const stored of faits) {
      // Déjà consommé. C'est toute l'idempotence : la projection est rejouable sans dégât.
      if (stored.position <= this.pos) continue;
      // Le point de reprise avance même sur l'inconnu, sinon la projection se bloque sur le
      // premier fait écrit par une version plus récente de l'application.
      this.pos = stored.position;
      if (!estKindConnu(stored.kind)) continue;

      const evenement = materialiser(stored);
      switch (evenement.kind) {
        case "ContributionEnregistree":
          this.contributions.set(
            evenement.membreId,
            (this.contributions.get(evenement.membreId) ?? 0) + evenement.montantCentimes,
          );
          break;

        case "DepenseEnregistree":
          this.depenses.set(evenement.depenseId, {
            membreId: evenement.membreId,
            montantCentimes: evenement.montantCentimes,
          });
          this.depensesParMembre.set(
            evenement.membreId,
            (this.depensesParMembre.get(evenement.membreId) ?? 0) + evenement.montantCentimes,
          );
          break;

        case "DepenseAnnulee": {
          const depense = this.depenses.get(evenement.depenseId);
          if (!depense || this.annulees.has(evenement.depenseId)) break;
          this.annulees.add(evenement.depenseId);
          this.depensesParMembre.set(
            depense.membreId,
            (this.depensesParMembre.get(depense.membreId) ?? 0) - depense.montantCentimes,
          );
          break;
        }
      }
    }
  }

  contributionDe(membreId: string): number {
    return this.contributions.get(membreId) ?? 0;
  }

  depenseDe(membreId: string): number {
    return this.depensesParMembre.get(membreId) ?? 0;
  }

  soldeCentimes(): number {
    const somme = (valeurs: Iterable<number>): number => {
      let total = 0;
      for (const valeur of valeurs) total += valeur;
      return total;
    };
    return somme(this.contributions.values()) - somme(this.depensesParMembre.values());
  }
}
