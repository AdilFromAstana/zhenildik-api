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
import { MerchantsService } from './merchants.service';
import { Merchant } from './entities/merchant.entity';

@Controller('merchants')
export class MerchantsController {
  constructor(private readonly merchantsService: MerchantsService) {}

  @Get()
  findAll(): Promise<Merchant[]> {
    return this.merchantsService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id') id: number): Promise<Merchant> {
    const merchant = await this.merchantsService.findOne(id);
    if (!merchant) {
      throw new NotFoundException('Merchant not found');
    }
    return merchant;
  }

  @Post()
  create(@Body() data: Partial<Merchant>) {
    return this.merchantsService.create(data);
  }

  @Put(':id')
  update(@Param('id') id: number, @Body() data: Partial<Merchant>) {
    return this.merchantsService.update(id, data);
  }

  @Delete(':id')
  remove(@Param('id') id: number) {
    return this.merchantsService.remove(id);
  }
}
