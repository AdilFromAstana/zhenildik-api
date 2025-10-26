import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Put,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { OfferTypeService } from './offer-type.service';
import { CreateOfferTypeDto } from './dto/create-offer-type.dto';
import { UpdateOfferTypeDto } from './dto/update-offer-type.dto';
import { OfferType } from './entities/offer-type.entity';

@ApiTags('Offer Types')
@Controller('offer-types')
export class OfferTypeController {
  constructor(private readonly service: OfferTypeService) {}

  @Post()
  @ApiOperation({ summary: 'Создать тип предложения' })
  @ApiResponse({ status: 201, type: OfferType })
  create(@Body() dto: CreateOfferTypeDto) {
    return this.service.create(dto);
  }

  @Post('bulk')
  @ApiOperation({ summary: 'Массовое добавление типов предложений' })
  @ApiResponse({
    status: 201,
    description: 'Список созданных типов',
    type: [OfferType],
  })
  bulkCreate() {
    return this.service.seedDefaults();
  }

  @Get()
  @ApiOperation({ summary: 'Получить список всех типов предложений' })
  @ApiResponse({ status: 200, type: [OfferType] })
  findAll() {
    return this.service.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Получить один тип предложения по ID' })
  @ApiResponse({ status: 200, type: OfferType })
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Обновить тип предложения' })
  @ApiResponse({ status: 200, type: OfferType })
  update(@Param('id') id: string, @Body() dto: UpdateOfferTypeDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Удалить тип предложения' })
  @ApiResponse({ status: 204 })
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
