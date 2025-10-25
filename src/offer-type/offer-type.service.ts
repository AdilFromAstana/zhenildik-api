import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OfferType } from './entities/offer-type.entity';
import { CreateOfferTypeDto } from './dto/create-offer-type.dto';
import { UpdateOfferTypeDto } from './dto/update-offer-type.dto';
import { BulkCreateOfferTypeDto } from './dto/bulk-create-offer-type.dto';

@Injectable()
export class OfferTypeService {
  constructor(
    @InjectRepository(OfferType)
    private readonly repo: Repository<OfferType>,
  ) {}

  async create(dto: CreateOfferTypeDto): Promise<OfferType> {
    const entity = this.repo.create(dto);
    return this.repo.save(entity);
  }

  async seedDefaults(): Promise<OfferType[]> {
    const defaults: CreateOfferTypeDto[] = [
      {
        code: 'DISCOUNT_PERCENT',
        name: 'Скидка (в процентах)',
        description:
          'Процентная скидка. Пример: “–20% на всё меню”. Клиент платит меньше от базовой цены.',
      },
      {
        code: 'DISCOUNT_FIXED',
        name: 'Скидка (фиксированная сумма)',
        description:
          'Фиксированная скидка в валюте. Пример: “–500₽ при покупке от 2000₽”.',
      },
      {
        code: 'DISCOUNT_PRICE_DROP',
        name: 'Снижение цены',
        description:
          'Старая и новая цена. Пример: “990₽ → 790₽”. Указывается прямо в карточке товара.',
      },
      {
        code: 'PROMOCODE',
        name: 'Промокод',
        description:
          'Акция активируется по коду или слову. Пример: “WELCOME25”.',
      },
      {
        code: 'GIFT',
        name: 'Подарок / Бонус',
        description:
          'Бонус или подарок при покупке. Пример: “Кофе в подарок” или “Кешбэк 5%”.',
      },
      {
        code: 'CONTEST',
        name: 'Розыгрыш / Конкурс',
        description:
          'Покупатель участвует в розыгрыше призов. Пример: “Розыгрыш iPhone 15”.',
      },
      {
        code: 'CAMPAIGN',
        name: 'Акция / Спецпредложение',
        description:
          'Объединённое предложение: “Чёрная пятница”, “Неделя скидок”.',
      },
      {
        code: 'NPLUSONE',
        name: '1+1 / N+1',
        description: 'Механика “купи X — получи Y”. Пример: “2 по цене 1”.',
      },
      {
        code: 'EVENT',
        name: 'Ивент / Событие',
        description:
          'Бесплатное или платное мероприятие. Пример: “Мастер-класс по кофе”.',
      },
      {
        code: 'LOYALTY',
        name: 'Программа лояльности',
        description:
          'Баллы, уровни, кэшбэк или скидки для постоянных клиентов.',
      },
      {
        code: 'TRADEIN',
        name: 'Трейд-ин',
        description:
          'Скидка при обмене старого товара. Пример: “Сдай старый телефон — получи –15%”.',
      },
    ];

    const entities = this.repo.create(defaults);
    return this.repo.save(entities);
  }

  findAll(): Promise<OfferType[]> {
    return this.repo.find({ order: { name: 'ASC' } });
  }

  async findOne(id: string): Promise<OfferType> {
    const offerType = await this.repo.findOne({ where: { id } });
    if (!offerType) throw new NotFoundException('Тип предложения не найден');
    return offerType;
  }

  async update(id: string, dto: UpdateOfferTypeDto): Promise<OfferType> {
    const offerType = await this.findOne(id);
    Object.assign(offerType, dto);
    return this.repo.save(offerType);
  }

  async remove(id: string): Promise<void> {
    await this.repo.delete(id);
  }
}
