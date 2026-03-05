# Cours 75 — Contract Testing

> **Objectif** : Comprendre le consumer-driven contract testing avec Pact, implémenter la vérification provider, et savoir quand les contract tests remplacent les tests d'intégration.

---

## Rappel du cours précédent

<details>
<summary>1. Quels sont les 5 types de test doubles ?</summary>

1. **Dummy** : remplit un parametre, jamais utilise
2. **Stub** : retourne une valeur predeterminee
3. **Spy** : enregistre les appels (wraps real)
4. **Mock** : comportement programme + vérification stricte
5. **Fake** : implémentation simplifiee mais fonctionnelle (ex: InMemoryRepository)
</details>

<details>
<summary>2. Pourquoi utiliser MSW plutot que mocker axios/fetch directement ?</summary>

MSW intercepte les **vraies requêtes HTTP** au niveau du réseau — il teste le chemin complet (serialisation, headers, status codes, body parsing). Mocker axios/fetch ne teste que l'appel de la fonction, pas le comportement HTTP reel. De plus, MSW fonctionne de la meme manière en tests Node.js et dans le navigateur.
</details>

---

## Analogie — Le contrat entre le restaurateur et le fournisseur

Un restaurateur commande "10 kg de tomates cerises bio, calibre 25-30mm" au fournisseur. C'est un **contrat** :
- Le **consumer** (restaurateur) définit ce dont il a besoin (format, quantité, qualité)
- Le **provider** (fournisseur) s'engage a livrer selon le contrat
- Si le fournisseur livre des tomates de 50mm, le contrat est brise → alerte

Le contract testing fait pareil entre services : le front (consumer) définit la forme des réponses attendues, le back (provider) vérifié qu'il respecte ce contrat.

---

## Théorie

### 1. Le problème que resolvent les contract tests

```
Sans contract tests :
  Front (Consumer)         API (Provider)
  ──────────────          ─────────────
  Attend { name: string }   Renvoie { name: string }
                              ↓
  Un dev renomme name → title
                              ↓
  Front casse en production ! (le test d'integration ne tournait pas)

Avec contract tests :
  Front definit : "je m'attends a { name: string }"
  → Contrat genere (fichier Pact)
  → API verifie : "est-ce que ma reponse contient { name: string } ?"
  → Le rename name → title casse le contract test AVANT le merge
```

### 2. Consumer-driven contract testing (Pact)

```
Flux Pact :

1. Consumer ecrit un test qui definit ses attentes
   → Genere un "pact file" (JSON)

2. Pact file est partage (Pact Broker ou fichier)

3. Provider execute le pact file contre sa vraie API
   → Verification : la reponse reelle matche-t-elle le contrat ?

┌──────────┐  Pact file  ┌──────────┐  Verify  ┌──────────┐
│ Consumer │ ──────────> │  Pact    │ ───────> │ Provider │
│ (Front)  │             │  Broker  │          │ (API)    │
└──────────┘             └──────────┘          └──────────┘
```

### 3. Contract testing vs Intégration testing

| Critère | Contract test | Intégration test |
|---|---|---|
| Quoi | La forme de la réponse (schema) | Le comportement complet |
| Vitesse | Rapide (pas de réseau reel) | Lent (services up) |
| Couplage | Faible (consumer définit ses besoins) | Fort (services interconnectes) |
| Scope | Inter-service boundaries | End-to-end flows |
| Maintenance | Contrats evolues incrementalement | Fragile aux changements |

### 4. Schema testing (alternative légère)

```
Si Pact est trop lourd, une alternative :
  → Valider le schema OpenAPI automatiquement

Provider genere une spec OpenAPI
Consumer valide que ses requetes matchent la spec
CI verifie que la spec n'a pas de breaking changes

Outils : openapi-diff, spectral, dredd
```

### 5. Quand utiliser les contract tests

```
OUI :
  ✓ Plusieurs consumers pour le meme API (web + mobile + tiers)
  ✓ Equipes separees (front ≠ back)
  ✓ API publique avec des consumers externes
  ✓ Microservices avec des interfaces bien definies

NON :
  ✗ Monolithe avec 1 seul consumer
  ✗ Equipe full-stack qui gere front + back
  ✗ Prototype / MVP (trop de churn)
```

---

## Pratique

### Consumer test (Pact — côté front)

```typescript
// products.consumer.test.ts
import { PactV3 } from '@pact-foundation/pact';
import { describe, it, expect } from 'vitest';

const provider = new PactV3({
  consumer: 'WebFrontend',
  provider: 'ProductAPI',
  dir: './pacts', // Ou sauvegarder le pact file
});

describe('Product API — Consumer Contract', () => {
  it('retourne la liste des produits', async () => {
    // 1. Definir les attentes du consumer
    provider
      .given('des produits existent')
      .uponReceiving('une requete GET /api/products')
      .withRequest({
        method: 'GET',
        path: '/api/products',
        headers: { Accept: 'application/json' },
      })
      .willRespondWith({
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: {
          'hydra:member': [
            {
              id: like('uuid-123'),
              name: like('T-shirt'),
              price: like(29.9),
            },
          ],
          'hydra:totalItems': like(1),
        },
      });

    // 2. Executer le test avec le mock server Pact
    await provider.executeTest(async (mockServer) => {
      const response = await fetch(`${mockServer.url}/api/products`, {
        headers: { Accept: 'application/json' },
      });
      const data = await response.json();

      expect(data['hydra:member']).toHaveLength(1);
      expect(data['hydra:member'][0]).toHaveProperty('name');
      expect(data['hydra:member'][0]).toHaveProperty('price');
    });
    // → Genere un pact file dans ./pacts/
  });
});
```

### Provider vérification (Pact — côté API)

```typescript
// products.provider.test.ts
import { Verifier } from '@pact-foundation/pact';
import { describe, it, beforeAll, afterAll } from 'vitest';

describe('Product API — Provider Contract', () => {
  let app: INestApplication;

  beforeAll(async () => {
    // Demarrer la vraie API
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
    await app.init();
  });

  afterAll(() => app.close());

  it('respecte le contrat avec WebFrontend', async () => {
    const verifier = new Verifier({
      providerBaseUrl: 'http://localhost:3000',
      pactUrls: ['./pacts/WebFrontend-ProductAPI.json'],

      // State handlers : preparer les donnees pour chaque "given"
      stateHandlers: {
        'des produits existent': async () => {
          await seedTestProducts();
        },
      },
    });

    await verifier.verifyProvider();
  });
});
```

### OpenAPI schema validation (alternative légère)

```typescript
// schema.validation.test.ts
import { describe, it, expect } from 'vitest';
import SwaggerParser from '@apidevtools/swagger-parser';

describe('OpenAPI Schema', () => {
  it('la spec est valide', async () => {
    // Valider la syntaxe de la spec
    const api = await SwaggerParser.validate('./openapi.yaml');
    expect(api.info.title).toBeDefined();
  });

  it('pas de breaking changes', async () => {
    // Comparer la spec actuelle avec la version precedente
    const diff = await compareOpenApiSpecs(
      './openapi.yaml',       // Current
      './openapi.prev.yaml',  // Previous (from main branch)
    );

    // Pas de champs supprimes, pas de types changes
    expect(diff.breakingChanges).toHaveLength(0);
  });
});
```

---

## Resume

1. **Contract testing** : le consumer définit ses attentes, le provider vérifié qu'il les respecte — détecté les breaking changes AVANT le merge
2. **Pact** : consumer généré un pact file → provider vérifié contre sa vraie API — state handlers pour les fixtures
3. **Schema testing** (alternative) : valider la spec OpenAPI, détecter les breaking changes avec openapi-diff
4. **Contract ≠ Intégration** : le contract teste la FORME (schema), l'intégration teste le COMPORTEMENT (logique)
5. **Quand** : plusieurs consumers, équipes séparées, API publique — **pas** pour un monolithe full-stack

---

> **Prochain cours** : [Cours 76 — Load Testing & Testing in Production](./04-load-testing-production.md)

---

> **Lien fil rouge — ShopArch**
>
> - Implémente les contract tests Pact entre le BFF et l'API ShopArch
> - Configure le Pact Broker en CI pour vérifier les contrats à chaque PR
> - Exercice(s) associé(s) : `exercices/51-contract-tests-pact/`
> - Checkpoint : Module 11, critère 3
