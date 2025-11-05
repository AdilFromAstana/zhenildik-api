// src/imports/wolt-import.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from 'src/users/entities/user.entity';
import { Location } from 'src/locations/location.entity';
import { Offer } from 'src/offers/entities/offer.entity';
import { OffersService } from 'src/offers/offers.service';
import { LocationsService } from 'src/locations/locations.service';
import { OfferChannelCode } from 'src/offer-channels/offer-channel.enum';
import { BenefitKind } from 'src/offers/enums/benefit-kind.enum';
import { OfferScope } from 'src/offers/enums/offer-scope.enum';
import { CreateOfferDto } from 'src/offers/dto/create-offer.dto';

type WoltDeal = {
    name: string;
    link: string;
    discountCount: number;
    items: Array<{
        title: string;
        description?: string;
        discountText?: string;  // напр. "-40% на эти позиции"
        newPrice?: string;      // "2 262 KZT"
        oldPrice?: string;      // "3 770 KZT"
        image?: string;
    }>;
    info: {
        description?: string;
        address?: string;
        coordinates?: [number, number];
        schedule?: Record<string, string>;
        phone?: string | null;
        website?: string | null;       // игнорируем: поля нет в User
        logo?: string | null;
        brandLink?: string | null;
        brandSlug?: string | null;
        brandName?: string | null;
    };
};

@Injectable()
export class WoltImportService {
    private readonly logger = new Logger(WoltImportService.name);

    constructor(
        @InjectRepository(User) private readonly userRepo: Repository<User>,
        @InjectRepository(Location) private readonly locationRepo: Repository<Location>,
        @InjectRepository(Offer) private readonly offerRepo: Repository<Offer>,
        private readonly offerService: OffersService,
        private readonly locationService: LocationsService,
    ) { }

    // === ПУБЛИЧНЫЙ ВХОД ===
    async importWoltData(woltDeals: WoltDeal[]) {
        let businessesCreated = 0;
        let locationsCreated = 0;
        let offersCreated = 0;

        for (const deal of woltDeals) {
            try {
                // 1) Бизнес
                const { user, createdBusiness } = await this.ensureBusiness(deal);
                if (createdBusiness) businessesCreated++;

                // 2) Филиал
                const { location, createdLocation } = await this.ensureLocation(user.id, deal);
                if (createdLocation) locationsCreated++;

                // 3) Офферы
                const cityCode = this.extractCityCode(deal.info?.address);
                for (const item of deal.items || []) {
                    const title = item.title?.trim();
                    if (!title) continue;

                    // Простейшая защита от дублей по (title + author)
                    const exists = await this.offerRepo.findOne({
                        where: { title, createdByUserId: user.id },
                    });
                    if (exists) continue;

                    const norm = this.normalizeWoltItem(item);

                    const dto: CreateOfferDto & { createdByUserId: number } = {
                        createdByUserId: user.id,
                        title: item.title,
                        description: item.description || deal.info?.description || '',
                        categoryId: undefined,                  // при желании — маппинг категорий
                        cityCode,

                        benefitKind: norm.benefitKind,
                        scope: OfferScope.ITEM,

                        oldPrice: norm.oldPrice ?? undefined,
                        newPrice: norm.newPrice ?? undefined,
                        discountAmount: norm.discountAmount ?? undefined,
                        discountPercent: norm.discountPercent ?? undefined,

                        eligibility: {
                            channel_codes: [OfferChannelCode.APP_WOLT],
                            source_link: deal.link,
                            discount_text_raw: item.discountText,
                            brand_slug: deal.info?.brandSlug,
                            brand_name: deal.info?.brandName ?? deal.name,
                        },

                        // даты, если будут — заполни здесь
                        // startDate: undefined,
                        // endDate: undefined,

                        posters: item.image ? [item.image] : [],
                        locationIds: [location.id],
                        channels: [OfferChannelCode.APP_WOLT],

                        // эти поля есть в DTO; если в Entity их нет — OffersService их просто проигнорирует
                        primaryChannel: OfferChannelCode.APP_WOLT,
                        ctaUrl: deal.link,
                        sourceSystem: 'WOLT',
                        sourceUrl: deal.link,
                    };

                    await this.offerService.create(dto);
                    offersCreated++;
                    this.logger.log(`💸 Добавлена акция: ${item.title}`);
                }
            } catch (e: any) {
                this.logger.error(`Ошибка при импорте "${deal.name}": ${e?.message ?? e}`);
            }
        }

        return { businessesCreated, locationsCreated, offersCreated };
    }

    // === БИЗНЕС ===
    private async ensureBusiness(deal: WoltDeal) {
        const brandName = (deal.info?.brandName?.trim() || deal.name || '').slice(0, 255);
        const slug =
            (deal.info?.brandSlug?.trim()?.toLowerCase() || this.slugify(brandName)).slice(0, 255);
        const phone = deal.info?.phone ?? null;

        let user = await this.userRepo.findOne({
            where: [{ slug }, ...(phone ? [{ phone }] : [])],
        });

        let createdBusiness = false;
        if (!user) {
            user = this.userRepo.create({
                email: null,
                phone,
                passwordHash: '!', // заглушка для импортируемых бизнесов
                slug,
                name: brandName,
                avatar: deal.info?.logo ?? null,
                isBusiness: true,
                isVerified: false,
            });
            user = await this.userRepo.save(user);
            createdBusiness = true;
            this.logger.log(`➕ Создан бизнес: ${brandName}`);
        }

        return { user, createdBusiness };
    }

    // === ФИЛИАЛ ===
    private async ensureLocation(userId: number, deal: WoltDeal) {
        const address = deal.info?.address ?? '';
        const [lat, lng] = deal.info?.coordinates ?? [null, null];

        // 1) Пытаемся найти по точным координатам
        let location =
            lat != null && lng != null
                ? await this.locationRepo.findOne({
                    where: { createdByUserId: userId, latitude: lat, longitude: lng },
                })
                : null;

        let createdLocation = false;

        if (!location) {
            // Простая запись: street=полный адрес, без парсинга
            location = await this.locationService.create({
                createdByUserId: userId,
                city: this.extractCityName(address) ?? 'Астана',
                district: '',
                street: address,
                houseNumber: '',
                phone: deal.info?.phone ?? undefined,
                latitude: lat ?? 0,
                longitude: lng ?? 0,
                workingHours: this.mapSchedule(deal.info?.schedule),
            });
            createdLocation = true;
            this.logger.log(`📍 Добавлена точка: ${address}`);
        }

        return { location, createdLocation };
    }

    // === НОРМАЛИЗАЦИЯ Wolt item ===
    private normalizeWoltItem(item: {
        oldPrice?: string;
        newPrice?: string;
        discountText?: string;
    }) {
        const oldNum = this.parseKzt(item.oldPrice);
        const newNum = this.parseKzt(item.newPrice);
        const pctTxt = this.parsePercent(item.discountText);

        // Идеальный случай — есть старая и новая цена
        if (oldNum != null && newNum != null && oldNum > 0 && newNum < oldNum) {
            const discountAmount = oldNum - newNum;
            const discountPercent = (discountAmount / oldNum) * 100;
            return {
                benefitKind: BenefitKind.NEW_PRICE as const,
                oldPrice: oldNum,
                newPrice: newNum,
                discountAmount,
                discountPercent,
            };
        }

        // Есть только процент в тексте
        if (pctTxt != null) {
            return {
                benefitKind: BenefitKind.PERCENT_OFF as const,
                oldPrice: null,
                newPrice: null,
                discountAmount: null,
                discountPercent: pctTxt,
            };
        }

        // Есть только новая цена — считаем как NEW_PRICE без oldPrice
        if (newNum != null) {
            return {
                benefitKind: BenefitKind.NEW_PRICE as const,
                oldPrice: null,
                newPrice: newNum,
                discountAmount: null,
                discountPercent: null,
            };
        }

        // Фолбэк
        return {
            benefitKind: BenefitKind.PERCENT_OFF as const,
            oldPrice: null,
            newPrice: null,
            discountAmount: null,
            discountPercent: null,
        };
    }

    // === УТИЛИТЫ ===
    private parseKzt(raw?: string): number | null {
        if (!raw) return null;
        // "2 262 KZT" / "2 262 KZT" / "2,262" → 2262
        const digits = raw.replace(/[^\d.,]/g, '').replace(/\s/g, '').replace(',', '.');
        const n = Number(digits);
        return Number.isFinite(n) ? n : null;
    }

    private parsePercent(txt?: string): number | null {
        if (!txt) return null;
        const m = txt.match(/(-?\d{1,3})\s*%/);
        if (!m) return null;
        const n = Math.abs(Number(m[1]));
        return Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : null;
    }

    private extractCityCode(address?: string | null): string | undefined {
        if (!address) return undefined;
        if (/Астана/i.test(address)) return 'AST';
        if (/Алматы/i.test(address)) return 'ALA';
        if (/Шымкент/i.test(address)) return 'SHY';
        return undefined;
    }

    private extractCityName(address?: string | null): string | undefined {
        if (!address) return undefined;
        if (/Астана/i.test(address)) return 'Астана';
        if (/Алматы/i.test(address)) return 'Алматы';
        if (/Шымкент/i.test(address)) return 'Шымкент';
        return undefined;
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

    private mapSchedule(schedule?: Record<string, string>) {
        if (!schedule) return undefined;
        const out: Record<string, any> = {};
        for (const [day, value] of Object.entries(schedule)) {
            const key = day.toLowerCase(); // храним как есть
            if (!value) {
                out[key] = null;
                continue;
            }
            if (value.includes('Круглосуточно')) {
                out[key] = { open: '00:00', close: '23:59' };
            } else {
                const [open, close] = value.split(/[–-]/).map((x) => x.trim());
                out[key] = { open, close };
            }
        }
        return out;
    }
}
