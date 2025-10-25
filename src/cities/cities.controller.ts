import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Put,
} from '@nestjs/common';
import { CitiesService } from './cities.service';
import { CreateCityDto } from './dto/create-city.dto';
import { UpdateCityDto } from './dto/update-city.dto';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('Cities')
@Controller('cities')
export class CitiesController {
  constructor(private readonly service: CitiesService) {}

  @ApiOperation({ summary: 'Добавить город' })
  @Post()
  create(@Body() dto: CreateCityDto) {
    return this.service.create(dto);
  }

  @ApiOperation({ summary: 'Добавить все города (bulk)' })
  @Post('bulk')
  bulkCreate() {
    return this.service.bulkCreate();
  }

  @ApiOperation({ summary: 'Получить все города' })
  @Get()
  findAll() {
    return this.service.findAll();
  }

  @ApiOperation({ summary: 'Получить город по ID' })
  @Get(':id')
  findOne(@Param('id') id: number) {
    return this.service.findOne(id);
  }

  @ApiOperation({ summary: 'Обновить город' })
  @Put(':id')
  update(@Param('id') id: number, @Body() dto: UpdateCityDto) {
    return this.service.update(id, dto);
  }

  @ApiOperation({ summary: 'Удалить город' })
  @Delete(':id')
  remove(@Param('id') id: number) {
    return this.service.remove(id);
  }
}
