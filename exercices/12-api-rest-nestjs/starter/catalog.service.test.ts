// catalog.service.test.ts — Tests unitaires pour CatalogService
// Lance: pnpm test:ex12 (depuis exercices/)
//
// Nota: Ce test contourne l'injection de dépendances NestJS
// en injectant le repository directement via une propriété.
// Pattern viable pour tous les services NestJS testés en isolation.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CatalogService } from './catalog.service.js';
import type { CreateProductDto, UpdateProductDto } from './catalog.service.js';

// Simule Repository<Product> de TypeORM
const makeRepo = () => ({
  find: vi.fn(),
  findOne: vi.fn(),
  create: vi.fn(),
  save: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  createQueryBuilder: vi.fn(),
});

const makeProduct = (overrides = {}) => ({
  id: 'uuid-1',
  name: 'Widget',
  description: 'A widget',
  price: 1999,
  stock: 10,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

function makeService() {
  const repo = makeRepo();
  const service = new CatalogService();
  // Injection directe (bypass NestJS DI pour les tests unitaires)
  (service as unknown as { repo: typeof repo }).repo = repo;
  return { service, repo };
}

describe('CatalogService.findOne', () => {
  it('retourne un produit par son id', async () => {
    const { service, repo } = makeService();
    const product = makeProduct();
    repo.findOne.mockResolvedValue(product);

    const result = await service.findOne('uuid-1');

    expect(result).toEqual(product);
    expect(repo.findOne).toHaveBeenCalledWith({ where: { id: 'uuid-1' } });
  });

  it('retourne null si le produit est introuvable', async () => {
    const { service, repo } = makeService();
    repo.findOne.mockResolvedValue(null);

    const result = await service.findOne('unknown');

    expect(result).toBeNull();
  });
});

describe('CatalogService.create', () => {
  it('crée et sauvegarde un produit', async () => {
    const { service, repo } = makeService();
    const dto: CreateProductDto = { name: 'New Widget', price: 999, stock: 5 };
    const created = makeProduct({ name: 'New Widget', price: 999, stock: 5 });

    repo.create.mockReturnValue(created);
    repo.save.mockResolvedValue(created);

    const result = await service.create(dto);

    expect(repo.create).toHaveBeenCalledWith(dto);
    expect(repo.save).toHaveBeenCalledWith(created);
    expect(result).toEqual(created);
  });
});

describe('CatalogService.update', () => {
  it('met à jour et retourne le produit modifié', async () => {
    const { service, repo } = makeService();
    const existing = makeProduct();
    const dto: UpdateProductDto = { name: 'Updated', price: 2500 };
    const updated = { ...existing, ...dto };

    repo.findOne.mockResolvedValue(existing);
    repo.save.mockResolvedValue(updated);

    const result = await service.update('uuid-1', dto);

    expect(repo.save).toHaveBeenCalled();
    expect(result).toMatchObject({ name: 'Updated', price: 2500 });
  });

  it('lève une erreur si le produit est introuvable', async () => {
    const { service, repo } = makeService();
    repo.findOne.mockResolvedValue(null);

    await expect(service.update('unknown', { name: 'x' })).rejects.toThrow();
  });
});

describe('CatalogService.remove', () => {
  it('supprime le produit par id', async () => {
    const { service, repo } = makeService();
    repo.delete.mockResolvedValue({ affected: 1 });

    await service.remove('uuid-1');

    expect(repo.delete).toHaveBeenCalledWith('uuid-1');
  });
});

describe('CatalogService.findAll — pagination cursor-based', () => {
  it('retourne une page de produits avec nextCursor si plus de résultats', async () => {
    const { service, repo } = makeService();
    // Simule limit=2 → retourne 3 produits (limit + 1) → il y a une page suivante
    const prods = [makeProduct({ id: 'a' }), makeProduct({ id: 'b' }), makeProduct({ id: 'c' })];
    repo.find.mockResolvedValue(prods);

    const result = await service.findAll(undefined, 2);

    expect(result.products).toHaveLength(2);
    expect(result.nextCursor).toBe('b'); // id du dernier élément retourné
  });

  it('retourne nextCursor = null si pas de page suivante', async () => {
    const { service, repo } = makeService();
    const prods = [makeProduct({ id: 'a' }), makeProduct({ id: 'b' })];
    repo.find.mockResolvedValue(prods);

    const result = await service.findAll(undefined, 5);

    expect(result.products).toHaveLength(2);
    expect(result.nextCursor).toBeNull();
  });
});
