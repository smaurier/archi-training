# Correction — Exercice 59 : Anti-corruption layer

## Architecture

```
┌────────────────────────────────────────────────────────┐
│                    ShopArch Domain                      │
│                                                        │
│  ┌──────────┐      ┌──────────┐      ┌──────────┐    │
│  │ Product  │      │ Order    │      │ ...      │    │
│  │ Service  │      │ Service  │      │          │    │
│  └────┬─────┘      └────┬─────┘      └──────────┘    │
│       │                  │                             │
│       ▼                  ▼                             │
│  ┌─────────────────────────────────────┐              │
│  │           ERPPort (interface)        │              │
│  │  getProduct(id): Product             │              │
│  │  syncOrder(order): void              │              │
│  └─────────────────┬───────────────────┘              │
│                    │                                   │
├────────────────────┼───────────────────────────────────┤
│                    │  ANTI-CORRUPTION LAYER            │
│  ┌─────────────────▼───────────────────────┐          │
│  │           SAPAdapter                     │          │
│  │  ┌─────────────────────────────────┐    │          │
│  │  │ ERPProductTranslator            │    │          │
│  │  │  toDomain(ERPMaterial): Product │    │          │
│  │  │  toERP(Product): ERPMaterial    │    │          │
│  │  └─────────────────────────────────┘    │          │
│  │  ┌─────────────────────────────────┐    │          │
│  │  │ ERPOrderTranslator              │    │          │
│  │  │  toERP(Order): ERPSalesOrder    │    │          │
│  │  └─────────────────────────────────┘    │          │
│  │  ┌─────────────────────────────────┐    │          │
│  │  │ CircuitBreaker + Cache + Queue  │    │          │
│  │  └─────────────────────────────────┘    │          │
│  └─────────────────┬───────────────────────┘          │
│                    │                                   │
├────────────────────┼───────────────────────────────────┤
│                    ▼                                   │
│  ┌──────────────────────────────┐                     │
│  │      ERP Legacy (SAP)        │                     │
│  │  SOAP API, codes cryptiques  │                     │
│  └──────────────────────────────┘                     │
└────────────────────────────────────────────────────────┘
```

## Types ERP (on ne les expose JAMAIS au domaine)

```typescript
// erp/types/erp-types.ts — INTERNE a l'ACL uniquement
interface ERPMaterial {
  MATNR: string;           // Material number (ex: "MAT-00012345")
  MAKTX: string;           // Material description
  MATL_GRP: string;        // Material group code
  BRGEW: string;           // Gross weight (string!)
  NTGEW: string;           // Net weight (string!)
  MEINS: string;           // Unit of measure
  VPRSV: string;           // Price control (V=moving average, S=standard)
  STPRS: string;           // Standard price (centimes, string)
  ERDAT: string;           // Created date (YYYYMMDD)
  AEDAT: string;           // Last changed date (YYYYMMDD)
  LVORM: string;           // Deletion flag ("X" or "")
}

interface ERPSalesOrder {
  VBELN: string;           // Sales order number
  KUNNR: string;           // Customer number
  AUART: string;           // Order type
  ERDAT: string;           // Created date
  NETWR: string;           // Net value (centimes, string)
  WAERK: string;           // Currency
  ITEMS: ERPSalesOrderItem[];
}
```

## Port du domaine

```typescript
// domain/ports/erp.port.ts — le domaine definit l'interface
export interface ERPPort {
  getProduct(id: string): Promise<Product | null>;
  getProductsBatch(ids: string[]): Promise<Product[]>;
  syncOrder(order: Order): Promise<{ erpOrderId: string }>;
  syncStock(productId: string, quantity: number): Promise<void>;
}
```

## Traducteurs

```typescript
// acl/translators/product-translator.ts
export class ERPProductTranslator {
  static toDomain(erp: ERPMaterial): Product {
    return {
      id: erp.MATNR.replace('MAT-', ''), // "MAT-00012345" → "00012345"
      name: erp.MAKTX.trim(),
      category: this.mapCategoryCode(erp.MATL_GRP),
      price: parseInt(erp.STPRS) / 100, // centimes string → decimal
      weight: parseFloat(erp.BRGEW) || 0,
      unit: this.mapUnit(erp.MEINS),
      createdAt: this.parseERPDate(erp.ERDAT),
      updatedAt: this.parseERPDate(erp.AEDAT),
      isDeleted: erp.LVORM === 'X',
    };
  }

  static toERP(product: Product): Partial<ERPMaterial> {
    return {
      MATNR: `MAT-${product.id.padStart(11, '0')}`,
      MAKTX: product.name.slice(0, 40), // ERP limite a 40 chars
      MATL_GRP: this.reverseCategoryCode(product.category),
      STPRS: Math.round(product.price * 100).toString(),
      AEDAT: this.formatERPDate(product.updatedAt),
    };
  }

  private static parseERPDate(erpDate: string): Date {
    // "20260315" → Date
    if (!erpDate || erpDate.length !== 8) return new Date();
    const year = parseInt(erpDate.slice(0, 4));
    const month = parseInt(erpDate.slice(4, 6)) - 1;
    const day = parseInt(erpDate.slice(6, 8));
    return new Date(year, month, day);
  }

  private static formatERPDate(date: Date): string {
    // Date → "20260315"
    return [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, '0'),
      String(date.getDate()).padStart(2, '0'),
    ].join('');
  }

  private static mapCategoryCode(code: string): string {
    const mapping: Record<string, string> = {
      'ELEC': 'electronics',
      'BOOK': 'books',
      'CLTH': 'clothing',
      'FOOD': 'food',
    };
    return mapping[code] ?? 'uncategorized';
  }

  private static reverseCategoryCode(category: string): string {
    const mapping: Record<string, string> = {
      'electronics': 'ELEC',
      'books': 'BOOK',
      'clothing': 'CLTH',
      'food': 'FOOD',
    };
    return mapping[category] ?? 'MISC';
  }
}
```

## Adaptateur avec résilience

```typescript
// acl/adapters/sap-adapter.ts
@Injectable()
export class SAPAdapter implements ERPPort {
  private circuitBreaker: CircuitBreaker;

  constructor(
    private readonly soapClient: SoapClient,
    private readonly redis: Redis,
    @InjectQueue('erp-sync') private readonly syncQueue: Queue,
  ) {
    this.circuitBreaker = new CircuitBreaker({
      failureThreshold: 5,
      recoveryTimeout: 30000,
    });
  }

  async getProduct(id: string): Promise<Product | null> {
    // 1. Cache d'abord
    const cached = await this.redis.get(`erp:product:${id}`);
    if (cached) return JSON.parse(cached);

    // 2. Appel ERP avec circuit breaker
    try {
      const erpMaterial = await this.circuitBreaker.execute(async () => {
        return this.soapClient.call('BAPI_MATERIAL_GET', { MATNR: `MAT-${id}` });
      });

      if (!erpMaterial) return null;

      // 3. Traduire vers le domaine
      const product = ERPProductTranslator.toDomain(erpMaterial);

      // 4. Valider
      this.validateProduct(product);

      // 5. Mettre en cache
      await this.redis.set(`erp:product:${id}`, JSON.stringify(product), 'EX', 300);

      return product;
    } catch (error) {
      // Circuit ouvert ou ERP down → retourner la derniere version cachee (stale)
      const stale = await this.redis.get(`erp:product:${id}:stale`);
      if (stale) {
        console.warn(`ERP unavailable, returning stale data for product ${id}`);
        return JSON.parse(stale);
      }
      throw error;
    }
  }

  async syncOrder(order: Order): Promise<{ erpOrderId: string }> {
    try {
      return await this.circuitBreaker.execute(async () => {
        const erpOrder = ERPOrderTranslator.toERP(order);
        const result = await this.soapClient.call('BAPI_SALESORDER_CREATE', erpOrder);
        return { erpOrderId: result.VBELN };
      });
    } catch (error) {
      // ERP down → queue pour retry
      console.warn(`ERP unavailable, queuing order sync for ${order.id}`);
      await this.syncQueue.add('sync-order', {
        orderId: order.id,
        erpPayload: ERPOrderTranslator.toERP(order),
      }, {
        attempts: 10,
        backoff: { type: 'exponential', delay: 60000 },
      });

      return { erpOrderId: 'PENDING' };
    }
  }

  private validateProduct(product: Product): void {
    if (!product.name || product.name.trim() === '') {
      console.error(`Invalid ERP product: empty name for ID ${product.id}`);
      throw new Error('Invalid ERP data: empty product name');
    }
    if (product.price < 0) {
      console.error(`Invalid ERP product: negative price for ID ${product.id}`);
      throw new Error('Invalid ERP data: negative price');
    }
  }
}
```

## Circuit breaker

```typescript
// acl/resilience/circuit-breaker.ts
class CircuitBreaker {
  private failures = 0;
  private state: 'closed' | 'open' | 'half-open' = 'closed';
  private lastFailure = 0;

  constructor(
    private readonly config: { failureThreshold: number; recoveryTimeout: number },
  ) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailure > this.config.recoveryTimeout) {
        this.state = 'half-open';
      } else {
        throw new Error('Circuit breaker is open');
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess() {
    this.failures = 0;
    this.state = 'closed';
  }

  private onFailure() {
    this.failures++;
    this.lastFailure = Date.now();
    if (this.failures >= this.config.failureThreshold) {
      this.state = 'open';
    }
  }
}
```

## Ce que tu aurais pu oublier

### 1. Types ERP dans le domaine
```
FAUX — Product.MATL_GRP, Order.VBELN (codes ERP dans le domaine)
CORRECT — le domaine ne connait QUE ses propres types (Product.category, Order.id)
         L'ACL traduit entre les deux mondes
```

### 2. Pas de validation apres traduction
```
FAUX — faire confiance aux donnees de l'ERP (prix negatif, date invalide)
CORRECT — valider APRES traduction, avant de passer au domaine
         L'ERP peut avoir des donnees corrompues ou des formats inattendus
```

### 3. Erreur ERP qui propage
```
FAUX — l'ERP retourne une erreur SOAP → erreur 500 dans ShopArch
CORRECT — l'ACL isole les erreurs : circuit breaker, cache stale, queue
         ShopArch continue de fonctionner meme si l'ERP est down
```

### 4. ACL bidirectionnel oublie
```
FAUX — traduire seulement ERP → domaine (pas l'inverse)
CORRECT — traduction dans les DEUX sens
         toDomain pour lire, toERP pour ecrire
         Les deux traductions doivent etre coherentes
```
