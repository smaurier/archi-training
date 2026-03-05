// TODO: Entité TypeORM pour Product
//
// Colonnes :
//   id         — UUID, auto-généré (@PrimaryGeneratedColumn('uuid'))
//   name       — string, non null
//   description — string, nullable
//   price      — integer (en centimes !), non null
//   stock      — integer, default 0
//   createdAt  — timestamp, auto
//   updatedAt  — timestamp, auto
//
// Rappel décorateurs TypeORM :
//   @Entity()
//   @PrimaryGeneratedColumn('uuid')
//   @Column()
//   @CreateDateColumn()
//   @UpdateDateColumn()
//
// Copie ce fichier dans projet-fil-rouge/apps/api/src/catalog/

import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('products')
export class Product {
  // TODO: définis les colonnes
}
