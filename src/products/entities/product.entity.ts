import { Category } from 'src/categories/category.entity';
import { ProductLink } from 'src/product-links/entities/product-link.entity';
import {
  Column,
  Entity,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity()
export class Product {
  @PrimaryGeneratedColumn()
  id: number;

  @Column('varchar', { length: 255 })
  title: string;

  @Column('varchar', { length: 255, nullable: true })
  brand: string | null;

  @Column('varchar', { length: 50, nullable: true })
  unit: string | null;

  @Column('float', { nullable: true })
  unitQty: number | null;

  @ManyToOne(() => Category, { nullable: true })
  category?: Category;

  @OneToMany(() => ProductLink, (link) => link.product)
  links: ProductLink[];
}
