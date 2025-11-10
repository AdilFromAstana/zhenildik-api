import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CategoriesModule } from './categories/categories.module';
import { CitiesModule } from './cities/cities.module';
import { DistrictsModule } from './districts/districts.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { OfferTypeModule } from './offer-type/offer-type.module';
import { OffersModule } from './offers/offers.module';
import { LocationsModule } from './locations/locations.module';
import { ModerationModule } from './moderation/moderation.module';
import { OfferChannelsModule } from './offer-channels/offer-channels.module';
import { ImportModule } from './import/import.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get<string>('DB_HOST'),
        port: config.get<number>('DB_PORT'),
        username: config.get<string>('DB_USER'),
        password: config.get<string>('DB_PASS'),
        database: config.get<string>('DB_NAME'),
        autoLoadEntities: true,
        synchronize: true,
      }),
    }),
    CategoriesModule,
    CitiesModule,
    DistrictsModule,
    AuthModule,
    UsersModule,
    OfferTypeModule,
    OffersModule,
    LocationsModule,
    ModerationModule,
    OfferChannelsModule,
    ImportModule,
  ],
})
export class AppModule { }
