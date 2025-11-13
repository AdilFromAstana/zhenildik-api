import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Put,
  NotFoundException,
} from '@nestjs/common';
import { ProductLinksService } from './product-link.service';
import { ProductLink } from './entities/product-link.entity';

@Controller('products')
export class ProductLinksController {
  constructor(private readonly productLinksService: ProductLinksService) {}

  @Get()
  findAll(): Promise<ProductLink[]> {
    return this.productLinksService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id') id: number): Promise<ProductLink> {
    const product = await this.productLinksService.findOne(id);
    if (!product) {
      throw new NotFoundException('Product not found');
    }
    return product;
  }

  @Post()
  create(@Body() data: Partial<ProductLink>) {
    return this.productLinksService.create(data);
  }

  @Put(':id')
  update(@Param('id') id: number, @Body() data: Partial<ProductLink>) {
    return this.productLinksService.update(id, data);
  }

  @Delete(':id')
  remove(@Param('id') id: number) {
    return this.productLinksService.remove(id);
  }
}
