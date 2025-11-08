import { Entity, Column, PrimaryGeneratedColumn, OneToMany, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { Location } from 'src/locations/location.entity';
import { Offer } from 'src/offers/entities/offer.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    type: 'varchar',
    length: 255,
    nullable: true,
    unique: true,
  })
  email: string | null;

  @Column({
    type: 'varchar',
    length: 32,
    nullable: true,
    unique: true,
  })
  phone: string | null;

  @Column({
    type: 'varchar',
    length: 255,
  })
  passwordHash: string;

  @Column({
    type: 'varchar',
    length: 255,
    nullable: true,
    unique: true,
  })
  slug: string | null;


  @Column({
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  name: string | null;

  @Column({
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  avatar: string | null;

  @Column({
    type: 'boolean',
    default: false,
  })
  isBusiness: boolean;

  @Column({
    type: 'boolean',
    default: false,
  })
  isVerified: boolean;

  @Column({ type: 'varchar', length: 500, nullable: true })
  website: string | null; // 🌐 важно для Wolt-брендов

  @Column({
    type: 'varchar',
    length: 6,
    nullable: true,
  })
  pendingOtpCode: string | null;

  @Column({
    type: 'timestamptz',
    nullable: true,
  })
  pendingOtpExpiresAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => Location, (location) => location.user)
  locations: Location[];

  @OneToMany(() => Offer, (offer) => offer.user)
  offers: Offer[];
}
