// bff.test.ts — Tests pour BFFAggregator
// Lance: pnpm test:ex31 (depuis exercices/)

import { describe, it, expect, vi } from 'vitest';
import { BFFAggregator } from './bff.js';
import type {
  IProductService, ICartService, IUserService, ICategoryService,
  Product, Cart, UserProfile, Category,
} from './bff.js';

const makeProduct = (): Product => ({ id: 'p1', name: 'Widget', price: 1000, imageUrl: '/p1.jpg', stock: 5 });
const makeCart = (): Cart => ({ items: [{ productId: 'p1', quantity: 1, unitPrice: 1000 }], total: 1000, itemCount: 1 });
const makeUser = (): UserProfile => ({ id: 'u1', name: 'Alice', email: 'alice@test.com', loyaltyPoints: 100 });
const makeCategory = (): Category => ({ id: 'c1', name: 'Electronics', slug: 'electronics', productCount: 10 });

const makeServices = () => ({
  products: { getPopular: vi.fn().mockResolvedValue([makeProduct()]), getByIds: vi.fn() } satisfies IProductService,
  cart: { getCart: vi.fn().mockResolvedValue(makeCart()) } satisfies ICartService,
  users: { getProfile: vi.fn().mockResolvedValue(makeUser()) } satisfies IUserService,
  categories: { getAll: vi.fn().mockResolvedValue([makeCategory()]) } satisfies ICategoryService,
});

describe('BFFAggregator.getHomePage', () => {
  it('retourne une réponse complète quand tous les services réussissent', async () => {
    const s = makeServices();
    const bff = new BFFAggregator(s.products, s.cart, s.users, s.categories);

    const result = await bff.getHomePage('u1');

    expect(result.user?.name).toBe('Alice');
    expect(result.cart?.total).toBe(1000);
    expect(result.popularProducts).toHaveLength(1);
    expect(result.categories).toHaveLength(1);
    expect(result.meta.fetchedAt).toBeGreaterThan(0);
  });

  it('exécute tous les services EN PARALLÈLE', async () => {
    const delays: number[] = [];
    const delayed = <T>(val: T, ms: number) =>
      new Promise<T>(res => setTimeout(() => { delays.push(Date.now()); res(val); }, ms));

    const s = makeServices();
    s.products.getPopular = vi.fn().mockReturnValue(delayed([makeProduct()], 50));
    s.cart.getCart = vi.fn().mockReturnValue(delayed(makeCart(), 50));
    s.users.getProfile = vi.fn().mockReturnValue(delayed(makeUser(), 50));
    s.categories.getAll = vi.fn().mockReturnValue(delayed([makeCategory()], 50));

    const start = Date.now();
    await new BFFAggregator(s.products, s.cart, s.users, s.categories).getHomePage('u1');
    const elapsed = Date.now() - start;

    // Si parallèle, ça prend ~50ms, pas 200ms
    expect(elapsed).toBeLessThan(150);
  });

  it('retourne null pour user si le service échoue (resilience)', async () => {
    const s = makeServices();
    s.users.getProfile = vi.fn().mockRejectedValue(new Error('Service down'));
    const bff = new BFFAggregator(s.products, s.cart, s.users, s.categories);

    const result = await bff.getHomePage('u1');

    expect(result.user).toBeNull();
    expect(result.popularProducts).toHaveLength(1); // autres services OK
  });

  it('retourne [] pour les catégories si le service échoue', async () => {
    const s = makeServices();
    s.categories.getAll = vi.fn().mockRejectedValue(new Error('DB error'));
    const bff = new BFFAggregator(s.products, s.cart, s.users, s.categories);

    const result = await bff.getHomePage('u1');
    expect(result.categories).toEqual([]);
  });

  it('liste les services utilisés dans meta.servicesUsed', async () => {
    const s = makeServices();
    s.users.getProfile = vi.fn().mockRejectedValue(new Error('down'));
    const bff = new BFFAggregator(s.products, s.cart, s.users, s.categories);

    const result = await bff.getHomePage('u1');

    // 'users' a échoué → pas dans servicesUsed
    expect(result.meta.servicesUsed).not.toContain('users');
    expect(result.meta.servicesUsed.length).toBeGreaterThanOrEqual(2);
  });
});
