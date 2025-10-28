import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsDateString, IsOptional } from 'class-validator';

export class UpdateOfferDto {
  @ApiProperty({ example: true })
  @IsBoolean()
  @IsOptional()
  hasEndDate?: boolean;

  @ApiProperty({ example: '2025-11-01', required: false })
  @IsDateString()
  @IsOptional()
  startDate?: string | null;

  @ApiProperty({ example: '2025-12-31', required: false })
  @IsDateString()
  @IsOptional()
  endDate?: string | null;

  @ApiProperty({
    example: false,
    description: 'Архивировать (true) или активировать (false)',
  })
  @IsBoolean()
  @IsOptional()
  archived?: boolean;
}
