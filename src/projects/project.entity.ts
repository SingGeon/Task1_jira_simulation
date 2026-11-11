import { Column, Entity, Index, OneToMany } from 'typeorm';
import { BaseEntity } from '../common/entities/base.entity';
import { ProjectMember } from './project-member.entity';

export enum BoardType {
  SCRUM = 'SCRUM', // board shows the active sprint; work is planned in sprints
  KANBAN = 'KANBAN', // board shows every task; continuous flow, no sprints
}

/**
 * Mirrors Jira's "Company-managed" vs "Team-managed" distinction.
 * COMPANY: only an admin can create one (org-standard project).
 * TEAM: any authenticated user can create one (if TEAM_PROJECTS_ENABLED) and
 * automatically becomes its Project Manager.
 */
export enum ProjectManagement {
  COMPANY = 'COMPANY',
  TEAM = 'TEAM',
}

@Entity('projects')
export class Project extends BaseEntity {
  /** Short uppercase key used as task prefix, e.g. "WEB" -> WEB-1, WEB-2 */
  @Index({ unique: true })
  @Column({ length: 10 })
  key: string;

  @Column({ length: 120 })
  name: string;

  @Column({ type: 'text', default: '' })
  description: string;

  @Column({ type: 'enum', enum: BoardType, default: BoardType.SCRUM })
  boardType: BoardType;

  @Column({ type: 'enum', enum: ProjectManagement, default: ProjectManagement.TEAM })
  management: ProjectManagement;

  /** Monotonic counter for task numbers (never reused, even after deletions). */
  @Column({ type: 'int', default: 0 })
  taskCounter: number;

  @OneToMany(() => ProjectMember, (m) => m.project)
  members: ProjectMember[];
}
