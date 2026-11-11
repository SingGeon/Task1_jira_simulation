import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { User } from '../users/user.entity';

/**
 * One row per issued refresh token (= one "session"). The raw token is never stored, only its
 * hash, so a leaked database dump can't be replayed as a session. `userId` cascades on user
 * deletion — unlike tasks/comments, a session isn't audit history worth keeping.
 */
@Entity('refresh_tokens')
export class RefreshToken {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column('uuid')
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn()
  user: User;

  @Index({ unique: true })
  @Column({ length: 64 })
  tokenHash: string;

  @Column({ type: 'varchar', length: 300, nullable: true })
  userAgent: string | null;

  @Column({ type: 'timestamptz' })
  expiresAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  revokedAt: Date | null;

  @Column({ type: 'timestamptz' })
  createdAt: Date;
}
