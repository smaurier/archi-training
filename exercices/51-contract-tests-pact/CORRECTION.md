# Correction — Exercice 51 : Contract tests avec Pact

## Consumer test (BFF)

```typescript
// bff-catalog.pact.test.ts
import { PactV3, MatchersV3 } from '@pact-foundation/pact';

const { like, eachLike, uuid, decimal, string } = MatchersV3;

const provider = new PactV3({
  consumer: 'ShopArch-BFF',
  provider: 'ShopArch-CatalogAPI',
  dir: './pacts',
});

describe('BFF → Catalog API contract', () => {
  describe('GET /products', () => {
    it('should return a paginated list of products', async () => {
      await provider
        .given('products exist')
        .uponReceiving('a request for products')
        .withRequest({
          method: 'GET',
          path: '/products',
          query: { limit: '20' },
          headers: { 'X-Tenant-ID': 'tenant-123' },
        })
        .willRespondWith({
          status: 200,
          headers: { 'Content-Type': 'application/json' },
          body: {
            data: eachLike({
              id: uuid(),
              name: string('TypeScript Book'),
              price: decimal(29.99),
              inStock: like(true),
              categoryName: string('Books'),
            }),
            meta: {
              hasNext: like(true),
              nextCursor: like('eyJpZCI6...'),
            },
          },
        });

      await provider.executeTest(async (mockServer) => {
        const client = new CatalogClient(mockServer.url);
        const result = await client.getProducts('tenant-123', { limit: 20 });

        expect(result.data).toBeInstanceOf(Array);
        expect(result.data[0]).toHaveProperty('id');
        expect(result.data[0]).toHaveProperty('name');
        expect(result.data[0]).toHaveProperty('price');
        expect(result.meta).toHaveProperty('hasNext');
      });
    });
  });

  describe('GET /products/:id', () => {
    it('should return a single product', async () => {
      const productId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

      await provider
        .given('product exists', { id: productId })
        .uponReceiving('a request for a specific product')
        .withRequest({
          method: 'GET',
          path: `/products/${productId}`,
          headers: { 'X-Tenant-ID': 'tenant-123' },
        })
        .willRespondWith({
          status: 200,
          body: {
            id: uuid(productId),
            name: string('TypeScript Book'),
            description: string('A comprehensive guide'),
            price: decimal(29.99),
            inStock: like(true),
            stockQuantity: like(42),
            categoryName: string('Books'),
            images: eachLike({ url: string('https://cdn.example.com/img.jpg'), alt: string('cover') }),
          },
        });

      await provider.executeTest(async (mockServer) => {
        const client = new CatalogClient(mockServer.url);
        const product = await client.getProduct(productId, 'tenant-123');

        expect(product.id).toBe(productId);
        expect(typeof product.price).toBe('number');
        expect(product.images).toBeInstanceOf(Array);
      });
    });
  });

  describe('GET /products/:id (not found)', () => {
    it('should return 404 for missing product', async () => {
      const missingId = '00000000-0000-0000-0000-000000000000';

      await provider
        .given('product does not exist', { id: missingId })
        .uponReceiving('a request for a non-existent product')
        .withRequest({
          method: 'GET',
          path: `/products/${missingId}`,
          headers: { 'X-Tenant-ID': 'tenant-123' },
        })
        .willRespondWith({ status: 404 });

      await provider.executeTest(async (mockServer) => {
        const client = new CatalogClient(mockServer.url);
        await expect(client.getProduct(missingId, 'tenant-123')).rejects.toThrow('Not Found');
      });
    });
  });
});
```

## Provider vérification (API Catalogue)

```typescript
// catalog-api.pact-verification.test.ts
import { Verifier } from '@pact-foundation/pact';

describe('Catalog API — Provider verification', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication();
    await app.init();
    await app.listen(0);
  });

  afterAll(() => app.close());

  it('should fulfill all consumer contracts', async () => {
    const verifier = new Verifier({
      providerBaseUrl: await app.getUrl(),
      provider: 'ShopArch-CatalogAPI',
      // Depuis le Pact Broker
      pactBrokerUrl: process.env.PACT_BROKER_URL,
      pactBrokerToken: process.env.PACT_BROKER_TOKEN,
      publishVerificationResult: process.env.CI === 'true',
      providerVersion: process.env.GIT_SHA,
      // Provider states
      stateHandlers: {
        'products exist': async () => {
          await seedProducts([
            { name: 'TypeScript Book', price: 29.99, inStock: true, categoryName: 'Books' },
          ]);
        },
        'product exists': async (params) => {
          await seedProduct({ id: params.id, name: 'TypeScript Book', price: 29.99 });
        },
        'product does not exist': async (params) => {
          await deleteProduct(params.id);
        },
      },
      // Headers requis
      customProviderHeaders: {
        'X-Tenant-ID': 'tenant-123',
      },
    });

    await verifier.verifyProvider();
  });
});
```

## CI/CD intégration

```yaml
# .github/workflows/contract-tests.yml
name: Contract Tests

# Consumer (BFF)
jobs:
  consumer-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci && npm run test:pact
      - name: Publish pact
        run: npx pact-broker publish ./pacts --consumer-app-version=${{ github.sha }} --broker-base-url=$PACT_BROKER_URL

  can-i-deploy:
    needs: consumer-tests
    runs-on: ubuntu-latest
    steps:
      - name: Can I deploy?
        run: |
          npx pact-broker can-i-deploy \
            --pacticipant ShopArch-BFF \
            --version ${{ github.sha }} \
            --to-environment production

# Provider (Catalog API) — dans un autre repo
  provider-verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci && npm run test:pact:verify
```

## Détection des breaking changes

```typescript
// Ajout de champ (safe) — le test consumer passe car il ignore les champs inconnus
// Provider response AVANT : { id, name, price }
// Provider response APRES : { id, name, price, rating }
// → Consumer test PASSE (il ne demande pas 'rating')

// Suppression de champ (breaking) — le provider test echoue
// Consumer attend : { id, name, price, inStock }
// Provider retourne : { id, name, price }  (inStock supprime)
// → Provider verification ECHOUE : "missing field 'inStock'"

// Modification de type (breaking) — le consumer test echoue
// Consumer attend : { price: decimal }
// Provider retourne : { price: "29.99" }  (string au lieu de number)
// → Provider verification ECHOUE : "type mismatch for 'price'"
```

## Alternatives et arbitrages

> En architecture, ta valeur n'est pas de connaître UNE solution,
> mais de savoir POURQUOI tu choisis celle-ci plutôt qu'une autre.

### Option A : Pact (Consumer-Driven Contract Tests) — solution présentée
**Quand la choisir :** Le consumer définit ses attentes, le provider s'engage à les respecter. Idéal quand le consumer a plus de pouvoir sur le contrat (front ↔ backend, BFF ↔ services).
**Limites :** Overhead de setup (Pact Broker, CI pipeline), le consumer doit écrire les tests en premier, ne vérifie pas la logique métier (seulement la forme du contrat).

### Option B : OpenAPI schema validation
**Quand la choisir :** Le provider définit le contrat (spec-first), validation automatique en CI (Spectral, Prism), documentation vivante, génération de clients type-safe.
**Limites :** Ne valide que la forme (types, required fields), pas les interactions réelles, ne détecte pas les breaking changes subtils (valeur par défaut changée).

### Option C : gRPC / Protobuf
**Quand la choisir :** Contrat binaire strict (Protobuf), backward compatibility intégrée (field numbers), génération de code automatique, communication inter-services haute performance.
**Limites :** Pas utilisable directement depuis un navigateur, tooling moins accessible, Protobuf non human-readable pour le debugging.

### Option D : GraphQL schema checks
**Quand la choisir :** API GraphQL, schema comme contrat unique, outils de diff de schema (Apollo Studio, GraphQL Inspector), breaking change detection automatique.
**Limites :** Uniquement pour GraphQL, ne teste pas le comportement des resolvers, dépendance à l'outillage GraphQL.

### Matrice de décision
| Critère | Pact | OpenAPI | gRPC/Protobuf | GraphQL schema |
|---|---|---|---|---|
| Qui définit le contrat ? | Consumer | Provider | Provider | Provider |
| Détection breaking changes | Excellente | Bonne | Excellente | Excellente |
| Test d'interactions réelles | Oui | Non | Non | Non |
| Setup complexity | Élevée | Faible | Moyenne | Faible |
| Polyglotte | Oui | Oui | Oui | GraphQL only |

### Pour ShopArch, on choisit...
Pact pour les contrats BFF ↔ API car le front-office (consumer) a des besoins spécifiques de données. On complète avec une validation OpenAPI en CI (Spectral lint sur le fichier `openapi.yaml`) pour s'assurer que le schéma respecte les conventions REST. Les deux approches sont complémentaires : Pact teste les interactions, OpenAPI valide la forme.

---

## Ce que tu aurais pu oublier

### 1. Tester contre le provider reel
```
FAUX — le consumer test se connecte a l'API reelle (fragile, lent)
CORRECT — le consumer teste contre le mock Pact (local, rapide, deterministe)
         Le contrat genere est ensuite verifie cote provider
```

### 2. Matchers trop stricts
```
FAUX — attendre des valeurs exactes dans le contrat ({ name: "TypeScript Book" })
CORRECT — utiliser des matchers (like, string, decimal, uuid)
         Le contrat verifie la STRUCTURE, pas les valeurs exactes
```

### 3. Pas de provider states
```
FAUX — le provider n'a pas de setup pour les tests (DB vide → echec)
CORRECT — provider states pour creer les donnees necessaires a chaque interaction
```

### 4. Pas de "can-i-deploy"
```
FAUX — deployer le consumer sans verifier que le provider a valide le contrat
CORRECT — can-i-deploy dans le CI bloque le deploy si le contrat n'est pas verifie
```
