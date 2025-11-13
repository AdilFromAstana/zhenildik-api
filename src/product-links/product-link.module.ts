import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductLink } from './entities/product-link.entity';
import { ProductLinksService } from './product-link.service';
import { ProductLinksController } from './product-link.controller';

@Module({
  imports: [TypeOrmModule.forFeature([ProductLink])],
  controllers: [ProductLinksController],
  providers: [ProductLinksService],
  exports: [ProductLinksService],
})
export class ProductLinkModule {}
