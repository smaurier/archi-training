/**
 * Entité Category — catégorie de produits.
 *
 * Identité propre (UUID), nom modifiable.
 */
export class Category {
  readonly id: string;
  private _name: string;
  private _parentId: string | null;

  constructor(params: {
    id?: string;
    name: string;
    parentId?: string | null;
  }) {
    if (!params.name || params.name.trim().length === 0) {
      throw new Error('Category name is required');
    }

    this.id = params.id ?? crypto.randomUUID();
    this._name = params.name.trim();
    this._parentId = params.parentId ?? null;
  }

  get name(): string { return this._name; }
  get parentId(): string | null { return this._parentId; }

  rename(newName: string): void {
    if (!newName || newName.trim().length === 0) {
      throw new Error('Category name is required');
    }
    this._name = newName.trim();
  }
}
