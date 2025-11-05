// src/offers/offers.service.ts
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Offer } from './entities/offer.entity';
import { CreateOfferDto } from './dto/create-offer.dto';
import { QueryOffersDto, SortBy } from './dto/query-offers.dto';
import { UpdateOfferDto } from './dto/update-offer.dto';
import { UpdateOfferStatusDto } from './dto/update-offer-status.dto';
import { Location } from 'src/locations/location.entity';
import { ModerationService } from 'src/moderation/moderation.service';
import { OfferChannelCode } from 'src/offer-channels/offer-channel.enum';
import { BenefitKind } from './enums/benefit-kind.enum';
import { OfferScope } from './enums/offer-scope.enum';

type Num = number | null | undefined;

function toFixedStr(n: Num): string | null {
  if (n === undefined || n === null || Number.isNaN(n)) return null;
  return (Math.round(n * 100) / 100).toFixed(2);
}

function normalizePrices(dto: CreateOfferDto) {
  const oldP = dto.oldPrice ?? null;
  const newP = dto.newPrice ?? null;
  const dAmt = dto.discountAmount ?? null;
  const dPct = dto.discountPercent ?? null;

  let oldPrice = oldP, newPrice = newP, discountAmount = dAmt, discountPercent = dPct;

  // NEW_PRICE: если заданы old/new — вывести amount и %
  if (dto.benefitKind === 'NEW_PRICE' && oldPrice != null && newPrice != null && oldPrice > 0 && newPrice >= 0) {
    discountAmount = oldPrice - newPrice;
    discountPercent = oldPrice > 0 ? (discountAmount / oldPrice) * 100 : null;
  }

  // PERCENT_OFF: если есть old + % — вывести new/amount
  if (dto.benefitKind === 'PERCENT_OFF' && oldPrice != null && dPct != null) {
    discountAmount = (oldPrice * dPct) / 100;
    newPrice = oldPrice - discountAmount;
  }

  // AMOUNT_OFF: если есть old + amount — вывести new/%
  if (dto.benefitKind === 'AMOUNT_OFF' && oldPrice != null && dAmt != null) {
    newPrice = oldPrice - dAmt;
    discountPercent = oldPrice > 0 ? (dAmt / oldPrice) * 100 : null;
  }

  // Валидация базовых инвариантов
  if (oldPrice != null && newPrice != null && newPrice > oldPrice) {
    throw new Error('newPrice не может быть больше oldPrice');
  }
  if (discountPercent != null && (discountPercent < 0 || discountPercent > 100)) {
    throw new Error('discountPercent должен быть в диапазоне 0..100');
  }

  return {
    oldPrice: toFixedStr(oldPrice),
    newPrice: toFixedStr(newPrice),
    discountAmount: toFixedStr(discountAmount),
    discountPercent: discountPercent == null ? null : (Math.round(discountPercent * 100) / 100).toFixed(2),
  };
}

@Injectable()
export class OffersService {
  constructor(
    @InjectRepository(Offer)
    private readonly offerRepository: Repository<Offer>,
    @InjectRepository(Location)
    private readonly locationRepository: Repository<Location>,
    private readonly moderationService: ModerationService,
  ) { }
  // ==========================
  //       PUBLIC: CREATE
  // ==========================
  async create(dto: CreateOfferDto & { createdByUserId: number }): Promise<Offer> {
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

      categoryId: dto.categoryId ?? null,
      cityCode: dto.cityCode ?? null,

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
      const moderation = await this.moderationService.validateText(text, 'offer');
      const isFlagged = moderation?.flagged === true;

      await this.offerRepository.update(saved.id, {
        status: isFlagged ? 'DRAFT' : 'ACTIVE',
      });
    } catch (e) {
      // если модерация упала — не мешаем созданию, оставим PENDING
    }

    return saved;
  }

  // ==========================
  //       PRIVATE HELPERS
  // ==========================

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
    // допускаем, что пришли любые комбинации old/new/%/amount
    const oldN = this.parseMoney(dto.oldPrice);
    const newN = this.parseMoney(dto.newPrice);
    const amtN = this.parseMoney(dto.discountAmount);
    const pctN = dto.discountPercent != null ? Number(dto.discountPercent) : null;

    let oldPrice = oldN, newPrice = newN, discountAmount = amtN, discountPercent = pctN;

    if (oldPrice != null && newPrice != null) {
      discountAmount = Math.round((oldPrice - newPrice) * 100) / 100;
      discountPercent = oldPrice > 0 ? Math.round(((oldPrice - newPrice) / oldPrice) * 10000) / 100 : null;
    } else if (oldPrice != null && discountPercent != null) {
      newPrice = Math.round((oldPrice * (1 - discountPercent / 100)) * 100) / 100;
      discountAmount = Math.round((oldPrice - newPrice) * 100) / 100;
    } else if (oldPrice != null && discountAmount != null) {
      newPrice = Math.round((oldPrice - discountAmount) * 100) / 100;
      discountPercent = oldPrice > 0 ? Math.round((discountAmount / oldPrice) * 10000) / 100 : null;
    }

    if (newPrice != null && oldPrice != null && newPrice > oldPrice) {
      throw new BadRequestException('newPrice не может быть больше oldPrice');
    }

    return {
      oldPrice: this.toPgNumericOrNull(oldPrice),
      newPrice: this.toPgNumericOrNull(newPrice),
      discountAmount: this.toPgNumericOrNull(discountAmount),
      discountPercent: discountPercent == null ? null : discountPercent.toFixed(2),
    };
  }

  private validateByBenefitKind(
    dto: CreateOfferDto,
    canon: { oldPrice: string | null; newPrice: string | null; discountAmount: string | null; discountPercent: string | null },
  ) {
    switch (dto.benefitKind) {
      case BenefitKind.PERCENT_OFF:
        if (canon.discountPercent == null && !(canon.oldPrice && canon.newPrice)) {
          throw new BadRequestException('Для PERCENT_OFF задай discountPercent или (oldPrice и newPrice).');
        }
        break;
      case BenefitKind.AMOUNT_OFF:
        if (canon.discountAmount == null && !(canon.oldPrice && canon.newPrice)) {
          throw new BadRequestException('Для AMOUNT_OFF задай discountAmount или (oldPrice и newPrice).');
        }
        break;
      case BenefitKind.NEW_PRICE:
        if (canon.newPrice == null && !(canon.oldPrice && canon.discountPercent)) {
          throw new BadRequestException('Для NEW_PRICE задай newPrice или (oldPrice и discountPercent).');
        }
        break;
      case BenefitKind.BUY_X_GET_Y:
        if (!(dto.buyQty && dto.getQty)) {
          throw new BadRequestException('Для BUY_X_GET_Y обязательно buyQty и getQty.');
        }
        break;
      case BenefitKind.TRADE_IN:
        if (!dto.tradeInRequired) {
          throw new BadRequestException('Для TRADE_IN укажи tradeInRequired=true.');
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
      throw new BadRequestException('Нужно указать хотя бы один канал (channels или primaryChannel).');
    }
    if (primary && !Object.values(OfferChannelCode).includes(primary as OfferChannelCode)) {
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
      throw new BadRequestException(`ctaUrl обязателен для primaryChannel=${primary}`);
    }

    return { channels, primaryChannel: primary ?? null, ctaUrl: url ?? null };
  }

  private async resolveLocations(dto: CreateOfferDto & { createdByUserId: number }) {
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
      throw new BadRequestException('startDate должен быть валидной датой (ISO).');
    }
    if (end && isNaN(endDate!.getTime())) {
      throw new BadRequestException('endDate должен быть валидной датой (ISO).');
    }
    if (startDate && endDate && endDate < startDate) {
      throw new BadRequestException('endDate не может быть раньше startDate.');
    }
    return { startDate, endDate };
  }

  async findAll(
    filters: QueryOffersDto,
  ): Promise<{ data: Offer[]; total: number }> {
    const queryBuilder = this.offerRepository
      .createQueryBuilder('offer')
      .leftJoinAndSelect('offer.locations', 'locations')
      .leftJoinAndSelect('offer.category', 'category')
      .leftJoinAndSelect('offer.offerType', 'offerType');

    if (filters.search) {
      const term = `%${filters.search.toLowerCase()}%`;
      queryBuilder.andWhere(
        '(LOWER(offer.title) LIKE :term OR LOWER(offer.description) LIKE :term)',
        { term },
      );
    }

    if (filters.status) {
      queryBuilder.andWhere('offer.status = :status', {
        status: filters.status,
      });
    }

    if (filters.categoryId) {
      queryBuilder.andWhere('offer.categoryId = :categoryId', {
        categoryId: filters.categoryId,
      });
    }

    if (filters.offerTypeCode) {
      queryBuilder.andWhere('offer.offerTypeCode = :offerTypeCode', {
        offerTypeCode: filters.offerTypeCode,
      });
    }

    if (filters.cityCode) {
      queryBuilder.andWhere('offer.cityCode = :cityCode', {
        cityCode: filters.cityCode,
      });
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
      queryBuilder.andWhere('offer.status = :status', {
        status: filters.status,
      });
    }
    if (filters.offerTypeCode) {
      queryBuilder.andWhere('offer.offerTypeCode = :offerTypeCode', {
        offerTypeCode: filters.offerTypeCode,
      });
    }
    if (filters.cityCode) {
      queryBuilder.andWhere('offer.cityCode = :cityCode', {
        cityCode: filters.cityCode,
      });
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

    // --- 1) Базовые поля
    if (dto.title !== undefined) offer.title = dto.title;
    if (dto.description !== undefined) offer.description = dto.description;
    if (dto.categoryId !== undefined) offer.categoryId = dto.categoryId ?? null;
    if (dto.cityCode !== undefined) offer.cityCode = dto.cityCode ?? null;

    // --- 2) Тип выгоды / охват
    if (dto.benefitKind !== undefined) offer.benefitKind = dto.benefitKind as BenefitKind;
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
      const { startDate, endDate } = this.parseDates(dto.startDate!, dto.endDate!);
      offer.startDate = startDate ?? null;
      offer.endDate = endDate ?? null;
      if (offer.startDate && offer.endDate && offer.endDate < offer.startDate) {
        throw new BadRequestException('endDate не может быть раньше startDate.');
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
        oldPrice: dto.oldPrice ?? (offer.oldPrice ? Number(offer.oldPrice) : undefined),
        newPrice: dto.newPrice ?? (offer.newPrice ? Number(offer.newPrice) : undefined),
        discountAmount: dto.discountAmount ?? (offer.discountAmount ? Number(offer.discountAmount) : undefined),
        discountPercent: dto.discountPercent ?? (offer.discountPercent ? Number(offer.discountPercent) : undefined),
        buyQty: dto.buyQty ?? offer.buyQty ?? undefined,
        getQty: dto.getQty ?? offer.getQty ?? undefined,
        tradeInRequired: dto.tradeInRequired ?? offer.tradeInRequired ?? undefined,
      };

      const canon = this.computeCanonical(temp as any);

      // Валидация под benefitKind
      this.validateByBenefitKind(
        { ...temp } as any,
        canon,
      );

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
    if (dto.campaignName !== undefined) offer.campaignName = dto.campaignName ?? null;

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
      const allowed = new Set(['DRAFT', 'ACTIVE', 'ARCHIVE', 'DELETED', 'PENDING']);
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
}
