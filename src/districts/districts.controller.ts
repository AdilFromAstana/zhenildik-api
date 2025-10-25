import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Put,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { DistrictsService } from './districts.service';
import { CreateDistrictDto } from './dto/create-district.dto';
import { UpdateDistrictDto } from './dto/update-district.dto';

@ApiTags('Districts')
@Controller('districts')
export class DistrictsController {
  constructor(private readonly service: DistrictsService) {}

  @ApiOperation({ summary: 'Создать район' })
  @Post()
  create(@Body() dto: CreateDistrictDto) {
    return this.service.create(dto);
  }

  @ApiOperation({ summary: 'Массово засеять районы (bulk)' })
  @Post('bulk')
  bulkCreate() {
    return this.service.bulkCreate();
  }

  @ApiOperation({
    summary:
      'Получить районы. Если передан cityId — вернёт районы только этого города',
  })
  @ApiQuery({
    name: 'cityId',
    required: false,
    type: Number,
    description: 'ID города',
    example: 1,
  })
  @Get()
  findAll(@Query('cityId') cityId?: string) {
    return this.service.findAll(cityId ? +cityId : undefined);
  }

  @ApiOperation({ summary: 'Получить район по ID' })
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(+id);
  }

  @ApiOperation({ summary: 'Обновить район' })
  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateDistrictDto) {
    return this.service.update(+id, dto);
  }

  @ApiOperation({ summary: 'Удалить район' })
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(+id);
  }
}
