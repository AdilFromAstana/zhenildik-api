import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProductLink } from './entities/product-link.entity';

@Injectable()
export class ProductLinksService {
  constructor(
    @InjectRepository(ProductLink)
    private repo: Repository<ProductLink>,
  ) {}

  findAll() {
    return this.repo.find();
  }

  findOne(id: number) {
    return this.repo.findOne({ where: { id } });
  }

  async create(data: Partial<ProductLink>) {
    const productLink = this.repo.create(data);
    return await this.repo.save(productLink);
  }

  async update(id: number, data: Partial<ProductLink>) {
    const productLink = await this.repo.findOne({ where: { id } });
    if (!productLink) throw new NotFoundException('ProductLink not found');
    Object.assign(productLink, data);
    return this.repo.save(productLink);
  }

  async remove(id: number) {
    await this.repo.delete(id);
    return { deleted: true };
  }
}
