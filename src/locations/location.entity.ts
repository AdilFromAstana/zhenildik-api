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

  @Column({ nullable: true })
  name: string;

  @Column({
    type: 'geography',
    spatialFeatureType: 'Point',
    srid: 4326,
    nullable: true,
  }) 
  geom?: string;

  @Column({ nullable: true })
  fullAddress: string;

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

  @Column({ type: 'json', nullable: true })
  workingHours?: Record<string, { open: string; close: string } | null>;

  @ManyToMany(() => Offer, (offer) => offer.locations)
  offers: Offer[];

  @Column()
  createdByUserId: number;

  @ManyToOne(() => User, (user) => user.locations, { onDelete: 'CASCADE' })
  user: User;
}
