import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ArbuzService } from './arbuz.service';
import { ArbuzController } from './arbuz.controller';
import { Product } from 'src/products/entities/product.entity';
import { Merchant } from 'src/merchants/entities/merchant.entity';
import { ProductLink } from 'src/product-links/entities/product-link.entity';
import { PriceHistory } from 'src/price-history/entities/price-history.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Product, Merchant, ProductLink, PriceHistory]),
  ],
  controllers: [ArbuzController],
  providers: [ArbuzService],
})
export class ArbuzModule {}
