import { Controller, Get, Post } from '@nestjs/common';
import { OfferChannelsService } from './offer-channels.service';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('Offer Channels')
@Controller('offer-channels')
export class OfferChannelsController {
  constructor(private readonly service: OfferChannelsService) {}

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Post('seed')
  seed() {
    return this.service.seedDefaultChannels();
  }
}
