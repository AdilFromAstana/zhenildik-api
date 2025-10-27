import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CategoriesModule } from './categories/categories.module';
import { CitiesModule } from './cities/cities.module';
import { DistrictsModule } from './districts/districts.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { OfferTypeModule } from './offer-type/offer-type.module';
import { OffersModule } from './offers/offers.module';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: 'localhost',
      port: 5432,
      username: 'postgres',
      password: 'postgres',
      database: 'zhenildik',
      autoLoadEntities: true,
      synchronize: true,
    }),
    CategoriesModule,
    CitiesModule,
    DistrictsModule,
    AuthModule,
    UsersModule,
    OfferTypeModule,
    OffersModule,
  ],
})
export class AppModule {}
