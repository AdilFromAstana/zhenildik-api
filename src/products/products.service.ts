// src/products/products.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, In, Repository } from 'typeorm';
import { Product } from './entities/product.entity';
import { ProductOffer } from 'src/product-offers/product-offer.entity';
import { Merchant } from 'src/merchants/entities/merchant.entity';
import { ProductCategory } from 'src/product-categories/product-category.entity';

type NormalizedExternalProduct = {
  title: string;
  brand: string | null;
  unit: string | null;
  unitQty: number | null;
  categoryPath: string[];
  merchantName: string;
  merchantSku: string;
  url: string | null;
  price: number;
  oldPrice: number | null;
  currency: string;
  extra: any;
  // 🔹 новые поля
  attributes: Record<string, any> | null;
};

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
    @InjectRepository(ProductOffer)
    private readonly offerRepo: Repository<ProductOffer>,
    @InjectRepository(Merchant)
    private readonly merchantRepo: Repository<Merchant>,
    @InjectRepository(ProductCategory)
    private readonly productCategoryRepo: Repository<ProductCategory>,
  ) {}

  // ===== ПУБЛИЧНЫЕ МЕТОДЫ ДЛЯ ЮЗЕРА =====

  async findAllForUser() {
    const products = await this.productRepo.find({
      relations: ['productCategory', 'offers', 'offers.merchant'],
      order: { id: 'DESC' },
    });

    return products.map((p) => {
      const offers =
        p.offers?.filter((o) => o.currentPrice != null && o.isAvailable) ?? [];

      const mappedOffers = offers.map((o) => ({
        id: o.id,
        merchantId: o.merchant.id,
        merchantName: o.merchant.name,
        price: Number(o.currentPrice),
        oldPrice: o.currentOldPrice != null ? Number(o.currentOldPrice) : null,
        discountPercent: o.currentDiscountPercent,
        url: o.url,
        lastSeenAt: o.lastSeenAt,
      }));

      const minPrice = mappedOffers.length
        ? Math.min(...mappedOffers.map((x) => x.price))
        : null;

      const maxDiscount = mappedOffers.length
        ? Math.max(...mappedOffers.map((x) => x.discountPercent))
        : 0;

      const bestOffer =
        mappedOffers.length > 0
          ? [...mappedOffers].sort(
              (a, b) =>
                a.price - b.price || b.discountPercent - a.discountPercent,
            )[0]
          : null;

      return {
        id: p.id,
        title: p.title,
        brand: p.brand,
        unit: p.unit,
        unitQty: p.unitQty,
        productCategory: p.productCategory,
        attributes: p.attributes,
        offersCount: mappedOffers.length,
        minPrice,
        maxDiscountPercent: maxDiscount,
        bestOffer,
      };
    });
  }

  async findOneForUser(id: number) {
    const product = await this.productRepo.findOne({
      where: { id },
      relations: ['productCategory', 'offers', 'offers.merchant'],
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    const offers =
      product.offers
        ?.filter((o) => o.currentPrice != null && o.isAvailable)
        .map((o) => ({
          id: o.id,
          merchantId: o.merchant.id,
          merchantName: o.merchant.name,
          price: Number(o.currentPrice),
          oldPrice:
            o.currentOldPrice != null ? Number(o.currentOldPrice) : null,
          discountPercent: o.currentDiscountPercent,
          url: o.url,
          lastSeenAt: o.lastSeenAt,
        })) ?? [];

    return {
      id: product.id,
      title: product.title,
      brand: product.brand,
      unit: product.unit,
      unitQty: product.unitQty,
      productCategory: product.productCategory,
      attributes: product.attributes,
      offers,
    };
  }

  // ===== НОВОЕ: СОЗДАНИЕ PRODUCT + OFFER ИЗ ВНЕШНЕГО ОБЪЕКТА =====

  /**
   * Создать/найти Product и сразу создать/обновить ProductOffer
   * для внешнего объекта (Arbuz / Kaspi / Wolt).
   */
  async createFromExternal(payload: any) {
    const normalized = this.normalizeExternalProduct(payload);

    // 1. Merchant
    let merchant = await this.merchantRepo.findOne({
      where: { name: normalized.merchantName },
    });
    if (!merchant) {
      merchant = this.merchantRepo.create({
        name: normalized.merchantName,
        website: '', // можно потом заполнить
        logo: null,
      });
      merchant = await this.merchantRepo.save(merchant);
    }

    // 2. ProductCategory (по последнему элементу categoryPath)
    let productCategory: ProductCategory | null = null;
    if (normalized.categoryPath.length > 0) {
      const lastName =
        normalized.categoryPath[normalized.categoryPath.length - 1];
      productCategory = await this.productCategoryRepo.findOne({
        where: { name: lastName },
      });
    }

    // 3. Product — ищем по title + brand (это можно потом доработать)
    let where: FindOptionsWhere<Product> = {
      title: normalized.title,
    };

    if (normalized.brand) {
      where = {
        ...where,
        brand: normalized.brand,
      };
    }

    let product = await this.productRepo.findOne({
      where,
      relations: ['productCategory'],
    });

    if (!product) {
      product = this.productRepo.create({
        title: normalized.title,
        brand: normalized.brand,
        unit: normalized.unit,
        unitQty: normalized.unitQty,
        productCategory: productCategory ?? undefined,
        attributes: normalized.attributes ?? null, // 🔹 здесь
      });

      product = await this.productRepo.save(product);
    } else {
      // опционально: если у продукта ещё нет attributes, а у нормализованного есть — можно заполнить
      if (!product.attributes && normalized.attributes) {
        product.attributes = normalized.attributes;
        product = await this.productRepo.save(product);
      }
    }

    // 4. ProductOffer — ищем по merchant + merchantSku
    let offer = await this.offerRepo.findOne({
      where: {
        merchant: { id: merchant.id },
        merchantSku: normalized.merchantSku,
      },
      relations: ['merchant', 'product'],
    });

    const price = normalized.price;
    const oldPrice = normalized.oldPrice;
    const discountPercent =
      oldPrice && oldPrice > price
        ? Math.round(((oldPrice - price) / oldPrice) * 100)
        : 0;

    if (!offer) {
      offer = this.offerRepo.create({
        product,
        merchant,
        merchantSku: normalized.merchantSku,
        url: normalized.url ?? '',
        currentPrice: price,
        currentOldPrice: oldPrice,
        currentDiscountPercent: discountPercent,
        isAvailable: true,
        lastSeenAt: new Date(),
        extra: normalized.extra,
      });
    } else {
      offer.currentPrice = price;
      offer.currentOldPrice = oldPrice;
      offer.currentDiscountPercent = discountPercent;
      offer.isAvailable = true;
      offer.lastSeenAt = new Date();
      offer.url = normalized.url ?? offer.url;
      offer.extra = normalized.extra ?? offer.extra;
    }

    offer = await this.offerRepo.save(offer);

    return {
      product,
      offer,
    };
  }

  // ===== ВНУТРЕННЯЯ НОРМАЛИЗАЦИЯ СЫРЫХ ОБЪЕКТОВ =====

  private normalizeExternalProduct(payload: any): NormalizedExternalProduct {
    // Kaspi
    if ('configSku' in payload && 'shopLink' in payload) {
      const price = Number(payload.unitSalePrice ?? payload.unitPrice);
      const oldPrice =
        payload.unitSalePrice && payload.unitSalePrice < payload.unitPrice
          ? Number(payload.unitPrice)
          : null;

      // пример извлечения жирности из title "7.1%" и объёма/веса из title "500 г"
      const attrs: Record<string, any> = {};

      const fatMatch = payload.title.match(/(\d+[.,]\d+)\s*%/);
      if (fatMatch) {
        attrs.fatPercent = Number(fatMatch[1].replace(',', '.'));
      }

      const volMatch = payload.title.match(/(\d+(?:[.,]\d+)?)\s*(мл|л|г)/i);
      if (volMatch) {
        attrs.volumeValue = Number(volMatch[1].replace(',', '.'));
        attrs.volumeUnit = volMatch[2]; // "мл" / "г" / "л"
      }

      return {
        title: payload.title,
        brand: payload.brand ?? null,
        unit: payload.unit?.measurementLiteral ?? null,
        unitQty: payload.weight ?? null,
        categoryPath: payload.categoryRu ?? payload.category ?? [],
        merchantName: payload.majorMerchants?.[0] ?? 'Kaspi',
        merchantSku: String(payload.configSku),
        url: `https://kaspi.kz${payload.shopLink}`,
        price,
        oldPrice,
        currency: payload.currency ?? 'KZT',
        extra: payload,
        attributes: Object.keys(attrs).length ? attrs : null, // 🔹
      };
    }

    // Arbuz
    if (
      'catalogId' in payload &&
      'name' in payload &&
      'priceActual' in payload
    ) {
      const price = Number(payload.priceActual);
      const oldPrice =
        payload.pricePrevious && payload.pricePrevious > price
          ? Number(payload.pricePrevious)
          : null;

      const addInfo = payload.additionalInformation ?? {};

      const categoryPath = [
        addInfo.categoryLevel1,
        addInfo.categoryLevel2,
        addInfo.categoryLevel3,
      ].filter(Boolean);

      const attrs: Record<string, any> = {};

      if (payload.nutrition?.fats) {
        attrs.fatPercent = Number(
          String(payload.nutrition.fats).replace(',', '.'),
        );
      }

      // weight: "1 шт" — можно дополнительно парсить при желании

      return {
        title: payload.name,
        brand: payload.brandName ?? null,
        unit: payload.measure ?? null,
        unitQty: null,
        categoryPath,
        merchantName: 'Arbuz',
        merchantSku: String(payload.id),
        url: `https://arbuz.kz${payload.uri}`,
        price,
        oldPrice,
        currency: 'KZT',
        extra: payload,
        attributes: Object.keys(attrs).length ? attrs : null, // 🔹
      };
    }

    // Wolt
    if ('unit_price' in payload && 'unit_info' in payload) {
      const priceKzt = Number(payload.price) / 100;
      const oldPrice =
        payload.original_price != null
          ? Number(payload.original_price) / 100
          : null;

      const unitInfo: string = payload.unit_info ?? '';
      let unitQty: number | null = null;
      let unit: string | null = null;
      const m = unitInfo.match(/^(\d+(?:[.,]\d+)?)\s*(.+)$/);
      if (m) {
        unitQty = Number(m[1].replace(',', '.'));
        unit = m[2];
      } else {
        unit = unitInfo || null;
      }

      const attrs: Record<string, any> = {};
      if (unitQty != null && unit) {
        attrs.volumeValue = unitQty;
        attrs.volumeUnit = unit;
      }

      return {
        title: payload.name,
        brand: null,
        unit,
        unitQty,
        categoryPath: [],
        merchantName: 'Wolt',
        merchantSku: String(payload.id),
        url: '',
        price: priceKzt,
        oldPrice,
        currency: 'KZT',
        extra: payload,
        attributes: Object.keys(attrs).length ? attrs : null, // 🔹
      };
    }

    throw new Error('Unknown external product format');
  }
}
