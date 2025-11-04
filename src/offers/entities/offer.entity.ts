// src/offers/entities/offer.entity.ts

import { Category } from 'src/categories/category.entity';
import { OfferType } from 'src/offer-type/entities/offer-type.entity';
import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  ManyToMany,
  JoinTable,
} from 'typeorm';
import { Location } from '../../locations/location.entity';
import { User } from 'src/users/entities/user.entity';

export enum OfferStatus {
  DRAFT = 'DRAFT', // черновик
  ACTIVE = 'ACTIVE', // активный
  ARCHIVE = 'ARCHIVE', // архив
  DELETED = 'DELETED', // удалённый
  PENDING = 'PENDING', // на проверке
}

export enum OfferChannelCode {
  IN_STORE = 'IN_STORE', // В магазине, на месте
  WEBSITE = 'WEBSITE', // На сайте магазина
  APP_WOLT = 'APP_WOLT', // Приложение Wolt
  APP_KASPI = 'APP_KASPI', // Приложение Kaspi
  APP_YANDEX_EDA = 'APP_YANDEX_EDA', // Приложение Yandex.Eda
  APP_OTHER = 'APP_OTHER', // Другое приложение
  MESSENGER_WHATSAPP = 'MESSENGER_WHATSAPP', // Через WhatsApp
  MESSENGER_TELEGRAM = 'MESSENGER_TELEGRAM', // Через Telegram
  MARKETPLACE = 'MARKETPLACE', // На маркетплейсе (Lamoda, OLX и т.п.)
  PHONE = 'PHONE', // По телефону
  SOCIAL_INSTAGRAM = 'SOCIAL_INSTAGRAM', // Через Instagram
  SOCIAL_TIKTOK = 'SOCIAL_TIKTOK', // Через TikTok
  OTHER = 'OTHER', // Другое
}

@Entity('offers')
export class Offer {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  title: string;

  @Column()
  description: string;

  @Column()
  offerTypeCode: string;

  @Column({ nullable: true })
  categoryId: number;

  @Column({
    type: 'simple-array',
    nullable: true,
  })
  channels: OfferChannelCode[];

  @ManyToOne(() => OfferType, { eager: true })
  @JoinColumn({ name: 'offerTypeCode', referencedColumnName: 'code' })
  offerType: OfferType;

  @ManyToOne(() => Category, { eager: true })
  @JoinColumn({ name: 'categoryId' })
  category: Category;

  @Column({ nullable: true })
  cityCode: string;

  @Column()
  hasMinPrice: boolean;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  minPrice?: number;

  @Column()
  hasConditions: boolean;

  @Column({ nullable: true })
  conditions?: string;

  @Column()
  hasEndDate: boolean;

  @Column({ type: 'timestamp', nullable: true })
  startDate?: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  endDate?: Date | null;

  @Column('simple-array')
  posters: string[];

  @Column()
  createdByUserId: number;

  @Column({ type: 'enum', enum: OfferStatus, default: OfferStatus.DRAFT })
  status: OfferStatus;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToMany(() => Location, (location) => location.offers, { cascade: true })
  @JoinTable({
    name: 'offer_locations',
    joinColumn: { name: 'offerId', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'locationId', referencedColumnName: 'id' },
  })
  locations: Location[];

  @ManyToOne(() => User, (user) => user.offers, { onDelete: 'CASCADE' })
  user: User;
}
