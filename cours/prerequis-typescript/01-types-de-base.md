# Types de base -- Arrete de mettre `any` partout

Si tu mets `any` quand TS te crie dessus, cette leçon est pour toi.

On va pas se mentir : la moitie des devs React qui "font du TypeScript" ont un projet
JavaScript avec des `any` planques dans les coins. Ça marche... jusqu'au jour ou ça
casse en prod. Cette leçon reprend les bases -- juste ce qu'il faut pour arreter de tricher.

---

## Les types primitifs et l'inference

TypeScript devine les types tout seul. Laisse-le faire son boulot :

```typescript
const name = "Alice";      // TS infere string
const age = 30;            // TS infere number
const isActive = true;     // TS infere boolean
const names: string[] = ["Alice", "Bob"];
```

Ecris le type explicitement seulement quand l'inference ne suffit pas.

**Essaie :** Declare une variable `price` initialisee a `19.99` sans annotation de type.
Survole-la dans ton IDE -- quel type TypeScript a-t-il infere ?

---

## `type` vs `interface`

Les deux decrivent la forme d'un objet. Choisis-en un et sois coherent.

```typescript
interface ButtonProps {          // interface pour les props et contrats
  label: string;
  onClick: () => void;
  disabled?: boolean;            // le ? rend la prop optionnelle
}

type Status = "loading" | "success" | "error";  // type pour les unions
```

Differences : `interface` supporte `extends` et le declaration merging. `type` supporte
les unions, tuples et alias de primitifs. Pour des objets simples, les deux marchent.

**Essaie :** Cree une `interface UserCardProps` avec `username` (string), `avatarUrl`
(string) et `isOnline` (optionnel, boolean). Puis créé un `type Theme` egal a
`"light" | "dark"`.

---

## Union types et discriminated unions

Un union type, c'est "ceci OU cela". Avec un champ discriminant, TypeScript sait
dans quelle branche tu te trouves :

```typescript
type ApiResult =
  | { status: "success"; data: Product[] }
  | { status: "error"; message: string };

function handle(result: ApiResult) {
  if (result.status === "success") {
    console.log(result.data);     // TS sait que data existe ici
  } else {
    console.log(result.message);  // TS sait que message existe ici
  }
}
```

**Essaie :** Cree un type `ApiResponse` qui est soit `{ ok: true; data: string[] }`
soit `{ ok: false; error: string }`. Ecris une fonction `handleResponse` qui retourne
le `data` si ok, ou leve une erreur sinon.

---

## Literal types et `as const`

Avec `const`, TypeScript infere un literal type. `as const` etend ça aux structures :

```typescript
const mode = "dark";      // type: "dark" (pas string)
let mode2 = "dark";       // type: string (car let peut changer)

const config = { theme: "dark", lang: "fr" } as const;
// config.theme est de type "dark", pas string -- et c'est readonly
```

**Essaie :** Declare un objet `const endpoints` avec les clés `users` et `products`.
Ajoute `as const` et survole dans ton IDE pour voir la différence.

---

## Type narrowing

Le narrowing permet a TypeScript de preciser un type au fil du code :

```typescript
// typeof -- pour les primitifs
function format(value: string | number): string {
  if (typeof value === "string") return value.toUpperCase();
  return value.toFixed(2);
}

// in -- pour les objets avec des champs differents
type Fish = { swim: () => void };
type Bird = { fly: () => void };
function move(animal: Fish | Bird) {
  if ("swim" in animal) animal.swim();
  else animal.fly();
}

// instanceof -- pour les classes
function logError(error: unknown) {
  if (error instanceof Error) console.log(error.message);
  else console.log(String(error));
}
```

Le discriminant (vu plus haut avec `status`) est le pattern de narrowing le plus
courant en React.

**Essaie :** Ecris une fonction `describeValue(input: string | number | boolean)`
qui retourne `"texte: ..."`, `"nombre: ..."` ou `"flag: true/false"` selon le type.
Utilise `typeof` pour narrower.

---

## Optional chaining et nullish coalescing

TypeScript comprend `?.` et ajuste les types en consequence :

```typescript
type User = {
  name: string;
  address?: { street: string; city: string };
};

function getCity(user: User): string {
  return user.address?.city ?? "Ville inconnue";
}
```

Attention : `??` ne reagit qu'a `null`/`undefined`, contrairement a `||` qui reagit
a toutes les valeurs falsy (0, "").

**Essaie :** Cree un type `Order` avec un champ optionnel `discount?: { code: string;
percentage: number }`. Ecris une fonction qui retourne le code promo ou `"AUCUN"`.

---

## Arreter d'utiliser `any`

Quand tu ne sais pas quel type mettre, trois options meilleures que `any` :

| Situation | Utilise | Pourquoi |
|-----------|---------|----------|
| Tu sais rien du tout | `unknown` | Force le narrowing avant usage |
| Ça peut etre null | `T \| null` | Explicite |
| Type complexe | un `type` nomme | Documente ton intention |

```typescript
// Mauvais
function parse(data: any) { return data.name.toUpperCase(); }

// Bon
function parse(data: unknown) {
  if (typeof data === "object" && data !== null && "name" in data) {
    return (data as { name: string }).name.toUpperCase();
  }
  throw new Error("Format invalide");
}
```

**Essaie :** Tu as une fonction qui retourne `Promise<any>`. Change-la en
`Promise<unknown>` et ajoute du narrowing pour acceder a `user.email` de façon sure.

**Essaie :** Reprends un de tes composants React et cherche les `any`. Remplace-en
au moins un par un type plus précis.

---

## Ce que tu retiens

- Laisse TypeScript inferer quand il peut -- n'ecris le type que quand c'est nécessaire.
- `type` pour les unions et alias, `interface` pour les objets et props -- sois coherent.
- Les union types + narrowing remplacent la majorite de tes `any`.
- `unknown` est le `any` des gens responsables : il te force a vérifier avant d'utiliser.
- `as const` fige les valeurs en literal types -- utile pour les configs et les enums maison.

---

Leçon suivante : [Generiques et Utility Types -- Le superpouvoir que tu ignores](./02-generiques-utility.md)
