import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Merchant } from './entities/merchant.entity';

@Injectable()
export class MerchantsService {
  constructor(
    @InjectRepository(Merchant)
    private repo: Repository<Merchant>,
  ) {}

  findAll() {
    return this.repo.find();
  }

  findOne(id: number) {
    return this.repo.findOne({ where: { id } });
  }

  async create(data: Partial<Merchant>) {
    const merchant = this.repo.create(data);
    return await this.repo.save(merchant);
  }

  async update(id: number, data: Partial<Merchant>) {
    const merchant = await this.repo.findOne({ where: { id } });
    if (!merchant) throw new NotFoundException('Merchant not found');
    Object.assign(merchant, data);
    return this.repo.save(merchant);
  }

  async remove(id: number) {
    await this.repo.delete(id);
    return { deleted: true };
  }
}
