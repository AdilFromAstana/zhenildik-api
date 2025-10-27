// src/offers/offers.module.ts
import { Module } from '@nestjs/common';
import { OffersController } from './offers.controller';
import { OffersService } from './offers.service';
import { AuthModule } from '../auth/auth.module'; // 👈 добавляем

@Module({
  imports: [AuthModule], // 👈 теперь OffersModule видит JwtService и JwtAuthGuard
  controllers: [OffersController],
  providers: [OffersService],
})
export class OffersModule {}
