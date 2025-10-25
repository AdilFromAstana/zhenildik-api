import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { District } from './district.entity';
import { CreateDistrictDto } from './dto/create-district.dto';
import { UpdateDistrictDto } from './dto/update-district.dto';
import { districtsSeed } from './seed/districts.seed';

@Injectable()
export class DistrictsService {
  constructor(
    @InjectRepository(District)
    private readonly repo: Repository<District>,
  ) {}

  create(dto: CreateDistrictDto) {
    const district = this.repo.create(dto);
    return this.repo.save(district);
  }

  findAll(cityId?: number) {
    if (cityId) {
      return this.repo.find({
        where: { cityId },
        order: { id: 'ASC' },
      });
    }
    return this.repo.find({
      order: { id: 'ASC' },
    });
  }

  findOne(id: number) {
    return this.repo.findOne({ where: { id } });
  }

  async update(id: number, dto: UpdateDistrictDto) {
    await this.repo.update(id, dto);
    return this.findOne(id);
  }

  async remove(id: number) {
    const row = await this.findOne(id);
    if (row) await this.repo.remove(row);
    return { deleted: true };
  }

  // массовая заливка
  async bulkCreate() {
    const existing = await this.repo.count();
    if (existing === 0) {
      await this.repo.save(districtsSeed);
      return {
        message: 'Районы успешно добавлены',
        count: districtsSeed.length,
      };
    }
    return { message: 'Районы уже существуют' };
  }
}
