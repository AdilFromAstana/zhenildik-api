// src/deals/deals.controller.ts
import {
  Controller,
  Post,
  Body,
  Get,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { DealsService } from './deals.service';
import { CreateDealDto } from './dto/create-deal.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('Deals')
@Controller('deals')
export class DealsController {
  constructor(private readonly deals: DealsService) {}

  @ApiOperation({ summary: 'Создать новую акцию (нужен токен)' })
  @UseGuards(JwtAuthGuard)
  @Post()
  async create(@Body() dto: CreateDealDto, @Req() req: any) {
    return this.deals.create({
      ...dto,
      createdByUserId: Number(req.user.sub),
    });
  }

  @ApiOperation({ summary: 'Получить акции по городу' })
  @Get()
  async find(@Query('city') city?: string) {
    if (city) {
      return this.deals.findByCity(city);
    }
    return this.deals.findAll();
  }
}
