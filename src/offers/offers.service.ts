// src/offers/offers.service.ts
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Offer, OfferStatus } from './entities/offer.entity';
import { CreateOfferDto } from './dto/create-offer.dto';
import { QueryOffersDto, SortBy } from './dto/query-offers.dto';
import { UpdateOfferDto } from './dto/update-offer.dto';
import { UpdateOfferStatusDto } from './dto/update-offer-status.dto';
import { Location } from 'src/locations/location.entity';
import { ModerationService } from 'src/moderation/moderation.service';
import { OfferChannelCode } from 'src/offer-channels/offer-channel.enum';
import { BenefitKind } from './enums/benefit-kind.enum';
import { OfferScope } from './enums/offer-scope.enum';

@Injectable()
export class OffersService {
  constructor(
    @InjectRepository(Offer)
    private readonly offerRepository: Repository<Offer>,
    @InjectRepository(Location)
    private readonly locationRepository: Repository<Location>,
    private readonly moderationService: ModerationService,
  ) {}

  private parseMoney(v: any): number | null {
    if (v == null) return null;
    const s = String(v)
      .replace(/[\s\u00A0]/g, '')
      .replace(/[^\d.,-]/g, '')
      .replace(',', '.');
    const n = Number(s);
    return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
  }

  private toPgNumericOrNull(n: number | null): string | null {
    return n == null ? null : n.toFixed(2); // хранить NUMERIC как строку с 2 знаками
  }

  private computeCanonical(dto: CreateOfferDto) {
    const oldN = this.parseMoney(dto.oldPrice);
    const newN = this.parseMoney(dto.newPrice);
    const amtN = this.parseMoney(dto.discountAmount);
    const pctN =
      dto.discountPercent != null ? Number(dto.discountPercent) : null;

    let oldPrice = oldN,
      newPrice = newN,
      discountAmount = amtN,
      discountPercent = pctN;

    if (oldPrice != null && newPrice != null) {
      discountAmount = Math.round((oldPrice - newPrice) * 100) / 100;
      discountPercent =
        oldPrice > 0
          ? Math.round(((oldPrice - newPrice) / oldPrice) * 10000) / 100
          : null;
    } else if (oldPrice != null && discountPercent != null) {
      newPrice = Math.round(oldPrice * (1 - discountPercent / 100) * 100) / 100;
      discountAmount = Math.round((oldPrice - newPrice) * 100) / 100;
    } else if (oldPrice != null && discountAmount != null) {
      newPrice = Math.round((oldPrice - discountAmount) * 100) / 100;
      discountPercent =
        oldPrice > 0
          ? Math.round((discountAmount / oldPrice) * 10000) / 100
          : null;
    }

    if (newPrice != null && oldPrice != null && newPrice > oldPrice) {
      throw new BadRequestException('newPrice не может быть больше oldPrice');
    }

    return {
      oldPrice: this.toPgNumericOrNull(oldPrice),
      newPrice: this.toPgNumericOrNull(newPrice),
      discountAmount: this.toPgNumericOrNull(discountAmount),
      discountPercent:
        discountPercent == null ? null : discountPercent.toFixed(2),
    };
  }

  private validateByBenefitKind(
    dto: CreateOfferDto,
    canon: {
      oldPrice: string | null;
      newPrice: string | null;
      discountAmount: string | null;
      discountPercent: string | null;
    },
  ) {
    switch (dto.benefitKind) {
      case BenefitKind.PERCENT_OFF:
        if (
          canon.discountPercent == null &&
          !(canon.oldPrice && canon.newPrice)
        ) {
          throw new BadRequestException(
            'Для PERCENT_OFF задай discountPercent или (oldPrice и newPrice).',
          );
        }
        break;
      case BenefitKind.AMOUNT_OFF:
        if (
          canon.discountAmount == null &&
          !(canon.oldPrice && canon.newPrice)
        ) {
          throw new BadRequestException(
            'Для AMOUNT_OFF задай discountAmount или (oldPrice и newPrice).',
          );
        }
        break;
      case BenefitKind.NEW_PRICE:
        if (
          canon.newPrice == null &&
          !(canon.oldPrice && canon.discountPercent)
        ) {
          throw new BadRequestException(
            'Для NEW_PRICE задай newPrice или (oldPrice и discountPercent).',
          );
        }
        break;
      case BenefitKind.BUY_X_GET_Y:
        if (!(dto.buyQty && dto.getQty)) {
          throw new BadRequestException(
            'Для BUY_X_GET_Y обязательно buyQty и getQty.',
          );
        }
        break;
      case BenefitKind.TRADE_IN:
        if (!dto.tradeInRequired) {
          throw new BadRequestException(
            'Для TRADE_IN укажи tradeInRequired=true.',
          );
        }
        break;
      default:
        // на будущее
        break;
    }
  }

  private validateChannels(dto: CreateOfferDto) {
    const channels = Array.isArray(dto.channels) ? [...dto.channels] : [];
    const primary = dto.primaryChannel ?? null;
    const url = dto.ctaUrl ?? null;

    if (!channels.length && !primary) {
      throw new BadRequestException(
        'Нужно указать хотя бы один канал (channels или primaryChannel).',
      );
    }
    if (
      primary &&
      !Object.values(OfferChannelCode).includes(primary as OfferChannelCode)
    ) {
      throw new BadRequestException('primaryChannel: неизвестный код канала.');
    }
    if (primary && !channels.includes(primary)) {
      channels.push(primary);
    }

    const needsUrlFor = new Set<OfferChannelCode>([
      OfferChannelCode.WEBSITE,
      OfferChannelCode.MARKETPLACE,
      OfferChannelCode.APP_WOLT,
      OfferChannelCode.APP_KASPI,
      OfferChannelCode.SOCIAL_INSTAGRAM,
      OfferChannelCode.SOCIAL_TIKTOK,
    ]);
    if (primary && needsUrlFor.has(primary as OfferChannelCode) && !url) {
      throw new BadRequestException(
        `ctaUrl обязателен для primaryChannel=${primary}`,
      );
    }

    return { channels, primaryChannel: primary ?? null, ctaUrl: url ?? null };
  }

  private async resolveLocations(
    dto: CreateOfferDto & { createdByUserId: number },
  ) {
    if (!dto.locationIds?.length) return [];
    return this.locationRepository.find({
      where: {
        id: In(dto.locationIds),
        createdByUserId: dto.createdByUserId,
      },
    });
  }

  private parseDates(start?: string, end?: string) {
    const startDate = start ? new Date(start) : null;
    const endDate = end ? new Date(end) : null;

    if (start && isNaN(startDate!.getTime())) {
      throw new BadRequestException(
        'startDate должен быть валидной датой (ISO).',
      );
    }
    if (end && isNaN(endDate!.getTime())) {
      throw new BadRequestException(
        'endDate должен быть валидной датой (ISO).',
      );
    }
    if (startDate && endDate && endDate < startDate) {
      throw new BadRequestException('endDate не может быть раньше startDate.');
    }
    return { startDate, endDate };
  }
  // ==========================
  //       PUBLIC: CREATE
  // ==========================
  async create(
    dto: CreateOfferDto & { createdByUserId: number },
  ): Promise<Offer> {
    // 0) Базовые проверки (даты)
    const { startDate, endDate } = this.parseDates(dto.startDate, dto.endDate);

    // 1) Канонизация цен/скидок
    const canon = this.computeCanonical(dto);

    // 2) Валидации под тип выгоды
    this.validateByBenefitKind(dto, canon);

    // 3) Каналы (где применимо) + CTA
    const chan = this.validateChannels(dto);

    // 4) Локации
    const locations = await this.resolveLocations(dto);

    // 5) Сбор сущности
    const offer = this.offerRepository.create({
      title: dto.title,
      description: dto.description,

      categoryId: dto.categoryId ?? 1,
      cityCode: dto.cityCode ?? 'astana',

      benefitKind: dto.benefitKind as BenefitKind,
      scope: dto.scope as OfferScope,

      oldPrice: canon.oldPrice,
      newPrice: canon.newPrice,
      discountAmount: canon.discountAmount,
      discountPercent: canon.discountPercent,

      buyQty: dto.buyQty ?? null,
      getQty: dto.getQty ?? null,
      tradeInRequired: dto.tradeInRequired ?? null,

      eligibility: dto.eligibility ?? null,

      campaignId: null,
      campaignName: null,

      startDate,
      endDate,

      posters: dto.posters ?? [],

      channels: chan.channels,
      primaryChannel: chan.primaryChannel,
      ctaUrl: chan.ctaUrl,

      sourceSystem: dto.sourceSystem ?? 'MANUAL',
      sourceUrl: dto.sourceUrl ?? null,

      createdByUserId: dto.createdByUserId,
      status: 'PENDING',

      locations,
    });

    // 6) Сохранение
    const saved = await this.offerRepository.save(offer);

    // 7) Модерация (как у тебя)
    try {
      const text = `${dto.title}\n${dto.description ?? ''}`;
      const moderation = await this.moderationService.validateText(
        text,
        'offer',
      );
      const isFlagged = moderation?.flagged === true;

      await this.offerRepository.update(saved.id, {
        status: isFlagged ? 'DRAFT' : 'ACTIVE',
      });
    } catch (e) {
      // если модерация упала — не мешаем созданию, оставим PENDING
    }

    return saved;
  }

  async findAll(
    filters: QueryOffersDto,
  ): Promise<{ data: Offer[]; total: number }> {
    console.log('filters: ', filters);
    const baseQuery = this.offerRepository
      .createQueryBuilder('offer')
      .leftJoinAndSelect('offer.locations', 'location')
      .leftJoinAndSelect('offer.category', 'category')
      .leftJoin('offer.user', 'user') // 👈 только join, без select всех полей
      .addSelect(['user.id', 'user.name', 'user.avatar']); // 👈 только нужные

    // Поиск по строке
    if (filters.search) {
      const term = `%${filters.search.toLowerCase()}%`;
      baseQuery.andWhere(
        '(LOWER(offer.title) LIKE :term ' +
          'OR LOWER(offer.description) LIKE :term ' +
          'OR LOWER(offer.campaignName) LIKE :term ' +
          'OR LOWER(category.name) LIKE :term)',
        { term },
      );
    }

    // 🔒 Город обязателен
    if (!filters.cityCode) {
      throw new BadRequestException(
        'cityCode обязателен для выборки предложений',
      );
    }

    baseQuery.andWhere('offer.cityCode = :cityCode', {
      cityCode: filters.cityCode,
    });

    // Категория
    if (filters.categoryId) {
      baseQuery.andWhere('offer.categoryId = :categoryId', {
        categoryId: filters.categoryId,
      });
    }

    // Только офферы конкретного пользователя
    if (filters.userId) {
      baseQuery.andWhere('offer.userId = :userId', {
        userId: filters.userId,
      });
    }

    // Фильтр по цене
    if (filters.priceMin) {
      baseQuery.andWhere('offer.newPrice >= :priceMin', {
        priceMin: filters.priceMin,
      });
    }

    if (filters.priceMax) {
      baseQuery.andWhere('offer.newPrice <= :priceMax', {
        priceMax: filters.priceMax,
      });
    }

    // Фильтр по скидке
    if (filters.discountMin) {
      baseQuery.andWhere('offer.discountPercent >= :discountMin', {
        discountMin: filters.discountMin,
      });
    }

    if (filters.discountMax) {
      baseQuery.andWhere('offer.discountPercent <= :discountMax', {
        discountMax: filters.discountMax,
      });
    }

    // Активные сейчас
    if (filters.isActiveNow) {
      baseQuery.andWhere(
        'offer.startDate <= NOW() AND (offer.endDate IS NULL OR offer.endDate >= NOW())',
      );
    }

    // Тип выгоды
    if (filters.benefitKind) {
      baseQuery.andWhere('offer.benefitKind = :benefitKind', {
        benefitKind: filters.benefitKind,
      });
    }

    // Охват
    if (filters.scope) {
      baseQuery.andWhere('offer.scope = :scope', { scope: filters.scope });
    }

    // 🍣 Фильтрация по метаданным
    if (filters.dishType) {
      baseQuery.andWhere(`offer.meta->>'dishType' = :dishType`, {
        dishType: filters.dishType,
      });
    }
    if (filters.cuisine) {
      baseQuery.andWhere(`offer.meta->>'cuisine' = :cuisine`, {
        cuisine: filters.cuisine,
      });
    }
    if (filters.deal) {
      baseQuery.andWhere(`offer.meta->'deal' ? :deal`, { deal: filters.deal });
    }
    if (filters.protein) {
      baseQuery.andWhere(`offer.meta->'protein' ? :protein`, {
        protein: filters.protein,
      });
    }
    if (filters.mealType) {
      baseQuery.andWhere(`offer.meta->>'mealType' = :mealType`, {
        mealType: filters.mealType,
      });
    }
    if (filters.serviceType) {
      baseQuery.andWhere(`offer.meta->>'serviceType' = :serviceType`, {
        serviceType: filters.serviceType,
      });
    }
    if (filters.productType) {
      baseQuery.andWhere(`offer.meta->>'productType' = :productType`, {
        productType: filters.productType,
      });
    }

    const sortFieldMap: Record<string, string> = {
      createdAt: 'offer.createdAt',
      discountPercent: 'offer.discountPercent',
      newPrice: 'offer.newPrice',
      title: 'offer.title',
    };

    const sortField = sortFieldMap[filters.sortBy] || 'offer.createdAt';
    baseQuery.orderBy(sortField, filters.sortOrder ?? 'DESC');

    const page = filters.page ?? 1;
    const limit = filters.limit ?? 20;

    baseQuery.skip((page - 1) * limit).take(limit);

    const [data, total] = await baseQuery.getManyAndCount();

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
    // if (filters.status) {
    //   queryBuilder.andWhere('offer.status = :status', {
    //     status: filters.status,
    //   });
    // }
    // if (filters.offerTypeCode) {
    //   queryBuilder.andWhere('offer.offerTypeCode = :offerTypeCode', {
    //     offerTypeCode: filters.offerTypeCode,
    //   });
    // }
    // if (filters.cityCode) {
    //   queryBuilder.andWhere('offer.cityCode = :cityCode', {
    //     cityCode: filters.cityCode,
    //   });
    // }

    const sortFieldMap: Record<SortBy, string> = {
      createdAt: 'offer.createdAt',
      title: 'offer.title',
      discountPercent: 'offer.discountPercent',
      distance: 'offer.distance',
      newPrice: 'offer.newPrice',
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

    // --- 1) Базовые поля
    if (dto.title !== undefined) offer.title = dto.title;
    if (dto.description !== undefined) offer.description = dto.description;
    if (dto.categoryId !== undefined) offer.categoryId = dto.categoryId ?? null;
    if (dto.cityCode !== undefined) offer.cityCode = dto.cityCode ?? null;

    // --- 2) Тип выгоды / охват
    if (dto.benefitKind !== undefined)
      offer.benefitKind = dto.benefitKind as BenefitKind;
    if (dto.scope !== undefined) offer.scope = dto.scope as OfferScope;

    // --- 3) Даты/период и "архивирование"
    // архивирование: если archived=true — выставляем endDate в прошлое (вчера),
    // archived=false — снимаем архив, очищаем дату окончания, если явно не заданы start/end.
    if (dto.archived !== undefined) {
      if (dto.archived) {
        offer.endDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
        // startDate оставляем как было, если нужно — клиент может прислать отдельно
      } else {
        // снимаем «архив», только если клиент не передал явные даты ниже
        offer.endDate = null;
      }
    }

    // явное управление датами имеет приоритет над archived
    if (dto.startDate || dto.endDate) {
      const { startDate, endDate } = this.parseDates(
        dto.startDate!,
        dto.endDate!,
      );
      offer.startDate = startDate ?? null;
      offer.endDate = endDate ?? null;
      if (offer.startDate && offer.endDate && offer.endDate < offer.startDate) {
        throw new BadRequestException(
          'endDate не может быть раньше startDate.',
        );
      }
    }

    // --- 4) Канонизация цен/скидок
    const needCanon =
      dto.oldPrice !== undefined ||
      dto.newPrice !== undefined ||
      dto.discountAmount !== undefined ||
      dto.discountPercent !== undefined ||
      dto.buyQty !== undefined ||
      dto.getQty !== undefined ||
      dto.tradeInRequired !== undefined ||
      dto.benefitKind !== undefined;

    if (needCanon) {
      // Собираем временный dto из текущего оффера + патча
      const temp = {
        benefitKind: (dto.benefitKind ?? offer.benefitKind) as BenefitKind,
        oldPrice:
          dto.oldPrice ?? (offer.oldPrice ? Number(offer.oldPrice) : undefined),
        newPrice:
          dto.newPrice ?? (offer.newPrice ? Number(offer.newPrice) : undefined),
        discountAmount:
          dto.discountAmount ??
          (offer.discountAmount ? Number(offer.discountAmount) : undefined),
        discountPercent:
          dto.discountPercent ??
          (offer.discountPercent ? Number(offer.discountPercent) : undefined),
        buyQty: dto.buyQty ?? offer.buyQty ?? undefined,
        getQty: dto.getQty ?? offer.getQty ?? undefined,
        tradeInRequired:
          dto.tradeInRequired ?? offer.tradeInRequired ?? undefined,
      };

      const canon = this.computeCanonical(temp as any);

      // Валидация под benefitKind
      this.validateByBenefitKind({ ...temp } as any, canon);

      offer.oldPrice = canon.oldPrice;
      offer.newPrice = canon.newPrice;
      offer.discountAmount = canon.discountAmount;
      offer.discountPercent = canon.discountPercent;

      offer.buyQty = temp.buyQty ?? null;
      offer.getQty = temp.getQty ?? null;
      offer.tradeInRequired = temp.tradeInRequired ?? null;
    }

    // --- 5) Условия доступа / eligibility (jsonb, мерж или замена)
    if (dto.eligibility !== undefined) {
      // для MVP проще заменять целиком; если нужен merge — раскомментируй:
      // offer.eligibility = { ...(offer.eligibility ?? {}), ...(dto.eligibility ?? {}) };
      offer.eligibility = dto.eligibility ?? null;
    }

    // --- 6) Кампания (метка)
    if (dto.campaignId !== undefined) offer.campaignId = dto.campaignId ?? null;
    if (dto.campaignName !== undefined)
      offer.campaignName = dto.campaignName ?? null;

    // --- 7) Медиа
    if (dto.posters !== undefined) offer.posters = dto.posters ?? [];

    // --- 8) Каналы применения и CTA
    if (
      dto.channels !== undefined ||
      dto.primaryChannel !== undefined ||
      dto.ctaUrl !== undefined
    ) {
      const chan = this.validateChannels({
        channels: dto.channels ?? offer.channels ?? [],
        primaryChannel: dto.primaryChannel ?? offer.primaryChannel ?? null,
        ctaUrl: dto.ctaUrl ?? offer.ctaUrl ?? null,
      } as any);

      offer.channels = chan.channels;
      offer.primaryChannel = chan.primaryChannel;
      offer.ctaUrl = chan.ctaUrl;
    }

    // --- 9) Привязка к локациям
    if (dto.locationIds !== undefined) {
      if (!dto.locationIds?.length) {
        offer.locations = [];
      } else {
        const locs = await this.locationRepository.find({
          where: { id: In(dto.locationIds), createdByUserId: userId },
        });
        offer.locations = locs;
      }
    }

    // --- 10) Статус (по желанию)
    if (dto.status !== undefined) {
      // Разреши только валидные статусы
      const allowed = new Set([
        'DRAFT',
        'ACTIVE',
        'ARCHIVE',
        'DELETED',
        'PENDING',
      ]);
      if (!allowed.has(dto.status)) {
        throw new BadRequestException('Недопустимый статус.');
      }
      offer.status = dto.status as any;
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

  async findOneById(
    id: number,
    options?: { includeDeleted?: boolean },
  ): Promise<Offer> {
    const includeDeleted = options?.includeDeleted ?? false;

    const qb = this.offerRepository
      .createQueryBuilder('offer')
      .leftJoinAndSelect('offer.locations', 'location')
      .leftJoin('offer.user', 'user')
      .addSelect(['user.id', 'user.name', 'user.avatar']); // только нужные поля

    qb.where('offer.id = :id', { id });

    if (!includeDeleted) {
      qb.andWhere('offer.status != :deletedStatus', {
        deletedStatus: OfferStatus.DELETED,
      });
    }

    const offer = await qb.getOne();

    if (!offer) {
      throw new NotFoundException(`Offer with id=${id} not found`);
    }

    return offer;
  }

  async getMetaStats(cityCode: string) {
    if (!cityCode || cityCode.trim() === '') {
      throw new BadRequestException(
        'Параметр cityCode обязателен для получения статистики по метаданным.',
      );
    }

    const qb = this.offerRepository
      .createQueryBuilder('offer')
      .select([
        `offer.meta->>'dishType' AS "dishType"`,
        `offer.meta->>'cuisine' AS "cuisine"`,
        `jsonb_array_elements_text(offer.meta->'deal') AS "deal"`,
      ])
      .where('offer.status = :status', { status: OfferStatus.ACTIVE })
      .andWhere('offer.cityCode = :cityCode', { cityCode });

    const rows = await qb.getRawMany();

    const stats = {
      dishType: {} as Record<string, number>,
      cuisine: {} as Record<string, number>,
      deal: {} as Record<string, number>,
    };

    for (const r of rows) {
      if (r.dishType)
        stats.dishType[r.dishType] = (stats.dishType[r.dishType] ?? 0) + 1;
      if (r.cuisine)
        stats.cuisine[r.cuisine] = (stats.cuisine[r.cuisine] ?? 0) + 1;
      if (r.deal) stats.deal[r.deal] = (stats.deal[r.deal] ?? 0) + 1;
    }

    return stats;
  }
}
