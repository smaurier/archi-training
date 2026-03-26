// acl.ts — Anti-Corruption Layer (ACL) : isolation du domaine des systèmes legacy
// Le pattern ACL traduit les modèles externes en modèles de domaine propres.

// ---- Modèle LEGACY (ancien système CRM, ne pas modifier) ----

export interface LegacyProduct {
  prod_id: string;           // ex: "P-001"
  prod_name: string;
  prod_price_eur_cents: number; // prix en centimes
  prod_stock_qty: number;
  prod_status_code: 'A' | 'I' | 'D'; // Active, Inactive, Discontinued
  prod_created_ts: string;   // ISO string mal formé, ex: "2024-01-15T10:30:00"
  prod_category_id: number;
  prod_tags: string;         // CSV: "tag1,tag2,tag3"
}

export interface LegacyOrderLine {
  line_prod_id: string;
  line_qty: number;
  line_unit_price_cents: number;
}

export interface LegacyOrder {
  ord_ref: string;
  ord_customer_code: string;
  ord_lines: LegacyOrderLine[];
  ord_total_cents: number;
  ord_status: 'OPEN' | 'CLOSED' | 'CANCEL';
  ord_date: string;
}

// ---- Modèle de DOMAINE (cible propre) ----

export type ProductStatus = 'active' | 'inactive' | 'discontinued';

export interface Product {
  id: string;
  name: string;
  priceEuros: number; // en euros (float)
  stockQuantity: number;
  status: ProductStatus;
  createdAt: Date;
  categoryId: string;
  tags: string[];
}

export type OrderStatus = 'open' | 'closed' | 'cancelled';

export interface OrderLine {
  productId: string;
  quantity: number;
  unitPriceEuros: number;
}

export interface Order {
  id: string;
  customerId: string;
  lines: OrderLine[];
  totalEuros: number;
  status: OrderStatus;
  date: Date;
}

// ---- À IMPLÉMENTER ----

/** Traduit le modèle LegacyProduct en domaine Product. */
export function legacyProductToDomain(legacy: LegacyProduct): Product {
  // TODO:
  // id: legacy.prod_id
  // name: legacy.prod_name
  // priceEuros: legacy.prod_price_eur_cents / 100
  // stockQuantity: legacy.prod_stock_qty
  // status: 'A' → 'active', 'I' → 'inactive', 'D' → 'discontinued'
  // createdAt: new Date(legacy.prod_created_ts)
  // categoryId: String(legacy.prod_category_id)
  // tags: legacy.prod_tags ? legacy.prod_tags.split(',').map(t => t.trim()).filter(Boolean) : []
  throw new Error('Not implemented');
}

/** Traduit le modèle LegacyOrder en domaine Order. */
export function legacyOrderToDomain(legacy: LegacyOrder): Order {
  // TODO:
  // id: legacy.ord_ref
  // customerId: legacy.ord_customer_code
  // lines: legacy.ord_lines.map(...)
  //   → { productId: l.line_prod_id, quantity: l.line_qty, unitPriceEuros: l.line_unit_price_cents / 100 }
  // totalEuros: legacy.ord_total_cents / 100
  // status: 'OPEN' → 'open', 'CLOSED' → 'closed', 'CANCEL' → 'cancelled'
  // date: new Date(legacy.ord_date)
  throw new Error('Not implemented');
}

/** Traduit un Product domaine en LegacyProduct (pour écriture dans le vieux système). */
export function domainProductToLegacy(product: Product): LegacyProduct {
  // TODO:
  // prod_id: product.id
  // prod_name: product.name
  // prod_price_eur_cents: Math.round(product.priceEuros * 100)
  // prod_stock_qty: product.stockQuantity
  // prod_status_code: 'active' → 'A', 'inactive' → 'I', 'discontinued' → 'D'
  // prod_created_ts: product.createdAt.toISOString()
  // prod_category_id: parseInt(product.categoryId, 10)
  // prod_tags: product.tags.join(',')
  throw new Error('Not implemented');
}
