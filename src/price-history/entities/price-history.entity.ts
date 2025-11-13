import { ProductLink } from "src/product-links/entities/product-link.entity";
import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from "typeorm";

// price-history/entities/price-history.entity.ts
@Entity()
export class PriceHistory {
  @PrimaryGeneratedColumn() id: number;

  @ManyToOne(() => ProductLink, (link) => link.history)
  link: ProductLink;

  @Column('date') date: Date;
  @Column('decimal', { precision: 10, scale: 2 }) price: number;
  @Column('decimal', { precision: 10, scale: 2, nullable: true })
  oldPrice: number;
  @Column({ default: 0 }) discountPercent: number;
}
