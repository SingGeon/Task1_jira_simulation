import { Column, Entity, JoinColumn, ManyToOne, Unique } from 'typeorm';
import { BaseEntity } from '../common/entities/base.entity';
import { Project } from './project.entity';
import { User } from '../users/user.entity';
import { Role } from '../roles/role.entity';

/** A user's membership in a project, with the role they have *in that project*. */
@Entity('project_members')
@Unique(['projectId', 'userId'])
export class ProjectMember extends BaseEntity {
  @Column('uuid')
  projectId: string;

  @ManyToOne(() => Project, (p) => p.members, { onDelete: 'CASCADE' })
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
}
