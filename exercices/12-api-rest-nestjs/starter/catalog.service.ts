// TODO: Service métier pour le catalogue
//
// Méthodes à implémenter :
//   findAll(cursor?: string, limit?: number) → { products: Product[], nextCursor: string | null }
//   findOne(id: string) → Product | null
//   create(dto: CreateProductDto) → Product
//   update(id: string, dto: UpdateProductDto) → Product
//   remove(id: string) → void
//
// Rappel NestJS :
//   @Injectable()
//   constructor(@InjectRepository(Product) private repo: Repository<Product>) {}
//
// Copie ce fichier dans projet-fil-rouge/apps/api/src/catalog/

import { Injectable } from '@nestjs/common';

export interface CreateProductDto {
  name: string;
  description?: string;
  price: number;  // en centimes
  stock: number;
}

export interface UpdateProductDto {
  name?: string;
  description?: string;
  price?: number;
  stock?: number;
}

@Injectable()
export class CatalogService {
  // TODO: injecter le Repository<Product>

  async findAll(cursor?: string, limit = 20) {
    // TODO: pagination cursor-based
    // SELECT * FROM products WHERE id > cursor ORDER BY id ASC LIMIT limit + 1
    // Si résultat.length > limit → il y a une page suivante
    throw new Error('Not implemented');
  }

  async findOne(id: string) {
    // TODO
    throw new Error('Not implemented');
  }

  async create(dto: CreateProductDto) {
    // TODO
    throw new Error('Not implemented');
  }

  async update(id: string, dto: UpdateProductDto) {
    // TODO
    throw new Error('Not implemented');
  }

  async remove(id: string) {
    // TODO
    throw new Error('Not implemented');
  }
}
