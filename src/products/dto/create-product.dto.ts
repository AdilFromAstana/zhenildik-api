import { ApiProperty } from '@nestjs/swagger';
import {
  IsNumber,
  IsOptional,
  IsString,
  IsObject,
  MaxLength,
} from 'class-validator';

export class CreateProductDto {
  @ApiProperty()
  @IsString()
  @MaxLength(255)
  title: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  brand?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  unit?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  unitQty?: number;

  @ApiProperty({ required: false, description: 'ID категории товара' })
  @IsOptional()
  productCategoryId?: number;

  @ApiProperty({
    required: false,
    description:
      'Доп. данные по товару. Структура зависит от категории. Например, для молока: { "fatPercent": 7.1, "volumeMl": 500 }',
  })
  @IsOptional()
  @IsObject()
  attributes?: Record<string, any>;
}
