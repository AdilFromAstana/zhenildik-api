import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class CreateCityDto {
  @ApiProperty({ example: 'Астана' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'astana' })
  @IsString()
  @IsNotEmpty()
  slug: string;
}
