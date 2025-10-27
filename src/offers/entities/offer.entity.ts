// src/offers/entities/offer.entity.ts

import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

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

  @Column()
  hasMinPrice: boolean;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  minPrice: number | null;

  @Column()
  hasConditions: boolean;

  // ✅ Вот так правильно:
  @Column({ nullable: true })
  conditions?: string;

  @Column()
  hasEndDate: boolean;

  @Column({ type: 'timestamp', nullable: true })
  startDate?: Date;

  @Column({ type: 'timestamp', nullable: true })
  endDate?: Date;

  @Column('simple-array') // или @Column({ type: 'text', array: true }) если массив
  posters: string[];

  @Column()
  createdByUserId: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}