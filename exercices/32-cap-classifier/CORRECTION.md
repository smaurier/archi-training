# Correction — Exercice 32 : CAP classifier

## Classification des composants

| Composant | CAP | Justification |
|---|---|---|
| Stock / Inventaire | **CP** | Vendre un produit en rupture = perte financiere + client mecontent. La cohérence est non-negociable. |
| Commandes | **CP** | Une commande doit etre atomique (paiement + stock + création). Pas de commande "partielle". |
| Panier | **AP** | Un panier temporairement incoherent est acceptable. L'utilisateur peut toujours ajouter/retirer. |
| Catalogue produits | **AP** | Afficher un prix stale de quelques secondes est préférable a une page d'erreur. |
| Recherche (ES) | **AP** | Un produit manquant dans la recherche pendant 30s est tolerable. |
| Sessions (Redis) | **AP** | Si Redis est partitionne, mieux vaut créer une nouvelle session que bloquer l'accès. |

## Stock — CP avec verrou pessimiste

```typescript
// stock.service.ts — CP : coherence forte
async decrementStock(productId: string, quantity: number): Promise<boolean> {
  return this.dataSource.transaction(async (manager) => {
    // SELECT FOR UPDATE = verrou pessimiste, serialise les acces
    const stock = await manager
      .createQueryBuilder(Stock, 's')
      .setLock('pessimistic_write')
      .where('s.productId = :productId', { productId })
      .getOne();

    if (!stock || stock.quantity < quantity) {
      return false; // pas de stock negatif
    }

    stock.quantity -= quantity;
    await manager.save(stock);
    return true;
  });
}
```

## Catalogue — AP avec eventual consistency

```typescript
// catalog-cache.service.ts — AP : disponibilite privilegiee
@Injectable()
export class CatalogCacheService {
  private readonly TTL = 30; // 30 secondes

  constructor(
    private readonly redis: Redis,
    private readonly catalogRepo: Repository<Product>,
  ) {}

  async getProduct(id: string): Promise<Product | null> {
    // 1. Essayer le cache d'abord (AP = toujours disponible)
    const cached = await this.redis.get(`product:${id}`);
    if (cached) return JSON.parse(cached);

    // 2. Fallback sur la DB
    const product = await this.catalogRepo.findOne({ where: { id } });
    if (product) {
      await this.redis.set(`product:${id}`, JSON.stringify(product), 'EX', this.TTL);
    }
    return product;
  }

  // Invalidation lors d'une mise a jour
  async onProductUpdated(id: string): Promise<void> {
    await this.redis.del(`product:${id}`);
    // Eventual consistency : les lecteurs verront la mise a jour
    // au plus tard apres TTL secondes
  }

  // Read-Your-Writes : apres un update, lire la version fraiche
  async getProductFresh(id: string): Promise<Product | null> {
    const product = await this.catalogRepo.findOne({ where: { id } });
    if (product) {
      await this.redis.set(`product:${id}`, JSON.stringify(product), 'EX', this.TTL);
    }
    return product;
  }
}
```

## Panier — AP avec merge

```typescript
// cart-merge.service.ts — AP : merge en cas de conflit
interface CartItem {
  productId: string;
  quantity: number;
  addedAt: Date;
}

@Injectable()
export class CartMergeService {
  // Quand deux partitions ont des versions differentes du panier,
  // on merge avec la strategie LWW (Last-Writer-Wins) par item
  merge(cartA: CartItem[], cartB: CartItem[]): CartItem[] {
    const merged = new Map<string, CartItem>();

    // Pour chaque produit, garder la version la plus recente
    for (const item of [...cartA, ...cartB]) {
      const existing = merged.get(item.productId);
      if (!existing || item.addedAt > existing.addedAt) {
        merged.set(item.productId, item);
      }
    }

    // Filtrer les items avec quantity = 0 (suppression)
    return Array.from(merged.values()).filter((item) => item.quantity > 0);
  }
}
```

## Compensation au checkout

```typescript
// checkout.service.ts — saga de compensation
async checkout(userId: string, orderId: string): Promise<CheckoutResult> {
  const cart = await this.cartService.getCart(userId);

  // 1. Verifier le stock en temps reel (pas le cache)
  const stockChecks = await Promise.all(
    cart.items.map(async (item) => ({
      ...item,
      available: await this.stockService.checkAvailability(item.productId, item.quantity),
    })),
  );

  const unavailable = stockChecks.filter((c) => !c.available);
  if (unavailable.length > 0) {
    return {
      status: 'stock_changed',
      unavailableItems: unavailable.map((i) => i.productId),
      message: 'Certains produits ne sont plus disponibles',
    };
  }

  // 2. Reserver le stock (CP)
  const reservation = await this.stockService.reserve(orderId, cart.items);

  // 3. Processus de paiement
  try {
    const payment = await this.paymentService.charge(orderId, cart.total);

    if (payment.status === 'succeeded') {
      await this.stockService.confirmReservation(reservation.id);
      await this.orderService.confirm(orderId);
      return { status: 'success', orderId };
    }
  } catch (error) {
    // COMPENSATION : annuler la reservation si le paiement echoue
    await this.stockService.cancelReservation(reservation.id);
    throw error;
  }
}
```

## Alternatives et compromis

### Stock : verrou pessimiste vs verrou optimiste

| Critère | Pessimiste (SELECT FOR UPDATE) | Optimiste (version column) |
|---|---|---|
| Contention | Bloque les autres transactions | Pas de blocage, retry si conflit |
| Performance sous charge | Degrade (lock wait) | Meilleure (pas de lock) |
| Risque de sur-vente | Zero | Zero (retry jusqu'a succes) |
| Complexite | Simple | Nécessité une logique de retry |
| Cas d'usage ideal | Peu de concurrence sur le meme produit | Forte concurrence (flash sale) |

**Verdict pour ShopArch** : pessimiste pour le cas général (simple, suffisant). Pour les flash sales avec 1000 users sur le meme produit, passer en optimiste avec retry.

### Panier : LWW-merge vs event sourcing

| Critère | LWW (Last-Writer-Wins) | Event sourcing |
|---|---|---|
| Complexite | Faible | Elevee |
| Perte de données | Possible (ecrase la version précédente) | Aucune (historique complet) |
| Conflict résolution | Automatique (timestamp) | Manuelle (merge events) |
| Cas d'usage ideal | Panier simple (1 user = 1 panier) | Panier partage / wishlist collaborative |

**Verdict pour ShopArch** : LWW est suffisant pour un panier individuel. Event sourcing est over-engineering ici.

### Cache catalogue : TTL fixe vs invalidation événementielle

| Critère | TTL fixe (30s) | Invalidation par event |
|---|---|---|
| Fraicheur | Jusqu'a 30s de retard | Quasi temps-reel |
| Complexite | Triviale | Nécessité un event bus |
| Risque de stale | Oui (pendant le TTL) | Non (invalide immédiatement) |
| Charge sur la DB | Constante (re-fetch apres TTL) | Minimale (fetch uniquement apres invalidation) |

**Verdict pour ShopArch** : TTL fixe pour commencer (simple). Migrer vers invalidation événementielle quand le volume justifie un event bus (Redis Pub/Sub ou RabbitMQ).

## Ce que tu aurais pu oublier

### 1. Tout en CP
```
FAUX — Stock, Catalogue, Panier, Sessions : tout avec des verrous et transactions
CORRECT — Seuls Stock et Commandes necessitent CP
         Le reste fonctionne mieux en AP (meilleure disponibilite, latence plus basse)
```

### 2. Stock AP
```
FAUX — stock en cache avec eventual consistency (risque de sur-vente)
CORRECT — le stock DOIT etre CP. Verifier en temps reel au checkout.
```

### 3. Pas de compensation
```
FAUX — accepter le paiement sans verifier le stock en temps reel
CORRECT — reserver le stock AVANT le paiement, compenser si echec
```

### 4. Merge naif du panier
```
FAUX — ecraser un panier par l'autre en cas de conflit
CORRECT — merge par item avec LWW (Last-Writer-Wins) par produit
```
