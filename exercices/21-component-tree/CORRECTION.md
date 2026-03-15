# Correction — Exercice 21 : Component tree

## Classification des composants

| Composant | Type | Raison |
|---|---|---|
| ProductPage | Conteneur | Fetch le produit, orchestre la page |
| ProductGallery | Presentationnel | Recoit images[], callback image selectionnee |
| ProductPrice | Presentationnel | Recoit price + currency, affiche formatte |
| VariantSelector | Presentationnel | Recoit variants[], callback selection |
| AddToCartButton | Presentationnel | Recoit inStock + loading, callback click |
| RelatedProducts | Conteneur | Fetch les produits lies |
| ProductCard | Presentationnel | Recoit product, affiche une carte |

## Composants clés

### ProductPrice

```tsx
// components/ProductPrice.tsx
interface ProductPriceProps {
  price: number;
  originalPrice?: number;
  currency?: string;
}

export function ProductPrice({
  price,
  originalPrice,
  currency = 'EUR',
}: ProductPriceProps) {
  const formatted = useMemo(
    () =>
      new Intl.NumberFormat('fr-FR', {
        style: 'currency',
        currency,
      }).format(price),
    [price, currency],
  );

  const hasDiscount = originalPrice != null && originalPrice > price;
  const discountPercent = hasDiscount
    ? Math.round((1 - price / originalPrice!) * 100)
    : 0;

  return (
    <div className="product-price">
      {hasDiscount && (
        <span className="original-price">
          {new Intl.NumberFormat('fr-FR', {
            style: 'currency',
            currency,
          }).format(originalPrice!)}
        </span>
      )}
      <span className={`current-price ${hasDiscount ? 'on-sale' : ''}`}>
        {formatted}
      </span>
      {hasDiscount && (
        <span className="discount-badge">-{discountPercent}%</span>
      )}
    </div>
  );
}
```

### AddToCartButton

```tsx
// components/AddToCartButton.tsx
interface AddToCartButtonProps {
  inStock: boolean;
  loading?: boolean;
  onAddToCart: () => void;
}

export function AddToCartButton({
  inStock,
  loading = false,
  onAddToCart,
}: AddToCartButtonProps) {
  const buttonText = useMemo(() => {
    if (loading) return 'Ajout en cours...';
    if (!inStock) return 'Rupture de stock';
    return 'Ajouter au panier';
  }, [loading, inStock]);

  const isDisabled = !inStock || loading;

  return (
    <button
      disabled={isDisabled}
      className={`${!inStock ? 'out-of-stock' : ''} ${loading ? 'loading' : ''}`}
      onClick={onAddToCart}
    >
      {buttonText}
    </button>
  );
}
```

### VariantSelector

```tsx
// components/VariantSelector.tsx
interface Variant {
  id: string;
  type: 'size' | 'color';
  label: string;
  value: string;
  inStock: boolean;
}

interface VariantSelectorProps {
  variants: Variant[];
  selectedId?: string;
  onSelect: (variantId: string) => void;
}

export function VariantSelector({
  variants,
  selectedId,
  onSelect,
}: VariantSelectorProps) {
  return (
    <div className="variant-selector">
      {variants.map((variant) => (
        <div
          key={variant.id}
          className={`variant-option ${
            variant.id === selectedId ? 'selected' : ''
          } ${!variant.inStock ? 'out-of-stock' : ''}`}
          onClick={() => variant.inStock && onSelect(variant.id)}
          role="button"
          tabIndex={0}
        >
          {variant.label}
        </div>
      ))}
    </div>
  );
}
```

### Custom hook useProduct (bonus)

```typescript
// hooks/useProduct.ts
export function useProduct(id: string) {
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchProduct = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<Product>(`/api/products/${id}`);
      setProduct(res.data);
    } catch (e) {
      setError(e as Error);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    let cancelled = false;

    api.get<Product>(`/api/products/${id}`)
      .then((res) => { if (!cancelled) setProduct(res.data); })
      .catch((e) => { if (!cancelled) setError(e); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [id]);

  return { product, loading, error, refresh: fetchProduct };
}
```

### ProductPage (conteneur)

```tsx
// pages/ProductPage.tsx
export function ProductPage() {
  const { id } = useParams<{ id: string }>();
  const { product, loading, error } = useProduct(id!);
  const [addingToCart, setAddingToCart] = useState(false);
  const [selectedVariant, setSelectedVariant] = useState<string>();

  const handleAddToCart = useCallback(async () => {
    if (!product) return;
    setAddingToCart(true);
    await cartService.addItem(product.id, selectedVariant, 1);
    setAddingToCart(false);
  }, [product, selectedVariant]);

  if (loading) return <div>Chargement...</div>;
  if (error) return <div>Erreur : {error.message}</div>;
  if (!product) return null;

  return (
    <div className="product-page">
      <ProductGallery images={product.images} />
      <div className="product-info">
        <h1>{product.name}</h1>
        <ProductPrice
          price={product.price}
          originalPrice={product.originalPrice}
        />
        <VariantSelector
          variants={product.variants}
          selectedId={selectedVariant}
          onSelect={setSelectedVariant}
        />
        <AddToCartButton
          inStock={product.stock > 0}
          loading={addingToCart}
          onAddToCart={handleAddToCart}
        />
      </div>
    </div>
  );
}
```

## Ce que tu aurais pu oublier

### 1. Props drilling sur 3+ niveaux

```
FAUX — ProductPage → ProductInfo → VariantSelector → VariantOption (passe currency)
  → 4 niveaux de props pour la devise

CORRECT — React Context pour les donnees partagees
  → const CurrencyContext = createContext('EUR')
  → <CurrencyContext.Provider value="EUR">
  → N'importe quel descendant : useCurrency() via useContext
```

### 2. Business logic dans le JSX

```tsx
{/* FAUX */}
<span>{(price * (1 - discount / 100)).toFixed(2)}€</span>

{/* CORRECT — calcul dans un useMemo */}
const formattedPrice = useMemo(() => ..., [price, discount]);
<span>{formattedPrice}</span>
```

### 3. Composant conteneur + presentationnel

```
FAUX — ProductCard fetch ses propres donnees et les affiche
  → Impossible a reutiliser, difficile a tester

CORRECT — ProductCard est presentationnel (props in, callbacks out)
  → Le parent (RelatedProducts) fetch et passe en props
```
