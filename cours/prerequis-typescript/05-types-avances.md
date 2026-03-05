# Types avances -- Le niveau qui impressionne en code review

Tu sais typer une variable, ecrire un generique, utiliser `Pick` et `Omit`. Mais en code
review, tu as vu des types qui ressemblent a de la magie noire -- `Brand<string, "UUID">`,
des `is` dans des signatures, des `satisfies` au bout d'un objet. Cette lecon demystifie
les types avances que tu vas croiser partout dans la formation.

---

## Branded types -- Quand `string` ne suffit plus

Un `userId` et un `productId` sont tous les deux des strings. Le probleme :

```typescript
function getOrder(userId: string, productId: string): Order { /* ... */ }
getOrder(productId, userId);  // arguments inverses -- bug silencieux
```

Les branded types ajoutent une "marque" invisible qui rend les types incompatibles :

```typescript
declare const __brand: unique symbol;
type Brand<T, B extends string> = T & { readonly [__brand]: B };

type UserId = Brand<string, "UserId">;
type ProductId = Brand<string, "ProductId">;

function createUserId(value: string): UserId {
  if (!value) throw new Error("UserId invalide");
  return value as UserId;
}

const uid = createUserId("user-42");
const pid = createProductId("prod-99");
getOrder(uid, pid);   // OK
getOrder(pid, uid);   // Erreur TS ! Les types ne matchent pas
```

La marque n'existe pas au runtime -- zero cout. Mais TypeScript refuse de melanger les
types. Ce pattern est utilise dans `src/domain/shared/types.ts` de la formation.

**Essaie :** Cree un type `Email = Brand<string, "Email">` et une fonction `createEmail`
qui valide la presence de `@`. Passe une `string` brute la ou un `Email` est attendu.

---

## Discriminated unions -- Modeliser des evenements metier

```typescript
type OrderEvent =
  | { type: "OrderPlaced"; orderId: string; userId: string; total: number }
  | { type: "OrderPaid"; orderId: string; paymentId: string; paidAt: Date }
  | { type: "OrderShipped"; orderId: string; trackingNumber: string }
  | { type: "OrderCancelled"; orderId: string; reason: string };

function handleEvent(event: OrderEvent): string {
  switch (event.type) {
    case "OrderPlaced":    return `Commande ${event.orderId} de ${event.total} EUR`;
    case "OrderPaid":      return `Paiement ${event.paymentId} recu`;
    case "OrderShipped":   return `Colis ${event.trackingNumber} expedie`;
    case "OrderCancelled": return `Annulee : ${event.reason}`;
    default: {
      const _exhaustive: never = event;
      throw new Error(`Event non gere : ${_exhaustive}`);
    }
  }
}
```

Le champ `type` est le discriminant. Dans chaque `case`, TypeScript sait quels champs
existent. Le `default` avec `never` garantit que si tu ajoutes un variant sans l'ajouter
au switch, le code ne compile plus.

**Essaie :** Cree un type `PaymentEvent` avec trois variants : `PaymentInitiated`
(avec `amount`, `currency`), `PaymentSucceeded` (avec `transactionId`), et
`PaymentFailed` (avec `errorCode`, `message`). Ecris un switch exhaustif.

---

## Type guards -- Les fonctions `is`

Parfois `typeof` et `instanceof` ne suffisent pas. Les type guards custom narrowent :

```typescript
type Cat = { kind: "cat"; purrs: boolean };
type Dog = { kind: "dog"; barks: boolean };
type Animal = Cat | Dog;

function isCat(animal: Animal): animal is Cat {
  return animal.kind === "cat";
}

// Cas pratique : valider une valeur inconnue
function isHttpError(error: unknown): error is HttpError {
  return error instanceof HttpError;
}

function hasMessage(value: unknown): value is { message: string } {
  return typeof value === "object" && value !== null && "message" in value
    && typeof (value as { message: unknown }).message === "string";
}
```

Le `animal is Cat` dit a TypeScript : "si `true`, considere le parametre comme `Cat`".

**Essaie :** Ecris un type guard `isNonNullable<T>(value: T): value is NonNullable<T>`.
Utilise-le pour filtrer : `[1, null, 3, undefined, 5].filter(isNonNullable)`.

---

## Template literal types -- Des strings structurees

```typescript
type HttpMethod = "GET" | "POST" | "PUT" | "DELETE";
type ApiPath = `/api/${string}`;
type Endpoint = `${HttpMethod} ${ApiPath}`;

const valid: Endpoint = "GET /api/products";      // OK
const invalid: Endpoint = "PATCH /api/products";   // Erreur

type EventName = `${string}.${"created" | "updated" | "deleted"}`;
const ok: EventName = "order.created";       // OK
const nope: EventName = "order.archived";    // Erreur
```

Mapping automatique avec remappage de cles :

```typescript
type Getters<T> = {
  [K in keyof T as `get${Capitalize<string & K>}`]: () => T[K];
};
type ProductGetters = Getters<{ name: string; price: number }>;
// { getName: () => string; getPrice: () => number }
```

**Essaie :** Cree un type `CssColorVariable = `--color-${string}``. Verifie que
`"--color-primary"` est accepte mais `"--spacing-sm"` est refuse.

---

## `satisfies` -- Valider sans elargir

`satisfies` (TS 4.9+) verifie la conformite sans perdre l'inference precise :

```typescript
type Route = { path: string; auth: boolean };
type Routes = Record<"home" | "dashboard" | "login", Route>;

const routes = {
  home:      { path: "/",          auth: false },
  dashboard: { path: "/dashboard", auth: true },
  login:     { path: "/login",     auth: false },
} satisfies Routes;

routes.dashboard.auth;  // type: true (pas juste boolean -- precis !)
```

Si tu oublies une route, `satisfies` te le signale. Avec une annotation de type classique,
`routes.dashboard.auth` serait de type `boolean` -- trop large.

**Essaie :** Cree un `ThemeColors = Record<"primary" | "secondary" | "background", string>`.
Definis un objet avec `satisfies`. Verifie l'inference precise et essaie d'oublier une cle.

---

## `infer` -- Extraire un type depuis un autre

`infer` declare une variable de type dans un conditional type -- le "capture group" des types :

```typescript
type Unwrap<T> = T extends Promise<infer U> ? U : T;
type A = Unwrap<Promise<User>>;  // User
type B = Unwrap<string>;         // string

type FirstArg<T> = T extends (first: infer F, ...rest: any[]) => any ? F : never;
type C = FirstArg<(name: string, age: number) => void>; // string

type ElementOf<T> = T extends (infer E)[] ? E : never;
type D = ElementOf<Product[]>;   // Product
```

TypeScript fournit deja `ReturnType<T>` et `Parameters<T>` qui utilisent `infer` sous le
capot. Tu n'ecriras pas souvent des `infer` complexes, mais tu dois savoir les lire.

**Essaie :** Cree un type `UnwrapResult<T>` qui, pour un `Result<T, E>`, extrait `T`.
Teste avec `UnwrapResult<Result<User, Error>>` -- tu devrais obtenir `User`.

---

## Ce que tu retiens

- Les branded types empechent de confondre des valeurs de meme type sous-jacent --
  un `UserId` n'est pas un `ProductId`.
- Les discriminated unions avec exhaustive check (`never`) garantissent la gestion de tous
  les cas.
- Les type guards `is` etendent le narrowing au-dela de `typeof` et `instanceof`.
- `satisfies` verifie la conformite sans elargir les types -- ideal pour les configs.
- `infer` capture un sous-type dans un conditional type -- essentiel pour lire les
  types utilitaires avances.

---

Lecon suivante : [Exercice integratif -- Construis ton premier domaine](./06-exercice-integratif.md)
