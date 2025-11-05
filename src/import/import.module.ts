import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WoltImportService } from './sources/wolt-import.service';
import { ImportService } from './import.service';
import { OffersService } from 'src/offers/offers.service';
import { User } from 'src/users/entities/user.entity';
import { Offer } from 'src/offers/entities/offer.entity';
import { LocationsService } from 'src/locations/locations.service';
import { ModerationService } from 'src/moderation/moderation.service';
import { Location } from 'src/locations/location.entity';
import { OfferChannel } from 'src/offer-channels/offer-channel.entity';
import { ModerationLog } from 'src/moderation/moderation-log.entity';
import { ImportsController } from './import.controller';

@Module({
    imports: [TypeOrmModule.forFeature([Offer, Location, User, OfferChannel, ModerationLog])],
    providers: [ImportService, WoltImportService, OffersService, LocationsService, ModerationService],
    exports: [ImportService],
    controllers: [ImportsController],
})
export class ImportModule { }
