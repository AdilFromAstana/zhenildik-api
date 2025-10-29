import { Offer } from 'src/offers/entities/offer.entity';
import { User } from 'src/users/entities/user.entity';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToMany,
  ManyToOne,
} from 'typeorm';

@Entity('locations')
export class Location {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  city: string;

  @Column()
  district: string;

  @Column()
  street: string;

  @Column()
  houseNumber: string;

  @Column({ nullable: true })
  residentialComplex?: string;

  @Column({ nullable: true })
  phone?: string;

  @Column({ type: 'float' })
  latitude: number;

  @Column({ type: 'float' })
  longitude: number;

  // ⏰ JSON-поле для хранения расписания
  @Column({ type: 'json', nullable: true })
  workingHours?: Record<string, { open: string; close: string } | null>;

  @ManyToMany(() => Offer, (offer) => offer.locations)
  offers: Offer[];

  @Column()
  createdByUserId: number;

  @ManyToOne(() => User, (user) => user.locations, { onDelete: 'CASCADE' })
  user: User;
}
