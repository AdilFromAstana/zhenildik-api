// src/products/products.controller.ts
import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ProductsService } from './products.service';

@ApiTags('Products')
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  @ApiOperation({ summary: 'Список товаров с лучшими офферами' })
  findAll() {
    return this.productsService.findAllForUser();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Карточка товара с офферами' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.productsService.findOneForUser(id);
  }

  @Post('external')
  @ApiOperation({
    summary: 'Создать товар + оффер из внешнего объекта (Kaspi / Arbuz / Wolt)',
    description:
      'В body можно прислать raw JSON одного товара из Kaspi, Arbuz или Wolt. ' +
      'Сервис сам определит источник, создаст/найдет Product и создаст/обновит ProductOffer.',
  })
  createFromExternal(@Body() body: any) {
    return this.productsService.createFromExternal(body);
  }
}
