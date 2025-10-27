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
} from '@nestjs/common';
import { OffersService } from './offers.service';
import { CreateOfferDto } from './dto/create-offer.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ApiTags, ApiOperation, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
import { FilesInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { QueryOffersDto } from './dto/query-offers.dto';

@ApiTags('Offers')
@Controller('offers')
export class OffersController {
  constructor(private readonly offers: OffersService) { }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @Post()
  @UseInterceptors(
    FilesInterceptor('posters', 10, {
      storage: diskStorage({
        destination: './uploads', // сохраняем файлы сюда
        filename: (req, file, callback) => {
          // Уникальное имя файла
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

  @ApiOperation({ summary: 'Получить все предложения с фильтрацией и пагинацией' })
  @Get()
  async findAll(@Query() query: QueryOffersDto) {
    return this.offers.findAll(query);
  }

  @ApiOperation({ summary: 'Получить предложения текущего пользователя' })
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @Get('my')
  async findMy(@Req() req: any, @Query() query: QueryOffersDto) {
    return this.offers.findByUser(Number(req.user.sub), query);
  }
}
