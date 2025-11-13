// src/import/arbuz/arbuz.controller.ts
import {
  Controller,
  Get,
  Query,
  BadRequestException,
  Post,
  Body,
} from '@nestjs/common';
import { ArbuzService } from './arbuz.service';
import {
  ApiTags,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiBody,
  ApiProperty,
} from '@nestjs/swagger';

@ApiTags('Импорт • Arbuz.kz')
@Controller('import/arbuz')
export class ArbuzController {
  constructor(private readonly arbuzService: ArbuzService) {}

  @Get()
  @ApiOperation({
    summary: 'Импортировать товары из категории Arbuz.kz',
    description:
      'Принимает ссылку на категорию с сайта arbuz.kz, обходит все страницы пагинации (включая "Показать еще" и "Дальше"), парсит товары и сохраняет их в БД с историей цен.',
  })
  @ApiQuery({
    name: 'url',
    required: true,
    description:
      'Ссылка на категорию Arbuz.kz (например: https://arbuz.kz/ru/astana/catalog/cat/225164-ovoshi_frukty_zelen)',
    example:
      'https://arbuz.kz/ru/astana/catalog/cat/225164-ovoshi_frukty_zelen#/',
  })
  @ApiResponse({
    status: 200,
    description: 'Результат импорта.',
  })
  @ApiResponse({
    status: 400,
    description: 'Параметр url обязателен.',
    schema: {
      example: {
        statusCode: 400,
        message: 'URL обязателен',
        error: 'Bad Request',
      },
    },
  })
  async importByUrl(
    @Query('url') url: string,
    @Query('threads') threads?: string,
  ) {
    if (!url) return { error: 'URL обязателен' };
    const concurrency = threads ? parseInt(threads) : 1;
    return await this.arbuzService.importByUrl(url, concurrency);
  }

  @Get('debug')
  async debug(@Query('url') url: string) {
    if (!url) return { error: 'URL обязателен' };
    await this.arbuzService.debugPage(url);
    return { ok: true };
  }

  @Post('json')
  @ApiOperation({
    summary: 'Импорт товаров из Arbuz JSON',
    description:
      'Принимает JSON-структуру из Arbuz API и сохраняет товары, ссылки и историю цен в БД.',
  })
  @ApiResponse({
    status: 200,
    description: 'Результат импорта',
    schema: {
      example: {
        created: 2,
        updated: 1,
        took: '1.7',
      },
    },
  })
  async importFromJson(@Body() body: any) {
    return this.arbuzService.importFromJson(body);
  }
}
