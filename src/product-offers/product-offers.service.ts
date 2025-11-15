// src/product-offers/product-offers.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { ProductOffer } from './product-offer.entity';
import { Product } from 'src/products/entities/product.entity';
import { Merchant } from 'src/merchants/entities/merchant.entity';
import { PriceHistory } from 'src/price-history/entities/price-history.entity';

interface ExternalPricePayload {
  merchantSku: string;
  url: string;
  unitPrice: number;
  unitSalePrice?: number | null;
  raw?: any;
}

@Injectable()
export class ProductOffersService {
  constructor(
    @InjectRepository(ProductOffer)
    private readonly offerRepo: Repository<ProductOffer>,
    @InjectRepository(PriceHistory)
    private readonly historyRepo: Repository<PriceHistory>,
  ) {}

  async upsertFromExternal(
    product: Product,
    merchant: Merchant,
    payload: ExternalPricePayload,
  ): Promise<ProductOffer> {
    const newPrice = payload.unitSalePrice ?? payload.unitPrice;
    const oldPrice =
      payload.unitSalePrice && payload.unitSalePrice < payload.unitPrice
        ? payload.unitPrice
        : null;

    const discountPercent =
      oldPrice && oldPrice > newPrice
        ? Math.round(((oldPrice - newPrice) / oldPrice) * 100)
        : 0;

    let offer = await this.offerRepo.findOne({
      where: { merchant, merchantSku: payload.merchantSku },
      relations: ['history'],
    });

    if (!offer) {
      offer = this.offerRepo.create({
        product,
        merchant,
        merchantSku: payload.merchantSku,
        url: payload.url,
        currentPrice: newPrice,
        currentOldPrice: oldPrice,
        currentDiscountPercent: discountPercent,
        isAvailable: true,
        lastSeenAt: new Date(),
        extra: payload.raw ?? null,
      });

      await this.offerRepo.save(offer);

      await this.historyRepo.save(
        this.historyRepo.create({
          offer,
          capturedAt: new Date(),
          price: newPrice,
          oldPrice: oldPrice,
          discountPercent,
        }),
      );

      return offer;
    }

    const latest = offer.history?.sort(
      (a, b) => b.capturedAt.getTime() - a.capturedAt.getTime(),
    )[0];

    const priceChanged =
      !latest ||
      Number(latest.price) !== newPrice ||
      (latest.oldPrice != null ? Number(latest.oldPrice) : null) !== oldPrice;

    if (priceChanged) {
      await this.historyRepo.save(
        this.historyRepo.create({
          offer,
          capturedAt: new Date(),
          price: newPrice,
          oldPrice: oldPrice,
          discountPercent,
        }),
      );
    }

    offer.currentPrice = newPrice;
    offer.currentOldPrice = oldPrice;
    offer.currentDiscountPercent = discountPercent;
    offer.lastSeenAt = new Date();
    offer.extra = payload.raw ?? offer.extra;

    return this.offerRepo.save(offer);
  }
}
