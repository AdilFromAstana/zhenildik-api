import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
} from 'typeorm';

@Entity('categories')
export class Category {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  slug: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  icon?: string;

  @ManyToOne(() => Category, (category) => category.children, {
    nullable: true,
    onDelete: 'CASCADE',
  })
  parent: Category | null; // 👈 обязательно null

  @OneToMany(() => Category, (category) => category.parent)
  children: Category[];
}
