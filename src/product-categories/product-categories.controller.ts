// src/product-categories/product-categories.controller.ts
import { Body, Controller, Get, Post } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiBody,
} from '@nestjs/swagger';

import { ProductCategoriesService } from './product-categories.service';
import { CreateProductCategoryDto } from './dto/create-product-category.dto';
import { BulkImportProductCategoriesDto } from './dto/bulk-import-product-categories.dto';
import { ProductCategory } from './product-category.entity';

@ApiTags('Product categories')
@Controller('product-categories')
export class ProductCategoriesController {
  constructor(
    private readonly productCategoriesService: ProductCategoriesService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Получить все категории товаров (плоский список)' })
  @ApiOkResponse({ type: ProductCategory, isArray: true })
  async getAll() {
    return this.productCategoriesService.findAll();
  }

  @Get('tree')
  @ApiOperation({ summary: 'Получить иерархию категорий товаров (tree)' })
  @ApiOkResponse({ type: ProductCategory, isArray: true })
  async getTree() {
    return this.productCategoriesService.findTree();
  }

  @Post()
  @ApiOperation({ summary: 'Создать одну категорию товара' })
  @ApiBody({ type: CreateProductCategoryDto })
  @ApiCreatedResponse({ type: ProductCategory })
  async create(@Body() dto: CreateProductCategoryDto) {
    return this.productCategoriesService.create(dto);
  }

  @Post('bulk')
  @ApiOperation({
    summary: 'Импортировать дерево категорий товаров из JSON',
    description:
      'Принимает объект вида { "Алкоголь": { "Вермут": ["Вермут.json"], ... }, ... }. Массивы файлов игнорируются, используется только иерархия.',
  })
  @ApiBody({ type: BulkImportProductCategoriesDto })
  @ApiOkResponse({
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'ok' },
      },
    },
  })
  async bulkImport(@Body() dto: BulkImportProductCategoriesDto) {
    await this.productCategoriesService.bulkImport(dto);
    return { status: 'ok' };
  }
}
