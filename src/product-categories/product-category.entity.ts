// src/product-categories/product-category.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('product_categories')
export class ProductCategory {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 255 })
  @Index()
  name: string;

  // Можно использовать для URL, если понадобится
  @Column({
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  slug: string | null;

  @ManyToOne(() => ProductCategory, (category) => category.children, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  parent: ProductCategory | null;

  @Column({ nullable: true })
  parentId: number | null;

  @OneToMany(() => ProductCategory, (category) => category.parent)
  children: ProductCategory[];

  // Уровень вложенности (0 — корень)
  @Column({ type: 'int', default: 0 })
  depth: number;

  // Порядок сортировки внутри одного уровня
  @Column({ type: 'int', default: 0 })
  sortOrder: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
