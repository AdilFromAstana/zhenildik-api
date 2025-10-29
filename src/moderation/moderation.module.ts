import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ModerationLog } from './moderation-log.entity';
import { ModerationService } from './moderation.service';

@Module({
    imports: [TypeOrmModule.forFeature([ModerationLog])],
    providers: [ModerationService],
    exports: [ModerationService],
})
export class ModerationModule { }
