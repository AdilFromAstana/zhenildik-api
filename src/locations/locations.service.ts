import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Location } from './location.entity';
import { CreateLocationDto } from './dto/create-location.dto';

@Injectable()
export class LocationsService {
  constructor(
    @InjectRepository(Location)
    private readonly locationRepository: Repository<Location>,
  ) {}

  async create(dto: CreateLocationDto & { createdByUserId: number }) {
    const location = this.locationRepository.create({
      ...dto,
      createdByUserId: dto.createdByUserId,
    });
    return this.locationRepository.save(location);
  }

  // ✅ Получить все локации текущего пользователя
  async findAllByUser(userId: number) {
    return this.locationRepository.find({
      where: { createdByUserId: userId },
      order: { id: 'DESC' },
    });
  }

  // ✅ Получить одну локацию по ID (с проверкой владельца)
  async findOneByUser(id: number, userId: number) {
    const location = await this.locationRepository.findOne({ where: { id } });
    if (!location) throw new NotFoundException('Локация не найдена');
    if (location.createdByUserId !== userId)
      throw new ForbiddenException('Нет доступа к этой локации');
    return location;
  }

  // ✅ Обновить локацию
  async update(id: number, dto: Partial<CreateLocationDto>, userId: number) {
    const location = await this.findOneByUser(id, userId);
    Object.assign(location, dto);
    return this.locationRepository.save(location);
  }

  // ✅ Удалить локацию
  async remove(id: number, userId: number) {
    const location = await this.findOneByUser(id, userId);
    await this.locationRepository.remove(location);
    return { message: 'Локация успешно удалена' };
  }

  // ✅ Получить локации по ID (используется в OffersService)
  async findByIdsForUser(ids: number[], userId: number) {
    if (!ids?.length) return [];
    return this.locationRepository.find({
      where: { id: In(ids), createdByUserId: userId },
    });
  }
}
