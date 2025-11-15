// src/product-offers/product-offers.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductOffer } from './product-offer.entity';
import { ProductOffersService } from './product-offers.service';
import { PriceHistory } from 'src/price-history/entities/price-history.entity';

@Module({
  imports: [TypeOrmModule.forFeature([ProductOffer, PriceHistory])],
  providers: [ProductOffersService],
  exports: [ProductOffersService],
})
export class ProductOffersModule {}
