# Async et gestion d'erreurs -- Promets-moi que tu n'ecriras plus `.then().catch()`

Tu as probablement écrit des centaines d'appels `fetch` en React. Et chaque fois, c'est
le même schema : `.then(res => res.json()).then(data => ...).catch(err => ...)`. Ça marche,
mais les types disparaissent en route et la gestion d'erreurs se résumé à un
`console.log(err)` en priant. Cette leçon regle ça.

---

## `async/await` -- Du code asynchrone lisible et type

```typescript
type User = { id: string; name: string; email: string };

async function fetchUser(id: string): Promise<User> {
  const response = await fetch(`/api/users/${id}`);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json() as Promise<User>;
}
```

Annote toujours le retour `Promise<T>` -- c'est de la documentation gratuite qui empeche
un `any` de se glisser.

**Essaie :** Ecris une fonction `fetchProducts(): Promise<Product[]>` qui appelle
`/api/products`, vérifié `response.ok`, et retourne le JSON type.

---

## `try/catch` et error narrowing

En TypeScript, le `catch` recoit toujours `unknown`. Le narrowing avec `instanceof` est
obligatoire pour acceder a `.message` :

```typescript
async function getUser(id: string): Promise<User | null> {
  try {
    return await fetchUser(id);
  } catch (error: unknown) {
    if (error instanceof Error) console.error(error.message);
    else console.error("Erreur inconnue:", error);
    return null;
  }
}
```

Pour un narrowing plus fin, créé des classes d'erreur custom :

```typescript
class HttpError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = "HttpError";
  }
}

class NotFoundError extends HttpError {
  constructor(resource: string, id: string) {
    super(404, `${resource} ${id} not found`);
  }
}

class ValidationError extends Error {
  constructor(public readonly field: string, message: string) {
    super(message);
  }
}

// Maintenant le catch devient precis :
try { await updateUser(userId, data); }
catch (error: unknown) {
  if (error instanceof NotFoundError) showToast("Introuvable");
  else if (error instanceof ValidationError) setFieldError(error.field, error.message);
  else if (error instanceof HttpError) showToast(`Erreur ${error.status}`);
}
```

**Essaie :** Cree une classe `TimeoutError extends Error` avec un champ `readonly url: string`.
Ecris un `catch` qui distingue `TimeoutError`, `HttpError` et le reste.

**Essaie :** Ecris un `catch` qui géré `instanceof TypeError` (réseau), `instanceof Error`
(applicatif) et le cas par defaut, avec un message différent pour chaque.

---

## `Promise.all` vs `Promise.allSettled`

`Promise.all` echoue des qu'une promesse echoue. `Promise.allSettled` attend tout :

```typescript
async function fetchProductsSafe(ids: string[]): Promise<Product[]> {
  const results = await Promise.allSettled(ids.map(id => fetchProduct(id)));
  return results
    .filter((r): r is PromiseFulfilledResult<Product> => r.status === "fulfilled")
    .map(r => r.value);
}
```

Le type guard inline `r is PromiseFulfilledResult<Product>` est nécessaire pour que
TypeScript sache que `.value` existe après le filtre.

**Essaie :** Utilise `Promise.allSettled` pour fetcher 5 URLs. Affiche combien ont reussi
et combien ont echoue. Collecte les messages d'erreur des echecs dans un tableau a part.

---

## `AbortController` -- Annuler des requêtes

En React, quand un composant se demonte avant la fin d'un fetch, tu as un memory leak :

```typescript
useEffect(() => {
  const controller = new AbortController();
  fetch("/api/products", { signal: controller.signal })
    .then(res => res.json())
    .then(setProducts)
    .catch(err => { if (err.name !== "AbortError") console.error(err); });
  return () => controller.abort();
}, []);
```

**Essaie :** Ecris une fonction `fetchWithAbort<T>(url: string, signal?: AbortSignal): Promise<T>`
qui propage le signal au `fetch` et type la réponse en générique.

---

## Le pattern Result -- Remplacer `try/catch` par des types

`try/catch` à un defaut fondamental : rien dans la signature ne dit que la fonction peut
echouer. Le pattern Result rend l'erreur explicite dans le type de retour :

```typescript
type Result<T, E = Error> =
  | { ok: true; value: T }
  | { ok: false; error: E };

function Ok<T>(value: T): Result<T, never> { return { ok: true, value }; }
function Err<E>(error: E): Result<never, E> { return { ok: false, error }; }

async function fetchUser(id: string): Promise<Result<User, HttpError>> {
  try {
    const response = await fetch(`/api/users/${id}`);
    if (!response.ok) return Err(new HttpError(response.status, response.statusText));
    return Ok(await response.json());
  } catch {
    return Err(new HttpError(0, "Network error"));
  }
}

const result = await fetchUser("42");
if (result.ok) console.log(result.value.name);   // type: User
else console.log(result.error.status);            // type: HttpError
```

L'erreur fait partie du contrat. C'est une discriminated union -- tu connais déjà.
La composition est naturelle : chaque étape peut echouer et le flux s'arrete proprement :

```typescript
async function createOrder(userId: string, productId: string): Promise<Result<Order, HttpError>> {
  const userResult = await fetchUser(userId);
  if (!userResult.ok) return userResult;
  const productResult = await fetchProduct(productId);
  if (!productResult.ok) return productResult;
  return Ok(new Order(userResult.value, productResult.value));
}
```

**Essaie :** Cree une fonction `parseJson<T>(raw: string): Result<T, Error>` qui wrappe
`JSON.parse` dans un Result. Teste avec du JSON valide et invalide.

**Essaie :** Ecris une fonction `validateAndFetch` qui valide un email (retourne
`Result<Email, ValidationError>`), puis fetche un utilisateur par email (retourne
`Result<User, HttpError>`). Compose les deux Results sans `try/catch`.

---

## Ce que tu retiens

- `async/await` avec `Promise<T>` explicite remplace les chaines `.then()`.
- Le `catch` recoit `unknown` -- utilise `instanceof` pour narrower vers le bon type.
- Les classes d'erreur custom (`HttpError`, `NotFoundError`) permettent un narrowing précis.
- `Promise.allSettled` est plus robuste que `Promise.all` quand certaines requêtes peuvent echouer.
- `AbortController` annule des requêtes -- indispensable dans les `useEffect` React.
- Le pattern `Result<T, E>` rend les erreurs explicites dans le type de retour. C'est le
  pattern privilegie dans la formation.

---

Leçon suivante : [Types avances -- Le niveau qui impressionne en code review](./05-types-avances.md)
