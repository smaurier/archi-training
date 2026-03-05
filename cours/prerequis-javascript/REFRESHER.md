# Refresher JavaScript & React — Antisèche de la formation

> Ce n'est pas un cours — c'est une antisèche. Si un pattern te semble flou,
> prends 10 minutes pour le pratiquer dans un fichier temporaire.
>
> Chaque pattern ci-dessous est utilisé dans la formation. Si tu ne les reconnais pas,
> tu vas perdre du temps à comprendre la syntaxe au lieu de comprendre l'architecture.

---

## JavaScript — 10 patterns essentiels

### 1. Destructuring (objet + tableau)

```javascript
// Objet
const product = { name: 'Clavier', price: 89, stock: 42 };
const { name, price } = product; // name = 'Clavier', price = 89

// Tableau
const [first, second, ...rest] = [1, 2, 3, 4, 5];
// first = 1, second = 2, rest = [3, 4, 5]

// Renommage
const { name: productName } = product; // productName = 'Clavier'
```

### 2. Spread operator (objets + tableaux)

```javascript
// Copier et étendre un objet
const updated = { ...product, price: 99 }; // nouveau objet, price changé

// Fusionner des tableaux
const all = [...arrayA, ...arrayB];

// Copier un objet (shallow copy — attention aux objets imbriqués)
const copy = { ...product };
```

### 3. Optional chaining (?.) et nullish coalescing (??)

```javascript
// Optional chaining : accéder sans crash si null/undefined
const city = user?.address?.city; // undefined si user ou address est null

// Nullish coalescing : valeur par défaut SEULEMENT si null ou undefined
const name = user?.name ?? 'Anonyme'; // 'Anonyme' si name est null/undefined
// Attention : '' ?? 'default' donne '' (pas 'default') — contrairement à ||
const empty = '' || 'default';  // 'default' (|| traite '' comme falsy)
const empty2 = '' ?? 'default'; // '' (?? ne traite que null/undefined)
```

### 4. Méthodes de tableau (map, filter, reduce, find, some, every)

```javascript
const products = [
  { name: 'Clavier', price: 89 },
  { name: 'Souris', price: 45 },
  { name: 'Ecran', price: 350 },
];

const names = products.map(p => p.name);           // ['Clavier', 'Souris', 'Ecran']
const cheap = products.filter(p => p.price < 100);  // [{Clavier}, {Souris}]
const total = products.reduce((sum, p) => sum + p.price, 0); // 484
const found = products.find(p => p.name === 'Souris');        // {Souris} ou undefined
const hasExpensive = products.some(p => p.price > 300);       // true
const allCheap = products.every(p => p.price < 100);          // false
```

### 5. Promises et async/await

```javascript
// Créer une Promise
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Chaîner avec .then()
fetch('/api/products')
  .then(res => res.json())
  .then(data => console.log(data));

// Avec async/await (préféré dans la formation)
async function getProducts() {
  const res = await fetch('/api/products');
  const data = await res.json();
  return data;
}
```

### 6. try/catch avec fetch

```javascript
async function fetchProducts() {
  try {
    const res = await fetch('/api/products');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (error) {
    console.error('Erreur:', error.message);
    return []; // valeur par défaut en cas d'erreur
  }
}
```

### 7. Classes (constructor, méthodes, getters)

```javascript
class Money {
  constructor(amount, currency) {
    this.amount = amount;
    this.currency = currency;
  }

  add(other) {
    if (this.currency !== other.currency) throw new Error('Currency mismatch');
    return new Money(this.amount + other.amount, this.currency);
  }

  get formatted() {
    return `${this.amount.toFixed(2)} ${this.currency}`;
  }
}

const price = new Money(10, 'EUR');
price.formatted; // '10.00 EUR' — pas de parenthèses, c'est un getter
```

### 8. Modules (import/export, named vs default)

```javascript
// Named exports (préféré dans la formation)
// math.js
export const add = (a, b) => a + b;
export const multiply = (a, b) => a * b;
// usage
import { add, multiply } from './math.js';

// Default export (un seul par fichier)
// ProductService.js
export default class ProductService { /* ... */ }
// usage
import ProductService from './ProductService.js';

// Re-export (pattern "barrel" — index.ts)
export { ProductService } from './product.service';
export { OrderService } from './order.service';
```

### 9. Closures et callbacks

```javascript
// Closure : une fonction qui "capture" des variables de son scope parent
function createCounter(start = 0) {
  let count = start;
  return {
    increment: () => ++count,
    getValue: () => count,
  };
}
const counter = createCounter(10);
counter.increment(); // 11
counter.getValue();  // 11

// Callback : passer une fonction en argument
function fetchThen(url, onSuccess, onError) {
  fetch(url).then(res => res.json()).then(onSuccess).catch(onError);
}
```

### 10. Patterns d'immutabilité

```javascript
// Object.freeze — empêche la modification (shallow)
const config = Object.freeze({ apiUrl: '/api', timeout: 5000 });
config.timeout = 10000; // silencieusement ignoré (ou erreur en strict mode)

// Copie par spread pour "modifier" sans muter
const original = { name: 'Clavier', price: 89 };
const updated = { ...original, price: 99 }; // original inchangé

// Tableau : ajouter/supprimer sans muter
const items = [1, 2, 3];
const added = [...items, 4];               // [1, 2, 3, 4]
const removed = items.filter(i => i !== 2); // [1, 3]
const replaced = items.map(i => i === 2 ? 20 : i); // [1, 20, 3]
```

---

## React — 6 patterns utilisés dans la formation

### 1. useState avec un état objet

```tsx
const [product, setProduct] = useState({ name: '', price: 0 });

// JAMAIS : product.name = 'Clavier' (mutation directe)
// TOUJOURS : créer un nouvel objet
setProduct(prev => ({ ...prev, name: 'Clavier' }));

// Pour un tableau dans l'état
const [items, setItems] = useState<Item[]>([]);
setItems(prev => [...prev, newItem]);         // ajouter
setItems(prev => prev.filter(i => i.id !== id)); // supprimer
```

### 2. useEffect avec cleanup

```tsx
useEffect(() => {
  // Setup : s'exécute au montage (et quand deps changent)
  const controller = new AbortController();

  fetch('/api/products', { signal: controller.signal })
    .then(res => res.json())
    .then(setProducts)
    .catch(err => {
      if (err.name !== 'AbortError') console.error(err);
    });

  // Cleanup : s'exécute au démontage (et avant la prochaine exécution)
  return () => controller.abort();
}, []); // [] = exécuter une seule fois au montage
```

### 3. useContext + Provider

```tsx
// 1. Créer le contexte
const ThemeContext = createContext<'light' | 'dark'>('light');

// 2. Fournir la valeur (dans un parent)
function App() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  return (
    <ThemeContext.Provider value={theme}>
      <Header />
      <Main />
    </ThemeContext.Provider>
  );
}

// 3. Consommer (dans n'importe quel enfant)
function Header() {
  const theme = useContext(ThemeContext);
  return <header className={theme}>Mon App</header>;
}
```

### 4. Custom hooks

```tsx
// Convention : commence toujours par "use"
function useProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/products')
      .then(res => res.json())
      .then(setProducts)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return { products, loading, error };
}

// Usage : propre et réutilisable
function ProductList() {
  const { products, loading, error } = useProducts();
  if (loading) return <p>Chargement...</p>;
  if (error) return <p>Erreur : {error}</p>;
  return <ul>{products.map(p => <li key={p.id}>{p.name}</li>)}</ul>;
}
```

### 5. Rendu conditionnel

```tsx
// Avec && (attention : 0 && <Component/> affiche "0", pas rien)
{isLoggedIn && <Dashboard />}

// Avec ternaire
{isLoading ? <Spinner /> : <Content />}

// Avec early return (préféré dans la formation pour la lisibilité)
function ProductPage({ id }: { id: string }) {
  const { product, loading, error } = useProduct(id);
  if (loading) return <Spinner />;
  if (error) return <ErrorBanner message={error} />;
  if (!product) return <NotFound />;
  return <ProductDetail product={product} />;
}
```

### 6. Key prop dans les listes

```tsx
// TOUJOURS donner une key unique et stable (pas l'index !)
{products.map(product => (
  <ProductCard key={product.id} product={product} />
))}

// Pourquoi pas l'index ? Parce que si la liste change (tri, suppression),
// React ne saura pas quel élément a bougé et va tout re-render.
// Utilise un ID métier (product.id, user.email, order.reference).
```

---

## Récap rapide

| Si tu bloques sur... | Consulte |
|---|---|
| `const { x } = obj` | Pattern 1 (Destructuring) |
| `{ ...obj, key: val }` | Pattern 2 (Spread) |
| `user?.address?.city` | Pattern 3 (Optional chaining) |
| `.map().filter()` | Pattern 4 (Array methods) |
| `async/await` | Pattern 5 (Promises) |
| `try/catch` avec `fetch` | Pattern 6 (Error handling) |
| `class Money {}` | Pattern 7 (Classes) |
| `import/export` | Pattern 8 (Modules) |
| Fonction qui retourne une fonction | Pattern 9 (Closures) |
| `{ ...obj }` sans muter | Pattern 10 (Immutabilité) |
| `useState` avec objet | React 1 |
| `useEffect` + cleanup | React 2 |
| Partager de l'état global | React 3 (useContext) |
| Logique réutilisable | React 4 (Custom hooks) |
| Affichage conditionnel | React 5 |
| Listes et `key` | React 6 |
