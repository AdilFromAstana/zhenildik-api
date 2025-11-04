import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OfferChannel } from './offer-channel.entity';

@Injectable()
export class OfferChannelsService {
  constructor(
    @InjectRepository(OfferChannel)
    private readonly repo: Repository<OfferChannel>,
  ) {}

  findAll(): Promise<OfferChannel[]> {
    return this.repo.find();
  }

  async seedDefaultChannels() {
    const defaults = [
      { code: 'IN_STORE', name: 'В магазине', category: 'offline' },
      { code: 'WEBSITE', name: 'На сайте магазина', category: 'online' },
      { code: 'APP_WOLT', name: 'Через приложение Wolt', category: 'app' },
      { code: 'APP_KASPI', name: 'Через приложение Kaspi', category: 'app' },
      {
        code: 'MESSENGER_WHATSAPP',
        name: 'Через WhatsApp',
        category: 'messenger',
      },
      {
        code: 'MESSENGER_TELEGRAM',
        name: 'Через Telegram',
        category: 'messenger',
      },
      { code: 'MARKETPLACE', name: 'На маркетплейсе', category: 'marketplace' },
      { code: 'PHONE', name: 'По телефону', category: 'offline' },
      { code: 'SOCIAL_INSTAGRAM', name: 'Через Instagram', category: 'social' },
      { code: 'SOCIAL_TIKTOK', name: 'Через TikTok', category: 'social' },
    ];

    for (const item of defaults) {
      const exists = await this.repo.findOne({ where: { code: item.code } });
      if (!exists) await this.repo.save(item);
    }

    return this.repo.find();
  }
}
