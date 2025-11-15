// src/products/entities/product.entity.ts
import {
  Column,
  Entity,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ProductCategory } from 'src/product-categories/product-category.entity';
import { ProductOffer } from 'src/product-offers/product-offer.entity';

@Entity()
export class Product {
  @PrimaryGeneratedColumn()
  id: number;

  @Column('varchar', { length: 255 })
  title: string;

  @Column('varchar', { length: 255, nullable: true })
  brand: string | null;

  @Column('varchar', { length: 50, nullable: true })
  unit: string | null; // кг, л, шт

  @Column('float', { nullable: true })
  unitQty: number | null; // 1.6, 0.7 и т.п.

  @ManyToOne(() => ProductCategory, { nullable: false })
  productCategory: ProductCategory;

  @OneToMany(() => ProductOffer, (offer) => offer.product)
  offers: ProductOffer[];

  // 🔹 ДОП. ДАННЫЕ ПО ТОВАРУ (зависят от категории)
  // Примеры:
  //  - для молока: { fatPercent: 7.1, volumeMl: 500 }
  //  - для хлеба: { flourType: 'wholegrain', sliced: true }
  @Column({ type: 'jsonb', nullable: true })
  attributes: Record<string, any> | null;
}
