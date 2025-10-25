// src/deals/deals.module.ts
import { Module } from '@nestjs/common';
import { DealsService } from './deals.service';
import { DealsController } from './deals.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule], // чтобы был доступ к JwtAuthGuard
  controllers: [DealsController],
  providers: [DealsService],
})
export class DealsModule {}
