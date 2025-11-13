import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PriceHistory } from './entities/price-history.entity';

@Injectable()
export class PriceHistoryService {
  constructor(
    @InjectRepository(PriceHistory)
    private repo: Repository<PriceHistory>,
  ) {}

  findAll() {
    return this.repo.find();
  }

  findOne(id: number) {
    return this.repo.findOne({ where: { id } });
  }

  async create(data: Partial<PriceHistory>) {
    const priceHistory = this.repo.create(data);
    return await this.repo.save(priceHistory);
  }

  async update(id: number, data: Partial<PriceHistory>) {
    const priceHistory = await this.repo.findOne({ where: { id } });
    if (!priceHistory) throw new NotFoundException('PriceHistory not found');
    Object.assign(priceHistory, data);
    return this.repo.save(priceHistory);
  }

  async remove(id: number) {
    await this.repo.delete(id);
    return { deleted: true };
  }
}
