import { PartialType } from '@nestjs/mapped-types';
import { CreateOfferTypeDto } from './create-offer-type.dto';

export class UpdateOfferTypeDto extends PartialType(CreateOfferTypeDto) {}
