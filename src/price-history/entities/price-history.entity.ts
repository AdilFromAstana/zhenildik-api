// src/price-history/entities/price-history.entity.ts
import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { ProductOffer } from 'src/product-offers/product-offer.entity';

@Entity()
export class PriceHistory {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => ProductOffer, (offer) => offer.history)
  offer: ProductOffer;

  @Column('timestamptz')
  capturedAt: Date;

  @Column('decimal', { precision: 10, scale: 2 })
  price: number;

  @Column('decimal', { precision: 10, scale: 2, nullable: true })
  oldPrice: number | null;

  @Column({ default: 0 })
  discountPercent: number;
}
