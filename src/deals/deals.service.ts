// src/deals/deals.service.ts
import { Injectable } from '@nestjs/common';
import { CreateDealDto } from './dto/create-deal.dto';
import { Deal } from './entities/deal.entity';

@Injectable()
export class DealsService {
  // тут должна быть твоя БД / ORM
  private mockDeals: Deal[] = [];

  async create(
    dto: CreateDealDto & { createdByUserId: number },
  ): Promise<Deal> {
    const newDeal: Deal = {
      id: this.mockDeals.length + 1,
      title: dto.title,
      description: dto.description,
      oldPrice: dto.oldPrice,
      newPrice: dto.newPrice,
      citySlug: dto.citySlug,
      expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
      createdByUserId: dto.createdByUserId,
      createdAt: new Date(),
    };

    this.mockDeals.push(newDeal);
    return newDeal;
  }

  async findByCity(citySlug: string): Promise<Deal[]> {
    return this.mockDeals.filter((d) => d.citySlug === citySlug);
  }

  async findAll(): Promise<Deal[]> {
    return this.mockDeals;
  }
}
