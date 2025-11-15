// src/product-offers/product-offer.entity.ts
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Product } from 'src/products/entities/product.entity';
import { Merchant } from 'src/merchants/entities/merchant.entity';
import { PriceHistory } from 'src/price-history/entities/price-history.entity';

@Entity()
@Index(['merchant', 'merchantSku'], { unique: true })
export class ProductOffer {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Product, (product) => product.offers)
  product: Product;

  @ManyToOne(() => Merchant)
  merchant: Merchant;

  @Column()
  url: string; // ссылка на карточку товара у мерчанта

  @Column({ nullable: true })
  merchantSku: string; // configSku / id / артикул

  // ТЕКУЩЕЕ СОСТОЯНИЕ ЦЕНЫ

  @Column('decimal', { precision: 10, scale: 2, nullable: true })
  currentPrice: number | null;

  @Column('decimal', { precision: 10, scale: 2, nullable: true })
  currentOldPrice: number | null;

  @Column({ type: 'int', default: 0 })
  currentDiscountPercent: number;

  @Column({ default: true })
  isAvailable: boolean;

  @Column({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  lastSeenAt: Date;

  // Сырой ответ от внешнего сервиса (Kaspi, Arbuz, Wolt)
  @Column({ type: 'jsonb', nullable: true })
  extra: any;

  @OneToMany(() => PriceHistory, (h) => h.offer)
  history: PriceHistory[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
