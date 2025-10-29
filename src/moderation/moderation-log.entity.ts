import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('moderation_logs')
export class ModerationLog {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ type: 'text' })
    inputText: string;

    @Column({ type: 'varchar', length: 100 })
    context: string; // Например: "offer", "comment", "review"

    @Column({ type: 'jsonb', nullable: true })
    aiResponse: any;

    @Column({ type: 'boolean' })
    isFlagged: boolean;

    @Column({ type: 'text', nullable: true })
    reason: string;

    @CreateDateColumn()
    createdAt: Date;
}
