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
} from 'typeorm';

export enum OfferStatus {
  DRAFT = 'DRAFT',       // черновик
  ACTIVE = 'ACTIVE',     // активный
  ARCHIVE = 'ARCHIVE',   // архив
  DELETED = 'DELETED',   // удалённый
  PENDING = 'PENDING',   // на проверке
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

  @ManyToOne(() => OfferType, { eager: true })
  @JoinColumn({ name: 'offerTypeCode', referencedColumnName: 'code' })
  offerType: OfferType;

  @ManyToOne(() => Category, { eager: true })
  @JoinColumn({ name: 'categoryId' })
  category: Category;

  @Column()
  hasMinPrice: boolean;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  minPrice?: number;

  @Column()
  hasConditions: boolean;

  // ✅ Вот так правильно:
  @Column({ nullable: true })
  conditions?: string;

  @Column()
  hasEndDate: boolean;

  @Column({ type: 'timestamp', nullable: true })
  startDate?: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  endDate?: Date | null;

  @Column('simple-array') // или @Column({ type: 'text', array: true }) если массив
  posters: string[];

  @Column()
  createdByUserId: number;

  @Column({ type: 'enum', enum: OfferStatus, default: OfferStatus.DRAFT })
  status: OfferStatus;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
