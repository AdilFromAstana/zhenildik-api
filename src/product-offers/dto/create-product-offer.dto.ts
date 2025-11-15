import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateProductOfferDto {
  @ApiProperty()
  @IsString()
  merchantName: string;

  @ApiProperty()
  @IsString()
  merchantSku: string;

  @ApiProperty()
  @IsString()
  url: string;

  @ApiProperty()
  @IsNumber()
  price: number;

  @ApiProperty({ required: false })
  @IsOptional()
  oldPrice?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  productCategoryId?: number;

  @ApiProperty()
  @IsString()
  title: string;

  @ApiProperty({ required: false })
  brand?: string;

  @ApiProperty({ required: false })
  unit?: string;

  @ApiProperty({ required: false })
  unitQty?: number;
}
