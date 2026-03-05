// TODO: Controller REST pour le catalogue
//
// Endpoints :
//   GET    /products          → findAll (query params: cursor, limit)
//   GET    /products/:id      → findOne
//   POST   /products          → create
//   PATCH  /products/:id      → update
//   DELETE /products/:id      → remove
//
// Rappel décorateurs NestJS :
//   @Controller('products')
//   @Get(), @Get(':id'), @Post(), @Patch(':id'), @Delete(':id')
//   @Body(), @Param('id'), @Query()
//   @HttpCode(HttpStatus.NO_CONTENT) pour DELETE
//
// Copie ce fichier dans projet-fil-rouge/apps/api/src/catalog/

import { Controller, Get, Post, Patch, Delete, Body, Param, Query, HttpCode, HttpStatus, NotFoundException } from '@nestjs/common';

@Controller('products')
export class CatalogController {
  // TODO: injecter CatalogService

  @Get()
  async findAll(@Query('cursor') cursor?: string, @Query('limit') limit?: string) {
    // TODO: appeler le service, retourner { data: products, nextCursor }
    throw new Error('Not implemented');
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    // TODO: appeler le service, throw NotFoundException si null
    throw new Error('Not implemented');
  }

  @Post()
  async create(@Body() dto: any) {
    // TODO: appeler le service
    throw new Error('Not implemented');
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: any) {
    // TODO
    throw new Error('Not implemented');
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string) {
    // TODO
    throw new Error('Not implemented');
  }
}
