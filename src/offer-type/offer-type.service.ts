import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OfferType } from './entities/offer-type.entity';
import { CreateOfferTypeDto } from './dto/create-offer-type.dto';
import { UpdateOfferTypeDto } from './dto/update-offer-type.dto';

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
        description: '–20% на всё меню',
      },
      {
        code: 'DISCOUNT_FIXED',
        name: 'Скидка (фиксированная сумма)',
        description: '–5000тг при покупке от 20000тг',
      },
      {
        code: 'DISCOUNT_PRICE_DROP',
        name: 'Снижение цены',
        description: '9900тг → 7900тг',
      },
      {
        code: 'PROMOCODE',
        name: 'Промокод',
        description: 'WELCOME25',
      },
      {
        code: 'GIFT',
        name: 'Подарок',
        description: 'Кофе в подарок',
      },
      {
        code: 'CONTEST',
        name: 'Розыгрыш',
        description: 'Розыгрыш iPhone 15',
      },
      {
        code: 'CAMPAIGN',
        name: 'Акция',
        description: 'Неделя скидок',
      },
      {
        code: 'NPLUSONE',
        name: '1+1 / N+1',
        description: 'Донер комбо 1+1',
      },
      {
        code: 'LOYALTY',
        name: 'Программа лояльности',
        description: 'Скидки для постоянных клиентов',
      },
      {
        code: 'TRADEIN',
        name: 'Трейд-ин',
        description: 'Сдай старый телефон — получи –15%',
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
