// src/products/products.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';
import { Product } from './entities/product.entity';
import { ProductOffer } from 'src/product-offers/product-offer.entity';
import { ProductCategory } from 'src/product-categories/product-category.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Product, ProductOffer, ProductCategory])],
  controllers: [ProductsController],
  providers: [ProductsService],
  exports: [ProductsService],
})
export class ProductsModule {}
