import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNumber, IsOptional, IsObject } from 'class-validator';
import { Type } from 'class-transformer';

class DayScheduleDto {
  @ApiProperty()
  @IsString()
  open: string;

  @ApiProperty()
  @IsString()
  close: string;
}

export class CreateLocationDto {
  @ApiProperty()
  @IsString()
  city: string;

  @ApiProperty()
  @IsString()
  district: string;

  @ApiProperty()
  @IsString()
  street: string;

  @ApiProperty()
  @IsString()
  houseNumber: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  residentialComplex?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  fullAddress?: string;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  latitude: number;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  longitude: number;

  @ApiProperty({
    required: false,
    type: () => Object,
    example: {
      monday: { open: '09:00', close: '20:00' },
      tuesday: { open: '09:00', close: '20:00' },
      saturday: { open: '10:00', close: '18:00' },
      sunday: null,
    },
  })
  @IsOptional()
  @IsObject()
  workingHours?: Record<string, DayScheduleDto | null>;
}
