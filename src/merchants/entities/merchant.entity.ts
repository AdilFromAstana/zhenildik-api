import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
// merchants/entities/merchant.entity.ts
@Entity()
export class Merchant {
  @PrimaryGeneratedColumn() id: number;
  @Column() name: string;
  @Column() website: string;
  @Column({ nullable: true }) logo: string | null; // ← вот так
}
