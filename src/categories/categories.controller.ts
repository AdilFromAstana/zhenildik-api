import {
  Controller,
  Get,
  Param,
  Post,
  Body,
  Delete,
  Query,
} from '@nestjs/common';
import { CategoriesService } from './categories.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { categories as seedData } from './seed/categories.seed';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';

@ApiTags('categories')
@Controller('categories')
export class CategoriesController {
  constructor(private readonly service: CategoriesService) {}

  @Post()
  @ApiOperation({ summary: 'Создать категорию' })
  @ApiResponse({
    status: 201,
    description: 'Категория успешно создана',
  })
  create(@Body() dto: CreateCategoryDto) {
    return this.service.create(dto);
  }

  @Post('bulk')
  @ApiOperation({ summary: 'Создать все категории оптом (bulk)' })
  @ApiResponse({
    status: 201,
    description: 'Категории успешно созданы',
  })
  bulkCreate() {
    return this.service.bulkCreate(seedData);
  }

  @Get()
  @ApiOperation({
    summary:
      'Получить список категорий (главные, если parentId не указан, или подкатегории по parentId)',
  })
  @ApiQuery({
    name: 'parentId',
    required: false,
    type: Number,
    description: 'ID родительской категории (необязательно)',
    example: 1,
  })
  @ApiResponse({
    status: 200,
    description: 'Успешный ответ — список категорий',
  })
  findAll(@Query('parentId') parentId?: number) {
    return this.service.findByParent(parentId ? +parentId : undefined);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Удалить категорию по ID' })
  @ApiResponse({
    status: 200,
    description: 'Категория удалена',
  })
  remove(@Param('id') id: number) {
    return this.service.remove(+id);
  }
}
