// src/offers/offers.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OffersService } from './offers.service';
import { OffersController } from './offers.controller';
import { Offer } from './entities/offer.entity';
import { AuthModule } from '../auth/auth.module'; // ← добавьте этот импорт

@Module({
  imports: [
    TypeOrmModule.forFeature([Offer]),
    AuthModule, // ← добавьте эту строку
  ],
  providers: [OffersService],
  controllers: [OffersController],
})
export class OffersModule { }