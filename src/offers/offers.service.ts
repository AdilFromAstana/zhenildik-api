// src/offers/offers.service.ts
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Offer } from './entities/offer.entity';
import { CreateOfferDto } from './dto/create-offer.dto';
import { QueryOffersDto, SortBy } from './dto/query-offers.dto';
import { UpdateOfferDto } from './dto/update-offer.dto';
import { UpdateOfferStatusDto } from './dto/update-offer-status.dto';

@Injectable()
export class OffersService {
  constructor(
    @InjectRepository(Offer)
    private offerRepository: Repository<Offer>,
  ) { }

  async create(
    dto: CreateOfferDto & { createdByUserId: number },
  ): Promise<Offer> {
    const now = new Date();
    console.log('dto: ', dto);

    // 🔒 Условная валидация
    if (dto.hasMinPrice) {
      console.log('dto.hasMinPrice: ', dto.hasMinPrice);
      if (dto.minPrice == null || dto.minPrice < 0) {
        throw new BadRequestException(
          'minPrice must be provided and >= 0 when hasMinPrice is true',
        );
      }
    }

    if (dto.hasConditions) {
      if (!dto.conditions || dto.conditions.trim() === '') {
        throw new BadRequestException(
          'conditions must be provided and non-empty when hasConditions is true',
        );
      }
    }

    if (dto.hasEndDate) {
      if (!dto.startDate || !dto.endDate) {
        throw new BadRequestException(
          'startDate and endDate must be provided when hasEndDate is true',
        );
      }

      const start = new Date(dto.startDate);
      const end = new Date(dto.endDate);

      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        throw new BadRequestException(
          'startDate and endDate must be valid ISO dates (YYYY-MM-DD)',
        );
      }

      if (end < start) {
        throw new BadRequestException(
          'endDate cannot be earlier than startDate',
        );
      }
    }

    const offer = this.offerRepository.create({
      title: dto.title,
      description: dto.description,
      offerTypeCode: dto.offerTypeCode,
      categoryId: dto.categoryId,
      hasMinPrice: dto.hasMinPrice,
      minPrice: dto.minPrice,
      hasConditions: dto.hasConditions,
      conditions: dto.conditions,
      hasEndDate: dto.hasEndDate,
      startDate: dto.startDate,
      endDate: dto.endDate,
      posters: dto.posters ?? [],
      createdByUserId: dto.createdByUserId,
      createdAt: now,
      updatedAt: now,
    });

    return this.offerRepository.save(offer);
  }

  async findAll(
    filters: QueryOffersDto,
  ): Promise<{ data: Offer[]; total: number }> {
    const queryBuilder = this.offerRepository.createQueryBuilder('offer');

    // Поиск по title/description
    if (filters.search) {
      const term = `%${filters.search.toLowerCase()}%`;
      queryBuilder.andWhere(
        '(LOWER(offer.title) LIKE :term OR LOWER(offer.description) LIKE :term)',
        { term },
      );
    }

    if (filters.status) {
      queryBuilder.andWhere('offer.status = :status', { status: filters.status });
    }

    // Фильтр по категории
    if (filters.categoryId) {
      queryBuilder.andWhere('offer.categoryId = :categoryId', {
        categoryId: filters.categoryId,
      });
    }

    // Фильтр по типу
    if (filters.offerTypeCode) {
      queryBuilder.andWhere('offer.offerTypeCode = :offerTypeCode', {
        offerTypeCode: filters.offerTypeCode,
      });
    }

    // Только активные акции
    if (filters.activeOnly) {
      const now = new Date();
      queryBuilder.andWhere(
        '(offer.hasEndDate = false OR offer.endDate IS NULL OR offer.endDate >= :now)',
        { now },
      );
    }

    // Сортировка
    const sortFieldMap: Record<SortBy, string> = {
      createdAt: 'offer.createdAt',
      title: 'offer.title',
      minPrice: 'offer.minPrice',
    };
    const sortField = sortFieldMap[filters.sortBy] || 'offer.createdAt';
    queryBuilder.orderBy(sortField, filters.sortOrder);

    // Пагинация
    const total = await queryBuilder.getCount();
    const { page, limit } = filters;
    const data = await queryBuilder
      .skip((page - 1) * limit)
      .take(limit)
      .getMany();

    return { data, total };
  }

  async findByUser(
    userId: number,
    filters: QueryOffersDto,
  ): Promise<{ data: Offer[]; total: number }> {
    const queryBuilder = this.offerRepository
      .createQueryBuilder('offer')
      .leftJoinAndSelect('offer.category', 'category')
      .leftJoinAndSelect('offer.offerType', 'offerType')
      .where('offer.createdByUserId = :userId', { userId });

    // Повторяем те же фильтры, что и в findAll
    if (filters.search) {
      const term = `%${filters.search.toLowerCase()}%`;
      queryBuilder.andWhere(
        '(LOWER(offer.title) LIKE :term OR LOWER(offer.description) LIKE :term)',
        { term },
      );
    }
    if (filters.categoryId) {
      queryBuilder.andWhere('offer.categoryId = :categoryId', {
        categoryId: filters.categoryId,
      });
    }
    if (filters.status) {
      queryBuilder.andWhere('offer.status = :status', { status: filters.status });
    }
    if (filters.offerTypeCode) {
      queryBuilder.andWhere('offer.offerTypeCode = :offerTypeCode', {
        offerTypeCode: filters.offerTypeCode,
      });
    }
    if (filters.activeOnly) {
      const now = new Date();
      queryBuilder.andWhere(
        '(offer.hasEndDate = false OR offer.endDate IS NULL OR offer.endDate >= :now)',
        { now },
      );
    }

    const sortFieldMap: Record<SortBy, string> = {
      createdAt: 'offer.createdAt',
      title: 'offer.title',
      minPrice: 'offer.minPrice',
    };
    const sortField = sortFieldMap[filters.sortBy] || 'offer.createdAt';
    queryBuilder.orderBy(sortField, filters.sortOrder);

    const total = await queryBuilder.getCount();
    const { page, limit } = filters;
    const data = await queryBuilder
      .skip((page - 1) * limit)
      .take(limit)
      .getMany();

    return { data, total };
  }

  async findOneByUser(id: number, userId: number) {
    return this.offerRepository.findOne({
      where: { id, createdByUserId: userId },
      relations: ['offerType', 'category'],
    });
  }

  async updateOffer(
    id: number,
    userId: number,
    dto: UpdateOfferDto,
  ): Promise<Offer> {
    const offer = await this.findOneByUser(id, userId);
    if (!offer) throw new NotFoundException('Предложение не найдено');

    if (dto.hasEndDate !== undefined) offer.hasEndDate = dto.hasEndDate;
    if (dto.hasEndDate) {
      offer.startDate = dto.startDate ? new Date(dto.startDate) : null;
      offer.endDate = dto.endDate ? new Date(dto.endDate) : null;
    } else {
      offer.startDate = null;
      offer.endDate = null;
    }

    if (dto.archived !== undefined) {
      // “Архивация” — просто выставляем дату окончания в прошлом
      if (dto.archived) {
        offer.hasEndDate = true;
        offer.endDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
      } else {
        // активация: убираем архивность
        offer.endDate = null;
        offer.hasEndDate = false;
      }
    }

    return this.offerRepository.save(offer);
  }

  async updateStatus(id: number, userId: number, dto: UpdateOfferStatusDto) {
    const offer = await this.findOneByUser(id, userId);
    if (!offer) throw new NotFoundException('Предложение не найдено');

    offer.status = dto.status;
    return this.offerRepository.save(offer);
  }

  async getUserOfferStats(userId: number) {
    const result = await this.offerRepository
      .createQueryBuilder('offer')
      .select('offer.status', 'status')
      .addSelect('COUNT(*)::int', 'count')
      .where('offer.createdByUserId = :userId', { userId })
      .groupBy('offer.status')
      .getRawMany<{ status: string; count: number }>();

    // Собираем динамически
    const stats: Record<string, number> = { total: 0 };

    for (const { status, count } of result) {
      stats[status] = count;
      stats.total += count;
    }

    // гарантируем, что фронт всегда получает все известные поля
    for (const key of ['ACTIVE', 'ARCHIVE', 'DRAFT', 'REVIEW', 'DELETED']) {
      if (!(key in stats)) stats[key] = 0;
    }

    return stats;
  }
}
