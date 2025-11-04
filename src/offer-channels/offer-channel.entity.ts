import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';

@Entity('offer_channels')
export class OfferChannel {
  @ApiProperty()
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty({ example: 'IN_STORE' })
  @Column({ unique: true })
  code: string; // внутренний код (ENUM-подобный)

  @ApiProperty({ example: 'На месте (в магазине)' })
  @Column()
  name: string; // название для пользователя

  @ApiProperty({ example: 'Можно воспользоваться в точке продаж' })
  @Column({ nullable: true })
  description?: string;

  @ApiProperty({ example: 'store' })
  @Column({ nullable: true })
  category?: string; // группа: 'offline' | 'app' | 'messenger' и т.д.

  @ApiProperty({ example: 'https://wolt.com' })
  @Column({ nullable: true })
  defaultLink?: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
