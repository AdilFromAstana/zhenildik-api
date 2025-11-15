// src/product-offers/product-offers.controller.ts
import { Controller, Post, Body } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { ProductOffersService } from './product-offers.service';

@ApiTags('Product Offers')
@Controller('product-offers')
export class ProductOffersController {
  constructor(private readonly service: ProductOffersService) {}
}
