// src/offers/dto/update-offer-status.dto.ts
import { IsEnum } from 'class-validator';
import { OfferStatus } from '../entities/offer.entity';

export class UpdateOfferStatusDto {
    @IsEnum(OfferStatus)
    status: OfferStatus;
}
