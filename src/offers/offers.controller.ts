// src/offers/offers.controller.ts
import {
  Controller,
  Post,
  Body,
  Get,
  Query,
  UseGuards,
  Req,
  UseInterceptors,
  UploadedFiles,
  Param,
  Put,
  NotFoundException,
} from '@nestjs/common';
import { OffersService } from './offers.service';
import { CreateOfferDto } from './dto/create-offer.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  ApiTags,
  ApiOperation,
  ApiQuery,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { FilesInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { QueryOffersDto } from './dto/query-offers.dto';
import { plainToInstance } from 'class-transformer';
import { OffersResponseDto } from './dto/offers-response.dto';
import { UpdateOfferDto } from './dto/update-offer.dto';

@ApiTags('Offers')
@Controller('offers')
export class OffersController {
  constructor(private readonly offers: OffersService) {}

  // ✅ Создание
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @Post()
  @UseInterceptors(
    FilesInterceptor('posters', 10, {
      storage: diskStorage({
        destination: './uploads',
        filename: (req, file, callback) => {
          const uniqueSuffix =
            Date.now() + '-' + Math.round(Math.random() * 1e9);
          const ext = extname(file.originalname);
          callback(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
        },
      }),
    }),
  )
  async create(
    @UploadedFiles() files: Express.Multer.File[],
    @Body() dto: CreateOfferDto,
    @Req() req: any,
  ) {
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const fileUrls = files.map((f) => `${baseUrl}/uploads/${f.filename}`);

    return this.offers.create({
      ...dto,
      posters: fileUrls,
      createdByUserId: Number(req.user.sub),
    });
  }

  // ✅ Получить все
  @ApiOperation({
    summary: 'Получить все предложения с фильтрацией и пагинацией',
  })
  @Get()
  async findAll(@Query() query: QueryOffersDto) {
    return this.offers.findAll(query);
  }

  // ✅ Мои предложения
  @ApiOperation({ summary: 'Получить предложения текущего пользователя' })
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @Get('my')
  async findMy(@Req() req: any, @Query() query: QueryOffersDto) {
    const result = await this.offers.findByUser(Number(req.user.sub), query);
    return {
      total: result.total,
      data: plainToInstance(OffersResponseDto, result.data, {
        excludeExtraneousValues: true,
      }),
    };
  }

  // ✅ Получить одно предложение
  @ApiOperation({ summary: 'Получить одно предложение по ID' })
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiParam({ name: 'id', type: Number, description: 'ID предложения' })
  @Get(':id')
  async findOne(@Param('id') id: number, @Req() req: any) {
    const offer = await this.offers.findOneByUser(Number(id), req.user.sub);
    if (!offer) throw new NotFoundException('Предложение не найдено');
    return plainToInstance(OffersResponseDto, offer, {
      excludeExtraneousValues: true,
    });
  }

  // ✅ Обновить предложение (даты, статус)
  @ApiOperation({
    summary: 'Обновить предложение (даты, статус — архив/активация)',
  })
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiParam({ name: 'id', type: Number, description: 'ID предложения' })
  @Put(':id')
  async update(
    @Param('id') id: number,
    @Body() dto: UpdateOfferDto,
    @Req() req: any,
  ) {
    const updated = await this.offers.updateOffer(
      Number(id),
      req.user.sub,
      dto,
    );
    return plainToInstance(OffersResponseDto, updated, {
      excludeExtraneousValues: true,
    });
  }
}
