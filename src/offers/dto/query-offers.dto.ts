// src/offers/dto/query-offers.dto.ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsOptional,
  IsString,
  IsNumber,
  IsBoolean,
  IsEnum,
  Min,
  Max,
} from 'class-validator';
import { OfferScope } from '../enums/offer-scope.enum';
import { BenefitKind } from '../enums/benefit-kind.enum';

export enum SortBy {
  createdAt = 'createdAt',
  discountPercent = 'discountPercent',
  newPrice = 'newPrice',
  title = 'title',
  distance = 'distance', // 🧭 сортировка по расстоянию
}

export enum SortOrder {
  ASC = 'ASC',
  DESC = 'DESC',
}

export class QueryOffersDto {
  @ApiPropertyOptional({ example: 1, default: 1 })
  @Type(() => Number)
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ example: 10, default: 10 })
  @Type(() => Number)
  @Min(1)
  @Max(100)
  limit: number = 10;

  // 🔍 Текстовый поиск
  @ApiPropertyOptional({
    example: 'шаурма',
    description: 'Поиск по названию, описанию, кампании, адресу',
  })
  @IsOptional()
  @IsString()
  search?: string;

  // 👤 Автор (для фильтрации по владельцу/пользователю)
  @ApiPropertyOptional({
    example: 42,
    description: 'ID пользователя (автора оффера)',
  })
  @IsOptional()
  @Type(() => Number)
  userId?: number;

  // 🏷 Категория
  @ApiPropertyOptional({ example: 3, description: 'ID категории' })
  @IsOptional()
  @Type(() => Number)
  categoryId?: number;

  // 🌐 Город
  @ApiPropertyOptional({
    example: 'astana',
    description: 'Код города (например, "astana", "almaty")',
  })
  @IsOptional()
  @IsString()
  cityCode?: string;

  // 💰 Ценовой диапазон
  @ApiPropertyOptional({ example: 1000, description: 'Минимальная цена' })
  @IsOptional()
  @Type(() => Number)
  priceMin?: number;

  @ApiPropertyOptional({ example: 10000, description: 'Максимальная цена' })
  @IsOptional()
  @Type(() => Number)
  priceMax?: number;

  // 📉 Диапазон скидки
  @ApiPropertyOptional({
    example: 10,
    description: 'Минимальный процент скидки',
  })
  @IsOptional()
  @Type(() => Number)
  @Min(0)
  @Max(100)
  discountMin?: number;

  @ApiPropertyOptional({
    example: 50,
    description: 'Максимальный процент скидки',
  })
  @IsOptional()
  @Type(() => Number)
  @Min(0)
  @Max(100)
  discountMax?: number;

  // 🎯 Тип выгоды
  @ApiPropertyOptional({
    enum: BenefitKind,
    description:
      'Тип выгоды (DISCOUNT, CASHBACK, BONUS, BUY_X_GET_Y, TRADE_IN)',
  })
  @IsOptional()
  @IsEnum(BenefitKind)
  benefitKind?: BenefitKind;

  // ⚙️ Сфера действия
  @ApiPropertyOptional({
    enum: OfferScope,
    description: 'Сфера действия акции (ONLINE, OFFLINE, BOTH)',
  })
  @IsOptional()
  @IsEnum(OfferScope)
  scope?: OfferScope;

  // 🕓 Только активные
  @ApiPropertyOptional({
    example: true,
    description: 'Фильтровать только действующие на текущую дату акции',
  })
  @IsOptional()
  @Type(() => Boolean)
  isActiveNow?: boolean;

  // 📅 Новинки
  @ApiPropertyOptional({
    example: 7,
    description: 'Показывать только акции, созданные за последние N дней',
  })
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  @Max(365)
  recentDays?: number;

  // 📍 Геолокация пользователя
  @ApiPropertyOptional({ example: 51.128, description: 'Широта пользователя' })
  @IsOptional()
  @Type(() => Number)
  userLat?: number;

  @ApiPropertyOptional({ example: 71.43, description: 'Долгота пользователя' })
  @IsOptional()
  @Type(() => Number)
  userLng?: number;

  @ApiPropertyOptional({
    example: 5,
    description: 'Радиус поиска в километрах (по умолчанию 5 км)',
  })
  @IsOptional()
  @Type(() => Number)
  @Min(0.5)
  @Max(100)
  radiusKm?: number;

  // 🔄 Сортировка
  @ApiPropertyOptional({
    enum: SortBy,
    default: SortBy.createdAt,
    description:
      'Поле сортировки (createdAt, discountPercent, newPrice, title, distance)',
  })
  @IsOptional()
  @IsEnum(SortBy)
  sortBy: SortBy = SortBy.createdAt;

  @ApiPropertyOptional({
    enum: SortOrder,
    default: SortOrder.DESC,
    description: 'Порядок сортировки (ASC или DESC)',
  })
  @IsOptional()
  @IsEnum(SortOrder)
  sortOrder: SortOrder = SortOrder.DESC;
}
