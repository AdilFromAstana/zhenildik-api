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

@Injectable()
export class ImportService {
    constructor(
        private readonly ds: DataSource,
        @InjectRepository(User) private readonly userRepo: Repository<User>,
        @InjectRepository(LocationEntity) private readonly locRepo: Repository<LocationEntity>,
        @InjectRepository(Offer) private readonly offerRepo: Repository<Offer>,
        @InjectRepository(OfferChannel) private readonly channelRepo: Repository<OfferChannel>,
    ) { }

    async importWoltDeals(deals: WoltDealDto[], createdByUserId: number) {
        const warnings: string[] = [];

        // Канал WOLT (создаём/получаем один раз)
        const appWolt = await this.ensureChannel('APP_WOLT', 'Через приложение Wolt', 'app');

        let businessesCreated = 0;
        let locationsCreated = 0;
        let offersCreated = 0;

        for (const deal of deals) {
            await this.ds.transaction(async (trx) => {
                // 1) Бизнес (User.isBusiness)
                const { user, createdBusiness } = await this.ensureBusiness(trx.getRepository(User), deal);
                if (createdBusiness) businessesCreated++;

                // 2) Филиал (Location)
                const { location, createdLocation } = await this.ensureLocation(
                    trx.getRepository(LocationEntity),
                    user.id,
                    deal,
                );
                if (createdLocation) locationsCreated++;

                // 3) Офферы (items)
                const offerRepo = trx.getRepository(Offer);

                for (const item of deal.items) {
                    const normalized = this.normalizeItem(item);

                    const offer = offerRepo.create({
                        title: item.title,
                        description: item.description ?? '',
                        categoryId: null, // при необходимости — маппинг категорий
                        cityCode: this.extractCityCode(deal.info?.address),
                        benefitKind: normalized.benefitKind,
                        scope: OfferScope.ITEM,

                        oldPrice: normalized.oldPriceStr,
                        newPrice: normalized.newPriceStr,
                        discountAmount: normalized.discountAmountStr,
                        discountPercent: normalized.discountPercentStr,

                        buyQty: null,
                        getQty: null,
                        tradeInRequired: null,

                        eligibility: {
                            channel_codes: ['APP_WOLT'],
                            source_link: deal.link,
                            discount_text_raw: item.discountText,
                        },

                        campaignId: null,
                        campaignName: null,

                        startDate: null,
                        endDate: null,

                        posters: item.image ? [item.image] : [],

                        locations: [location],
                        createdByUserId,
                        status: 'ACTIVE',
                        user: user,
                    });

                    await offerRepo.save(offer);

                    // Привязка каналов (M2M)
                    offer.channels = [OfferChannelCode.APP_WOLT];
                    await offerRepo.save(offer);

                    offersCreated++;
                }
            });
        }

        return { businessesCreated, locationsCreated, offersCreated, warnings };
    }

    /** Канал по коду или создать */
    private async ensureChannel(code: string, name: string, category: string) {
        let ch = await this.channelRepo.findOne({ where: { code } });
        if (!ch) {
            ch = this.channelRepo.create({ code, name, category });
            ch = await this.channelRepo.save(ch);
        }
        return ch;
    }

    /** Создать/найти бизнес (User) по brandSlug/brandName/phone */
    private async ensureBusiness(userRepo: Repository<User>, deal: WoltDealDto) {
        const slugCandidate =
            (deal.info?.brandSlug || '')
                .toString()
                .trim()
                .toLowerCase()
                .replace(/[^a-z0-9-]+/g, '-') || this.slugify(deal.info?.brandName || deal.name);

        let user = await userRepo.findOne({
            where: [
                { slug: slugCandidate },
                { phone: deal.info?.phone ?? '' },
            ],
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

    /** Создать/найти филиал по userId + координаты/адрес */
    private async ensureLocation(
        locRepo,
        userId: number,
        deal: WoltDealDto,
    ) {
        const [lat, lng] = deal.info.coordinates ?? [null, null];

        let location =
            lat != null && lng != null
                ? await locRepo.findOne({ where: { createdByUserId: userId, latitude: lat, longitude: lng } })
                : null;

        let createdLocation = false;

        if (!location) {
            const parsed = this.parseAddress(deal.info.address!);

            location = locRepo.create({
                city: parsed.city,
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
            discountAmountStr: discountAmount != null ? discountAmount.toFixed(2) : null,
            discountPercentStr: discountPercent != null ? discountPercent.toFixed(2) : null,
        };
    }

    private parseKzt(raw?: string): number | null {
        if (!raw) return null;
        const digits = raw.replace(/[^\d.,]/g, '').replace(/\s/g, '').replace(',', '.');
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

    private extractCityCode(address?: string | null): string | null {
        if (!address) return null;
        if (/Астана/i.test(address)) return 'AST';
        if (/Алматы/i.test(address)) return 'ALA';
        if (/Шымкент/i.test(address)) return 'SHY';
        return null;
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

    private mapWorkingHours(src?: Record<string, string>): Record<string, any> | undefined {
        if (!src) return undefined;
        const map: Record<string, string> = {
            'Понедельник': 'monday',
            'Вторник': 'tuesday',
            'Среда': 'wednesday',
            'Четверг': 'thursday',
            'Пятница': 'friday',
            'Суббота': 'saturday',
            'Воскресенье': 'sunday',
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
