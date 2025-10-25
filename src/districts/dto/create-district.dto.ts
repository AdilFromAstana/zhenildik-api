import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsNumber } from 'class-validator';

export class CreateDistrictDto {
  @ApiProperty({ example: 'Есильский район' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'esil' })
  @IsString()
  @IsNotEmpty()
  slug: string;

  @ApiProperty({ example: 1, description: 'ID города' })
  @IsNumber()
  cityId: number;
}
