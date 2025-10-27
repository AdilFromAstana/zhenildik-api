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
  ValidateIf,
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

  @ApiProperty({ example: true })
  @IsBoolean()
  @Type(() => Boolean)
  hasMinPrice: boolean;

  @ApiProperty({ example: 10000 })
  @ValidateIf((o: CreateOfferDto) => o.hasMinPrice === true)
  @IsNumber()
  @Type(() => Number)
  minPrice: number; // ← убрали ? и @IsOptional()

  @ApiProperty({ example: true })
  @IsBoolean()
  @Type(() => Boolean)
  hasConditions: boolean;

  @ApiProperty({ example: 'Только при оплате картой' })
  @ValidateIf((o: CreateOfferDto) => o.hasConditions === true)
  @IsString()
  @IsNotEmpty()
  conditions: string; // ← убрали ? и @IsOptional()

  @ApiProperty({ example: true })
  @IsBoolean()
  @Type(() => Boolean)
  hasEndDate: boolean;

  @ApiProperty({ example: '2025-01-01' })
  @ValidateIf((o: CreateOfferDto) => o.hasEndDate === true)
  @IsDateString()
  startDate: string; // ← обязателен, если hasEndDate = true

  @ApiProperty({ example: '2025-01-31' })
  @ValidateIf((o: CreateOfferDto) => o.hasEndDate === true)
  @IsDateString()
  endDate: string; // ← обязателен, если hasEndDate = true

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
