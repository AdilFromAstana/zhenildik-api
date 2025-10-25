import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsBoolean } from 'class-validator';

export class CreateOfferTypeDto {
  @ApiProperty({
    example: 'DISCOUNT',
    description: 'Уникальный код типа предложения',
  })
  @IsString()
  code: string;

  @ApiProperty({ example: 'Скидка', description: 'Название типа предложения' })
  @IsString()
  name: string;

  @ApiProperty({
    example: 'Процентная или фиксированная скидка',
    required: false,
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: true, required: false })
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}
