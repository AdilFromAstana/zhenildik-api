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
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { FilesInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';

@ApiTags('Offers')
@Controller('offers')
export class OffersController {
  constructor(private readonly offers: OffersService) {}

  @UseGuards(JwtAuthGuard)
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
    console.log('dto: ', dto);
    console.log('req: ', req);
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const fileUrls = files.map((f) => `${baseUrl}/uploads/${f.filename}`);

    return this.offers.create({
      ...dto,
      posters: fileUrls,
      createdByUserId: Number(req.user.sub),
    });
  }

  @ApiOperation({ summary: 'Получить все предложения или по категории' })
  @Get()
  async findAll(@Query('categoryId') categoryId?: string) {
    if (categoryId) return this.offers.findByCategory(Number(categoryId));
    return this.offers.findAll();
  }

  @ApiOperation({ summary: 'Получить предложения текущего пользователя' })
  @UseGuards(JwtAuthGuard)
  @Get('my')
  async findMy(@Req() req: any) {
    return this.offers.findByUser(Number(req.user.sub));
  }
}
