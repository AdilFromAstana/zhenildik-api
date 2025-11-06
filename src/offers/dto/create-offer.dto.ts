// src/offers/dto/create-offer.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsNumber,
  IsArray,
  IsInt,
  Min,
  Max,
  IsUrl,
} from 'class-validator';
import { Type } from 'class-transformer';
import { BenefitKind } from '../enums/benefit-kind.enum';
import { OfferScope } from '../enums/offer-scope.enum';
import { OfferChannelCode } from 'src/offer-channels/offer-channel.enum';

export class CreateOfferDto {
  @ApiProperty() @IsString() @IsNotEmpty() title: string;
  @ApiProperty() @IsString() @IsNotEmpty() description: string;

  @ApiProperty()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  categoryId: number;

  @ApiProperty()
  @IsOptional()
  @IsString()
  cityCode: string;

  @ApiProperty({ enum: BenefitKind })
  @IsEnum(BenefitKind)
  benefitKind: BenefitKind;

  @ApiProperty({ enum: OfferScope })
  @IsEnum(OfferScope)
  scope: OfferScope;

  // Цены/скидки — любые поля опциональны, сервис сам канонизирует
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
  tradeInRequired?: boolean;

  // Eligibility — свободная форма (MVP)
  @ApiProperty({ required: false, type: Object })
  @IsOptional()
  eligibility?: Record<string, any>;

  // Сроки
  @ApiProperty({ required: false }) @IsOptional() startDate?: string;
  @ApiProperty({ required: false }) @IsOptional() endDate?: string;

  // Медиа
  @ApiProperty({ required: false, type: [String] })
  @IsOptional()
  @IsArray()
  posters?: string[];

  // Привязки
  @ApiProperty({ required: false, type: [Number] })
  @IsOptional()
  @IsArray()
  locationIds?: number[];

  @ApiProperty({ enum: OfferChannelCode, isArray: true, required: false })
  @IsOptional()
  @IsArray()
  channels?: OfferChannelCode[];

  @ApiProperty({ enum: OfferChannelCode, required: false })
  @IsOptional()
  @IsEnum(OfferChannelCode)
  primaryChannel?: OfferChannelCode;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUrl({ require_tld: false }) // локальные/deeplink тоже пропустим
  ctaUrl?: string;

  @ApiProperty({ required: false, enum: ['MANUAL', 'WOLT', 'KASPI', 'IMPORT'] })
  @IsOptional()
  sourceSystem?: 'MANUAL' | 'WOLT' | 'KASPI' | 'IMPORT';

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUrl({ require_tld: false })
  sourceUrl?: string;
}
