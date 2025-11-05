// src/offers/dto/update-offer.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

import { BenefitKind } from '../enums/benefit-kind.enum';
import { OfferScope } from '../enums/offer-scope.enum';
import { OfferChannelCode } from 'src/offer-channels/offer-channel.enum';
import { OfferStatus } from '../entities/offer.entity';

export class UpdateOfferDto {
  // Базовые поля
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  categoryId?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  cityCode?: string;

  // Тип выгоды / область действия
  @ApiProperty({ enum: BenefitKind, required: false })
  @IsOptional()
  @IsEnum(BenefitKind)
  benefitKind?: BenefitKind;

  @ApiProperty({ enum: OfferScope, required: false })
  @IsOptional()
  @IsEnum(OfferScope)
  scope?: OfferScope;

  // Канонизированные цены/скидки
  @ApiProperty({ required: false })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  oldPrice?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  newPrice?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  discountAmount?: number;

  @ApiProperty({ required: false, description: '0..100' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  discountPercent?: number;

  // BUY_X_GET_Y
  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Min(1)
  buyQty?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Min(1)
  getQty?: number;

  // TRADE_IN
  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  tradeInRequired?: boolean;

  // Eligibility / условия доступа (jsonb)
  @ApiProperty({ required: false, type: Object })
  @IsOptional()
  @IsObject()
  eligibility?: Record<string, any>;

  // Кампания (метки)
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  campaignId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  campaignName?: string;

  // Сроки действия
  @ApiProperty({ example: '2025-11-01', required: false })
  @IsOptional()
  @IsDateString()
  startDate?: string | null;

  @ApiProperty({ example: '2025-12-31', required: false })
  @IsOptional()
  @IsDateString()
  endDate?: string | null;

  // Медиа
  @ApiProperty({ required: false, type: [String] })
  @IsOptional()
  @IsArray()
  posters?: string[];

  // Каналы применения и CTA
  @ApiProperty({ enum: OfferChannelCode, isArray: true, required: false })
  @IsOptional()
  @IsArray()
  channels?: OfferChannelCode[];

  @ApiProperty({ enum: OfferChannelCode, required: false, description: 'Главный канал (для CTA/ярлыка)' })
  @IsOptional()
  @IsEnum(OfferChannelCode)
  primaryChannel?: OfferChannelCode;

  @ApiProperty({ required: false, description: 'Ссылка для действия (если применимо)' })
  @IsOptional()
  @IsString()
  ctaUrl?: string;

  // Привязка к локациям
  @ApiProperty({ required: false, type: [Number] })
  @IsOptional()
  @IsArray()
  locationIds?: number[];

  // Статус
  @ApiProperty({ enum: OfferStatus, required: false })
  @IsOptional()
  @IsEnum(OfferStatus)
  status?: OfferStatus;

  // Удобный флаг архивирования (имеет более низкий приоритет, чем явные start/end)
  @ApiProperty({ example: false, required: false, description: 'Архивировать (true) или снять архив (false)' })
  @IsOptional()
  @IsBoolean()
  archived?: boolean;
}
