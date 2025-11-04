import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OfferChannel } from './offer-channel.entity';
import { OfferChannelsService } from './offer-channels.service';
import { OfferChannelsController } from './offer-channels.controller';

@Module({
  imports: [TypeOrmModule.forFeature([OfferChannel])],
  controllers: [OfferChannelsController],
  providers: [OfferChannelsService],
  exports: [OfferChannelsService],
})
export class OfferChannelsModule {}
