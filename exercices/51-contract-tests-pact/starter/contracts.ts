// contracts.ts — Contract testing : définitions de contrats API et validation
// Documente et valide l'interface entre le BFF (consumer) et l'API Catalogue (provider).

// Types du CONTRAT (ce que le consumer attend du provider)

export interface ProductContract {
  id: string;
  name: string;
  price: number;       // centimes
  stock: number;
  status: 'active' | 'inactive' | 'discontinued';
}

export interface PaginatedProductsContract {
  data: ProductContract[];
  nextCursor: string | null;
  total: number;
}

export interface CartItemContract {
  productId: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface CartContract {
  id: string;
  userId: string;
  items: CartItemContract[];
  total: number;
  updatedAt: string; // ISO string
}

// Erreurs de contrat

export class ContractViolationError extends Error {
  constructor(
    public readonly contract: string,
    public readonly violations: string[],
  ) {
    super(`Contract violation on ${contract}: ${violations.join('; ')}`);
    this.name = 'ContractViolationError';
  }
}

// ---- À IMPLÉMENTER ----

/**
 * Validateurs de contrat — vérifient que les données du provider respectent
 * le contrat attendu par le consumer (BFF).
 * Ces fonctions sont appelées dans les tests d'intégration.
 */

/**
 * Valide qu'un objet respecte le contrat ProductContract.
 * Retourne la liste des violations (propriétés manquantes ou mal typées).
 */
export function validateProduct(data: unknown): string[] {
  // TODO:
  // Vérifier que data est un objet non-null
  // Vérifier les champs obligatoires : id (string), name (string), price (number), stock (number)
  // Vérifier status est dans ['active', 'inactive', 'discontinued']
  // Retourner les violations sous forme de strings : ex: ["Missing field: id", "price must be number"]
  throw new Error('Not implemented');
}

/**
 * Valide qu'un objet respecte le contrat PaginatedProductsContract.
 */
export function validatePaginatedProducts(data: unknown): string[] {
  // TODO:
  // Vérifier : data.data est un tableau, data.nextCursor est string|null, data.total est number
  // Pour chaque produit dans data.data : appeler validateProduct et ajouter les violations avec index
  throw new Error('Not implemented');
}

/**
 * Valide qu'un objet respecte le contrat CartContract.
 */
export function validateCart(data: unknown): string[] {
  // TODO:
  // Vérifier : id (string), userId (string), items (array), total (number), updatedAt (string ISO)
  // Pour chaque item : vérifier productId, quantity, unitPrice, lineTotal
  throw new Error('Not implemented');
}

/**
 * Asserts qu'un contrat est respecté — lève ContractViolationError si non.
 */
export function assertContract(contractName: string, data: unknown, validator: (d: unknown) => string[]): void {
  const violations = validator(data);
  if (violations.length > 0) {
    throw new ContractViolationError(contractName, violations);
  }
}
