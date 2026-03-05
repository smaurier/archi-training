# Correction — Exercice 06 : Vertical Slice d'un module

## Entité et Repository (partages au module)

```typescript
// wishlist.entity.ts
export interface WishlistItem {
  id: string;
  userId: string;
  productId: string;
  addedAt: Date;
}

// wishlist.repository.ts
export interface WishlistRepository {
  findByUserId(userId: string): Promise<WishlistItem[]>;
  findByUserAndProduct(userId: string, productId: string): Promise<WishlistItem | null>;
  add(item: WishlistItem): Promise<WishlistItem>;
  remove(userId: string, productId: string): Promise<boolean>;
}
```

## Feature : add-to-wishlist

```typescript
// add-to-wishlist/add-to-wishlist.dto.ts
import { IsUUID } from 'class-validator';

export class AddToWishlistDto {
  @IsUUID('4')
  productId: string;
}

// add-to-wishlist/add-to-wishlist.handler.ts
import { Controller, Post, Body, Req, ConflictException } from '@nestjs/common';
import { AddToWishlistDto } from './add-to-wishlist.dto';
import { WishlistRepository } from '../wishlist.repository';
import { WishlistItem } from '../wishlist.entity';

@Controller('api/wishlists/items')
export class AddToWishlistHandler {
  constructor(private readonly repo: WishlistRepository) {}

  @Post()
  async handle(@Body() dto: AddToWishlistDto, @Req() req: any): Promise<WishlistItem> {
    const userId = req.user.id;

    // Verifier les doublons
    const existing = await this.repo.findByUserAndProduct(userId, dto.productId);
    if (existing) {
      throw new ConflictException('Product already in wishlist');
    }

    return this.repo.add({
      id: crypto.randomUUID(),
      userId,
      productId: dto.productId,
      addedAt: new Date(),
    });
  }
}
```

## Feature : remove-from-wishlist

```typescript
// remove-from-wishlist/remove-from-wishlist.handler.ts
import { Controller, Delete, Param, Req, NotFoundException } from '@nestjs/common';
import { WishlistRepository } from '../wishlist.repository';

@Controller('api/wishlists/items')
export class RemoveFromWishlistHandler {
  constructor(private readonly repo: WishlistRepository) {}

  @Delete(':productId')
  async handle(@Param('productId') productId: string, @Req() req: any): Promise<void> {
    const removed = await this.repo.remove(req.user.id, productId);
    if (!removed) {
      throw new NotFoundException('Product not found in wishlist');
    }
  }
}
```

## Feature : get-wishlist

```typescript
// get-wishlist/get-wishlist.handler.ts
import { Controller, Get, Req } from '@nestjs/common';
import { WishlistRepository } from '../wishlist.repository';
import { WishlistItem } from '../wishlist.entity';

@Controller('api/wishlists')
export class GetWishlistHandler {
  constructor(private readonly repo: WishlistRepository) {}

  @Get()
  async handle(@Req() req: any): Promise<WishlistItem[]> {
    const items = await this.repo.findByUserId(req.user.id);
    // Tri par date d'ajout decroissante (plus recent en premier)
    return items.sort((a, b) => b.addedAt.getTime() - a.addedAt.getTime());
  }
}
```

## InMemoryWishlistRepository

```typescript
// infra/in-memory-wishlist.repository.ts
import { WishlistRepository } from '../wishlist.repository';
import { WishlistItem } from '../wishlist.entity';

export class InMemoryWishlistRepository implements WishlistRepository {
  private items: WishlistItem[] = [];

  async findByUserId(userId: string): Promise<WishlistItem[]> {
    return this.items.filter((i) => i.userId === userId);
  }

  async findByUserAndProduct(userId: string, productId: string): Promise<WishlistItem | null> {
    return this.items.find((i) => i.userId === userId && i.productId === productId) || null;
  }

  async add(item: WishlistItem): Promise<WishlistItem> {
    this.items.push(item);
    return item;
  }

  async remove(userId: string, productId: string): Promise<boolean> {
    const index = this.items.findIndex(
      (i) => i.userId === userId && i.productId === productId,
    );
    if (index === -1) return false;
    this.items.splice(index, 1);
    return true;
  }

  // Helper pour les tests
  clear(): void {
    this.items = [];
  }
}
```

## Tests

```typescript
// add-to-wishlist/add-to-wishlist.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { AddToWishlistHandler } from './add-to-wishlist.handler';
import { InMemoryWishlistRepository } from '../infra/in-memory-wishlist.repository';

describe('AddToWishlist', () => {
  let handler: AddToWishlistHandler;
  let repo: InMemoryWishlistRepository;

  beforeEach(() => {
    repo = new InMemoryWishlistRepository();
    handler = new AddToWishlistHandler(repo);
  });

  it('ajoute un produit a la wishlist', async () => {
    const item = await handler.handle(
      { productId: 'prod-1' },
      { user: { id: 'user-1' } },
    );

    expect(item.productId).toBe('prod-1');
    expect(item.userId).toBe('user-1');

    const wishlist = await repo.findByUserId('user-1');
    expect(wishlist).toHaveLength(1);
  });

  it('rejette un doublon', async () => {
    await handler.handle({ productId: 'prod-1' }, { user: { id: 'user-1' } });

    await expect(
      handler.handle({ productId: 'prod-1' }, { user: { id: 'user-1' } }),
    ).rejects.toThrow('already in wishlist');
  });
});

// get-wishlist/get-wishlist.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { GetWishlistHandler } from './get-wishlist.handler';
import { InMemoryWishlistRepository } from '../infra/in-memory-wishlist.repository';

describe('GetWishlist', () => {
  let handler: GetWishlistHandler;
  let repo: InMemoryWishlistRepository;

  beforeEach(() => {
    repo = new InMemoryWishlistRepository();
    handler = new GetWishlistHandler(repo);
  });

  it('retourne la wishlist triee par date (recent en premier)', async () => {
    await repo.add({
      id: '1', userId: 'user-1', productId: 'old',
      addedAt: new Date('2024-01-01'),
    });
    await repo.add({
      id: '2', userId: 'user-1', productId: 'recent',
      addedAt: new Date('2024-06-01'),
    });

    const result = await handler.handle({ user: { id: 'user-1' } });

    expect(result[0].productId).toBe('recent');
    expect(result[1].productId).toBe('old');
  });
});
```

## Comparaison Vertical Slice vs Layered

| Critère | Vertical Slice | Layered |
|---|---|---|
| Fichiers touches pour modifier "add" | 1-2 (handler + DTO) | 3+ (controller + service + repo + DTO) |
| Merge conflicts | Rares (chaque dev sur sa feature) | Fréquents (tous dans le meme service) |
| Découverte | Structure = features métier | Structure = couches techniques |
| Duplication | Legere (chaque handler est autonome) | Faible (service partage) |
| Test | Isole par feature | Souvent un gros test du service |

## Ce que tu aurais pu oublier

### 1. Créer un service partage WishlistService

En vertical slice, chaque handler EST le service. Pas besoin d'un intermédiaire qui ne fait que déléguer.

### 2. Oublier la vérification de doublon

Sans verif, `add-to-wishlist` accepte le meme produit 2 fois → données incoherentes.

### 3. Ne pas trier dans get-wishlist

Sans tri explicite, l'ordre dépend de la DB (non deterministe). Toujours trier explicitement.

### 4. Confondre vertical slice et "un controller par fichier"

Le vertical slice n'est pas juste un découpage de fichiers — c'est un découpage par **feature métier**. Chaque slice peut avoir sa propre logique, ses propres validations, et son propre test.
