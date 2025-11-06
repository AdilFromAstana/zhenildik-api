// src/offers/entities/offer.entity.ts
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
  Index,
} from 'typeorm';
import { User } from 'src/users/entities/user.entity';
import { Category } from 'src/categories/category.entity';
import { Location } from 'src/locations/location.entity';
import { BenefitKind } from '../enums/benefit-kind.enum';
import { OfferScope } from '../enums/offer-scope.enum';
import { OfferChannelCode } from 'src/offer-channels/offer-channel.enum';

export enum OfferStatus {
  DRAFT = 'DRAFT', // черновик
  ACTIVE = 'ACTIVE', // активный
  ARCHIVE = 'ARCHIVE', // архив
  DELETED = 'DELETED', // удалённый
  PENDING = 'PENDING', // на проверке
}

@Entity('offers')
@Index(['status', 'cityCode'])
@Index(['benefitKind', 'scope'])
@Index(['categoryId'])
export class Offer {
  @PrimaryGeneratedColumn()
  id: number;

  // Базовые поля карточки
  @Column() title: string;
  @Column({ type: 'text' }) description: string;

  @Column({ nullable: true })
  categoryId: number | null;

  @ManyToOne(() => Category, { eager: true, nullable: true })
  @JoinColumn({ name: 'categoryId' })
  category?: Category | null;

  @Column({ type: 'varchar', length: 8, nullable: true })
  cityCode: string | null;

  // Нормализованные поля выгоды
  @Column({ type: 'enum', enum: BenefitKind })
  benefitKind: BenefitKind;

  @Column({ type: 'enum', enum: OfferScope })
  scope: OfferScope;

  // Канонизированные ценовые поля
  @Column({ type: 'numeric', precision: 12, scale: 2, nullable: true })
  oldPrice: string | null; // хранить как string для точности

  @Column({ type: 'numeric', precision: 12, scale: 2, nullable: true })
  newPrice: string | null;

  @Column({ type: 'numeric', precision: 12, scale: 2, nullable: true })
  discountAmount: string | null; // абсолютная выгода

  @Column({ type: 'numeric', precision: 5, scale: 2, nullable: true })
  discountPercent: string | null; // 0..100

  // BUY_X_GET_Y
  @Column({ type: 'int', nullable: true })
  buyQty: number | null;

  @Column({ type: 'int', nullable: true })
  getQty: number | null;

  // TRADE_IN
  @Column({ type: 'boolean', nullable: true })
  tradeInRequired: boolean | null;

  // Условия доступа (eligibility)
  @Column({ type: 'jsonb', nullable: true })
  eligibility: Record<string, any> | null;

  // Кампания — как метка/контейнер (не «тип выгоды»)
  @Column({ type: 'varchar', length: 64, nullable: true })
  campaignId: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  campaignName: string | null;

  // Сроки
  @Column({ type: 'timestamptz', nullable: true }) startDate: Date | null;
  @Column({ type: 'timestamptz', nullable: true }) endDate: Date | null;

  // Медиa
  @Column('text', { array: true, default: '{}' }) posters: string[];

  // Привязки
  @ManyToMany(() => Location, (location) => location.offers, { cascade: true })
  @JoinTable({
    name: 'offer_locations',
    joinColumn: { name: 'offerId', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'locationId', referencedColumnName: 'id' },
  })
  locations: Location[];

  @ManyToOne(() => User, (u) => u.offers, { onDelete: 'CASCADE', eager: false })
  user: User;

  @Column() createdByUserId: number;

  @Column() locationId: number;

  // Статус
  @Column({ type: 'varchar', length: 16, default: 'PENDING' })
  status: 'DRAFT' | 'ACTIVE' | 'ARCHIVE' | 'DELETED' | 'PENDING';

  @Column('text', { array: true, default: '{}' })
  channels: OfferChannelCode[];

  // Главный канал/CTA и ссылка
  @Column({ type: 'varchar', length: 64, nullable: true })
  primaryChannel: OfferChannelCode | null;

  @Column({ type: 'text', nullable: true })
  ctaUrl: string | null;

  // Откуда пришёл оффер (для трекинга импорта/модерации/повторов)
  @Column({ type: 'varchar', length: 16, default: 'MANUAL' })
  sourceSystem: 'MANUAL' | 'WOLT' | 'KASPI' | 'IMPORT';

  @Column({ type: 'text', nullable: true })
  sourceUrl: string | null;

  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
