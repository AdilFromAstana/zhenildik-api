import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ValidateNested, IsArray } from 'class-validator';
import { CreateOfferTypeDto } from './create-offer-type.dto';

export class BulkCreateOfferTypeDto {
  @ApiProperty({
    type: [CreateOfferTypeDto],
    description: 'Массив типов предложений для добавления',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateOfferTypeDto)
  items: CreateOfferTypeDto[];
}
