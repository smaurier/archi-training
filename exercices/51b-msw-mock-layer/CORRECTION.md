# Correction — Exercice 51b : MSW mock layer

## Setup MSW

```typescript
// mocks/handlers.ts
import { http, HttpResponse, delay } from 'msw';

// Donnees de test
const products = [
  { id: 'p1', name: 'TypeScript Book', price: 29.99, inStock: true, categoryName: 'Books' },
  { id: 'p2', name: 'React Course', price: 49.99, inStock: true, categoryName: 'Courses' },
  { id: 'p3', name: 'Node.js Stickers', price: 9.99, inStock: false, categoryName: 'Merch' },
];

export const handlers = [
  // GET /api/products — liste paginee
  http.get('/api/products', ({ request }) => {
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') ?? '20');
    const cursor = url.searchParams.get('cursor');

    let startIndex = 0;
    if (cursor) {
      const decoded = JSON.parse(atob(cursor));
      startIndex = products.findIndex((p) => p.id === decoded.id) + 1;
    }

    const items = products.slice(startIndex, startIndex + limit);
    const hasNext = startIndex + limit < products.length;

    return HttpResponse.json({
      data: items,
      meta: {
        hasNext,
        nextCursor: hasNext ? btoa(JSON.stringify({ id: items.at(-1)!.id })) : null,
      },
    });
  }),

  // GET /api/products/:id — detail
  http.get('/api/products/:id', ({ params }) => {
    const product = products.find((p) => p.id === params.id);
    if (!product) {
      return HttpResponse.json({ message: 'Not found' }, { status: 404 });
    }
    return HttpResponse.json({
      ...product,
      description: `Description of ${product.name}`,
      images: [{ url: 'https://cdn.example.com/img.jpg', alt: product.name }],
    });
  }),

  // POST /api/cart — ajout au panier
  http.post('/api/cart', async ({ request }) => {
    const body = await request.json() as { productId: string; quantity: number };
    const product = products.find((p) => p.id === body.productId);

    if (!product) {
      return HttpResponse.json({ message: 'Product not found' }, { status: 404 });
    }
    if (!product.inStock) {
      return HttpResponse.json({ message: 'Out of stock' }, { status: 409 });
    }

    return HttpResponse.json({
      items: [{ productId: body.productId, quantity: body.quantity, price: product.price }],
      total: product.price * body.quantity,
      count: body.quantity,
    }, { status: 201 });
  }),
];
```

## Handlers par scénario

```typescript
// mocks/scenarios.ts
import { http, HttpResponse, delay } from 'msw';

// Scenario : serveur lent (pour tester loading states)
export const slowHandlers = [
  http.get('/api/products', async () => {
    await delay(3000);
    return HttpResponse.json({ data: [], meta: { hasNext: false } });
  }),
];

// Scenario : erreur serveur
export const errorHandlers = [
  http.get('/api/products', () => {
    return HttpResponse.json({ message: 'Internal Server Error' }, { status: 500 });
  }),
];

// Scenario : liste vide
export const emptyHandlers = [
  http.get('/api/products', () => {
    return HttpResponse.json({ data: [], meta: { hasNext: false, nextCursor: null } });
  }),
];

// Scenario : derniere page
export const lastPageHandlers = [
  http.get('/api/products', () => {
    return HttpResponse.json({
      data: [{ id: 'p99', name: 'Last Product', price: 1.99, inStock: true }],
      meta: { hasNext: false, nextCursor: null },
    });
  }),
];
```

## Setup pour Vitest

```typescript
// mocks/server.ts
import { setupServer } from 'msw/node';
import { handlers } from './handlers';

export const server = setupServer(...handlers);

// vitest.setup.ts
import { server } from './mocks/server';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

## Tests composants avec MSW

```tsx
// __tests__/ProductList.test.tsx
import { render, screen, waitFor } from '@testing-library/react';
import { server } from '../mocks/server';
import { http, HttpResponse, delay } from 'msw';
import { ProductList } from './ProductList';

describe('ProductList', () => {
  it('should render products from API', async () => {
    render(<ProductList />);

    await waitFor(() => {
      expect(screen.getByText('TypeScript Book')).toBeInTheDocument();
      expect(screen.getByText('React Course')).toBeInTheDocument();
    });
  });

  it('should show loading state', async () => {
    server.use(
      http.get('/api/products', async () => {
        await delay('infinite');
        return HttpResponse.json({ data: [] });
      }),
    );

    render(<ProductList />);
    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
  });

  it('should show error state', async () => {
    server.use(
      http.get('/api/products', () => {
        return HttpResponse.json({ message: 'Server Error' }, { status: 500 });
      }),
    );

    render(<ProductList />);

    await waitFor(() => {
      expect(screen.getByText(/erreur/i)).toBeInTheDocument();
    });
  });

  it('should show empty state', async () => {
    server.use(
      http.get('/api/products', () => {
        return HttpResponse.json({ data: [], meta: { hasNext: false } });
      }),
    );

    render(<ProductList />);

    await waitFor(() => {
      expect(screen.getByText(/aucun produit/i)).toBeInTheDocument();
    });
  });
});
```

## Mode développement (navigateur)

```typescript
// mocks/browser.ts
import { setupWorker } from 'msw/browser';
import { handlers } from './handlers';

export const worker = setupWorker(...handlers);

// main.tsx — activer en dev uniquement
async function bootstrap() {
  if (import.meta.env.DEV && import.meta.env.VITE_MSW === 'true') {
    const { worker } = await import('./mocks/browser');
    await worker.start({
      onUnhandledRequest: 'bypass',
    });
    console.log('[MSW] Mock API active');
  }

  const root = createRoot(document.getElementById('root')!);
  root.render(<App />);
}

bootstrap();
```

```bash
# Demarrer avec MSW active
VITE_MSW=true npm run dev
```

## Ce que tu aurais pu oublier

### 1. Modifier le code pour les mocks
```
FAUX — if (process.env.MOCK) { return fakeData; } dans le code applicatif
CORRECT — MSW intercepte au niveau reseau, le code applicatif ne sait pas qu'il est mocke
         Meme fetch(), meme URL, meme code → donnees differentes
```

### 2. Mocks non realistes
```
FAUX — retourner { data: "ok" } dans les handlers
CORRECT — retourner la meme structure que l'API reelle (types, champs, pagination)
         Les mocks doivent etre un miroir fidele de l'API
```

### 3. Pas de reset entre les tests
```
FAUX — un override dans le test A affecte le test B
CORRECT — server.resetHandlers() dans afterEach pour revenir aux handlers par defaut
```

### 4. onUnhandledRequest: 'bypass'
```
FAUX — les requetes non mockees passent silencieusement (bug invisible)
CORRECT — onUnhandledRequest: 'error' dans les tests (detecte les requetes oubliees)
         onUnhandledRequest: 'bypass' uniquement en dev (pour les assets, etc.)
```
