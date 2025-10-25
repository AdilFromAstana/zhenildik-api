import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { City } from '../cities/city.entity';

@Entity('districts')
export class District {
  @ApiProperty({ example: 10 })
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty({ example: 'Есильский район' })
  @Column()
  name: string;

  @ApiProperty({ example: 'esil' })
  @Column({ unique: false })
  slug: string;

  @ApiProperty({ example: 1, description: 'ID города' })
  @Column()
  cityId: number;

  @ManyToOne(() => City, (city) => city.districts, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'cityId' })
  city: City;
}
