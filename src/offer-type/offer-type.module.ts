import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OfferType } from './entities/offer-type.entity';
import { OfferTypeService } from './offer-type.service';
import { OfferTypeController } from './offer-type.controller';

@Module({
  imports: [TypeOrmModule.forFeature([OfferType])],
  controllers: [OfferTypeController],
  providers: [OfferTypeService],
  exports: [OfferTypeService],
})
export class OfferTypeModule {}
