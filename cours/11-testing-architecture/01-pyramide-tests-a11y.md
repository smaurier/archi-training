# Cours 73 — Pyramide de tests & Accessibilité

> **Objectif** : Maîtriser la pyramide de tests (unit → intégration → E2E), savoir quand inverser la pyramide (honeycomb), intégrer les tests d'accessibilité (axe-core, WCAG 2.1 AA), et définir une stratégie de test pour un projet e-commerce.

---

## Rappel du cours précédent

<details>
<summary>1. Qu'est-ce que l'Infrastructure as Code et pourquoi est-ce mieux que le click-ops ?</summary>

L'IaC traite l'infrastructure comme du code versionne dans git. Avantages : **reproductible** (même commande = même infra), **reviewable** (PR avant apply), **rollback** (git revert), **documentation** (le code EST la doc). Le click-ops (console) n'est pas reproductible, pas auditable, et le drift est invisible.
</details>

<details>
<summary>2. Qu'est-ce que le GitOps et comment fonctionne ArgoCD ?</summary>

GitOps utilise un repo git comme **source of truth** pour l'état desire du cluster. ArgoCD **watch** le repo, détecté les changements, et **synchronise** le cluster pour converger vers l'état dans git. Self-healing : si quelqu'un modifie manuellement le cluster, ArgoCD le remet en conformite. Rollback = git revert.
</details>

---

## Analogie — Le filet de sécurité du trapeziste

Les tests sont le filet sous le trapeziste :
- **Unit tests** (filet pres du trapeze) : attrapent les chutes courtes — rapides, précis, nombreux
- **Intégration tests** (filet a mi-hauteur) : attrapent les problèmes de coordination entre trapezistes
- **E2E tests** (filet au sol) : dernier rempart — lents mais couvrent tout le spectacle

Sans filet, le trapeziste n'ose pas innover. Avec filet, il peut tenter des figures audacieuses (refactoring, nouvelles features).

---

## Théorie

### 1. Pyramide de tests

```
        ╱╲
       ╱  ╲       E2E (peu, lents, fragiles)
      ╱ E2E╲      → Parcours utilisateur critiques
     ╱──────╲     → 5-10 scenarios max
    ╱        ╲
   ╱Integration╲  Integration (moderement, moyens)
  ╱────────────╲  → API endpoints, DB queries
 ╱              ╲ → ~30% de la suite
╱    Unit Tests  ╲ Unit (beaucoup, rapides, stables)
╱────────────────╲ → Logique metier pure
                   → ~60% de la suite
```

| Niveau | Vitesse | Stabilite | Cout maintenance | Quoi tester |
|---|---|---|---|---|
| **Unit** | <1ms | Très stable | Faible | Logique métier, calculs, validations |
| **Intégration** | 100ms-1s | Stable | Moyen | API routes, DB queries, cache |
| **E2E** | 5-30s | Fragile | Eleve | Parcours utilisateur critiques |

### 2. Quand inverser la pyramide (Honeycomb)

```
Honeycomb (Martin Fowler — microservices) :

      ╱╲
     ╱  ╲        E2E (peu)
    ╱────╲
   ╱      ╲
  ╱        ╲      Integration (BEAUCOUP)
 ╱ Integr.  ╲    → Le gros de la suite
╱────────────╲
╱  Unit (peu) ╲  → Seulement la logique complexe

Quand : services minces (peu de logique pure, beaucoup d'I/O)
Pourquoi : un unit test qui mock tout ne teste rien d'utile
```

### 3. Accessibilité — WCAG 2.1 AA

| Critère | Exigence | Test |
|---|---|---|
| **Perceivable** | Texte alternatif sur les images | axe-core `image-alt` |
| **Operable** | Navigation clavier complete | Tab order, skip links |
| **Understandable** | Messages d'erreur explicites | Labels sur les inputs |
| **Robust** | HTML valide, ARIA correct | Validation axe-core |

```
Checklist minimum :
□ Skip link vers le contenu principal
□ Tous les <img> ont un alt (ou alt="" si decoratif)
□ Focus visible sur tous les elements interactifs
□ Touch targets ≥ 44×44px (WCAG 2.5.8)
□ Contraste ≥ 4.5:1 (texte normal) / 3:1 (grand texte)
□ prefers-reduced-motion respecte
□ Formulaires : labels associes, erreurs annoncees
□ Focus trap dans les modales
```

### 4. 3 niveaux de tests E2E

```
Niveau 1 : User flows critiques
  → Login, recherche, ajout panier, checkout, paiement
  → 5-10 scenarios max

Niveau 2 : SEO meta tags
  → Verifier <title>, <meta description>, canonical, hreflang
  → Open Graph, structured data

Niveau 3 : Security headers
  → CSP present, X-Frame-Options, HSTS
  → Health checks K8s (liveness, readiness)
```

### 5. Test coverage — la bonne metrique

```
MAUVAIS objectif : "100% de coverage"
  → Teste les getters/setters, pas la logique
  → Faux sentiment de securite

BON objectif : "coverage des branches critiques"
  → Logique metier : 90%+
  → Utilitaires : 80%+
  → Controllers : 0% unit (testes en integration)
  → Generated code : exclus
```

---

## Pratique

### Test unitaire — logique métier pure

```typescript
// domain/cart.test.ts
import { describe, it, expect } from 'vitest';
import { Cart } from './cart';

describe('Cart', () => {
  it('calcule le total avec reduction', () => {
    const cart = new Cart();
    cart.addItem({ productId: 'p1', price: 100, quantity: 2 });
    cart.addItem({ productId: 'p2', price: 50, quantity: 1 });
    cart.applyDiscount({ type: 'percentage', value: 10 });

    expect(cart.getTotal()).toBe(225); // (200 + 50) * 0.9
  });

  it('empeche un panier avec plus de 50 articles', () => {
    const cart = new Cart();
    for (let i = 0; i < 50; i++) {
      cart.addItem({ productId: `p${i}`, price: 10, quantity: 1 });
    }

    expect(() =>
      cart.addItem({ productId: 'p51', price: 10, quantity: 1 }),
    ).toThrow('Cart cannot exceed 50 items');
  });
});
```

### Test d'intégration — API endpoint

```typescript
// order.integration.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../app.module';

describe('POST /api/orders', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
    await app.init();
  });

  afterAll(() => app.close());

  it('cree une commande et retourne 201', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/orders')
      .set('Authorization', `Bearer ${testToken}`)
      .send({ items: [{ productId: 'p1', quantity: 2 }] })
      .expect(201);

    expect(response.body).toMatchObject({
      id: expect.any(String),
      status: 'created',
      items: expect.arrayContaining([
        expect.objectContaining({ productId: 'p1' }),
      ]),
    });
  });

  it('retourne 422 si le panier est vide', async () => {
    await request(app.getHttpServer())
      .post('/api/orders')
      .set('Authorization', `Bearer ${testToken}`)
      .send({ items: [] })
      .expect(422);
  });
});
```

### Test d'accessibilité avec Playwright + axe-core

```typescript
// a11y.e2e.test.ts
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Accessibility', () => {
  test('page produit respecte WCAG 2.1 AA', async ({ page }) => {
    await page.goto('/products/t-shirt-bio');

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();

    expect(results.violations).toEqual([]);
  });

  test('navigation clavier complete', async ({ page }) => {
    await page.goto('/');

    // Tab vers le skip link
    await page.keyboard.press('Tab');
    const skipLink = page.locator('[data-testid="skip-link"]');
    await expect(skipLink).toBeFocused();

    // Tab vers le menu
    await page.keyboard.press('Tab');
    const firstMenuLink = page.locator('nav a').first();
    await expect(firstMenuLink).toBeFocused();
  });

  test('modale a un focus trap', async ({ page }) => {
    await page.goto('/products');
    await page.click('[data-testid="open-filter"]');

    // Le focus est dans la modale
    const modal = page.locator('[role="dialog"]');
    await expect(modal).toBeVisible();

    // Tab ne sort pas de la modale
    const focusableElements = modal.locator(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    const count = await focusableElements.count();

    for (let i = 0; i < count + 1; i++) {
      await page.keyboard.press('Tab');
    }

    // Le focus est toujours dans la modale
    const focused = page.locator(':focus');
    await expect(modal).toContainText(await focused.textContent() ?? '');
  });
});
```

---

## Résumé

1. **Pyramide** : 60% unit (rapides, stables) + 30% intégration (API, DB) + 10% E2E (parcours critiques)
2. **Honeycomb** : inverser pour les microservices minces — plus d'intégration, moins d'unit tests inutiles
3. **Accessibilité WCAG 2.1 AA** : axe-core + Playwright, skip links, focus visible, contraste 4.5:1, touch targets 44px
4. **3 niveaux E2E** : user flows critiques + SEO meta tags + security headers
5. **Coverage** : viser les branches critiques (logique métier 90%+), pas le 100% aveugle

---

> **Prochain cours** : [Cours 74 — Test doubles & patterns](./02-test-doubles-patterns.md)

---

> **Lien fil rouge — ShopArch**
>
> - Définis la pyramide de tests ShopArch : 70% unit, 20% intégration, 5% contract, 5% E2E
> - Lance l'audit a11y axe-core sur les pages principales
> - Exercice(s) associé(s) : `exercices/50-strategie-test-ecommerce/`
> - Checkpoint : Module 11, critère 1-2
