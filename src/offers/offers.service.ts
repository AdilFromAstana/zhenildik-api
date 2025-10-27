// src/offers/offers.service.ts
import { Injectable } from '@nestjs/common';
import { CreateOfferDto } from './dto/create-offer.dto';
import { Offer } from './entities/offer.entity';

@Injectable()
export class OffersService {
  private mockOffers: Offer[] = [];

  async create(
    dto: CreateOfferDto & { createdByUserId: number },
  ): Promise<Offer> {
    const now = new Date();
    console.log('dto: ', dto);

    const offer: Offer = {
      id: this.mockOffers.length + 1,
      title: dto.title,
      description: dto.description,

      // раньше: offerTypeId: dto.offerTypeId,
      offerTypeCode: dto.offerTypeCode,

      categoryId: dto.categoryId,

      hasMinPrice: dto.hasMinPrice,
      minPrice: dto.hasMinPrice ? (dto.minPrice ?? null) : null,

      hasConditions: dto.hasConditions,
      conditions: dto.hasConditions ? (dto.conditions ?? null) : null,

      hasEndDate: dto.hasEndDate,
      startDate: dto.hasEndDate ? new Date(dto.startDate ?? now) : null,
      endDate: dto.hasEndDate ? new Date(dto.endDate ?? now) : null,

      posters: dto.posters ?? [],

      createdByUserId: dto.createdByUserId,
      createdAt: now,
      updatedAt: now,
    };

    this.mockOffers.push(offer);
    return offer;
  }

  async findAll(): Promise<Offer[]> {
    return this.mockOffers;
  }

  async findByUser(userId: number): Promise<Offer[]> {
    return this.mockOffers.filter((o) => o.createdByUserId === userId);
  }

  async findByCategory(categoryId: number): Promise<Offer[]> {
    return this.mockOffers.filter((o) => o.categoryId === categoryId);
  }
}
