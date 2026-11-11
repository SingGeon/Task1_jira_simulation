import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../common/entities/base.entity';
import { Project } from '../projects/project.entity';
import { Role } from '../roles/role.entity';
import { User } from '../users/user.entity';

export enum JoinRequestStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

/**
 * A user's self-service request to join a project with a given role.
 * An admin approves (creates the ProjectMember) or rejects it.
 */
@Entity('join_requests')
// A user may have at most one pending request per project.
@Index('uq_join_request_one_pending_per_project_user', ['projectId', 'userId'], {
  unique: true,
  where: `"status" = 'PENDING'`,
})
export class JoinRequest extends BaseEntity {
  @Column('uuid')
  projectId: string;

  @ManyToOne(() => Project, { onDelete: 'CASCADE' })
  @JoinColumn()
  project: Project;

  @Column('uuid')
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn()
  user: User;

  /** Role requested by the user; applied as-is if an admin approves. */
  @Column('uuid')
  roleId: string;

  @ManyToOne(() => Role, { onDelete: 'RESTRICT' })
  @JoinColumn()
  role: Role;

  @Column({ type: 'text', default: '' })
  message: string;

  @Column({ type: 'enum', enum: JoinRequestStatus, default: JoinRequestStatus.PENDING })
  status: JoinRequestStatus;

  @Column('uuid', { nullable: true })
  decidedById: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn()
  decidedBy: User | null;

  @Column({ type: 'timestamptz', nullable: true })
  decidedAt: Date | null;
}
