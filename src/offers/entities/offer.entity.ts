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
import { OfferChannel } from 'src/offer-channels/offer-channel.entity';

export enum OfferStatus {
  DRAFT = 'DRAFT', // черновик
  ACTIVE = 'ACTIVE', // активный
  ARCHIVE = 'ARCHIVE', // архив
  DELETED = 'DELETED', // удалённый
  PENDING = 'PENDING', // на проверке
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

  @ManyToMany(() => OfferChannel, { eager: true })
  @JoinTable({
    name: 'offer_channel_links',
    joinColumn: { name: 'offerId', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'channelId', referencedColumnName: 'id' },
  })
  channels: OfferChannel[];

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
