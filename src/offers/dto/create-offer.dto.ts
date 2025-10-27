// src/offers/dto/create-offer.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsNumber,
  IsDateString,
  IsArray,
  IsBoolean,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateOfferDto {
  @ApiProperty({ example: 'Скидка на айфоны' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({ example: '20% на все модели iPhone' })
  @IsString()
  @IsNotEmpty()
  description: string;

  // <-- ВАЖНО: теперь это не число, а код
  @ApiProperty({
    example: 'DISCOUNT_PERCENT',
    description: 'Код типа акции (из справочника offer_types.code)',
  })
  @IsString()
  @IsNotEmpty()
  offerTypeCode: string;

  @ApiProperty({ example: 3 })
  @IsNumber()
  @Type(() => Number)
  categoryId: number;

  // --- Цена ---
  @ApiProperty({
    example: true,
    description: 'Есть ли минимальная сумма/стоимость? (e.g. "от 10 000 тг")',
  })
  @IsBoolean()
  @Type(() => Boolean)
  hasMinPrice: boolean;

  @ApiProperty({ example: 10000, required: false })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  minPrice?: number;

  // --- Условия ---
  @ApiProperty({
    example: true,
    description:
      'Есть ли обязательные условия (типа "только при оплате картой")',
  })
  @IsBoolean()
  @Type(() => Boolean)
  hasConditions: boolean;

  @ApiProperty({
    example: 'Только при оплате картой',
    required: false,
  })
  @IsOptional()
  @IsString()
  conditions?: string;

  // --- Даты ---
  @ApiProperty({
    example: true,
    description: 'Акция ограничена по времени?',
  })
  @IsBoolean()
  @Type(() => Boolean)
  hasEndDate: boolean;

  @ApiProperty({
    example: '2025-01-01',
    required: false,
    description: 'Дата начала действия акции (YYYY-MM-DD)',
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiProperty({
    example: '2025-01-31',
    required: false,
    description: 'Дата окончания действия акции (YYYY-MM-DD)',
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  // --- Постеры ---
  @ApiProperty({
    type: [String],
    required: false,
    example: [
      'http://localhost:5000/uploads/poster1.jpg',
      'http://localhost:5000/uploads/poster2.jpg',
    ],
  })
  @IsOptional()
  @IsArray()
  posters?: string[];
}
