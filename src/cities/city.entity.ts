import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { District } from '../districts/district.entity';

@Entity('cities')
export class City {
  @ApiProperty({ example: 1 })
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty({ example: 'Астана' })
  @Column({ unique: true })
  name: string;

  @ApiProperty({ example: 'astana' })
  @Column({ unique: true })
  slug: string;

  @ApiProperty({ example: 'Казахстан' })
  @Column({ default: 'Казахстан' })
  country: string;

  @ApiProperty({ example: true, description: 'Есть ли у города районы' })
  @Column({ default: false })
  hasDistricts: boolean;

  @OneToMany(() => District, (district) => district.city)
  districts: District[];
}
