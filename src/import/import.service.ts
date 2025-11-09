// src/imports/imports.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { User } from 'src/users/entities/user.entity';
import { Location as LocationEntity } from 'src/locations/location.entity';
import { Offer } from 'src/offers/entities/offer.entity';
import { OfferChannel } from 'src/offer-channels/offer-channel.entity';
import { WoltDealDto, WoltItemDto } from './dto/wolt-import.dto';
import { BenefitKind } from 'src/offers/enums/benefit-kind.enum';
import { OfferScope } from 'src/offers/enums/offer-scope.enum';
import { OfferChannelCode } from 'src/offer-channels/offer-channel.enum';
import path from 'path';
import fs from "fs";

@Injectable()
export class ImportService {
  constructor(
    private readonly ds: DataSource,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(LocationEntity)
    private readonly locRepo: Repository<LocationEntity>,
    @InjectRepository(Offer) private readonly offerRepo: Repository<Offer>,
    @InjectRepository(OfferChannel)
    private readonly channelRepo: Repository<OfferChannel>,
  ) { }

  async importWoltDeals(deals: WoltDealDto[], createdByUserId: number) {
    const warnings: string[] = [];

    let businessesCreated = 0;
    let locationsCreated = 0;
    let offersCreated = 0;

    for (const deal of deals) {
      await this.ds.transaction(async (trx) => {
        const userRepo = trx.getRepository(User);
        const locRepo = trx.getRepository(LocationEntity);
        const offerRepo = trx.getRepository(Offer);

        // 1) Бизнес (User.isBusiness)
        const { user, createdBusiness } = await this.ensureBusiness(
          userRepo,
          deal,
        );
        if (createdBusiness) businessesCreated++;

        // 2) Филиал (Location)
        const { location, createdLocation } = await this.ensureLocation(
          locRepo,
          user.id,
          deal,
        );
        if (createdLocation) locationsCreated++;

        // 3) Офферы (items)
        for (const item of deal.items) {
          const normalized = this.normalizeItem(item);
          const { tags, meta } = this.detectTagsDetailed(item.title, item.description);

          // Поиск уже существующего оффера того же бренда
          const existing = await offerRepo.findOne({
            where: {
              title: item.title,
              user: { id: user.id },
              newPrice: normalized.newPriceStr ?? undefined,
              oldPrice: normalized.oldPriceStr ?? undefined,
              sourceSystem: 'WOLT',
            },
            relations: ['locations', 'user'],
          });

          if (existing) {
            // если филиал ещё не привязан — добавляем
            const alreadyLinked = existing.locations.some(l => l.id === location.id);
            if (!alreadyLinked) {
              existing.locations.push(location);
              await offerRepo.save(existing);
            }
            continue; // не создаём дубликат
          }

          // Создание нового оффера
          const offer = offerRepo.create({
            title: item.title,
            description: item.description ?? '',
            categoryId: 1,
            cityCode: 'astana',
            benefitKind: normalized.benefitKind,
            scope: OfferScope.ITEM,
            oldPrice: normalized.oldPriceStr,
            newPrice: normalized.newPriceStr,
            discountAmount: normalized.discountAmountStr,
            discountPercent: normalized.discountPercentStr,
            eligibility: {
              channel_codes: ['APP_WOLT'],
              source_link: deal.link,
              discount_text_raw: item.discountText,
            },
            tags,
            meta,
            posters: item.image ? [item.image] : [],
            createdByUserId,
            status: 'ACTIVE',
            user,
            channels: [OfferChannelCode.APP_WOLT],
            sourceSystem: 'WOLT',
            sourceUrl: deal.link,
            locations: [location],
          });

          await offerRepo.save(offer);
          offersCreated++;
        }
      });
    }

    return { businessesCreated, locationsCreated, offersCreated, warnings };
  }

  /** Создать/найти бизнес (User) по brandSlug/brandName/phone */
  private async ensureBusiness(userRepo: Repository<User>, deal: WoltDealDto) {
    const slugCandidate =
      (deal.info?.brandSlug || '')
        .toString()
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9-]+/g, '-') ||
      this.slugify(deal.info?.brandName || deal.name);

    let user = await userRepo.findOne({
      where: [{ slug: slugCandidate }, { phone: deal.info?.phone ?? '' }],
    });
    let createdBusiness = false;

    if (!user) {
      user = userRepo.create({
        email: null,
        phone: deal.info?.phone ?? null,
        passwordHash: '!', // placeholder
        slug: slugCandidate,
        name: (deal.info?.brandName || deal.name || '').trim().slice(0, 255),
        avatar: deal.info?.logo ?? null,
        isBusiness: true,
        isVerified: false,
      });
      user = await userRepo.save(user);
      createdBusiness = true;
    }

    return { user, createdBusiness };
  }

  private detectTagsDetailed(title: string, description?: string) {
    const text = `${title} ${description || ''}`.toLowerCase();
    const tags: string[] = [];
    const meta: Record<string, any> = {
      cuisine: null,
      dishType: null,
      protein: [],
      technique: [],
      deal: [],
      serviceType: null,
      productType: null,
      mealType: null, // 👈 добавлено
    };

    // 🍣 Тип блюда
    const dishGroups = {
      суши: ['суши', 'ролл', 'маки', 'филадельфия', 'калифорния', 'темпура'],
      пицца: ['пицца', 'pizza'],
      бургер: ['бургер', 'чизбургер', 'воппер', 'burger'],
      донер: ['донер', 'шаурма', 'лаваш', 'шаверма', 'kebab', 'дурум', 'тандыр'],
      лапша: ['вок', 'лагман', 'лапша', 'паста', 'спагетти', 'noodles', 'цомян'],
      салат: ['салат', 'цезарь', 'греческий'],
      суп: ['суп', 'борщ', 'шурпа', 'чечевичный'],
      десерт: ['десерт', 'чизкейк', 'мороженое', 'торт', 'панкейк', 'брауни'],
      закуска: ['брускетта', 'хрустящие палочки', 'наггетсы', 'стрипсы', 'тапас'],
      сэндвич: ['сэндвич', 'бутерброд', 'клаб', 'панини', 'тост'],
      рис: ['рис', 'fried rice', 'мад райс', 'мэд райс'],
      манты: ['манты', 'пельмени', 'дюмplings', 'вареники'],
      завтрак: ['завтрак', 'омлет', 'глазунья', 'скрэмбл', 'фасоль', 'breakfast'],
      комбо: ['комбо', 'сет', 'набор', 'комплекс'],
    };

    for (const [type, kws] of Object.entries(dishGroups)) {
      if (kws.some((w) => text.includes(w))) {
        meta.dishType = type;
        tags.push(type);
        break;
      }
    }

    // 🍗 Белки (ингредиенты)
    const proteins = {
      курица: ['курица', 'куриное', 'цыплёнок', 'chicken'],
      говядина: ['говядина', 'beef', 'ростбиф', 'вырезка'],
      баранина: ['баранина', 'lamb'],
      свинина: ['свинина', 'pork'],
      рыба: ['лосось', 'треска', 'форель', 'рыба', 'тунец'],
      креветки: ['креветки', 'shrimp', 'эби'],
      кальмар: ['кальмар'],
      мидии: ['мидии', 'моллюск'],
      сыр: ['сыр', 'сулугуни', 'фета', 'моцарелла', 'чеддер', 'страчателла'],
      яйцо: ['яйцо', 'глазунья', 'омлет', 'скрэмбл'],
    };

    for (const [prot, kws] of Object.entries(proteins)) {
      if (kws.some((w) => text.includes(w))) meta.protein.push(prot);
    }

    // 🔥 Техника приготовления
    const techniques = {
      гриль: ['гриль', 'барбекю', 'мангал'],
      фритюр: ['фритюр', 'во фритюре', 'жарен', 'панировка', 'темпура', 'кляр'],
      печь: ['запечен', 'в духовке', 'тандыр'],
      варка: ['варен', 'на пару', 'boiled'],
      wok: ['вок', 'stir-fry'],
    };
    for (const [tech, kws] of Object.entries(techniques)) {
      if (kws.some((w) => text.includes(w))) meta.technique.push(tech);
    }

    // 🌏 Кухня
    const cuisines = {
      итальянская: ['пицца', 'паста', 'спагетти', 'carbonara', 'тальятелле', 'песто', 'брускетта'],
      японская: ['суши', 'ролл', 'сашими', 'маки', 'соевый соус', 'васаби', 'темпура'],
      казахская: ['бешбармак', 'куырдак', 'баурсаки'],
      узбекская: ['плов', 'сомса', 'лагман', 'манты'],
      азиатская: ['вок', 'соус терияки', 'свит чили', 'тайская', 'азиатский', 'соус ладжан'],
      европейская: ['салат', 'бургер', 'стейк', 'сэндвич', 'завтрак'],
      кофейня: ['кофе', 'латте', 'капучино', 'эспрессо', 'чай', 'cappuccino', 'americano'],
      ближневосточная: ['донер', 'шаурма', 'лаваш', 'kebab'],
    };
    for (const [cuisine, kws] of Object.entries(cuisines)) {
      if (kws.some((w) => text.includes(w))) {
        meta.cuisine = cuisine;
        tags.push(cuisine);
        break;
      }
    }

    // 🍽 Тип приёма пищи
    if (/завтрак|омлет|фасоль|скрэмбл|breakfast/i.test(text)) meta.mealType = 'завтрак';
    if (/ланч|обед/i.test(text)) meta.mealType = 'обед';
    if (/ужин|dinner/i.test(text)) meta.mealType = 'ужин';

    // 💬 Тип предложения
    if (/комбо|сет|набор/i.test(text)) meta.deal.push('комбо');
    if (/скидк|%|новинка|акция/i.test(text)) meta.deal.push('акция');

    // 🦷 Услуги
    if (/зуб|стоматолог|ортодонт/i.test(text)) {
      meta.serviceType = 'стоматология';
      tags.push('стоматология');
    }
    if (/мойка|ремонт|услуга/i.test(text)) {
      meta.serviceType = 'ремонт';
      tags.push('услуги');
    }

    // 🛠 Магазины / техника
    if (/масло|шина|аккумулятор|запчаст/i.test(text)) {
      meta.productType = 'автотовары';
      tags.push('авто');
    }

    // Если ничего не найдено
    if (!tags.length) {
      tags.push('прочее');
      this.logUnrecognized(text);
    }

    return { tags: [...new Set(tags)], meta };
  }

  /** Логирование нераспознанных текстов в файл */
  private logUnrecognized(text: string) {
    try {
      const logsDir = path.resolve(process.cwd(), 'logs');
      const filePath = path.join(logsDir, 'unrecognized.json');

      // создаём папку logs, если её нет
      if (!fs.existsSync(logsDir)) {
        fs.mkdirSync(logsDir, { recursive: true });
      }

      // читаем существующие данные
      let data: string[] = [];
      if (fs.existsSync(filePath)) {
        const raw = fs.readFileSync(filePath, 'utf8');
        data = JSON.parse(raw || '[]');
      }

      // добавляем новый пример, если его ещё нет
      if (!data.includes(text)) {
        data.push(text);
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
      }
    } catch (err) {
      console.error('Ошибка записи в logs/unrecognized.json:', err);
    }
  }

  /** Создать/найти филиал по userId + координаты/адрес */
  private async ensureLocation(locRepo, userId: number, deal: WoltDealDto) {
    const [lat, lng] = deal.info.coordinates ?? [null, null];

    let location =
      lat != null && lng != null
        ? await locRepo.findOne({
          where: { createdByUserId: userId, latitude: lat, longitude: lng },
        })
        : null;

    let createdLocation = false;

    if (!location) {
      const parsed = this.parseAddress(deal.info.address!);

      location = locRepo.create({
        name: deal.name,
        city: parsed.city,
        fullAddress: deal.info.address,
        district: parsed.district,
        street: parsed.street,
        houseNumber: parsed.houseNumber,
        residentialComplex: null,
        phone: deal.info.phone ?? null,
        latitude: lat ?? 0,
        longitude: lng ?? 0,
        workingHours: this.mapWorkingHours(deal.info.schedule),
        createdByUserId: userId,
        user: { id: userId } as any,
      });

      location = await locRepo.save(location);
      createdLocation = true;
    }

    return { location, createdLocation };
  }

  /** Нормализация item → цены/процент */
  private normalizeItem(item: WoltItemDto) {
    const oldNum = this.parseKzt(item.oldPrice);
    const newNum = this.parseKzt(item.newPrice);

    const percentFromText = this.parsePercent(item.discountText);

    let benefitKind: BenefitKind = BenefitKind.NEW_PRICE;
    let discountPercent: number | null = null;
    let discountAmount: number | null = null;

    if (oldNum != null && newNum != null) {
      discountAmount = oldNum - newNum;
      discountPercent = oldNum > 0 ? (discountAmount / oldNum) * 100 : null;
      benefitKind = BenefitKind.NEW_PRICE;
    } else if (percentFromText != null) {
      discountPercent = percentFromText;
      benefitKind = BenefitKind.PERCENT_OFF;
    }

    return {
      benefitKind,
      oldPriceStr: oldNum != null ? oldNum.toFixed(2) : null,
      newPriceStr: newNum != null ? newNum.toFixed(2) : null,
      discountAmountStr:
        discountAmount != null ? discountAmount.toFixed(2) : null,
      discountPercentStr:
        discountPercent != null ? discountPercent.toFixed(2) : null,
    };
  }

  private parseKzt(raw?: string): number | null {
    if (!raw) return null;
    const digits = raw
      .replace(/[^\d.,]/g, '')
      .replace(/\s/g, '')
      .replace(',', '.');
    const n = Number(digits);
    return Number.isFinite(n) ? n : null;
  }

  private parsePercent(txt?: string): number | null {
    if (!txt) return null;
    const m = txt.match(/(-?\d{1,3})\s*%/);
    if (!m) return null;
    const n = Number(m[1]);
    return Number.isFinite(n) ? Math.max(0, Math.min(100, Math.abs(n))) : null;
  }

  private slugify(s: string): string {
    return (s || '')
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^\w\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .slice(0, 255);
  }

  private mapWorkingHours(
    src?: Record<string, string>,
  ): Record<string, any> | undefined {
    if (!src) return undefined;
    const map: Record<string, string> = {
      Понедельник: 'monday',
      Вторник: 'tuesday',
      Среда: 'wednesday',
      Четверг: 'thursday',
      Пятница: 'friday',
      Суббота: 'saturday',
      Воскресенье: 'sunday',
    };
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(src)) {
      const key = map[k] || k.toLowerCase();
      // Если “Круглосуточно” — сохраняем как { open: 'Круглосуточно', close: 'Круглосуточно' }
      out[key] = typeof v === 'string' ? { open: v, close: v } : v;
    }
    return out;
  }

  private parseAddress(address: string) {
    // "Сарайшык 5, 010000 Астана‎"
    const parts = (address || '').split(',').map((x) => x.trim());
    const first = parts[0] || '';
    const m = first.match(/^(.+?)\s+(\S+)$/);
    const street = m ? m[1] : first;
    const houseNumber = m ? m[2] : '';
    const city = parts.find((p) => /Астана|Алматы|Шымкент/i.test(p)) || '';
    return {
      city: city || 'Астана',
      district: '',
      street,
      houseNumber,
    };
  }
}
