// src/offers/dto/offer-response.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose, Type } from 'class-transformer';
import { OfferStatus } from '../entities/offer.entity';

@Exclude()
export class OfferTypeShortDto {
  @ApiProperty()
  @Expose()
  code: string;

  @ApiProperty()
  @Expose()
  name: string;
}

@Exclude()
export class CategoryShortDto {
  @ApiProperty()
  @Expose()
  id: number;

  @ApiProperty()
  @Expose()
  name: string;

  @ApiProperty({ nullable: true })
  @Expose()
  icon: string | null;
}

@Exclude()
export class OffersResponseDto {
  @Expose() id: number;
  @Expose() title: string;
  @Expose() description: string;
  @Expose() cityCode: string;
  @Expose() offerTypeCode: string;
  @Expose() categoryId: number;
  @Expose() hasMinPrice: boolean;
  @Expose() minPrice?: number;
  @Expose() hasConditions: boolean;
  @Expose() hasEndDate: boolean;
  @Expose() startDate?: Date;
  @Expose() endDate?: Date;
  @Expose() posters: string[];
  @Expose() status: OfferStatus;
  @Expose() createdAt: Date;

  @Expose()
  @Type(() => OfferTypeShortDto)
  offerType: OfferTypeShortDto;

  @Expose()
  @Type(() => CategoryShortDto)
  category: CategoryShortDto;
}
