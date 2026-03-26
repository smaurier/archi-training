// crdt.ts — Structures de données CRDT (Conflict-free Replicated Data Types)
// Ces structures permettent la fusion sans conflit entre nœuds distribués.

// ---- À IMPLÉMENTER ----

/**
 * GCounter (Grow-only Counter) : compteur distribué qui ne peut qu'augmenter.
 * Chaque nœud maintient son propre compteur; la valeur globale est la somme.
 * Fusion : prendre le MAX de chaque nœud.
 */
export class GCounter {
  private readonly counts: Map<string, number>;

  constructor(
    private readonly nodeId: string,
    initialState: Record<string, number> = {},
  ) {
    this.counts = new Map(Object.entries(initialState));
    if (!this.counts.has(nodeId)) {
      this.counts.set(nodeId, 0);
    }
  }

  /** Incrémente le compteur de ce nœud de `by` (défaut: 1). */
  increment(by = 1): void {
    // TODO: récupérer la valeur actuelle pour this.nodeId, ajouter `by`
    throw new Error('Not implemented');
  }

  /** Retourne la somme totale de tous les nœuds. */
  value(): number {
    // TODO: réduire la Map en additionnant toutes les valeurs
    throw new Error('Not implemented');
  }

  /** Fusionne avec l'état d'un autre nœud : prend le MAX pour chaque nodeId. */
  merge(other: GCounter): void {
    // TODO: Pour chaque (nodeId, count) dans other.state() :
    //   this.counts.set(nodeId, Math.max(current, count))
    throw new Error('Not implemented');
  }

  /** Retourne l'état interne (pour la transmission réseau / merge). */
  state(): Record<string, number> {
    return Object.fromEntries(this.counts);
  }
}

/**
 * LWWRegister (Last-Write-Wins Register) : registre où la dernière écriture gagne.
 * Comparaison via timestamp. En cas d'égalité, le nodeId le plus grand gagne (déterminisme).
 */
export class LWWRegister<T> {
  private _value: T | undefined;
  private _timestamp = 0;
  private _nodeId: string;

  constructor(
    nodeId: string,
    initialValue?: T,
    initialTimestamp = 0,
  ) {
    this._nodeId = nodeId;
    this._value = initialValue;
    this._timestamp = initialTimestamp;
  }

  /** Met à jour la valeur avec le timestamp donné (défaut: Date.now()). */
  set(value: T, timestamp = Date.now()): void {
    // TODO: ne mettre à jour que si timestamp > this._timestamp
    //   (ou si égal et this._nodeId "gagne" par comparaison de strings)
    throw new Error('Not implemented');
  }

  get value(): T | undefined {
    return this._value;
  }

  get timestamp(): number {
    return this._timestamp;
  }

  /** Fusionne avec un autre registre : la valeur avec le timestamp le plus récent gagne. */
  merge(other: LWWRegister<T>): void {
    // TODO: si other._timestamp > this._timestamp → prendre other
    //   si égal → comparer nodeId (string compare, le plus grand gagne)
    throw new Error('Not implemented');
  }

  state(): { value: T | undefined; timestamp: number; nodeId: string } {
    return { value: this._value, timestamp: this._timestamp, nodeId: this._nodeId };
  }
}

/**
 * LWWMap : map de LWWRegister<T> — chaque clé est un LWWRegister indépendant.
 * Les champs sont fusionnés indépendamment.
 */
export class LWWMap<T> {
  private readonly fields: Map<string, LWWRegister<T>>;

  constructor(private readonly nodeId: string) {
    this.fields = new Map();
  }

  /** Affecte une valeur pour une clé avec le timestamp courant. */
  set(key: string, value: T, timestamp = Date.now()): void {
    // TODO: créer/récupérer le LWWRegister pour cette clé, appeler set()
    throw new Error('Not implemented');
  }

  /** Récupère la valeur courante d'une clé. */
  get(key: string): T | undefined {
    // TODO: retourner le .value du LWWRegister de cette clé, ou undefined
    throw new Error('Not implemented');
  }

  /** Fusionne avec un autre LWWMap : fusionne chaque clé indépendamment. */
  merge(other: LWWMap<T>): void {
    // TODO: pour chaque (key, register) de other.fields :
    //   si clé existe → this.fields.get(key)!.merge(register)
    //   sinon → créer un LWWRegister copié de other
    throw new Error('Not implemented');
  }

  state(): Record<string, { value: T | undefined; timestamp: number; nodeId: string }> {
    const result: Record<string, { value: T | undefined; timestamp: number; nodeId: string }> = {};
    for (const [k, reg] of this.fields) {
      result[k] = reg.state();
    }
    return result;
  }
}
