import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

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
    type: 'boolean',
    default: false,
  })
  isVerified: boolean;

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
}
