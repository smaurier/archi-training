# Generiques et Utility Types -- Le superpouvoir que tu ignores

Tu as probablement deja vu `<T>` dans du code TypeScript et fait semblant de comprendre.
Pas de honte -- les generiques ont l'air intimidants, mais le principe est simple :
c'est une variable, mais pour les types.

On utilise des exemples e-commerce tout du long parce que c'est ce qu'on manipule
dans la formation.

---

## Les generiques : un parametre de type

Exactement comme une fonction prend des parametres de valeur, un generique prend un
parametre de type :

```typescript
function first<T>(arr: T[]): T | undefined {
  return arr[0];
}
const name = first(["Alice", "Bob"]);   // type: string | undefined
const price = first([19.99, 29.99]);    // type: number | undefined
```

**Essaie :** Ecris une fonction generique `last<T>(arr: T[]): T | undefined` qui
retourne le dernier element d'un tableau. Teste-la avec des strings et des numbers.

---

## Generiques avec des types metier

Les generiques brillent pour modeliser des reponses d'API :

```typescript
type ApiResponse<T> = { data: T; status: number; timestamp: string };

type Product = { id: string; name: string; price: number; category: string };
type CartItem = { product: Product; quantity: number };

type ProductResponse = ApiResponse<Product>;
type CartResponse = ApiResponse<CartItem[]>;

async function fetchProducts(): Promise<ApiResponse<Product[]>> {
  const response = await fetch("/api/products");
  return response.json();
}
```

Le meme conteneur `ApiResponse` s'adapte au contenu. Tu l'ecris une fois, tu le
reutilises partout.

**Essaie :** Cree un type `PaginatedResponse<T>` contenant `items: T[]`,
`totalCount: number`, `page: number` et `pageSize: number`. Utilise-le pour typer
une reponse paginee de `Product`.

---

## Contraindre avec `extends`

Parfois, tu veux accepter n'importe quel type... tant qu'il a certaines proprietes :

```typescript
type HasId = { id: string };

function findById<T extends HasId>(items: T[], id: string): T | undefined {
  return items.find(item => item.id === id);
}
const found = findById(products, "1");  // type: Product | undefined
```

TypeScript garantit que `T` a au moins un champ `id: string`. Impossible d'appeler
`findById` avec un tableau de `number`.

**Essaie :** Ecris `getNames<T extends { name: string }>(items: T[]): string[]`
qui retourne un tableau des noms. Teste-la avec tes `Product[]`.

---

## Les six Utility Types essentiels

TypeScript fournit des types utilitaires integres. Rien a installer.

```typescript
// Partial<T> -- tout devient optionnel
type ProductUpdate = Partial<Product>;
updateProduct("1", { price: 79 });  // OK, pas besoin de tout envoyer

// Required<T> -- tout devient obligatoire
type StrictConfig = Required<{ theme?: string; debug?: boolean }>;

// Pick<T, K> -- garde seulement certains champs
type ProductPreview = Pick<Product, "id" | "name" | "price">;

// Omit<T, K> -- enleve certains champs
type CreateProductDto = Omit<Product, "id">;  // pas d'id a la creation

// Record<K, V> -- objet avec cles et valeurs typees
type Category = "peripheriques" | "logiciels" | "services";
type CategoryCounts = Record<Category, number>;  // oblige les 3 cles

// Readonly<T> -- plus aucune modification
type FrozenProduct = Readonly<Product>;
```

**Essaie :** A partir de `Product`, cree un `ProductFormData` qui est un
`Partial<Omit<Product, "id">>`. Puis cree un `ProductSummary` avec `Pick` qui ne
garde que `name` et `price`.

**Essaie :** Cree un `Record<"small" | "medium" | "large", number>` qui associe
chaque taille a un prix. Que se passe-t-il si tu oublies une taille ?

---

## Combiner les Utility Types

La vraie puissance, c'est la composition :

```typescript
type CreateProduct = Omit<Product, "id">;
type UpdateProduct = Partial<Omit<Product, "id">>;
type ProductView = Readonly<Product>;
type ProductDraft = Pick<Product, "id"> & Partial<Omit<Product, "id">>;
```

L'operateur `&` (intersection) fusionne deux types.

**Essaie :** Cree un type `CartItemWithTotal` qui est un `CartItem & { total: number }`.

---

## Mapped types -- Transformer un type propriete par propriete

Les utility types comme `Partial` sont des **mapped types**. Tu peux ecrire les tiens :

```typescript
// Exactement comme ca que Partial est implemente :
type MyPartial<T> = { [K in keyof T]?: T[K] };

// Rendre tous les champs nullable :
type Nullable<T> = { [K in keyof T]: T[K] | null };
type NullableProduct = Nullable<Product>;
// { id: string | null; name: string | null; price: number | null; ... }
```

`keyof T` donne l'union des cles. `[K in ...]` itere. `T[K]` donne le type de la valeur.

**Essaie :** Ecris un mapped type `Stringify<T>` qui transforme tous les champs en
`string`. Applique-le a `Product` et verifie que `price` est devenu `string`.

---

## Conditional types -- Le ternaire des types

Comme un ternaire, mais pour les types :

```typescript
type IsString<T> = T extends string ? "oui" : "non";
type A = IsString<string>;  // "oui"
type B = IsString<number>;  // "non"
```

En pratique, tu utiliseras surtout ceux fournis par TypeScript :

```typescript
type WithoutId = Exclude<keyof Product, "id">;           // "name" | "price" | "category"
type Clean = NonNullable<string | null | undefined>;      // string
type ProductData = Extract<string | number, number>;      // number
```

**Essaie :** Utilise `Exclude` pour creer `EditableFields` contenant toutes les cles
de `Product` sauf `"id"`. Combine avec `Pick` pour obtenir un objet sans `id`.

---

## Exemple complet : un hook React generique

Mettons tout ensemble -- un hook de fetch type :

```typescript
type FetchState<T> =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; data: T }
  | { status: "error"; error: string };

function useFetch<T>(url: string): FetchState<T> { /* ... */ }

function ProductList() {
  const state = useFetch<Product[]>("/api/products");
  switch (state.status) {
    case "loading": return <Spinner />;
    case "success": return <List items={state.data} />;
    case "error":   return <Error message={state.error} />;
    default:        return null;
  }
}
```

Generiques + discriminated unions = typage parfait sans un seul `any`.

---

## Ce que tu retiens

- Un generique `<T>` est un parametre de type -- pense "une fonction, mais pour les types".
- `extends` contraint ce que `T` peut etre -- comme un contrat minimum.
- `Partial`, `Pick`, `Omit`, `Record`, `Readonly`, `Required` couvrent 90% des besoins.
- Les utility types se composent : `Partial<Omit<Product, "id">>` est valide et courant.
- Les mapped types te permettent de creer tes propres transformations quand les
  utilitaires integres ne suffisent pas.

---

Lecon suivante : [Classes et immutabilite -- Pourquoi `readonly` va devenir ton meilleur ami](./03-classes-immutabilite.md)
