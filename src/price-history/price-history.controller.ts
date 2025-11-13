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
import { PriceHistoryService } from './price-history.service';
import { PriceHistory } from './entities/price-history.entity';

@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: PriceHistoryService) {}

  @Get()
  findAll(): Promise<PriceHistory[]> {
    return this.productsService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id') id: number): Promise<PriceHistory> {
    const product = await this.productsService.findOne(id);
    if (!product) {
      throw new NotFoundException('Product not found');
    }
    return product;
  }

  @Post()
  create(@Body() data: Partial<PriceHistory>) {
    return this.productsService.create(data);
  }

  @Put(':id')
  update(@Param('id') id: number, @Body() data: Partial<PriceHistory>) {
    return this.productsService.update(id, data);
  }

  @Delete(':id')
  remove(@Param('id') id: number) {
    return this.productsService.remove(id);
  }
}
