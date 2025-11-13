import { Merchant } from 'src/merchants/entities/merchant.entity';
import { PriceHistory } from 'src/price-history/entities/price-history.entity';
import { Product } from 'src/products/entities/product.entity';
import { Column, Entity, ManyToOne, OneToMany, PrimaryGeneratedColumn } from 'typeorm';

// product-links/entities/product-link.entity.ts
@Entity()
export class ProductLink {
  @PrimaryGeneratedColumn() id: number;

  @ManyToOne(() => Product, (product) => product.links)
  product: Product;

  @ManyToOne(() => Merchant)
  merchant: Merchant;

  @Column() url: string;
  @Column({ nullable: true }) merchantSku: string;

  @OneToMany(() => PriceHistory, (h) => h.link)
  history: PriceHistory[];
}
