// src/offers/offers.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OffersService } from './offers.service';
import { OffersController } from './offers.controller';
import { Offer } from './entities/offer.entity';
import { AuthModule } from '../auth/auth.module';
import { LocationsModule } from 'src/locations/locations.module';
import { ModerationModule } from 'src/moderation/moderation.module';

@Module({
  imports: [TypeOrmModule.forFeature([Offer]), AuthModule, LocationsModule, ModerationModule],
  providers: [OffersService],
  controllers: [OffersController],
})
export class OffersModule { }
