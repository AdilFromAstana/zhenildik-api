import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { City } from './city.entity';
import { CreateCityDto } from './dto/create-city.dto';
import { UpdateCityDto } from './dto/update-city.dto';
import { citiesSeed } from './seed/cities.seed';

@Injectable()
export class CitiesService {
  constructor(
    @InjectRepository(City)
    private readonly repo: Repository<City>,
  ) {}

  create(dto: CreateCityDto) {
    const city = this.repo.create(dto);
    return this.repo.save(city);
  }

  findAll() {
    return this.repo.find();
  }

  findOne(id: number) {
    return this.repo.findOne({ where: { id } });
  }

  async update(id: number, dto: UpdateCityDto) {
    await this.repo.update(id, dto);
    return this.findOne(id);
  }

  async remove(id: number) {
    const city = await this.findOne(id);
    if (city) await this.repo.remove(city);
    return { deleted: true };
  }

  // 🌍 Массовое добавление (bulk seed)
  async bulkCreate() {
    const existing = await this.repo.count();
    if (existing === 0) {
      await this.repo.save(citiesSeed);
      return { message: 'Города успешно добавлены', count: citiesSeed.length };
    }
    return { message: 'Города уже существуют' };
  }
}
