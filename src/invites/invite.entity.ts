import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../common/entities/base.entity';
import { Project } from '../projects/project.entity';
import { Role } from '../roles/role.entity';
import { User } from '../users/user.entity';

export enum InviteStatus {
  PENDING = 'PENDING',
  ACCEPTED = 'ACCEPTED',
  DECLINED = 'DECLINED',
}

/**
 * A direct invite from a project (someone with project.members.manage) to a specific
 * account, for a specific role. The invitee accepts or declines — the inverse direction
 * of JoinRequest, where the *user* initiates and an admin decides.
 */
@Entity('project_invites')
@Index('uq_invite_one_pending_per_project_user', ['projectId', 'userId'], {
  unique: true,
  where: `"status" = 'PENDING'`,
})
export class ProjectInvite extends BaseEntity {
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

  @Column('uuid')
  roleId: string;

  @ManyToOne(() => Role, { onDelete: 'RESTRICT' })
  @JoinColumn()
  role: Role;

  @Column('uuid')
  invitedById: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn()
  invitedBy: User;

  @Column({ type: 'enum', enum: InviteStatus, default: InviteStatus.PENDING })
  status: InviteStatus;

  @Column({ type: 'timestamptz', nullable: true })
  respondedAt: Date | null;
}
